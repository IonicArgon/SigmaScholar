import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Initialize Functions
const functions = getFunctions(getApp())

// Callable functions
export const initializeUser = httpsCallable(functions, 'initializeUser')
export const completeOnboarding = httpsCallable(functions, 'completeOnboarding')
export const saveUserProfile = httpsCallable(functions, 'saveUserProfile')

// Transactional functions (recommended for production)
export const initializeUserTransactional = httpsCallable(functions, 'initializeUserTransactional')
export const completeOnboardingTransactional = httpsCallable(functions, 'completeOnboardingTransactional')

// User management functions
export const getUserData = httpsCallable(functions, 'getUserData')
export const updateUserProfile = httpsCallable(functions, 'updateUserProfile')
export const validateUserState = httpsCallable(functions, 'validateUserState')

export { functions }
