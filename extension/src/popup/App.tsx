import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
// OnboardingPage moved to extension pages
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
      // Custom error messages for better UX
      let errorMessage = error.message
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.'
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.'
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters long.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.'
      }
      
      setError(errorMessage)
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading SigmaScholar...</div>
        </div>
      </div>
    )
  }

  // If user is authenticated but not onboarded, open onboarding page
  if (user && profile && !profile.isOnboarded) {
    const openOnboarding = () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('src/pages/onboarding/index.html')
      })
      window.close() // Close popup after opening onboarding
    }
    
    return (
      <div className="popup-container">
        <div className="auth-page">
          <h2>SigmaScholar</h2>
          <p>Complete your setup to get started</p>
          <button onClick={openOnboarding} className="auth-button">
            Complete Setup
          </button>
        </div>
      </div>
    )
  }

  // If user is authenticated and onboarded, show home page
  if (user && profile && profile.isOnboarded) {
    return <HomePage />
  }

  // If user is not authenticated, show auth form
  return (
    <div className="popup-container">
      <div className="auth-page">
        <div className="auth-header">
          <h2>SigmaScholar</h2>
          <p>{isSignUp ? 'Create your account' : 'Sign in to get started'}</p>
        </div>
        
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
