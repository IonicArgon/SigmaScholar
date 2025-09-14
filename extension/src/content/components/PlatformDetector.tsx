import Logo from '@/assets/crx.svg'
import { useState, useEffect } from 'react'
import './PlatformDetector.css'
import { VideoExtractor, VideoData } from '../utils/videoExtractor'
import { LocalStorage } from '../utils/localStorage'
import { JSONExporter } from '../utils/jsonExporter'

type Platform = 'youtube-shorts' | 'instagram-reels' | 'tiktok' | 'other'

interface PlatformDetectorProps {
  onPlatformDetected?: (platform: Platform) => void
}

export default function PlatformDetector({ onPlatformDetected }: PlatformDetectorProps) {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [isDetected, setIsDetected] = useState(false)
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const toggle = () => setShow(!show)

  // Detection function
  const detectPlatform = (): Platform => {
    const url = window.location.href
    const hostname = window.location.hostname
    
    // YouTube Shorts detection
    if (hostname.includes('youtube.com') && url.includes('/shorts/')) {
      return 'youtube-shorts'
    }
    
    // Instagram Reels detection
    if (hostname.includes('instagram.com') && 
        (url.includes('/reel/') || url.includes('/reels/'))) {
      return 'instagram-reels'
    }
    
    // TikTok detection
    if (hostname.includes('tiktok.com')) {
      return 'tiktok'
    }
    
    return 'other'
  }

  // Monitor URL changes (for SPAs like YouTube/Instagram)
  useEffect(() => {
    const checkPlatform = () => {
      const detectedPlatform = detectPlatform()
      setPlatform(detectedPlatform)
      setIsDetected(detectedPlatform !== 'other')
      
      if (detectedPlatform !== 'other') {
        // Platform detected
        onPlatformDetected?.(detectedPlatform)
        
        // Extract video data when platform is detected
        setTimeout(() => {
          // Video data extraction
          
          const videoData = VideoExtractor.extractCurrentVideo()
          
          if (videoData) {
            // Video data extracted successfully
            
          } else {
            // No video data extracted
          }
          
          // Extraction complete
          setCurrentVideo(videoData)
        }, 1000) // Wait for page to fully load
      }
    }

    // Initial check
    checkPlatform()

    // Listen for URL changes (pushState/replaceState)
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      setTimeout(checkPlatform, 500) // Increased delay for YouTube's heavy DOM updates
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      setTimeout(checkPlatform, 500)
    }

    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      setTimeout(checkPlatform, 500)
    })

    // Additional YouTube-specific listeners
    const observer = new MutationObserver(() => {
      checkPlatform()
    })

    // Watch for DOM changes that indicate navigation
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    })

    // Periodic check for URL changes (fallback)
    const intervalId = setInterval(checkPlatform, 2000)

    // Cleanup
    return () => {
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      window.removeEventListener('popstate', checkPlatform)
      observer.disconnect()
      clearInterval(intervalId)
    }
  }, [onPlatformDetected])

  // Only show the extension on detected platforms
  if (!isDetected) {
    return null
  }

  const getPlatformInfo = () => {
    switch (platform) {
      case 'youtube-shorts':
        return { name: 'YouTube Shorts', color: '#ff0000' }
      case 'instagram-reels':
        return { name: 'Instagram Reels', color: '#e4405f' }
      case 'tiktok':
        return { name: 'TikTok', color: '#000000' }
      default:
        return { name: 'Unknown', color: '#666' }
    }
  }

  const platformInfo = getPlatformInfo()

  // Action handlers
  const handleSaveForResearch = async () => {
    if (!currentVideo) return
    
    setIsProcessing(true)
    try {
      await LocalStorage.saveVideo(currentVideo)
      alert('Video saved for research!')
    } catch (error) {
      console.error('Error saving video:', error)
      alert('Error saving video. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportJSON = () => {
    if (!currentVideo) return
    
    setIsProcessing(true)
    try {
      // Download JSON file
      JSONExporter.downloadJSON(currentVideo)
      
      // Also log to console for easy access
      JSONExporter.logToConsole(currentVideo)
      
      alert('Video data exported to JSON file and logged to console!')
    } catch (error) {
      console.error('Error exporting JSON:', error)
      alert('Error exporting JSON. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCopyJSON = async () => {
    if (!currentVideo) return
    
    setIsProcessing(true)
    try {
      await JSONExporter.copyToClipboard(currentVideo)
      alert('Video data copied to clipboard as JSON!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('Error copying to clipboard. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddTags = async () => {
    if (!currentVideo) return
    
    const tag = prompt('Enter a tag for this video:')
    if (!tag) return
    
    try {
      await LocalStorage.saveVideo(currentVideo)
      await LocalStorage.addVideoTag(currentVideo.id, tag)
      alert(`Tag "${tag}" added!`)
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('Error adding tag. Please try again.')
    }
  }

  return (
    <div className="sigma-scholar-platform-detector">
      {show && (
        <div className={`sigma-scholar-platform-popup ${show ? 'opacity-100' : 'opacity-0'}`}>
          <h3>📱 {platformInfo.name} Detected!</h3>
          <p>SigmaScholar is ready to help with your research.</p>
          <div className="sigma-scholar-platform-actions">
            <button 
              className="sigma-scholar-action-btn" 
              onClick={handleSaveForResearch}
              disabled={isProcessing || !currentVideo}
            >
              📚 Save for Research
            </button>
            <button 
              className="action-btn" 
              onClick={handleExportJSON}
              disabled={isProcessing || !currentVideo}
            >
              📄 Export JSON
            </button>
            <button 
              className="action-btn" 
              onClick={handleCopyJSON}
              disabled={isProcessing || !currentVideo}
            >
              📋 Copy JSON
            </button>
            <button 
              className="sigma-scholar-action-btn" 
              onClick={handleAddTags}
              disabled={isProcessing || !currentVideo}
            >
              🏷️ Add Tags
            </button>
          </div>
          {isProcessing && (
            <div className="sigma-scholar-processing-indicator">
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
      <button 
        className="sigma-scholar-platform-toggle-button" 
        onClick={toggle}
        style={{ borderColor: platformInfo.color }}
      >
        <img src={Logo} alt="SigmaScholar" className="sigma-scholar-button-icon" />
        <span className="sigma-scholar-platform-badge" style={{ backgroundColor: platformInfo.color }}>
          {platform === 'youtube-shorts' ? '▶️' : platform === 'instagram-reels' ? '📸' : '🎵'}
        </span>
      </button>
    </div>
  )
}
