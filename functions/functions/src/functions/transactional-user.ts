import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { getUsersCollection, withTransaction } from '../lib/mongodb'

// Define MongoDB secret
const mongodbUri = defineSecret('MONGODB_URI');

/**
 * Transactional user initialization that ensures atomic operations
 * Either both Firebase Auth and MongoDB succeed, or both fail
 */
export const initializeUserTransactional = onCall({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid, email, name } = auth.token
  
  console.log(`[initializeUserTransactional] Called for UID: ${uid}, name: ${name}, email: ${email}`)
  
  try {
    // First, verify Firebase Auth user exists
    let firebaseUser
    try {
      firebaseUser = await admin.auth().getUser(uid)
    } catch (authError) {
      console.error(`[initializeUserTransactional] Firebase Auth user ${uid} not found:`, authError)
      throw new Error('Firebase Auth user not found')
    }

    // Check if user already exists in MongoDB
    const usersCollection = await getUsersCollection()
    const existingUser = await usersCollection.findOne({ firebaseUid: uid })
    
    if (existingUser) {
      // Ensure Firebase custom claims are consistent
      const currentClaims = firebaseUser.customClaims || {}
      const expectedIsOnboarded = existingUser.profile.isOnboarded
      
      if (currentClaims.isOnboarded !== expectedIsOnboarded) {
        await admin.auth().setCustomUserClaims(uid, { 
          ...currentClaims,
          isOnboarded: expectedIsOnboarded 
        })
        console.log(`[initializeUserTransactional] Synced custom claims for existing user ${uid}`)
      }
      
      return {
        success: true,
        message: 'User already initialized',
        isOnboarded: existingUser.profile.isOnboarded
      }
    }
    
    console.log(`[initializeUserTransactional] Creating new user for UID: ${uid}`)
    
    // Use MongoDB transaction for atomic operations
    const result = await withTransaction(async (session) => {
      const user = {
        firebaseUid: uid,
        profile: {
          displayName: name || email?.split('@')[0] || 'User',
          email: email || '',
          isOnboarded: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        subjects: []
      }
      
      // Insert user document within transaction
      const insertResult = await usersCollection.insertOne(user, { session })
      
      if (!insertResult.insertedId) {
        throw new Error('Failed to create user document in MongoDB')
      }
      
      console.log(`[initializeUserTransactional] MongoDB user created with _id: ${insertResult.insertedId}`)
      
      // Set Firebase custom claims - if this fails, transaction will rollback
      try {
        await admin.auth().setCustomUserClaims(uid, { isOnboarded: false })
        console.log(`[initializeUserTransactional] Firebase custom claims set for ${uid}`)
      } catch (claimsError) {
        console.error(`[initializeUserTransactional] Failed to set custom claims for ${uid}:`, claimsError)
        throw new Error('Failed to set Firebase custom claims')
      }
      
      return {
        success: true,
        message: 'User initialized successfully',
        isOnboarded: false,
        userId: insertResult.insertedId
      }
    })
    
    console.log(`[initializeUserTransactional] Transaction completed successfully for ${uid}`)
    return result
    
  } catch (error) {
    console.error(`[initializeUserTransactional] Error for ${uid}:`, error)
    
    // Cleanup: If we have a partial state, try to clean it up
    try {
      const usersCollection = await getUsersCollection()
      const partialUser = await usersCollection.findOne({ firebaseUid: uid })
      
      if (partialUser) {
        console.log(`[initializeUserTransactional] Cleaning up partial MongoDB record for ${uid}`)
        await usersCollection.deleteOne({ firebaseUid: uid })
      }
      
      // Reset Firebase custom claims
      await admin.auth().setCustomUserClaims(uid, {})
      console.log(`[initializeUserTransactional] Cleaned up Firebase custom claims for ${uid}`)
      
    } catch (cleanupError) {
      console.error(`[initializeUserTransactional] Cleanup failed for ${uid}:`, cleanupError)
    }
    
    if (error instanceof Error) {
      throw new Error(`Transactional user initialization failed: ${error.message}`)
    }
    throw new Error('Failed to initialize user due to unknown error')
  }
})

/**
 * Transactional onboarding completion
 * Ensures atomic updates across Firebase Auth and MongoDB
 */
export const completeOnboardingTransactional = onCall<{
  subjects: Array<{
    name: string
    files: Array<{
      name: string
      size: number
      type: string
      data: string
    }>
  }>
}>({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjects } = data
  
  console.log(`[completeOnboardingTransactional] Called for UID: ${uid}, subjects count: ${subjects.length}`)
  
  try {
    // Verify user exists in both systems
    const firebaseUser = await admin.auth().getUser(uid)
    const usersCollection = await getUsersCollection()
    const mongoUser = await usersCollection.findOne({ firebaseUid: uid })
    
    if (!mongoUser) {
      throw new Error('User not found in MongoDB - run initializeUser first')
    }
    
    if (mongoUser.profile.isOnboarded) {
      return {
        success: true,
        message: 'User already onboarded'
      }
    }
    
    // Use transaction for atomic onboarding
    const result = await withTransaction(async (session) => {
      // Process subjects and files
      const processedSubjects = subjects.map(subject => ({
        name: subject.name,
        createdAt: new Date(),
        files: subject.files.map(file => ({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date(),
          processingStatus: 'pending' as const
        }))
      }))
      
      // Update MongoDB within transaction
      const updateResult = await usersCollection.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            'profile.isOnboarded': true,
            'profile.updatedAt': new Date(),
            subjects: processedSubjects
          }
        },
        { session }
      )
      
      if (updateResult.matchedCount === 0) {
        throw new Error('Failed to update user in MongoDB')
      }
      
      // Update Firebase custom claims
      const currentClaims = firebaseUser.customClaims || {}
      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        isOnboarded: true
      })
      
      console.log(`[completeOnboardingTransactional] Successfully onboarded user ${uid}`)
      
      return {
        success: true,
        message: 'Onboarding completed successfully',
        subjectsCreated: processedSubjects.length
      }
    })
    
    return result
    
  } catch (error) {
    console.error(`[completeOnboardingTransactional] Error for ${uid}:`, error)
    
    // Cleanup partial onboarding state
    try {
      const usersCollection = await getUsersCollection()
      await usersCollection.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            'profile.isOnboarded': false,
            'profile.updatedAt': new Date()
          },
          $unset: { subjects: '' }
        }
      )
      
      // Reset Firebase custom claims
      const firebaseUser = await admin.auth().getUser(uid)
      const currentClaims = firebaseUser.customClaims || {}
      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        isOnboarded: false
      })
      
      console.log(`[completeOnboardingTransactional] Cleaned up partial onboarding for ${uid}`)
      
    } catch (cleanupError) {
      console.error(`[completeOnboardingTransactional] Cleanup failed for ${uid}:`, cleanupError)
    }
    
    if (error instanceof Error) {
      throw new Error(`Transactional onboarding failed: ${error.message}`)
    }
    throw new Error('Failed to complete onboarding due to unknown error')
  }
})
