import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { getUsersCollection } from '../lib/mongodb'

// Define MongoDB secret
const mongodbUri = defineSecret('MONGODB_URI');

/**
 * Cleanup function to handle orphaned user states
 * Can be called manually or automatically to fix inconsistent states
 */
export const cleanupOrphanedUsers = onCall({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  // Only allow admin users to run cleanup (you can implement admin check)
  const { uid } = auth.token
  console.log(`[cleanupOrphanedUsers] Called by UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    const results = {
      orphanedFirebaseUsers: 0,
      orphanedMongoUsers: 0,
      recovered: 0,
      errors: [] as string[]
    }

    // Get all Firebase Auth users
    const listUsersResult = await admin.auth().listUsers()
    const firebaseUsers = listUsersResult.users

    // Get all MongoDB users
    const mongoUsers = await usersCollection.find({}).toArray()

    // Find Firebase users without MongoDB records
    for (const firebaseUser of firebaseUsers) {
      const mongoUser = mongoUsers.find(u => u.firebaseUid === firebaseUser.uid)
      
      if (!mongoUser) {
        console.log(`[cleanupOrphanedUsers] Found orphaned Firebase user: ${firebaseUser.uid}`)
        results.orphanedFirebaseUsers++
        
        try {
          // Create MongoDB record for orphaned Firebase user
          const newUser = {
            firebaseUid: firebaseUser.uid,
            profile: {
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              isOnboarded: false,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            subjects: []
          }
          
          await usersCollection.insertOne(newUser)
          await admin.auth().setCustomUserClaims(firebaseUser.uid, { isOnboarded: false })
          
          results.recovered++
          console.log(`[cleanupOrphanedUsers] Recovered Firebase user: ${firebaseUser.uid}`)
        } catch (error) {
          const errorMsg = `Failed to recover Firebase user ${firebaseUser.uid}: ${error}`
          console.error(errorMsg)
          results.errors.push(errorMsg)
        }
      }
    }

    // Find MongoDB users without Firebase Auth records
    for (const mongoUser of mongoUsers) {
      try {
        await admin.auth().getUser(mongoUser.firebaseUid)
      } catch (authError) {
        console.log(`[cleanupOrphanedUsers] Found orphaned MongoDB user: ${mongoUser.firebaseUid}`)
        results.orphanedMongoUsers++
        
        try {
          // Remove orphaned MongoDB record
          await usersCollection.deleteOne({ firebaseUid: mongoUser.firebaseUid })
          console.log(`[cleanupOrphanedUsers] Removed orphaned MongoDB user: ${mongoUser.firebaseUid}`)
        } catch (error) {
          const errorMsg = `Failed to remove orphaned MongoDB user ${mongoUser.firebaseUid}: ${error}`
          console.error(errorMsg)
          results.errors.push(errorMsg)
        }
      }
    }

    console.log(`[cleanupOrphanedUsers] Cleanup complete:`, results)
    
    return {
      success: true,
      message: 'Cleanup completed',
      results
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
    throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

/**
 * Validate and fix a specific user's state
 */
export const validateUserState = onCall<{ targetUserId?: string }>({
  secrets: [mongodbUri],
}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const targetUserId = data?.targetUserId || uid // Default to current user
  
  console.log(`[validateUserState] Validating user: ${targetUserId}`)
  
  try {
    const results = {
      firebaseExists: false,
      mongoExists: false,
      customClaimsSet: false,
      fixed: false,
      actions: [] as string[]
    }

    // Check Firebase Auth
    let firebaseUser
    try {
      firebaseUser = await admin.auth().getUser(targetUserId)
      results.firebaseExists = true
      results.customClaimsSet = !!firebaseUser.customClaims?.isOnboarded
    } catch (authError) {
      console.log(`[validateUserState] Firebase user ${targetUserId} not found`)
    }

    // Check MongoDB
    const usersCollection = await getUsersCollection()
    const mongoUser = await usersCollection.findOne({ firebaseUid: targetUserId })
    results.mongoExists = !!mongoUser

    // Fix inconsistencies
    if (results.firebaseExists && !results.mongoExists) {
      // Create missing MongoDB record
      const newUser = {
        firebaseUid: targetUserId,
        profile: {
          displayName: firebaseUser!.displayName || firebaseUser!.email?.split('@')[0] || 'User',
          email: firebaseUser!.email || '',
          isOnboarded: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        subjects: []
      }
      
      await usersCollection.insertOne(newUser)
      results.actions.push('Created MongoDB record')
      results.fixed = true
    }

    if (results.firebaseExists && results.mongoExists && !results.customClaimsSet) {
      // Set missing custom claims
      await admin.auth().setCustomUserClaims(targetUserId, { 
        isOnboarded: mongoUser!.profile.isOnboarded 
      })
      results.actions.push('Set Firebase custom claims')
      results.fixed = true
    }

    if (!results.firebaseExists && results.mongoExists) {
      // Remove orphaned MongoDB record
      await usersCollection.deleteOne({ firebaseUid: targetUserId })
      results.actions.push('Removed orphaned MongoDB record')
      results.fixed = true
    }

    console.log(`[validateUserState] Validation complete for ${targetUserId}:`, results)
    
    return {
      success: true,
      message: 'User state validated',
      results
    }
  } catch (error) {
    console.error('Error validating user state:', error)
    throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})
