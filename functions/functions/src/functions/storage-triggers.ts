import { onObjectFinalized, onObjectDeleted } from 'firebase-functions/v2/storage';
import { getUsersCollection } from '../lib/mongodb';
import { storage, functions } from '../lib/firebase';

interface FileProcessingTask {
  userId: string;
  subjectName: string;
  fileName: string;
  downloadUrl: string;
}

/**
 * Storage trigger that creates processing tasks when files are uploaded
 * Triggers on file creation in Firebase Storage
 */
export const onFileUploaded = onObjectFinalized(async (event) => {
  const object = event.data;
  const filePath = object.name;
  const bucket = object.bucket;

  // Only process files in the users directory structure
  if (!filePath || !filePath.startsWith('users/')) {
    console.log('Ignoring file outside users directory:', filePath);
    return;
  }

  // Parse the file path: users/{uid}/subjects/{subjectName}/{timestamp}_{fileName}
  const pathParts = filePath.split('/');
  if (pathParts.length !== 4) {
    console.log('Invalid file path structure:', filePath);
    return;
  }

  const [, userId, , subjectFolder] = pathParts;
  const subjectName = decodeURIComponent(subjectFolder);
  
  // Extract original filename from the timestamped filename
  const timestampedFileName = pathParts[3];
  const underscoreIndex = timestampedFileName.indexOf('_');
  if (underscoreIndex === -1) {
    console.log('Invalid filename format:', timestampedFileName);
    return;
  }
  
  const originalFileName = timestampedFileName.substring(underscoreIndex + 1);

  console.log(`File uploaded: ${originalFileName} for user: ${userId}, subject: ${subjectName}`);

  try {
    // Get download URL for the file
    const file = storage.bucket(bucket).file(filePath);
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Update MongoDB to set initial processing status
    const usersCollection = await getUsersCollection();

    // Update the file's processing status to 'pending'
    const updateResult = await usersCollection.updateOne(
      { 
        firebaseUid: userId,
        'subjects.name': subjectName,
        'subjects.files.fileName': originalFileName
      },
      {
        $set: {
          'subjects.$[subject].files.$[file].processingStatus': 'pending',
          'subjects.$[subject].files.$[file].processingQueuedAt': new Date()
        }
      },
      {
        arrayFilters: [
          { 'subject.name': subjectName },
          { 'file.fileName': originalFileName }
        ]
      }
    );

    if (updateResult.matchedCount === 0) {
      console.error('File not found in database:', originalFileName);
      return;
    }

    // Create task for processing
    const taskData: FileProcessingTask = {
      userId,
      subjectName,
      fileName: originalFileName,
      downloadUrl
    };

    // Enqueue the file processing task
    const queue = functions.taskQueue('processFileContent');
    
    await queue.enqueue(taskData, {
      scheduleDelaySeconds: 10, // Small delay to ensure file is fully uploaded
      dispatchDeadlineSeconds: 60 * 9, // 9 minutes (matches function timeout)
    });

    console.log(`Processing task enqueued for file: ${originalFileName}`);

  } catch (error) {
    console.error('Error handling file upload:', error);
    
    // Try to update status to failed if possible
    try {
      const usersCollection = await getUsersCollection();
      
      await usersCollection.updateOne(
        { 
          firebaseUid: userId,
          'subjects.name': subjectName,
          'subjects.files.fileName': originalFileName
        },
        {
          $set: {
            'subjects.$[subject].files.$[file].processingStatus': 'failed',
            'subjects.$[subject].files.$[file].processingError': 'Failed to enqueue processing task',
            'subjects.$[subject].files.$[file].processingFailedAt': new Date()
          }
        },
        {
          arrayFilters: [
            { 'subject.name': subjectName },
            { 'file.fileName': originalFileName }
          ]
        }
      );
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
  }
});

/**
 * Storage trigger for file deletion cleanup
 * Triggers when files are deleted from Firebase Storage
 */
export const onFileDeleted = onObjectDeleted(async (event) => {
  const object = event.data;
  const filePath = object.name;

  // Only process files in the users directory structure
  if (!filePath || !filePath.startsWith('users/')) {
    console.log('Ignoring deleted file outside users directory:', filePath);
    return;
  }

  // Parse the file path: users/{uid}/subjects/{subjectName}/{timestamp}_{fileName}
  const pathParts = filePath.split('/');
  if (pathParts.length !== 4) {
    console.log('Invalid deleted file path structure:', filePath);
    return;
  }

  const [, userId, , subjectFolder] = pathParts;
  const subjectName = decodeURIComponent(subjectFolder);
  
  // Extract original filename from the timestamped filename
  const timestampedFileName = pathParts[3];
  const underscoreIndex = timestampedFileName.indexOf('_');
  if (underscoreIndex === -1) {
    console.log('Invalid deleted filename format:', timestampedFileName);
    return;
  }
  
  const originalFileName = timestampedFileName.substring(underscoreIndex + 1);

  console.log(`File deleted: ${originalFileName} for user: ${userId}, subject: ${subjectName}`);

  try {
    // Clean up processing data from MongoDB
    const usersCollection = await getUsersCollection();

    // Remove the processing data for the deleted file
    await usersCollection.updateOne(
      { 
        firebaseUid: userId,
        'subjects.name': subjectName,
        'subjects.files.fileName': originalFileName
      },
      {
        $unset: {
          'subjects.$[subject].files.$[file].processingStatus': '',
          'subjects.$[subject].files.$[file].processingData': '',
          'subjects.$[subject].files.$[file].processingError': '',
          'subjects.$[subject].files.$[file].processingQueuedAt': '',
          'subjects.$[subject].files.$[file].processingStartedAt': '',
          'subjects.$[subject].files.$[file].processingFailedAt': ''
        }
      },
      {
        arrayFilters: [
          { 'subject.name': subjectName },
          { 'file.fileName': originalFileName }
        ]
      }
    );

    console.log(`Cleaned up processing data for deleted file: ${originalFileName}`);

  } catch (error) {
    console.error('Error cleaning up deleted file:', error);
  }
});
