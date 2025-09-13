import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import OnboardingPage from '@/components/OnboardingPage'
import HomePage from '@/components/HomePage'
import './App.css'

function AppContent() {
  const { user, profile, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        // Update the user's display name
        await updateProfile(userCredential.user, {
          displayName: name
        })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error: any) {
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  // If user is authenticated but not onboarded, show onboarding
  if (user && profile && !profile.isOnboarded) {
    return <OnboardingPage />
  }

  // If user is authenticated and onboarded, show home page
  if (user && profile && profile.isOnboarded) {
    return <HomePage />
  }

  // If user is not authenticated, show auth form
  return (
    <div className="popup-container">
      <div className="auth-page">
        <h2>SigmaScholar</h2>
        <p>{isSignUp ? 'Create your account' : 'Sign in to get started'}</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="auth-input"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="auth-input"
          />
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="auth-button">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        
        <button 
          onClick={() => setIsSignUp(!isSignUp)} 
          className="toggle-auth"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
