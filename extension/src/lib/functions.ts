import { getApp } from 'firebase/app'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'

// Initialize Functions
const functions = getFunctions(getApp())

// Connect to emulator in development
if (import.meta.env.DEV) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    console.log('Connected to Firebase Functions emulator')
  } catch (error) {
    console.warn('Failed to connect to Functions emulator:', error)
  }
}

// Callable functions
export const initializeUser = httpsCallable(functions, 'initializeUser')
export const completeOnboarding = httpsCallable(functions, 'completeOnboarding')
export const saveUserProfile = httpsCallable(functions, 'saveUserProfile')

export { functions }
