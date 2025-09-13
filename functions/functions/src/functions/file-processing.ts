import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { defineString, defineSecret } from 'firebase-functions/params';
import { getUsersCollection } from '../lib/mongodb';
import { UnstructuredClient } from 'unstructured-client';
import { Strategy } from 'unstructured-client/sdk/models/shared';
import { CohereClientV2 } from 'cohere-ai';

// Define parameterized configuration
// Using defineSecret for sensitive API keys
const unstructuredApiKey = defineSecret('UNSTRUCTURED_API_KEY');
const unstructuredApiUrl = defineString('UNSTRUCTURED_API_URL');
const cohereApiKey = defineSecret('COHERE_API_KEY');
const mongodbUri = defineSecret('MONGODB_URI');

interface FileProcessingTask {
  userId: string;
  subjectName: string;
  fileName: string;
  downloadUrl: string;
}

interface ProcessedChunk {
  raw_text: string;
  cleaned_text: string;
  chunk_index: number;
  element_type: string;
  metadata?: any;
}

/**
 * Task Queue function to process uploaded files
 * Triggered by Cloud Tasks from the storage trigger
 */
export const processFileContent = onTaskDispatched({
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 60,
  },
  rateLimits: {
    maxConcurrentDispatches: 5, // Process max 5 files simultaneously
  },
  memory: '2GiB',
  timeoutSeconds: 540, // 9 minutes max
  secrets: [unstructuredApiKey, cohereApiKey, mongodbUri], // Declare secrets for runtime access
}, async (req) => {
  const data = req.data as FileProcessingTask;
  const { userId, subjectName, fileName, downloadUrl } = data;
  
  console.log(`Processing file: ${fileName} for user: ${userId}, subject: ${subjectName}`);

  try {
    // Update processing status to 'processing'
    const usersCollection = await getUsersCollection();

    await usersCollection.updateOne(
      { 
        firebaseUid: userId,
        'subjects.name': subjectName,
        'subjects.files.fileName': fileName
      },
      {
        $set: {
          'subjects.$[subject].files.$[file].processingStatus': 'processing',
          'subjects.$[subject].files.$[file].processingStartedAt': new Date()
        }
      },
      {
        arrayFilters: [
          { 'subject.name': subjectName },
          { 'file.fileName': fileName }
        ]
      }
    );

    // Step 1: Download file from Firebase Storage
    console.log('Downloading file from Firebase Storage...');
    const fileBuffer = await downloadFileFromStorage(downloadUrl);

    // Step 2: Process with Unstructured.io
    console.log('Processing with Unstructured.io...');
    const unstructuredElements = await processWithUnstructured(fileBuffer, fileName);

    // Step 3: Clean text with Cohere in batches
    console.log('Cleaning text with Cohere...');
    const processedChunks = await cleanTextWithCohere(unstructuredElements);

    // Step 4: Save processed data to MongoDB
    console.log('Saving processed data to MongoDB...');
    await saveProcessedData(userId, subjectName, fileName, processedChunks);

    console.log(`Successfully processed file: ${fileName}`);

    } catch (error) {
    console.error(`Error processing file ${fileName}:`, error);
    
    // Update status to failed
      try {
        const usersCollection = await getUsersCollection();
          
        await usersCollection.updateOne(
        { 
          firebaseUid: userId,
          'subjects.name': subjectName,
          'subjects.files.fileName': fileName
        },
        {
          $set: {
            'subjects.$[subject].files.$[file].processingStatus': 'failed',
            'subjects.$[subject].files.$[file].processingError': error instanceof Error ? error.message : 'Unknown error',
            'subjects.$[subject].files.$[file].processingFailedAt': new Date(),
            'subjects.$[subject].files.$[file].errorDetails': error
          }
        },
        {
          arrayFilters: [
            { 'subject.name': subjectName },
            { 'file.fileName': fileName }
          ]
        }
      );
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
    
    throw error; // Re-throw to trigger task retry
  }
});

/**
 * Download file from Firebase Storage using download URL
 */
async function downloadFileFromStorage(downloadUrl: string): Promise<Buffer> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Process file with Unstructured.io
 */
async function processWithUnstructured(fileBuffer: Buffer, fileName: string): Promise<any[]> {
  try {
    // Initialize client inside function to access secrets
    const unstructuredClient = new UnstructuredClient({
      serverURL: unstructuredApiUrl.value(),
      security: {
        apiKeyAuth: unstructuredApiKey.value(),
      },
    });
    
    const response = await unstructuredClient.general.partition({
      partitionParameters: {
        files: {
          content: fileBuffer,
          fileName: fileName,
        },
        strategy: Strategy.HiRes,
        splitPdfPage: true,
        splitPdfAllowFailed: true,
        splitPdfConcurrencyLevel: 5, // Reduced for cloud function limits
        languages: ['eng'],
        chunkingStrategy: 'by_title', // Better chunking for academic content
        maxCharacters: 1500, // Optimal for Cohere processing
        newAfterNChars: 1200,
        combineUnderNChars: 200,
      }
    });

    // Check if response has elements property
    if (!response || typeof response === 'string') {
      throw new Error('Invalid response from Unstructured API');
    }

    return (response as any).elements || [];
  } catch (error) {
    console.error('Unstructured processing error:', error);
    throw new Error(`Failed to process with Unstructured: ${error}`);
  }
}

/**
 * Clean text with Cohere Command A in batches
 */
async function cleanTextWithCohere(elements: any[]): Promise<ProcessedChunk[]> {
  const processedChunks: ProcessedChunk[] = [];
  const batchSize = 5; // Process 5 chunks at a time to avoid rate limits

  for (let i = 0; i < elements.length; i += batchSize) {
    const batch = elements.slice(i, i + batchSize);
    const batchPromises = batch.map(async (element, batchIndex) => {
      const chunkIndex = i + batchIndex;
      
      if (!element.text || element.text.trim().length === 0) {
        return {
          raw_text: element.text || '',
          cleaned_text: '',
          chunk_index: chunkIndex,
          element_type: element.type || 'unknown',
          metadata: element.metadata || {}
        };
      }

      try {
        // Initialize client inside function to access secrets
        const cohereClient = new CohereClientV2({
          token: cohereApiKey.value(),
        });
        
        const response = await cohereClient.chat({
          model: 'command-a-03-2025', // Using command-r as it's more stable than command-a
          messages: [
            {
              role: 'system',
              content: `You are a text cleaning assistant. Your job is to clean and format text extracted from documents to make it more readable and well-structured.

Rules:
1. Remove excessive newlines, keeping only necessary paragraph breaks
2. Fix spacing issues and remove extra whitespace
3. Correct obvious OCR errors and formatting artifacts
4. Maintain the original meaning and structure
5. Keep important formatting like bullet points and numbered lists
6. Remove page numbers, headers, and footers if they appear mid-text
7. Ensure proper sentence structure and punctuation
8. Return ONLY the cleaned text, no explanations or additional content

The text should be clean, readable, and properly formatted for academic study purposes.`
            },
            {
              role: 'user',
              content: `Please clean and format this text:\n\n${element.text}`
            }
          ],
          temperature: 0.1, // Low temperature for consistent cleaning
          maxTokens: 2000,
        });

        const cleanedText = (response.message?.content?.[0] as any)?.text || element.text;

        return {
          raw_text: element.text,
          cleaned_text: cleanedText,
          chunk_index: chunkIndex,
          element_type: element.type || 'unknown',
          metadata: element.metadata || {}
        };
      } catch (cohereError) {
        console.error(`Cohere processing error for chunk ${chunkIndex}:`, cohereError);
        // Fallback to original text if Cohere fails
        return {
          raw_text: element.text,
          cleaned_text: element.text, // Use original text as fallback
          chunk_index: chunkIndex,
          element_type: element.type || 'unknown',
          metadata: element.metadata || {}
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    processedChunks.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + batchSize < elements.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return processedChunks;
}

/**
 * Save processed data to MongoDB
 */
async function saveProcessedData(
  userId: string,
  subjectName: string,
  fileName: string,
  processedChunks: ProcessedChunk[]
): Promise<void> {
  const usersCollection = await getUsersCollection();

  const totalTokens = processedChunks.reduce((sum, chunk) => {
    return sum + (chunk.cleaned_text.length / 4); // Rough token estimate
  }, 0);

  await usersCollection.updateOne(
    { 
      firebaseUid: userId,
      'subjects.name': subjectName,
      'subjects.files.fileName': fileName
    },
    {
      $set: {
        'subjects.$[subject].files.$[file].processingStatus': 'completed',
        'subjects.$[subject].files.$[file].processingData': {
          chunks: processedChunks,
          totalChunks: processedChunks.length,
          totalTokens: Math.round(totalTokens),
          processedAt: new Date(),
          completedAt: new Date()
        }
      }
    },
    {
      arrayFilters: [
        { 'subject.name': subjectName },
        { 'file.fileName': fileName }
      ]
    }
  );
}
