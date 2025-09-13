import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { getUsersCollection } from '../lib/mongodb'
import { Subject, FileMetadata } from '../types/user'

/**
 * Add files to an existing subject
 */
export const addFilesToSubject = onCall(async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjectName, files } = data
  
  if (!subjectName || !files || !Array.isArray(files)) {
    throw new Error('Subject name and files array are required')
  }
  
  console.log(`[addFilesToSubject] Adding ${files.length} files to "${subjectName}" for UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    // Upload files to Firebase Storage
    const uploadedFiles: FileMetadata[] = await Promise.all(files.map(async (file) => {
      const timestamp = Date.now()
      const sanitizedSubjectName = subjectName.replace(/[^a-zA-Z0-9]/g, '_')
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
      const uniqueFileName = `${timestamp}_${sanitizedFileName}`
      
      const storagePath = `users/${uid}/subjects/${sanitizedSubjectName}/${uniqueFileName}`
      
      try {
        const base64Data = file.data.split(',')[1]
        const fileBuffer = Buffer.from(base64Data, 'base64')
        
        const bucket = admin.storage().bucket()
        const fileRef = bucket.file(storagePath)
        
        await fileRef.save(fileBuffer, {
          metadata: {
            contentType: file.type,
            metadata: {
              originalName: file.name,
              uploadedBy: uid,
              subject: subjectName
            }
          }
        })
        
        await fileRef.makePublic()
        const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
        
        console.log(`[addFilesToSubject] Uploaded file: ${storagePath}`)
        
        return {
          fileName: uniqueFileName,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: storagePath,
          downloadUrl: downloadUrl,
          uploadedAt: new Date(),
          processingStatus: 'completed' as const
        }
      } catch (error) {
        console.error(`[addFilesToSubject] Failed to upload file ${file.name}:`, error)
        return {
          fileName: uniqueFileName,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: storagePath,
          uploadedAt: new Date(),
          processingStatus: 'failed' as const
        }
      }
    }))
    
    // Update MongoDB with new files
    const result = await usersCollection.updateOne(
      { firebaseUid: uid, 'subjects.name': subjectName },
      { 
        $push: { 'subjects.$.files': { $each: uploadedFiles } } as any,
        $inc: { 'subjects.$.fileCount': uploadedFiles.length },
        $set: { 'profile.updatedAt': new Date() }
      }
    )
    
    if (result.matchedCount === 0) {
      throw new Error('User or subject not found')
    }
    
    const successfulUploads = uploadedFiles.filter(f => f.processingStatus === 'completed').length
    console.log(`[addFilesToSubject] Added ${successfulUploads}/${uploadedFiles.length} files to "${subjectName}" for UID: ${uid}`)
    
    return {
      success: true,
      message: `Added ${successfulUploads} files to subject successfully`,
      filesAdded: successfulUploads,
      filesFailed: uploadedFiles.length - successfulUploads
    }
  } catch (error) {
    console.error('Error adding files to subject:', error)
    throw new Error('Failed to add files to subject')
  }
})

/**
 * Remove a specific file from a subject
 */
export const removeFileFromSubject = onCall(async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjectName, fileName } = data
  
  if (!subjectName || !fileName) {
    throw new Error('Subject name and file name are required')
  }
  
  console.log(`[removeFileFromSubject] Removing file "${fileName}" from "${subjectName}" for UID: ${uid}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    // First, get the file info to delete from storage
    const user = await usersCollection.findOne({ firebaseUid: uid })
    if (!user) {
      throw new Error('User not found')
    }
    
    const subject = user.subjects?.find((s: Subject) => s.name === subjectName)
    if (!subject) {
      throw new Error('Subject not found')
    }
    
    const fileToRemove = subject.files?.find((f: FileMetadata) => f.fileName === fileName)
    if (!fileToRemove) {
      throw new Error('File not found')
    }
    
    // Delete file from Firebase Storage
    try {
      const bucket = admin.storage().bucket()
      await bucket.file(fileToRemove.storagePath).delete()
      console.log(`[removeFileFromSubject] Deleted file: ${fileToRemove.storagePath}`)
    } catch (error) {
      console.warn(`[removeFileFromSubject] Failed to delete file ${fileToRemove.storagePath}:`, error)
    }
    
    // Remove file from MongoDB
    const result = await usersCollection.updateOne(
      { firebaseUid: uid, 'subjects.name': subjectName },
      { 
        $pull: { 'subjects.$.files': { fileName: fileName } } as any,
        $inc: { 'subjects.$.fileCount': -1 },
        $set: { 'profile.updatedAt': new Date() }
      }
    )
    
    if (result.modifiedCount === 0) {
      throw new Error('File not found or already removed')
    }
    
    console.log(`[removeFileFromSubject] Removed file "${fileName}" from "${subjectName}" for UID: ${uid}`)
    
    return {
      success: true,
      message: 'File removed successfully'
    }
  } catch (error) {
    console.error('Error removing file from subject:', error)
    throw new Error('Failed to remove file')
  }
})
