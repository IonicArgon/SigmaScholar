import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { firestore } from '../lib/firebase'

// Types
interface FileMetadata {
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  storagePath: string
  downloadUrl?: string
  uploadedAt: Date
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Add files to an existing subject
 */
export const addFilesToSubject = onCall<{
  subjectName: string
  files: Array<{
    name: string
    size: number
    type: string
    data: string // base64 data URL
  }>
}>({}, async (request) => {
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
    // Find the subject in Firestore
    const subjectsQuery = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .where('name', '==', subjectName)
      .get()
    
    if (subjectsQuery.empty) {
      throw new Error('Subject not found')
    }
    
    const subjectDoc = subjectsQuery.docs[0]
    const subjectRef = subjectDoc.ref
    
    // Upload files to Firebase Storage and create file documents
    const batch = firestore.batch()
    const uploadedFiles: FileMetadata[] = []
    
    for (const file of files) {
      const timestamp = Date.now()
      const sanitizedSubjectName = subjectName.replace(/[^a-zA-Z0-9]/g, '_')
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
      const uniqueFileName = `${timestamp}_${sanitizedFileName}`
      
      const storagePath = `users/${uid}/subjects/${sanitizedSubjectName}/${uniqueFileName}`
      
      let fileMetadata: FileMetadata
      
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
        
        fileMetadata = {
          fileName: uniqueFileName,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: storagePath,
          downloadUrl: downloadUrl,
          uploadedAt: new Date(),
          processingStatus: 'processing' as const
        }
      } catch (error) {
        console.error(`[addFilesToSubject] Failed to upload file ${file.name}:`, error)
        fileMetadata = {
          fileName: uniqueFileName,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: storagePath,
          uploadedAt: new Date(),
          processingStatus: 'failed' as const
        }
      }
      
      uploadedFiles.push(fileMetadata)
      
      // Create file document in Firestore
      const fileRef = firestore.collection('files').doc()
      const fileData = {
        userId: uid,
        subjectId: subjectDoc.id,
        subjectName: subjectName,
        ...fileMetadata
      }
      batch.set(fileRef, fileData)
      
      // Trigger document processing for successfully uploaded files
      if (fileMetadata.processingStatus === 'processing') {
        try {
          const { PubSub } = require('@google-cloud/pubsub')
          const pubsub = new PubSub()
          
          const messageData = {
            userId: uid,
            fileId: fileRef.id,
            storagePath: fileMetadata.storagePath,
            fileName: fileMetadata.fileName
          }
          
          const topic = pubsub.topic('process-document')
          await topic.publishMessage({
            json: messageData
          })
          
          console.log(`[addFilesToSubject] Triggered processing for: ${fileMetadata.fileName}`)
        } catch (processingError) {
          console.warn(`[addFilesToSubject] Failed to trigger processing for ${fileMetadata.fileName}:`, processingError)
        }
      }
    }
    
    // Update subject file count
    batch.update(subjectRef, {
      fileCount: admin.firestore.FieldValue.increment(uploadedFiles.length),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    // Commit all changes
    await batch.commit()
    
    const successfulUploads = uploadedFiles.filter(f => f.processingStatus === 'processing').length
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
export const removeFileFromSubject = onCall<{
  subjectName: string
  fileName: string
}>({}, async (request) => {
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
    // Find the file in Firestore
    const filesQuery = await firestore.collection('files')
      .where('userId', '==', uid)
      .where('subjectName', '==', subjectName)
      .where('fileName', '==', fileName)
      .get()
    
    if (filesQuery.empty) {
      throw new Error('File not found')
    }
    
    const fileDoc = filesQuery.docs[0]
    const fileData = fileDoc.data() as FileMetadata
    
    // Delete file from Firebase Storage
    try {
      const bucket = admin.storage().bucket()
      await bucket.file(fileData.storagePath).delete()
      console.log(`[removeFileFromSubject] Deleted file: ${fileData.storagePath}`)
    } catch (error) {
      console.warn(`[removeFileFromSubject] Failed to delete file ${fileData.storagePath}:`, error)
    }
    
    // Remove file document from Firestore and update subject file count
    const batch = firestore.batch()
    
    // Delete file document
    batch.delete(fileDoc.ref)
    
    // Find and update subject file count
    const subjectsQuery = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .where('name', '==', subjectName)
      .get()
    
    if (!subjectsQuery.empty) {
      const subjectRef = subjectsQuery.docs[0].ref
      batch.update(subjectRef, {
        fileCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }
    
    await batch.commit()
    
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
