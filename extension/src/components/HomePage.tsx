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
          <div className="user-avatar hover-meme-giga-chad">
            {(user?.displayName || 'Σ').charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span>What's good, {user?.displayName || 'Sigma'}! 🗿</span>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button onClick={handleSignOut} className="sign-out-button hover-meme-shake">
          Touch Grass 🌱
        </button>
      </div>

      <div className="home-content">
        <h3>Σ SigmaScholar Command Center</h3>
        <p className="home-subtitle">Your intelligent study companion</p>
        
        {profile?.subjects && profile.subjects.length > 0 ? (
          <div className="subjects-overview">
            <h4>Your Grindset Subjects 🔥</h4>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div key={index} className="subject-card hover-meme-wobble">
                  <h5 className="animate-meme-pulse-glow">{subject.name}</h5>
                  <p>Ready to absolutely demolish this 💯</p>
                  <div className="subject-stats">
                    <div className="subject-stat">
                      <span>📚 {subject.fileCount ?? 'No'} based materials</span>
                    </div>
                    <div className="subject-stat">
                      <span>🎯 {subject.files?.length ?? 'No'} sigma sessions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-subjects">
            <div className="empty-subjects-icon">😤</div>
            <p>No subjects in the grindset yet, chief.</p>
            <p className="add-subjects-hint">Time to lock in and add some subjects 💪</p>
          </div>
        )}

        <div className="actions">
          <button className="action-button primary">
            <span className="action-button-icon">🧠</span>
            Sigma Study Mode
          </button>
          <button className="action-button">
            <span className="action-button-icon">📤</span>
            Upload the Goods
          </button>
          <button className="action-button">
            <span className="action-button-icon">⚙️</span>
            Configure the Grind
          </button>
        </div>
      </div>
    </div>
  )
}
