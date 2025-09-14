// Background script for SigmaScholar extension
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Firebase config (matches lib/firebase.ts)
const firebaseConfig = {
  apiKey: "AIzaSyDNVjz3qU2I7TWkJiLMkFLmMHSddT-XH7k",
  authDomain: "sigma-scholar.firebaseapp.com",
  projectId: "sigma-scholar",
  storageBucket: "sigma-scholar.firebasestorage.app",
  messagingSenderId: "568258362201",
  appId: "1:568258362201:web:e621812191d667bc356a48"
}

// Initialize Firebase in background script
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const functions = getFunctions(app, 'us-central1')

let currentUser: User | null = null

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  currentUser = user
  console.log('[Background] Auth state changed:', user ? 'Authenticated' : 'Not authenticated')
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GENERATE_QUIZ') {
    handleQuizGeneration(request.data, sendResponse)
    return true // Keep message channel open for async response
  }
})

async function handleQuizGeneration(data: { subject: string; youtubeContext: string }, sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Generating quiz for subject:', data.subject)
    console.log('[Background] User authenticated:', !!currentUser)
    console.log('[Background] YouTube context length:', data.youtubeContext.length)
    
    if (!currentUser) {
      throw new Error('User not authenticated')
    }

    const generateQuiz = httpsCallable(functions, 'generateQuiz')
    const result = await generateQuiz({
      subject: data.subject,
      youtubeContext: data.youtubeContext
    })

    console.log('[Background] Quiz generated successfully:', result.data)
    sendResponse({ data: result.data })
    
  } catch (error) {
    console.error('[Background] Quiz generation failed - Full error:', error)
    console.error('[Background] Error code:', (error as any)?.code)
    console.error('[Background] Error message:', (error as any)?.message)
    console.error('[Background] Error details:', (error as any)?.details)
    
    sendResponse({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}

// Listen for messages from extension pages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ONBOARDING_COMPLETE') {
    console.log('Onboarding completed:', message);
    
    // Update extension badge or perform other background tasks
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('SigmaScholar extension installed');
});
