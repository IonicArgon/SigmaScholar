import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret, defineString } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { firestore } from '../lib/firebase'
import { UnstructuredClient } from 'unstructured-client'
import { Strategy } from 'unstructured-client/sdk/models/shared'

// Define secrets and config
const unstructuredApiKey = defineSecret('UNSTRUCTURED_API_KEY')
const unstructuredApiUrl = defineString('UNSTRUCTURED_API_URL')

// Pub/Sub message interface
interface ProcessDocumentMessage {
  userId: string
  fileId: string
  storagePath: string
  fileName: string
}

/**
 * Pub/Sub function to process documents using Unstructured.io
 */
export const processDocument = onMessagePublished({
  topic: 'process-document',
  secrets: [unstructuredApiKey],
}, async (event) => {
  const messageData = event.data.message.json as ProcessDocumentMessage
  const { userId, storagePath, fileName } = messageData
  
  console.log(`[processDocument] Processing file: ${fileName} for user: ${userId}`)
  
  try {
    // Download file from Firebase Storage
    const bucket = admin.storage().bucket()
    const file = bucket.file(storagePath)
    
    const [fileBuffer] = await file.download()
    console.log(`[processDocument] Downloaded file: ${storagePath}, size: ${fileBuffer.length} bytes`)
    
    // Initialize Unstructured client
    const client = new UnstructuredClient({
      serverURL: unstructuredApiUrl.value(),
      security: {
        apiKeyAuth: unstructuredApiKey.value(),
      },
    })
    
    // Process document with Unstructured.io
    console.log(`[processDocument] Starting Unstructured.io processing for: ${fileName}`)
    
    const response = await client.general.partition({
      partitionParameters: {
        files: {
          content: fileBuffer,
          fileName: fileName,
        },
        strategy: Strategy.HiRes,
        splitPdfPage: true,
        splitPdfAllowFailed: true,
        splitPdfConcurrencyLevel: 15,
        languages: ['eng']
      }
    })
    
    // Type the response as any to handle the dynamic response structure
    const responseData = response as any
    
    if (responseData.statusCode === 200) {
      console.log(`[processDocument] Successfully processed ${fileName}`)
      console.log(`[processDocument] Number of elements: ${responseData.elements?.length || 0}`)
      
      // Log first element for debugging
      if (responseData.elements && responseData.elements.length > 0) {
        console.log(`[processDocument] First element:`, JSON.stringify(responseData.elements[0], null, 2))
      }
      
      // Update file status in Firestore
      const fileQuery = await firestore.collection('files')
        .where('userId', '==', userId)
        .where('fileName', '==', fileName)
        .get()
      
      if (!fileQuery.empty) {
        const fileDoc = fileQuery.docs[0]
        await fileDoc.ref.update({
          processingStatus: 'completed',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          elementCount: responseData.elements?.length || 0
        })
        console.log(`[processDocument] Updated file status to completed for: ${fileName}`)
      }
      
      // For now, just log the processed data
      // In the future, we can store the processed elements in Firestore
      console.log(`[processDocument] Processing completed for: ${fileName}`)
      
    } else {
      throw new Error(`Unstructured.io returned status code: ${responseData.statusCode}`)
    }
    
  } catch (error) {
    console.error(`[processDocument] Error processing ${fileName}:`, error)
    
    // Update file status to failed in Firestore
    try {
      const fileQuery = await firestore.collection('files')
        .where('userId', '==', userId)
        .where('fileName', '==', fileName)
        .get()
      
      if (!fileQuery.empty) {
        const fileDoc = fileQuery.docs[0]
        await fileDoc.ref.update({
          processingStatus: 'failed',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          processingError: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } catch (updateError) {
      console.error(`[processDocument] Failed to update file status:`, updateError)
    }
  }
})

/**
 * HTTP callable function to trigger document processing
 */
export const triggerDocumentProcessing = onCall<{
  fileId: string
  storagePath: string
  fileName: string
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { uid } = auth.token
  const { fileId, storagePath, fileName } = data
  
  console.log(`[triggerDocumentProcessing] Triggering processing for: ${fileName}`)
  
  try {
    // Publish message to Pub/Sub topic
    const { PubSub } = require('@google-cloud/pubsub')
    const pubsub = new PubSub()
    
    const messageData: ProcessDocumentMessage = {
      userId: uid,
      fileId,
      storagePath,
      fileName
    }
    
    const topic = pubsub.topic('process-document')
    await topic.publishMessage({
      json: messageData
    })
    
    console.log(`[triggerDocumentProcessing] Published message for: ${fileName}`)
    
    return {
      success: true,
      message: 'Document processing triggered successfully'
    }
    
  } catch (error) {
    console.error(`[triggerDocumentProcessing] Error:`, error)
    throw new Error('Failed to trigger document processing')
  }
})
