import { onMessagePublished } from 'firebase-functions/v2/pubsub'
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret, defineString } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { UnstructuredClient } from 'unstructured-client'
import { Strategy } from 'unstructured-client/sdk/models/shared'
import { CohereClientV2 } from 'cohere-ai'

// Define secrets and config
const unstructuredApiKey = defineSecret('UNSTRUCTURED_API_KEY')
const unstructuredApiUrl = defineString('UNSTRUCTURED_API_URL')
const cohereApiKey = defineSecret('COHERE_API_KEY')

// Initialize Firestore
const firestore = admin.firestore()

/**
 * Clean and sanitize extracted text using Cohere's Command-R model
 */
async function cleanTextWithCohere(elements: any[], fileName: string): Promise<string> {
  try {
    // Concatenate all text elements
    const rawText = elements
      .filter(element => element.text && element.text.trim().length > 0)
      .map(element => element.text.trim())
      .join(' ')

    console.log(`[cleanTextWithCohere] Raw text length: ${rawText.length} characters`)

    if (rawText.length === 0) {
      console.log(`[cleanTextWithCohere] No text content found in ${fileName}`)
      return ''
    }

    // Initialize Cohere client
    const cohere = new CohereClientV2({
      token: cohereApiKey.value()
    })

    // System prompt for text cleaning
    const systemPrompt = `You are a text cleaning specialist. Your task is to clean and sanitize extracted text from PDF documents to make it suitable for use as context in a language model.

The text was extracted using OCR and document parsing, so it may contain:
- OCR errors and garbled characters
- Fragmented sentences
- Mathematical formulas that are poorly formatted
- Scattered single letters or characters
- Inconsistent spacing and formatting

Please clean this text by:
1. Fixing obvious OCR errors and typos
2. Reconstructing fragmented sentences where possible
3. Properly formatting mathematical expressions and formulas
4. Removing isolated single characters that don't add meaning
5. Ensuring proper spacing and punctuation
6. Maintaining the original meaning and structure
7. Keeping all important content, including formulas, diagrams descriptions, and key concepts
8. Not adding any additional commentary or explanation`

    const userPrompt = `Please clean and sanitize the following extracted text:

${rawText}`

    const response = await cohere.chat({
      model: 'command-r-03-2024',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        // Few-shot examples
        {
          role: 'user',
          content: `Please clean and sanitize the following extracted text:

qu adratic f ormula x = -b ± √(b² - 4ac) / 2a wh ere a ≠ 0 T his formula s olves any quadr atic equation ax² + bx + c = 0`
        },
        {
          role: 'assistant',
          content: `The quadratic formula is x = -b ± √(b² - 4ac) / 2a where a ≠ 0. This formula solves any quadratic equation ax² + bx + c = 0.`
        },
        {
          role: 'user',
          content: `Please clean and sanitize the following extracted text:

C H₃ C H₂ O H + O₂ → C H₃ C O O H + H₂ O T he oxid ation of eth anol pro duces acet ic acid . T his react ion is c atalyzed by enz ymes in liv ing org anisms`
        },
        {
          role: 'assistant',
          content: `CH₃CH₂OH + O₂ → CH₃COOH + H₂O. The oxidation of ethanol produces acetic acid. This reaction is catalyzed by enzymes in living organisms.`
        },
        {
          role: 'user',
          content: `Please clean and sanitize the following extracted text:

T he Ren aissance was a per iod of cult ural rebir th in Eur ope from the 14th to 17th cent uries . It mark ed the trans ition from the Mid dle Ages to mod ernity , char acterized by adv ances in art , liter ature , and sci ence`
        },
        {
          role: 'assistant',
          content: `The Renaissance was a period of cultural rebirth in Europe from the 14th to 17th centuries. It marked the transition from the Middle Ages to modernity, characterized by advances in art, literature, and science.`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      maxTokens: 4000,
      temperature: 0.1
    })

    // Extract text from the response - Cohere v2 API structure
    const messageContent = response.message?.content?.[0]
    const cleanedText = messageContent && 'text' in messageContent ? messageContent.text : ''
    console.log(`[cleanTextWithCohere] Cleaned text length: ${cleanedText.length} characters`)
    
    return cleanedText

  } catch (error) {
    console.error(`[cleanTextWithCohere] Error cleaning text for ${fileName}:`, error)
    // Fallback: return concatenated raw text if Cohere fails
    return elements
      .filter(element => element.text && element.text.trim().length > 0)
      .map(element => element.text.trim())
      .join(' ')
  }
}

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
  secrets: [unstructuredApiKey, cohereApiKey],
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
        chunkingStrategy: 'by_title',
        strategy: Strategy.HiRes,
        splitPdfPage: true,
        splitPdfAllowFailed: true,
        splitPdfConcurrencyLevel: 15,
        languages: ['eng']
      }
    })
    
    // The response is directly an array of elements
    const elements = response as any[]
    
    if (Array.isArray(elements) && elements.length > 0) {
      console.log(`[processDocument] Successfully processed ${fileName}`)
      console.log(`[processDocument] Number of elements: ${elements.length}`)
      
      // Log first element for debugging
      console.log(`[processDocument] First element:`, JSON.stringify(elements[0], null, 2))
      
      // Clean the extracted text using Cohere
      const cleanedText = await cleanTextWithCohere(elements, fileName)
      console.log(`[processDocument] Text cleaning completed for: ${fileName}`)
      
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
          elementCount: elements.length,
          cleanedText: cleanedText,
          textLength: cleanedText.length
        })
        console.log(`[processDocument] Updated file status to completed for: ${fileName}`)
        console.log(`[processDocument] Stored cleaned text (${cleanedText.length} chars) for: ${fileName}`)
      }
      
      // For now, just log the processed data
      // In the future, we can store the processed elements in Firestore
      console.log(`[processDocument] Processing completed for: ${fileName}`)
      
    } else {
      throw new Error(`Unstructured.io returned invalid response: ${JSON.stringify(elements)}`)
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
