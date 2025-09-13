import { getFunctions, Functions } from "firebase-admin/functions";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { getStorage, Storage } from "firebase-admin/storage";
import { initializeApp, getApp, getApps, App } from "firebase-admin/app";

let appInstance: App | undefined = undefined;

/**
 * Initializes the Firebase Admin SDK. Guarantees that only one instance is created.
 * @return {App} The initialized Firebase Admin app instance.
 * @throws {Error} If Firebase Admin SDK fails to initialize.
 */
function initializeAdminSDK(): App {
  if (appInstance) {
    return appInstance;
  }

  const apps = getApps();
  if (apps.length > 0) {
    // in case the sdk was initialized elsewhere
    try {
      appInstance = getApp();
      console.log("[SDK] Using existing Firebase Admin app instance");
      return appInstance;
    } catch (error) {
      console.warn(
        `[SDK] Could not retrieve existing default app. Attempting to initialize a new one: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Initialize with application default credentials
  appInstance = initializeApp();
  console.log("[SDK] Initialized Firebase Admin with default credentials");

  if (!appInstance) {
    throw new Error("Failed to initialize Firebase Admin SDK");
  }

  return appInstance;
}

const app: App = initializeAdminSDK();

const auth: Auth = getAuth(app);
const firestore: Firestore = getFirestore(app);
const messaging: Messaging = getMessaging(app);
const functions: Functions = getFunctions(app);
const storage: Storage = getStorage(app);

export { auth, firestore, messaging, functions, storage };
