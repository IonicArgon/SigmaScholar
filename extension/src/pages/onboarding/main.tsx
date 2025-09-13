import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import OnboardingApp from './OnboardingApp.tsx'
import './onboarding.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <OnboardingApp />
    </AuthProvider>
  </React.StrictMode>
)
