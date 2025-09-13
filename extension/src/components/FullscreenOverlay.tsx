import { useState } from 'react'
import './FullscreenOverlay.css'

interface FullscreenOverlayProps {
  isVisible: boolean
  onContinue: () => void
  platform: string
  viewCount: number
}

export default function FullscreenOverlay({ isVisible, onContinue, platform, viewCount }: FullscreenOverlayProps) {
  const [showQuestions, setShowQuestions] = useState(false)

  if (!isVisible) return null

  const getPlatformEmoji = () => {
    switch (platform) {
      case 'youtube-shorts': return '▶️'
      case 'instagram-reels': return '📸'
      case 'tiktok': return '🎵'
      default: return '📱'
    }
  }

  const getPlatformName = () => {
    switch (platform) {
      case 'youtube-shorts': return 'YouTube Shorts'
      case 'instagram-reels': return 'Instagram Reels'
      case 'tiktok': return 'TikTok'
      default: return 'Short Videos'
    }
  }

  return (
    <div className="fullscreen-overlay">
      <div className="overlay-content">
        <div className="overlay-header">
          <div className="platform-info">
            <span className="platform-emoji">{getPlatformEmoji()}</span>
            <h2>SigmaScholar Break</h2>
          </div>
          <div className="view-counter">
            <span className="counter-number">{viewCount}</span>
            <span className="counter-label">{getPlatformName()} viewed</span>
          </div>
        </div>

        <div className="overlay-body">
          {!showQuestions ? (
            <div className="break-message">
              <h3>Time for a quick learning break! 🧠</h3>
              <p>You've been watching {getPlatformName().toLowerCase()} for a while.</p>
              <p>Let's engage with some educational content to make your scrolling more productive.</p>
              
              <div className="action-buttons">
                <button 
                  className="primary-button"
                  onClick={() => setShowQuestions(true)}
                >
                  Start Learning Session
                </button>
                <button 
                  className="secondary-button"
                  onClick={onContinue}
                >
                  Continue Watching
                </button>
              </div>
            </div>
          ) : (
            <div className="questions-placeholder">
              <h3>📚 Learning Session</h3>
              <div className="placeholder-content">
                <div className="placeholder-box">
                  <h4>🔮 Coming Soon!</h4>
                  <p>This is where personalized questions based on your notes and study materials will appear.</p>
                  <ul>
                    <li>📝 Questions from your saved notes</li>
                    <li>🎯 Adaptive learning based on your subjects</li>
                    <li>⚡ Quick knowledge reinforcement</li>
                    <li>📊 Progress tracking</li>
                  </ul>
                </div>
                
                <div className="placeholder-actions">
                  <button 
                    className="primary-button"
                    onClick={onContinue}
                  >
                    Continue Watching (For Now)
                  </button>
                  <button 
                    className="tertiary-button"
                    onClick={() => setShowQuestions(false)}
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overlay-footer">
          <div className="sigma-branding">
            <span>Powered by SigmaScholar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
