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
let activeSessionCleanupTimer: number | null = null

// Global quiz state management
interface QuizState {
  isActive: boolean
  sessionId: string | null
  activeTabId: number | null
  subject: string | null
  startTime: number
  isGenerating: boolean // Add flag to prevent concurrent quiz generation
}

let globalQuizState: QuizState = {
  isActive: false,
  sessionId: null,
  activeTabId: null,
  subject: null,
  startTime: 0,
  isGenerating: false
}

// Track all YouTube Shorts tabs
const youtubeShortsTabs = new Set<number>()

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  currentUser = user
  console.log('[Background] Auth state changed:', user ? 'Authenticated' : 'Not authenticated')
  
  // If user logs out, clean up any active sessions
  if (!user && activeSessionCleanupTimer) {
    clearTimeout(activeSessionCleanupTimer)
    activeSessionCleanupTimer = null
  }
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GENERATE_QUIZ') {
    handleQuizGeneration(request.data, sender.tab?.id || null, sendResponse)
    return true // Keep message channel open for async response
  }
  
  if (request.type === 'SESSION_STARTED') {
    handleSessionStarted(request.data, sendResponse)
    return true
  }
  
  if (request.type === 'SESSION_ENDED') {
    handleSessionEnded(sendResponse)
    return true
  }
  
  if (request.type === 'END_ACTIVE_SESSION') {
    handleEndActiveSession(sendResponse)
    return true
  }
  
  if (request.type === 'QUIZ_ANSWERED') {
    handleQuizAnswered(request.data, sender.tab?.id || null, sendResponse)
    return true
  }
  
  if (request.type === 'CHECK_QUIZ_STATE') {
    handleCheckQuizState(sender.tab?.id || null, sendResponse)
    return true
  }
  
  if (request.type === 'REGISTER_YOUTUBE_TAB') {
    handleRegisterYouTubeTab(sender.tab?.id || null, sendResponse)
    return true
  }
  
  if (request.type === 'UNREGISTER_YOUTUBE_TAB') {
    handleUnregisterYouTubeTab(sender.tab?.id || null, sendResponse)
    return true
  }
  
  if (request.type === 'QUIZ_DISPLAYED') {
    handleQuizDisplayed(request.data, sender.tab?.id || null, sendResponse)
    return true
  }
})

async function handleQuizGeneration(data: { subject: string; youtubeContext: string }, tabId: number | null, sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Generating quiz for subject:', data.subject)
    console.log('[Background] User authenticated:', !!currentUser)
    console.log('[Background] YouTube context length:', data.youtubeContext.length)
    
    if (!currentUser) {
      throw new Error('User not authenticated')
    }
    
    // Check if quiz is already active or being generated
    if (globalQuizState.isActive || globalQuizState.isGenerating) {
      sendResponse({ 
        error: 'Quiz already active or being generated on another tab'
      })
      return
    }
    
    // Set generation flag to prevent concurrent generation
    globalQuizState.isGenerating = true

    const generateQuiz = httpsCallable(functions, 'generateQuiz')
    const result = await generateQuiz({
      subject: data.subject,
      youtubeContext: data.youtubeContext
    })

    console.log('[Background] Quiz generated successfully:', result.data)
    
    // Send quiz data first, let content script confirm when quiz is displayed
    sendResponse({ 
      data: result.data,
      tabId: tabId,
      subject: data.subject
    })
    
  } catch (error) {
    console.error('[Background] Quiz generation failed - Full error:', error)
    console.error('[Background] Error code:', (error as any)?.code)
    console.error('[Background] Error message:', (error as any)?.message)
    console.error('[Background] Error details:', (error as any)?.details)
    
    // Clear generation flag on error
    globalQuizState.isGenerating = false
    
    sendResponse({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}

// Quiz state management handlers
async function handleQuizDisplayed(data: { subject: string }, tabId: number | null, sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Quiz displayed on tab:', tabId, 'subject:', data.subject)
    
    // Set global quiz state now that quiz is confirmed to be displayed
    globalQuizState = {
      isActive: true,
      sessionId: data.subject,
      activeTabId: tabId,
      subject: data.subject,
      startTime: Date.now(),
      isGenerating: false
    }
    
    // Notify all other YouTube tabs to block content
    await blockContentOnOtherTabs(tabId)
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error handling quiz displayed:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleQuizAnswered(data: { isCorrect: boolean }, tabId: number | null, sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Quiz answered:', data.isCorrect, 'from tab:', tabId)
    
    // Only allow the active quiz tab to answer
    if (globalQuizState.isActive && globalQuizState.activeTabId === tabId) {
      // Clear global quiz state
      globalQuizState = {
        isActive: false,
        sessionId: null,
        activeTabId: null,
        subject: null,
        startTime: 0,
        isGenerating: false
      }
      
      // Unblock content on all other tabs
      await unblockContentOnAllTabs()
      
      sendResponse({ success: true, allowed: true })
    } else {
      sendResponse({ success: false, allowed: false, reason: 'Not the active quiz tab' })
    }
  } catch (error) {
    console.error('[Background] Error handling quiz answer:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleCheckQuizState(tabId: number | null, sendResponse: (response: any) => void) {
  try {
    const isBlocked = (globalQuizState.isActive || globalQuizState.isGenerating) && globalQuizState.activeTabId !== tabId
    const isActiveQuizTab = globalQuizState.isActive && globalQuizState.activeTabId === tabId
    
    sendResponse({
      success: true,
      quizState: {
        isActive: globalQuizState.isActive,
        isGenerating: globalQuizState.isGenerating,
        isBlocked: isBlocked,
        isActiveQuizTab: isActiveQuizTab,
        subject: globalQuizState.subject,
        timeElapsed: globalQuizState.isActive ? Date.now() - globalQuizState.startTime : 0
      }
    })
  } catch (error) {
    console.error('[Background] Error checking quiz state:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleRegisterYouTubeTab(tabId: number | null, sendResponse: (response: any) => void) {
  try {
    if (tabId) {
      youtubeShortsTabs.add(tabId)
      console.log('[Background] Registered YouTube tab:', tabId, 'Total tabs:', youtubeShortsTabs.size)
      
      // If there's an active quiz, immediately block this tab
      if (globalQuizState.isActive && globalQuizState.activeTabId !== tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'BLOCK_CONTENT',
          reason: 'Quiz active on another tab',
          subject: globalQuizState.subject
        }).catch(() => {
          // Tab might not be ready yet, ignore error
        })
      }
    }
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error registering YouTube tab:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleUnregisterYouTubeTab(tabId: number | null, sendResponse: (response: any) => void) {
  try {
    if (tabId) {
      youtubeShortsTabs.delete(tabId)
      console.log('[Background] Unregistered YouTube tab:', tabId, 'Total tabs:', youtubeShortsTabs.size)
      
      // If this was the active quiz tab, clear the quiz state
      if (globalQuizState.isActive && globalQuizState.activeTabId === tabId) {
        globalQuizState = {
          isActive: false,
          sessionId: null,
          activeTabId: null,
          subject: null,
          startTime: 0,
          isGenerating: false
        }
        await unblockContentOnAllTabs()
      }
    }
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error unregistering YouTube tab:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

// Utility functions for content blocking
async function blockContentOnOtherTabs(activeTabId: number | null) {
  console.log('[Background] Blocking content on other tabs, active tab:', activeTabId)
  
  for (const tabId of youtubeShortsTabs) {
    if (tabId !== activeTabId) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'BLOCK_CONTENT',
          reason: 'Quiz active on another tab',
          subject: globalQuizState.subject
        })
      } catch (error) {
        // Tab might be closed or not ready, remove from set
        youtubeShortsTabs.delete(tabId)
      }
    }
  }
}

async function unblockContentOnAllTabs() {
  console.log('[Background] Unblocking content on all tabs')
  
  for (const tabId of youtubeShortsTabs) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'UNBLOCK_CONTENT'
      })
    } catch (error) {
      // Tab might be closed, remove from set
      youtubeShortsTabs.delete(tabId)
    }
  }
}

// Session management handlers
async function handleSessionStarted(data: { sessionId: string }, sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Session started:', data.sessionId)
    
    // Set up automatic session cleanup after 4 hours of inactivity
    if (activeSessionCleanupTimer) {
      clearTimeout(activeSessionCleanupTimer)
    }
    
    activeSessionCleanupTimer = setTimeout(async () => {
      console.log('[Background] Auto-ending inactive session:', data.sessionId)
      await endSessionCleanup(data.sessionId)
    }, 4 * 60 * 60 * 1000) // 4 hours
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error handling session start:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleSessionEnded(sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Session ended by user')
    
    if (activeSessionCleanupTimer) {
      clearTimeout(activeSessionCleanupTimer)
      activeSessionCleanupTimer = null
    }
    
    // Clear global quiz state and unblock all tabs
    globalQuizState = {
      isActive: false,
      sessionId: null,
      activeTabId: null,
      subject: null,
      startTime: 0,
      isGenerating: false
    }
    
    await unblockContentOnAllTabs()
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error handling session end:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function handleEndActiveSession(sendResponse: (response: any) => void) {
  try {
    console.log('[Background] Force ending active session')
    
    if (!currentUser) {
      sendResponse({ error: 'User not authenticated' })
      return
    }
    
    // Call Firebase function to end any active session
    const endStudySession = httpsCallable(functions, 'endStudySession')
    await endStudySession({ forceEnd: true })
    
    if (activeSessionCleanupTimer) {
      clearTimeout(activeSessionCleanupTimer)
      activeSessionCleanupTimer = null
    }
    
    // Clear global quiz state and unblock all tabs
    globalQuizState = {
      isActive: false,
      sessionId: null,
      activeTabId: null,
      subject: null,
      startTime: 0,
      isGenerating: false
    }
    
    await unblockContentOnAllTabs()
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('[Background] Error force ending session:', error)
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

async function endSessionCleanup(sessionId: string) {
  try {
    if (!currentUser) {
      console.log('[Background] Cannot end session - user not authenticated')
      return
    }
    
    const endStudySession = httpsCallable(functions, 'endStudySession')
    await endStudySession({ sessionId, autoEnded: true })
    
    // Clear global quiz state and unblock all tabs
    globalQuizState = {
      isActive: false,
      sessionId: null,
      activeTabId: null,
      subject: null,
      startTime: 0,
      isGenerating: false
    }
    
    await unblockContentOnAllTabs()
    
    console.log('[Background] Session auto-ended:', sessionId)
  } catch (error) {
    console.error('[Background] Error auto-ending session:', error)
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
