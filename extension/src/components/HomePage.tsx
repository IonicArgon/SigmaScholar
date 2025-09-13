
import { } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import './HomePage.css'

export default function HomePage() {
  const { user, profile } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <div className="user-info">
          <div className="user-avatar">
            {(user?.displayName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span>Welcome, {user?.displayName || 'User'}!</span>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>

      <div className="home-content">
        <h3>SigmaScholar Dashboard</h3>
        <p className="home-subtitle">Your personalized study companion</p>
        
        {profile?.subjects && profile.subjects.length > 0 ? (
          <div className="subjects-overview">
            <h4>Your Subjects</h4>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div key={index} className="subject-card">
                  <h5>{subject}</h5>
                  <p>Ready for study assistance</p>
                  <div className="subject-stats">
                    <div className="subject-stat">
                      <span>📚 0 materials</span>
                    </div>
                    <div className="subject-stat">
                      <span>🎯 0 sessions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-subjects">
            <div className="empty-subjects-icon">📚</div>
            <p>No subjects configured yet.</p>
            <p className="add-subjects-hint">Add subjects in your settings to get started</p>
          </div>
        )}

        <div className="actions">
          <button className="action-button primary">
            <span className="action-button-icon">🧠</span>
            Study Assistant
          </button>
          <button className="action-button">
            <span className="action-button-icon">📤</span>
            Upload Materials
          </button>
          <button className="action-button">
            <span className="action-button-icon">⚙️</span>
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
