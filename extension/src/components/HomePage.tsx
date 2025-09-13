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
            {(user?.displayName || 'Σ').charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span>Welcome back, {user?.displayName || 'Scholar'}!</span>
            <div className="user-email">{user?.email}</div>
          </div>
          <div className="gigachad-icon">
            <img src="/Gigachad.png" alt="GigaChad" />
          </div>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>

      <div className="home-content">
        <h3>Σ SigmaScholar Command Center</h3>
        <p className="home-subtitle">Your intelligent study companion</p>
        
        {profile?.subjects && profile.subjects.length > 0 ? (
          <div className="subjects-overview">
            <h4>Your Study Subjects</h4>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div key={index} className="subject-card">
                  <h5>{subject.name}</h5>
                  <p>Study materials and progress tracking</p>
                  <div className="subject-stats">
                    <div className="subject-stat">
                      <span>📚 {subject.fileCount ?? 0} materials</span>
                    </div>
                    <div className="subject-stat">
                      <span>📊 {subject.files?.length ?? 0} study sessions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-subjects">
            <div className="empty-subjects-icon">📚</div>
            <p>No subjects added yet.</p>
            <p className="add-subjects-hint">Add your first subject to get started</p>
          </div>
        )}

        <div className="actions">
          <button className="action-button primary">
            <span className="action-button-icon">🧠</span>
            Study Mode
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
