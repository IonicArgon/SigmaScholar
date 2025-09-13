import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import SettingsApp from './SettingsApp.tsx'
import './settings.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsApp />
    </AuthProvider>
  </React.StrictMode>
)
