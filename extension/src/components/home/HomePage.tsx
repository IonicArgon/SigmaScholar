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

  const clearAllData = () => {
    if (confirm('Clear all extension data? This will reset onboarding, subjects, and files.')) {
      // Clear all SigmaScholar localStorage keys
      localStorage.removeItem('sigma_onboarded')
      localStorage.removeItem('sigma_subjects')
      localStorage.removeItem('sigma_files')
      
      // Clear user-specific profile data
      if (user) {
        localStorage.removeItem(`profile_${user.uid}`)
      }
      
      // Reload the popup to reflect changes
      window.location.reload()
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
                  <h5>{subject.name}</h5>
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
          <button 
            className="action-button"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/settings/index.html') })}
          >
            Settings
          </button>
          <button 
            className="action-button danger"
            onClick={clearAllData}
          >
            Reset Data
          </button>
        </div>
      </div>
    </div>
  )
}
