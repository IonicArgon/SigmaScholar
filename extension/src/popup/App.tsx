import { useState, useEffect } from 'react'
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import './App.css'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="popup-container">
        <div className="auth-page">
          <h2>SigmaScholar</h2>
          <p>{isSignUp ? 'Create your account' : 'Sign in to get started'}</p>
          
          <form onSubmit={handleSubmit} className="auth-form">
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

  return (
    <div className="popup-container">
      <div className="home-page">
        <div className="user-info">
          <img src={user.photoURL || ''} alt="Profile" className="profile-pic" />
          <span>Welcome, {user.displayName}</span>
        </div>
        <div className="home-content">
          <h3>SigmaScholar Home</h3>
          <p>Extension is ready to use!</p>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>
    </div>
  )
}
