import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { ShortsTracker } from '@/utils/shortsTracker'
import { StudySessionManager } from '@/utils/studySessionManager'
import { useState, useEffect } from 'react'
import './HomePage.css'

export default function HomePage() {
  const { user, profile } = useAuth()
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [isStudyModeActive, setIsStudyModeActive] = useState(false)

  // Load current study mode settings and migrate subjects on component mount
  useEffect(() => {
    const loadStudyModeSettings = async () => {
      try {
        // Migrate subjects to ensure they have sessionCount property
        await StudySessionManager.migrateSubjects()
        
        const currentSubject = await ShortsTracker.getSelectedSubject()
        const settings = await ShortsTracker.getQuizSettings()
        
        if (currentSubject) {
          setSelectedSubject(currentSubject)
          setIsStudyModeActive(settings.enabled)
        }
      } catch (error) {
        console.error('Failed to load study mode settings:', error)
      }
    }
    
    loadStudyModeSettings()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const startStudyMode = async () => {
    if (!selectedSubject) {
      alert('Please select a subject first!')
      return
    }

    try {
      // Start a new study session
      await StudySessionManager.startSession(selectedSubject)
      
      // Save selected subject and enable quiz blocker
      await ShortsTracker.setSelectedSubject(selectedSubject)
      await ShortsTracker.updateQuizSettings({ enabled: true })
      
      setIsStudyModeActive(true)
      
      // Show confirmation
      alert(`Study Mode activated for ${selectedSubject}! 🧠\n\nYou'll now get quiz questions while watching YouTube Shorts to help you learn.`)
    } catch (error) {
      console.error('Failed to start study mode:', error)
      alert('Failed to start study mode. Please try again.')
    }
  }

  const changeSubject = async (newSubject: string) => {
    if (!isStudyModeActive) {
      // If not in study mode, just change the selection
      setSelectedSubject(newSubject)
      return
    }

    try {
      // Change subject while keeping session active
      await ShortsTracker.setSelectedSubject(newSubject)
      setSelectedSubject(newSubject)
      
      // Show confirmation
      alert(`Study subject changed to ${newSubject}! 📚\n\nYour study session continues with the new subject.`)
    } catch (error) {
      console.error('Failed to change subject:', error)
      alert('Failed to change subject. Please try again.')
    }
  }

  const stopStudyMode = async () => {
    try {
      // End the current study session
      const finalStats = await StudySessionManager.endSession()
      
      await ShortsTracker.updateQuizSettings({ enabled: false })
      setIsStudyModeActive(false)
      
      if (finalStats) {
        const accuracy = finalStats.totalAnswers > 0 ? 
          Math.round((finalStats.correctAnswers / finalStats.totalAnswers) * 100) : 0
        
        alert(`Study Mode deactivated! 📊\n\nSession Summary:\n• ${finalStats.quizCount} quizzes completed\n• ${finalStats.correctAnswers}/${finalStats.totalAnswers} correct answers (${accuracy}%)\n• ${finalStats.videosWatched} videos watched\n\nEnjoy your regular YouTube experience!`)
      } else {
        alert('Study Mode deactivated. Enjoy your regular YouTube experience!')
      }
    } catch (error) {
      console.error('Failed to stop study mode:', error)
      alert('Failed to stop study mode. Please try again.')
    }
  }

  const openSettingsPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/pages/settings/index.html')
    })
    window.close()
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
            <div className="current-subject-display">
              <label>Current Study Subject:</label>
              <div className="selected-subject-info">
                {selectedSubject ? (
                  <div className="subject-display-card">
                    <span className="subject-name">{selectedSubject}</span>
                    <span className="subject-materials">
                      {profile.subjects.find(s => s.name === selectedSubject)?.fileCount ?? 0} materials
                    </span>
                  </div>
                ) : (
                  <div className="no-subject-selected">
                    <span>No subject selected</span>
                    <span className="selection-hint">Click a subject below to select it</span>
                  </div>
                )}
              </div>
            </div>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div 
                  key={index} 
                  className={`subject-card ${selectedSubject === subject.name ? 'selected' : ''}`}
                  onClick={() => setSelectedSubject(subject.name)}
                >
                  <h5>{subject.name}</h5>
                  <p>Study materials and progress tracking</p>
                  <div className="subject-stats">
                    <div className="subject-stat">
                      <span>📚 {subject.fileCount ?? 0} materials</span>
                    </div>
                    <div className="subject-stat">
                      <span>📊 {subject.sessionCount ?? 0} study sessions</span>
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
          {isStudyModeActive ? (
            <button className="action-button danger" onClick={stopStudyMode}>
              <span className="action-button-icon">⏹️</span>
              Stop Study Mode
            </button>
          ) : (
            <button 
              className="action-button primary" 
              onClick={startStudyMode}
              disabled={!selectedSubject}
            >
              <span className="action-button-icon">🧠</span>
              Start Study Mode
            </button>
          )}
          <button className="action-button" onClick={openSettingsPage}>
            <span className="action-button-icon">⚙️</span>
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
