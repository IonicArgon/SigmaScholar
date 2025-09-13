import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import FilesApp from './FilesApp.tsx'
import './files.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <FilesApp />
    </AuthProvider>
  </React.StrictMode>
)
