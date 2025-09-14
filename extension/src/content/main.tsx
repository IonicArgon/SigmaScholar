import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './views/App.tsx'
import { initializeMathJax } from '../utils/mathJax'

console.log('[CRXJS] Hello world from content script!')

// Ensure DOM is ready
async function initializeApp() {
  // Initialize MathJax first
  try {
    await initializeMathJax()
    console.log('[CRXJS] MathJax initialized successfully')
  } catch (error) {
    console.warn('[CRXJS] Failed to initialize MathJax:', error)
  }

  // Remove any existing instances
  const existingApp = document.getElementById('crxjs-app')
  if (existingApp) {
    existingApp.remove()
  }

  const container = document.createElement('div')
  container.id = 'crxjs-app'
  document.body.appendChild(container)
  
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Handle page unload to clean up tab registration
window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({
    type: 'UNREGISTER_YOUTUBE_TAB'
  }).catch(() => {
    // Ignore errors if background script is not available
  })
})

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp)
} else {
  initializeApp()
}