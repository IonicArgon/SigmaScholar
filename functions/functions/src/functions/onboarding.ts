import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { firestore } from '../lib/firebase'

// Types
interface FileData {
  name: string
  size: number
  type: string
  data: string // base64 data URL
}

interface SubjectData {
  name: string
  files: FileData[]
}

interface OnboardingData {
  subjects: SubjectData[]
}

interface FileMetadata {
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  storagePath: string
  downloadUrl?: string
  uploadedAt: Date
  processingStatus: 'pending' | 'completed' | 'failed'
}

/**
 * Complete user onboarding with subjects and file metadata
 */
export const completeOnboarding = onCall<OnboardingData>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjects } = data
  
  console.log(`[completeOnboarding] Called for UID: ${uid}, subjects count: ${subjects.length}`)
  console.log(`[completeOnboarding] Subjects data:`, JSON.stringify(subjects.map(s => ({
    name: s.name,
    fileCount: s.files.length,
    files: s.files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      hasData: !!f.data,
      dataType: typeof f.data,
      dataLength: f.data ? f.data.length : 0
    }))
  })), null, 2))
  
  try {
    // Check if user exists in Firestore
    const userRef = firestore.collection('users').doc(uid)
    const userDoc = await userRef.get()
    
    if (!userDoc.exists) {
      // Create user if doesn't exist
      await userRef.set({
        firebaseUid: uid,
        displayName: auth.token.name || 'User',
        email: auth.token.email || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isOnboarded: false
      })
    }
    
    // Upload files to Firebase Storage and create subjects in Firestore
    const batch = firestore.batch()
    
    for (const subject of subjects) {
      // Create subject document
      const subjectRef = firestore.collection('subjects').doc()
      const subjectData = {
        userId: uid,
        name: subject.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fileCount: subject.files.length,
        sessionCount: 0,
        lastSessionDate: null
      }
      batch.set(subjectRef, subjectData)
      
      // Upload files and create file documents
      for (const file of subject.files) {
        // Skip files without data
        if (!file.data || typeof file.data !== 'string') {
          console.warn(`[completeOnboarding] Skipping file ${file.name} - no data provided`)
          continue
        }
        
        // Generate unique filename to prevent conflicts
        const timestamp = Date.now()
        const sanitizedSubjectName = subject.name.replace(/[^a-zA-Z0-9]/g, '_')
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
        const uniqueFileName = `${timestamp}_${sanitizedFileName}`
        
        // Define storage path: users/{uid}/subjects/{subjectName}/{uniqueFileName}
        const storagePath = `users/${uid}/subjects/${sanitizedSubjectName}/${uniqueFileName}`
        
        let fileMetadata: FileMetadata
        
        try {
          // Convert base64 data URL to buffer
          const base64Data = file.data.split(',')[1] // Remove data:image/jpeg;base64, prefix
          if (!base64Data) {
            console.warn(`[completeOnboarding] Skipping file ${file.name} - invalid base64 format`)
            continue
          }
          const fileBuffer = Buffer.from(base64Data, 'base64')
          
          // Upload to Firebase Storage
          const bucket = admin.storage().bucket()
          const fileRef = bucket.file(storagePath)
          
          await fileRef.save(fileBuffer, {
            metadata: {
              contentType: file.type,
              metadata: {
                originalName: file.name,
                uploadedBy: uid,
                subject: subject.name
              }
            }
          })
          
          // Make file publicly readable and get download URL
          await fileRef.makePublic()
          const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
          
          console.log(`[completeOnboarding] Uploaded file: ${storagePath}`)
          
          fileMetadata = {
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
          console.error(`[completeOnboarding] Failed to upload file ${file.name}:`, error)
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
        
        // Create file document in Firestore
        const fileRef = firestore.collection('files').doc()
        const fileData = {
          userId: uid,
          subjectId: subjectRef.id,
          subjectName: subject.name,
          ...fileMetadata
        }
        batch.set(fileRef, fileData)
        
        // Trigger document processing for successfully uploaded files
        if (fileMetadata.processingStatus === 'completed') {
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
            
            console.log(`[completeOnboarding] Triggered processing for: ${fileMetadata.fileName}`)
          } catch (processingError) {
            console.warn(`[completeOnboarding] Failed to trigger processing for ${fileMetadata.fileName}:`, processingError)
          }
        }
      }
    }
    
    // Update user with onboarding status
    batch.update(userRef, {
      isOnboarded: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    // Commit all changes
    await batch.commit()
    console.log(`[completeOnboarding] Successfully created ${subjects.length} subjects with files`)
    
    // Set custom claim for onboarding completion
    await admin.auth().setCustomUserClaims(uid, { isOnboarded: true })
    
    return {
      success: true,
      message: 'Onboarding completed successfully',
      subjectsCreated: subjects.length,
      isOnboarded: true
    }
  } catch (error) {
    console.error('Error completing onboarding:', error)
    throw new Error('Failed to complete onboarding')
  }
})
