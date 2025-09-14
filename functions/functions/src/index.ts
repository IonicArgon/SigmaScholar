/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import * as admin from 'firebase-admin'

// Initialize Firebase Admin
if (!admin.apps.length) {
  // For local development, use default credentials
  if (process.env.FUNCTIONS_EMULATOR) {
    admin.initializeApp()
  } else {
    // For production, use explicit service account
    admin.initializeApp()
  }
}

// Export core functions only
export { completeOnboarding } from './functions/onboarding'
export { addFilesToSubject, removeFileFromSubject } from './functions/file-management'
export { addSubject, removeSubject, migrateSubjects } from './functions/subject-management'
export { processDocument, triggerDocumentProcessing } from './functions/document-processing'
export { generateQuiz } from './functions/quiz-generation'
export { startStudySession, endStudySession, updateStudySession, getStudyStats } from './functions/study-sessions'

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
