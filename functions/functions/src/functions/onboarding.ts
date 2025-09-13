import { onCall } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { getUsersCollection } from '../lib/mongodb'
import { Subject, OnboardingData, FileMetadata } from '../types/user'

/**
 * Complete user onboarding with subjects and file metadata
 */
export const completeOnboarding = onCall<OnboardingData>(async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { subjects } = data
  
  console.log(`[completeOnboarding] Called for UID: ${uid}, subjects count: ${subjects.length}`)
  
  try {
    const usersCollection = await getUsersCollection()
    
    // Find the user document to update
    const existingUser = await usersCollection.findOne({ firebaseUid: uid })
    if (!existingUser) {
      console.error(`[completeOnboarding] No user found for UID: ${uid}`)
      throw new Error('User not found. Please initialize user first.')
    }
    
    console.log(`[completeOnboarding] Found user with _id: ${existingUser._id}, displayName: ${existingUser.profile.displayName}`)
    
    // Upload files to Firebase Storage and create embedded subjects with file metadata
    const subjectDocs: Subject[] = await Promise.all(subjects.map(async (subject) => {
      const files: FileMetadata[] = await Promise.all(subject.files.map(async (file) => {
        // Generate unique filename to prevent conflicts
        const timestamp = Date.now()
        const sanitizedSubjectName = subject.name.replace(/[^a-zA-Z0-9]/g, '_')
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
        const uniqueFileName = `${timestamp}_${sanitizedFileName}`
        
        // Define storage path: users/{uid}/subjects/{subjectName}/{uniqueFileName}
        const storagePath = `users/${uid}/subjects/${sanitizedSubjectName}/${uniqueFileName}`
        
        try {
          // Convert base64 data URL to buffer
          const base64Data = file.data.split(',')[1] // Remove data:image/jpeg;base64, prefix
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
          console.error(`[completeOnboarding] Failed to upload file ${file.name}:`, error)
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
      
      return {
        name: subject.name,
        createdAt: new Date(),
        fileCount: subject.files.length,
        files: files
      }
    }))
    
    // Update user with onboarding status and embedded subjects
    const updateResult = await usersCollection.updateOne(
      { firebaseUid: uid },
      {
        $set: {
          'profile.isOnboarded': true,
          'profile.updatedAt': new Date(),
          subjects: subjectDocs
        }
      },
      { upsert: true } // Create if doesn't exist
    )
    
    console.log('Update result:', { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount, upsertedCount: updateResult.upsertedCount })
    
    // Set custom claim for onboarding completion
    await admin.auth().setCustomUserClaims(uid, { isOnboarded: true })
    
    return {
      success: true,
      message: 'Onboarding completed successfully',
      subjectsCreated: subjectDocs.length,
      isOnboarded: true
    }
  } catch (error) {
    console.error('Error completing onboarding:', error)
    throw new Error('Failed to complete onboarding')
  }
})
