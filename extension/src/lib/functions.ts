import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Initialize Functions
const functions = getFunctions(getApp())

// Callable functions
export const initializeUser = httpsCallable(functions, 'initializeUser')
export const completeOnboarding = httpsCallable(functions, 'completeOnboarding')
export const saveUserProfile = httpsCallable(functions, 'saveUserProfile')

export { functions }
