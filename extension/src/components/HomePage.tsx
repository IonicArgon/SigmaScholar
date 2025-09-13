import { useAuth } from '@/contexts/AuthContext'
import { signOut } from 'firebase/auth'
import { auth, functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
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

  const openSettingsPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/pages/settings/index.html')
    })
    window.close()
  }

  const testQuizGeneration = async () => {
    try {
      const generateQuiz = httpsCallable(functions, 'generateQuiz')
      
      // Test data
      const testData = {
        subject: 'Calculus',
        youtubeContext: JSON.stringify({
          title: 'Watching Cat Videos for 10 Hours Straight',
          description: 'The ultimate procrastination compilation',
          channelName: 'ProcrastinationNation',
          transcript: 'Meow meow purr purr... *keyboard typing sounds* ... oh no I have an assignment due tomorrow'
        })
      }

      const result = await generateQuiz(testData)
      const data = result.data as any
      
      // Safely handle the quiz data structure
      const quiz = data.quiz || data
      
      // Filter wrong answers to exclude the correct answer
      const allOptions = quiz.options || []
      const correctAnswerIndex = quiz.correctAnswer
      const wrongAnswers = allOptions.filter((_: string, index: number) => index !== correctAnswerIndex)
      
      // Get explanations
      const correctExplanation = quiz.explanations?.correct || 'No explanation provided'
      
      // Create a detailed output for the user
      const quizOutput = `
🧠 QUIZ GENERATED SUCCESSFULLY! 🧠

📚 Subject: ${testData.subject}
🎥 YouTube Context: ${JSON.parse(testData.youtubeContext).title}

❓ QUESTION:
${quiz.question || 'No question found'}

✅ CORRECT ANSWER:
${allOptions[correctAnswerIndex] || 'No correct answer found'}

❌ WRONG OPTIONS:
${wrongAnswers.length > 0 ? wrongAnswers.join('\n') : 'No wrong answers found'}

💡 EXPLANATION:
${correctExplanation}

🔗 Full Response:f
${JSON.stringify(data, null, 2)}
      `.trim()
      
      // Open a new window to display the quiz
      const newWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes')
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Quiz Generation Test Result</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  padding: 20px; 
                  background: #f5f5f5; 
                  line-height: 1.6;
                }
                .container { 
                  background: white; 
                  padding: 30px; 
                  border-radius: 10px; 
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  max-width: 800px;
                  margin: 0 auto;
                }
                h1 { color: #2563eb; text-align: center; }
                .section { margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; }
                .question { font-size: 18px; font-weight: bold; color: #1e40af; }
                .answer { color: #059669; font-weight: bold; }
                .wrong { color: #dc2626; }
                .explanation { color: #374151; font-style: italic; }
                pre { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 5px; overflow-x: auto; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🧠 Quiz Generation Test Result</h1>
                
                <div class="section">
                  <strong>📚 Subject:</strong> ${testData.subject}<br>
                  <strong>🎥 YouTube Context:</strong> ${JSON.parse(testData.youtubeContext).title}
                </div>
                
                <div class="section">
                  <div class="question">❓ QUESTION:</div>
                  <p>${quiz.question || 'No question found'}</p>
                </div>
                
                <div class="section">
                  <div class="answer">✅ CORRECT ANSWER:</div>
                  <p>${quiz.options[quiz.correctAnswer] || 'No correct answer found'}</p>
                </div>
                
                <div class="section">
                  <div class="wrong">❌ WRONG OPTIONS:</div>
                  <ul>
                    ${wrongAnswers.length > 0 ? wrongAnswers.map((answer: string) => `<li>${answer}</li>`).join('') : '<li>No wrong answers found</li>'}
                  </ul>
                </div>
                
                <div class="section">
                  <div class="explanation">💡 EXPLANATION:</div>
                  <p>${correctExplanation}</p>
                </div>
                
                <div class="section">
                  <strong>🔗 Full JSON Response:</strong>
                  <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
              </div>
            </body>
          </html>
        `)
        newWindow.document.close()
      } else {
        // Fallback to alert if popup blocked
        alert(quizOutput)
      }
    } catch (error) {
      const err = error as any
      const errorDetails = `
❌ QUIZ GENERATION FAILED ❌

🚨 Error: ${err.message || 'Unknown error'}

📝 Test Data Used:
Subject: Calculus
YouTube Context: Watching Cat Videos for 10 Hours Straight

🔍 Full Error:
${JSON.stringify(err, null, 2)}
      `.trim()
      
      alert(errorDetails)
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
          <button className="action-button" onClick={openSettingsPage}>
            <span className="action-button-icon">⚙️</span>
            Settings
          </button>
          <button className="action-button" onClick={testQuizGeneration}>
            <span className="action-button-icon">🧪</span>
            Test Quiz
          </button>
        </div>
      </div>
    </div>
  )
}
