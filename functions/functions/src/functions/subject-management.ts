import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { getUsersCollection } from '../lib/mongodb'
import { Subject } from '../types/user'

/**
 * Add a new subject for the user
 */
export const addSubject = onCall(async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjectName } = data
  
  if (!subjectName || typeof subjectName !== 'string') {
    throw new Error('Subject name is required')
  }
  
  console.log(`[addSubject] Adding subject "${subjectName}" for UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    const newSubject: Subject = {
      name: subjectName,
      createdAt: new Date(),
      fileCount: 0,
      files: []
    }
    
    const result = await usersCollection.updateOne(
      { firebaseUid: uid },
      { 
        $push: { subjects: newSubject } as any,
        $set: { 'profile.updatedAt': new Date() }
      }
    )
    
    if (result.matchedCount === 0) {
      throw new Error('User not found')
    }
    
    console.log(`[addSubject] Added subject "${subjectName}" for UID: ${uid}`)
    
    return {
      success: true,
      message: 'Subject added successfully',
      subject: newSubject
    }
  } catch (error) {
    console.error('Error adding subject:', error)
    throw new Error('Failed to add subject')
  }
})

/**
 * Remove a subject and all its files
 */
export const removeSubject = onCall(async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjectName } = data
  
  if (!subjectName || typeof subjectName !== 'string') {
    throw new Error('Subject name is required')
  }
  
  console.log(`[removeSubject] Removing subject "${subjectName}" for UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    // First, get the user to find files to delete from storage
    const user = await usersCollection.findOne({ firebaseUid: uid })
    if (!user) {
      throw new Error('User not found')
    }
    
    const subjectToRemove = user.subjects?.find((s: Subject) => s.name === subjectName)
    if (!subjectToRemove) {
      throw new Error('Subject not found')
    }
    
    // Delete files from Firebase Storage
    const bucket = admin.storage().bucket()
    const filesToDelete = subjectToRemove.files || []
    
    for (const file of filesToDelete) {
      try {
        await bucket.file(file.storagePath).delete()
        console.log(`[removeSubject] Deleted file: ${file.storagePath}`)
      } catch (error) {
        console.warn(`[removeSubject] Failed to delete file ${file.storagePath}:`, error)
      }
    }
    
    // Remove subject from MongoDB
    const result = await usersCollection.updateOne(
      { firebaseUid: uid },
      { 
        $pull: { subjects: { name: subjectName } } as any,
        $set: { 'profile.updatedAt': new Date() }
      }
    )
    
    if (result.modifiedCount === 0) {
      throw new Error('Subject not found or already removed')
    }
    
    console.log(`[removeSubject] Removed subject "${subjectName}" and ${filesToDelete.length} files for UID: ${uid}`)
    
    return {
      success: true,
      message: 'Subject and all files removed successfully',
      filesDeleted: filesToDelete.length
    }
  } catch (error) {
    console.error('Error removing subject:', error)
    throw new Error('Failed to remove subject')
  }
})
