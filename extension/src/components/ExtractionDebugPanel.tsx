import React, { useState, useEffect } from 'react'
import { VideoExtractor, VideoData } from '../content/utils/videoExtractor'
import './ExtractionDebugPanel.css'

export default function ExtractionDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentData, setCurrentData] = useState<VideoData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const performExtraction = () => {
    setIsExtracting(true)
    console.clear() // Clear console for clean logging
    
    setTimeout(() => {
      const data = VideoExtractor.extractCurrentVideo()
      setCurrentData(data)
      setIsExtracting(false)
    }, 100)
  }

  useEffect(() => {
    if (isOpen) {
      performExtraction()
    }
  }, [isOpen])

  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'high': return '#28a745'
      case 'medium': return '#ffc107' 
      case 'low': return '#dc3545'
      default: return '#6c757d'
    }
  }

  return (
    <div className="extraction-debug-panel">
      <button 
        className="debug-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔍 Content Debug {currentData && `(${currentData.extractionQuality})`}
      </button>
      
      {isOpen && (
        <div className="debug-content">
          <div className="debug-header">
            <h4>Content Extraction Debug</h4>
            <button onClick={performExtraction} disabled={isExtracting}>
              {isExtracting ? '🔄 Extracting...' : '🔄 Refresh'}
            </button>
          </div>
          
          {currentData ? (
            <div className="extraction-results">
              <div className="quality-indicator">
                <span 
                  className="quality-badge"
                  style={{ backgroundColor: getQualityColor(currentData.extractionQuality) }}
                >
                  {currentData.extractionQuality?.toUpperCase() || 'UNKNOWN'}
                </span>
                <span className="platform-badge">{currentData.platform}</span>
              </div>
              
              <div className="content-summary">
                <div className="content-item">
                  <strong>Title:</strong>
                  <span className={currentData.title.length > 10 ? 'success' : 'warning'}>
                    {currentData.title.length > 0 ? `✅ ${currentData.title.length} chars` : '❌ None'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Description:</strong>
                  <span className={currentData.description ? 'success' : 'warning'}>
                    {currentData.description ? `✅ ${currentData.description.length} chars` : '❌ None'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Author:</strong>
                  <span className={currentData.author ? 'success' : 'warning'}>
                    {currentData.author ? `✅ ${currentData.author}` : '❌ None'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Transcript:</strong>
                  <span className={currentData.transcript ? 'success' : 'warning'}>
                    {currentData.transcript ? `✅ ${currentData.transcript.length} chars` : '❌ None'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Duration:</strong>
                  <span className={currentData.duration && currentData.duration > 0 ? 'success' : 'warning'}>
                    {currentData.duration && currentData.duration > 0 ? `✅ ${currentData.duration.toFixed(1)}s` : '❌ Unknown'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Audio:</strong>
                  <span className={currentData.hasAudio ? 'success' : 'warning'}>
                    {currentData.hasAudio ? '✅ Yes' : '❌ No/Muted'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Hashtags:</strong>
                  <span className={currentData.hashtags && currentData.hashtags.length > 0 ? 'success' : 'warning'}>
                    {currentData.hashtags && currentData.hashtags.length > 0 ? `✅ ${currentData.hashtags.length}` : '❌ None'}
                  </span>
                </div>
                
                <div className="content-item">
                  <strong>Mentions:</strong>
                  <span className={currentData.mentions && currentData.mentions.length > 0 ? 'success' : 'warning'}>
                    {currentData.mentions && currentData.mentions.length > 0 ? `✅ ${currentData.mentions.length}` : '❌ None'}
                  </span>
                </div>
              </div>
              
              {currentData.extractionDetails && (
                <details className="technical-details">
                  <summary>Technical Details</summary>
                  <div className="tech-info">
                    <div><strong>Title Source:</strong> {currentData.extractionDetails.titleSource}</div>
                    <div><strong>Attempts:</strong> {currentData.extractionDetails.extractionAttempts}</div>
                    <div><strong>Failed Selectors:</strong> {currentData.extractionDetails.failedSelectors.length}</div>
                  </div>
                </details>
              )}
              
              <div className="content-preview">
                <details>
                  <summary>Content Preview</summary>
                  <div className="preview-content">
                    {currentData.title && (
                      <div><strong>Title:</strong> {currentData.title}</div>
                    )}
                    {currentData.description && (
                      <div><strong>Description:</strong> {currentData.description.substring(0, 200)}...</div>
                    )}
                    {currentData.transcript && (
                      <div><strong>Transcript:</strong> {currentData.transcript.substring(0, 200)}...</div>
                    )}
                    {currentData.hashtags && currentData.hashtags.length > 0 && (
                      <div><strong>Hashtags:</strong> {currentData.hashtags.join(', ')}</div>
                    )}
                    {currentData.mentions && currentData.mentions.length > 0 && (
                      <div><strong>Mentions:</strong> {currentData.mentions.join(', ')}</div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <div className="no-data">
              <p>No content detected on this page.</p>
              <small>Navigate to YouTube Shorts, Instagram Reels, or TikTok</small>
            </div>
          )}
        </div>
      )}
    </div>
  )
}