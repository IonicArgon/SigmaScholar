import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './views/App.tsx'

console.log('[CRXJS] Hello world from content script!')

// Ensure DOM is ready
function initializeApp() {
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp)
} else {
  initializeApp()
}