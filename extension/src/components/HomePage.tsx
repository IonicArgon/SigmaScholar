import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'
import { ShortsTracker } from '@/utils/shortsTracker'
import { StudySessionManager } from '@/utils/studySessionManager'
import { useState, useEffect } from 'react'
import './HomePage.css'

export default function HomePage() {
  const { user, profile } = useAuth()
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [isStudyModeActive, setIsStudyModeActive] = useState(false)
  const [subjectSessionCounts, setSubjectSessionCounts] = useState<Record<string, number>>({})

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

  // Set up real-time listeners for subject session counts
  useEffect(() => {
    if (!user?.uid) return

    const setupSubjectListeners = async () => {
      try {
        // Query all subjects for this user
        const subjectsQuery = query(
          collection(db, 'subjects'),
          where('userId', '==', user.uid)
        )
        
        const snapshot = await getDocs(subjectsQuery)
        const unsubscribers: (() => void)[] = []

        // Set up real-time listeners for each subject
        snapshot.docs.forEach((subjectDoc) => {
          const subjectData = subjectDoc.data()
          const subjectName = subjectData.name
          
          // Set initial session count
          setSubjectSessionCounts(prev => ({
            ...prev,
            [subjectName]: subjectData.sessionCount || 0
          }))

          // Set up real-time listener for this subject
          const unsubscribe = onSnapshot(subjectDoc.ref, (doc) => {
            if (doc.exists()) {
              const data = doc.data()
              setSubjectSessionCounts(prev => ({
                ...prev,
                [subjectName]: data.sessionCount || 0
              }))
            }
          }, (error) => {
            console.error(`Error listening to subject ${subjectName}:`, error)
          })

          unsubscribers.push(unsubscribe)
        })

        // Store unsubscribers for cleanup
        return () => {
          unsubscribers.forEach(unsubscribe => unsubscribe())
        }
      } catch (error) {
        console.error('Error setting up subject listeners:', error)
      }
    }

    const cleanupPromise = setupSubjectListeners()
    
    // Cleanup function
    return () => {
      cleanupPromise.then(cleanup => cleanup?.())
    }
  }, [user?.uid])

  // Handle extension lifecycle to end active study sessions
  useEffect(() => {
    const handleExtensionSuspend = async () => {
      if (await StudySessionManager.hasActiveSession()) {
        try {
          await StudySessionManager.endSession()
        } catch (error) {
          console.error('Failed to end session on extension suspend:', error)
        }
      }
    }

    // Listen for extension suspend/shutdown events
    if (chrome?.runtime?.onSuspend) {
      chrome.runtime.onSuspend.addListener(handleExtensionSuspend)
    }

    return () => {
      if (chrome?.runtime?.onSuspend) {
        chrome.runtime.onSuspend.removeListener(handleExtensionSuspend)
      }
    }
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
            <div className="subject-selector">
              <label htmlFor="subject-select">Select Subject for Study Mode:</label>
              <select
                id="subject-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="subject-dropdown"
              >
                <option value="">Choose a subject...</option>
                {profile.subjects.map((subject, index) => (
                  <option key={index} value={subject.name}>
                    {subject.name} ({subject.fileCount ?? 0} materials)
                  </option>
                ))}
              </select>
            </div>
            <div className="subjects-grid">
              {profile.subjects.map((subject, index) => (
                <div key={index} className={`subject-card ${selectedSubject === subject.name ? 'selected' : ''}`}>
                  <h5>{subject.name}</h5>
                  <p>Study materials and progress tracking</p>
                  <div className="subject-stats">
                    <div className="subject-stat">
                      <span>📚 {subject.fileCount ?? 0} materials</span>
                    </div>
                    <div className="subject-stat">
                      <span>📊 {subjectSessionCounts[subject.name] ?? subject.sessionCount ?? 0} study sessions</span>
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
