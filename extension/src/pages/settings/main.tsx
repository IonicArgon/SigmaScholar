import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import SettingsApp from './SettingsApp.tsx'
import './settings.css'

console.log('Settings main.tsx loading...')

const rootElement = document.getElementById('root')
console.log('Root element found:', !!rootElement)

if (!rootElement) {
  console.error('Root element not found!')
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found</div>'
} else {
  const root = ReactDOM.createRoot(rootElement)
  
  console.log('Rendering SettingsApp...')
  
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <SettingsApp />
      </AuthProvider>
    </React.StrictMode>
  )
}
