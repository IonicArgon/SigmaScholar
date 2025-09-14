import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { firestore } from '../lib/firebase'

/**
 * Add a new subject for a user
 */
export const addSubject = onCall<{
  name: string
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { name } = data
  
  if (!name || typeof name !== 'string') {
    throw new Error('Subject name is required')
  }
  
  console.log(`[addSubject] Adding subject "${name}" for UID: ${uid}`)
  
  try {
    // Check if subject already exists
    const existingSubject = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .where('name', '==', name)
      .get()
    
    if (!existingSubject.empty) {
      throw new Error('Subject already exists')
    }
    
    // Create new subject
    const subjectRef = firestore.collection('subjects').doc()
    const subjectData = {
      userId: uid,
      name: name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      fileCount: 0,
      sessionCount: 0,
      lastSessionDate: null
    }
    
    await subjectRef.set(subjectData)
    
    console.log(`[addSubject] Successfully added subject "${name}" for UID: ${uid}`)
    
    return {
      success: true,
      message: 'Subject added successfully',
      subjectId: subjectRef.id
    }
  } catch (error) {
    console.error('Error adding subject:', error)
    throw new Error('Failed to add subject')
  }
})

/**
 * Remove a subject and all its associated files
 */
export const removeSubject = onCall<{
  name: string
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { name } = data
  
  if (!name || typeof name !== 'string') {
    throw new Error('Subject name is required')
  }
  
  console.log(`[removeSubject] Removing subject "${name}" for UID: ${uid}`)
  
  try {
    // Find the subject
    const subjectQuery = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .where('name', '==', name)
      .get()
    
    if (subjectQuery.empty) {
      throw new Error('Subject not found')
    }
    
    const subjectDoc = subjectQuery.docs[0]
    const subjectId = subjectDoc.id
    
    // Find all files for this subject
    const filesQuery = await firestore.collection('files')
      .where('userId', '==', uid)
      .where('subjectId', '==', subjectId)
      .get()
    
    const batch = firestore.batch()
    
    // Delete all files from Storage and Firestore
    const bucket = admin.storage().bucket()
    for (const fileDoc of filesQuery.docs) {
      const fileData = fileDoc.data()
      
      // Delete from Storage
      try {
        await bucket.file(fileData.storagePath).delete()
        console.log(`[removeSubject] Deleted file: ${fileData.storagePath}`)
      } catch (error) {
        console.warn(`[removeSubject] Failed to delete file ${fileData.storagePath}:`, error)
      }
      
      // Delete from Firestore
      batch.delete(fileDoc.ref)
    }
    
    // Delete the subject document
    batch.delete(subjectDoc.ref)
    
    await batch.commit()
    
    console.log(`[removeSubject] Successfully removed subject "${name}" and ${filesQuery.docs.length} files for UID: ${uid}`)
    
    return {
      success: true,
      message: 'Subject and all associated files removed successfully',
      filesRemoved: filesQuery.docs.length
    }
  } catch (error) {
    console.error('Error removing subject:', error)
    throw new Error('Failed to remove subject')
  }
})

/**
 * Migrate existing subjects to include sessionCount and lastSessionDate
 */
export const migrateSubjects = onCall<{}>({}, async (request) => {
  const { auth } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  
  console.log(`[migrateSubjects] Migrating subjects for UID: ${uid}`)
  
  try {
    // Find all subjects for the user that don't have sessionCount
    const subjectsQuery = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .get()
    
    const batch = firestore.batch()
    let migratedCount = 0
    
    for (const subjectDoc of subjectsQuery.docs) {
      const subjectData = subjectDoc.data()
      
      // Check if migration is needed
      if (subjectData.sessionCount === undefined || subjectData.lastSessionDate === undefined) {
        batch.update(subjectDoc.ref, {
          sessionCount: subjectData.sessionCount || 0,
          lastSessionDate: subjectData.lastSessionDate || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
        migratedCount++
      }
    }
    
    if (migratedCount > 0) {
      await batch.commit()
      console.log(`[migrateSubjects] Successfully migrated ${migratedCount} subjects for UID: ${uid}`)
    } else {
      console.log(`[migrateSubjects] No subjects needed migration for UID: ${uid}`)
    }
    
    return {
      success: true,
      message: `Migrated ${migratedCount} subjects`,
      migratedCount: migratedCount
    }
  } catch (error) {
    console.error('Error migrating subjects:', error)
    throw new Error('Failed to migrate subjects')
  }
})
