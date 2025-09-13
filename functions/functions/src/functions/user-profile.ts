import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { getUsersCollection } from '../lib/mongodb'
import { Subject } from '../types/user'

// Define MongoDB secret
const mongodbUri = defineSecret('MONGODB_URI');

/**
 * Initialize a new user with default onboarding status
 * Implements robust error handling and state validation
 */
export const initializeUser = onCall({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid, email, name } = auth.token
  
  console.log(`[initializeUser] Called for UID: ${uid}, name: ${name}, email: ${email}`)
  
  try {
    // First, verify Firebase Auth user exists and is valid
    try {
      await admin.auth().getUser(uid)
    } catch (authError) {
      console.error(`[initializeUser] Firebase Auth user ${uid} not found:`, authError)
      throw new Error('Firebase Auth user not found')
    }

    // Check MongoDB connection before proceeding
    const usersCollection = await getUsersCollection()
    
    // Check if user already exists in MongoDB
    const existingUser = await usersCollection.findOne({ firebaseUid: uid })
    
    if (existingUser) {
      const existingDisplayName = existingUser.profile.displayName
      
      // Update display name if the new one is more specific (not a fallback)
      if (name && existingDisplayName !== name) {
        console.log(`[initializeUser] Updating display name from "${existingDisplayName}" to "${name}" for UID: ${uid}`)
        await usersCollection.updateOne(
          { firebaseUid: uid },
          {
            $set: {
              'profile.displayName': name,
              'profile.updatedAt': new Date()
            }
          }
        )
        
        // Ensure Firebase custom claims are set correctly
        await admin.auth().setCustomUserClaims(uid, { 
          isOnboarded: existingUser.profile.isOnboarded 
        })
        
        return {
          success: true,
          message: 'User display name updated',
          isOnboarded: existingUser.profile.isOnboarded
        }
      } else {
        console.log(`[initializeUser] User ${uid} already exists with display name "${existingDisplayName}", no update needed`)
        
        // Ensure Firebase custom claims are set correctly
        await admin.auth().setCustomUserClaims(uid, { 
          isOnboarded: existingUser.profile.isOnboarded 
        })
        
        return {
          success: true,
          message: 'User already initialized',
          isOnboarded: existingUser.profile.isOnboarded
        }
      }
    }
    
    console.log(`[initializeUser] Creating new user for UID: ${uid}`)
    
    const user = {
      firebaseUid: uid,
      profile: {
        displayName: name || email?.split('@')[0] || 'User',
        email: email || '',
        isOnboarded: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      subjects: [] // Initialize with empty subjects array
    }
    
    // Insert new user document with transaction-like behavior
    const insertResult = await usersCollection.insertOne(user)
    
    if (!insertResult.insertedId) {
      throw new Error('Failed to create user document in MongoDB')
    }
    
    // Only set custom claims after successful MongoDB insertion
    try {
      await admin.auth().setCustomUserClaims(uid, { isOnboarded: false })
    } catch (claimsError) {
      console.error(`[initializeUser] Failed to set custom claims for ${uid}:`, claimsError)
      // Rollback: Remove the MongoDB document we just created
      await usersCollection.deleteOne({ firebaseUid: uid })
      throw new Error('Failed to set Firebase custom claims - user creation rolled back')
    }
    
    console.log(`[initializeUser] User created successfully with _id: ${insertResult.insertedId}`)
    
    return {
      success: true,
      message: 'User initialized successfully',
      isOnboarded: false
    }
  } catch (error) {
    console.error('Error initializing user:', error)
    
    // Enhanced error reporting
    if (error instanceof Error) {
      throw new Error(`User initialization failed: ${error.message}`)
    }
    throw new Error('Failed to initialize user due to unknown error')
  }
})

/**
 * Update user profile information
 */
export const updateUserProfile = onCall<{ displayName?: string; email?: string }>({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { displayName, email } = data
  
  console.log(`[updateUserProfile] Called for UID: ${uid}, displayName: ${displayName}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    const updateFields: any = {
      'profile.updatedAt': new Date()
    }
    
    if (displayName !== undefined) updateFields['profile.displayName'] = displayName
    if (email !== undefined) updateFields['profile.email'] = email
    
    const result = await usersCollection.updateOne(
      { firebaseUid: uid },
      { $set: updateFields }
    )
    
    if (result.matchedCount === 0) {
      throw new Error('User not found')
    }
    
    console.log(`[updateUserProfile] Updated profile for UID: ${uid}`)
    
    return {
      success: true,
      message: 'Profile updated successfully'
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    throw new Error('Failed to update profile')
  }
})

/**
 * Get user profile and subjects data with automatic recovery
 */
export const getUserData = onCall({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  
  console.log(`[getUserData] Fetching data for UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    const user = await usersCollection.findOne({ firebaseUid: uid })
    if (!user) {
      console.warn(`[getUserData] User ${uid} not found in MongoDB, attempting recovery`)
      
      // Check if Firebase Auth user exists
      try {
        const firebaseUser = await admin.auth().getUser(uid)
        console.log(`[getUserData] Firebase Auth user exists, creating MongoDB record`)
        
        // Create the missing MongoDB record
        const newUser = {
          firebaseUid: uid,
          profile: {
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            isOnboarded: false,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          subjects: []
        }
        
        const insertResult = await usersCollection.insertOne(newUser)
        
        // Set custom claims
        await admin.auth().setCustomUserClaims(uid, { isOnboarded: false })
        
        console.log(`[getUserData] Recovery successful, created user with _id: ${insertResult.insertedId}`)
        
        return {
          success: true,
          displayName: newUser.profile.displayName,
          email: newUser.profile.email,
          createdAt: newUser.profile.createdAt,
          updatedAt: newUser.profile.updatedAt,
          subjects: [],
          recovered: true
        }
      } catch (authError) {
        console.error(`[getUserData] Firebase Auth user ${uid} also not found:`, authError)
        throw new Error('User not found in both Firebase Auth and MongoDB')
      }
    }
    
    console.log(`[getUserData] Found user with ${user.subjects?.length || 0} subjects`)
    if (user.subjects) {
      user.subjects.forEach((subject: Subject, index: number) => {
        console.log(`[getUserData] Subject ${index}: ${subject.name} with ${subject.files?.length || 0} files`)
      })
    }
    
    // Transform subjects to include proper file count and metadata
    const transformedSubjects = (user.subjects || []).map((subject: Subject) => ({
      name: subject.name,
      createdAt: subject.createdAt,
      fileCount: subject.files ? subject.files.length : 0,
      files: subject.files || []
    }))

    return {
      success: true,
      displayName: user.profile.displayName,
      email: user.profile.email,
      createdAt: user.profile.createdAt,
      updatedAt: user.profile.updatedAt,
      subjects: transformedSubjects
    }
  } catch (error) {
    console.error('Error fetching user data:', error)
    
    if (error instanceof Error) {
      throw new Error(`Failed to fetch user data: ${error.message}`)
    }
    throw new Error('Failed to fetch user data due to unknown error')
  }
})
