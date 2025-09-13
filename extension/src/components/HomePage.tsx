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
          <span>Welcome, {user?.displayName || 'User'}!</span>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>

      <div className="home-content">
        <h3>SigmaScholar Dashboard</h3>
        
        {profile?.subjects && profile.subjects.length > 0 ? (
          <div className="subjects-overview">
            <h4>Your Subjects:</h4>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div key={index} className="subject-card">
                  <h5>{subject}</h5>
                  <p>Ready for study assistance</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-subjects">
            <p>No subjects configured yet.</p>
          </div>
        )}

        <div className="actions">
          <button className="action-button">
            Study Assistant
          </button>
          <button className="action-button">
            Upload Materials
          </button>
          <button className="action-button">
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
