import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Initialize Functions
const functions = getFunctions(getApp())

// Core backend functions (still needed for complex backend operations)
// These handle file processing, onboarding, and Firebase Storage coordination
export const completeOnboarding = httpsCallable(functions, 'completeOnboarding')
export const addFilesToSubject = httpsCallable(functions, 'addFilesToSubject')
export const removeFileFromSubject = httpsCallable(functions, 'removeFileFromSubject')

// Note: User management, profile updates, and subject CRUD operations
// have been migrated to frontend Firestore operations in /lib/firestore.ts
// This reduces backend complexity and eliminates MongoDB dependency for simple operations

export { functions }
