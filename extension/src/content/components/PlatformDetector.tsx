import Logo from '@/assets/crx.svg'
import { useState, useEffect } from 'react'
import './PlatformDetector.css'
import { VideoExtractor, VideoData } from '../utils/videoExtractor'
import { LocalStorage } from '../utils/localStorage'
import { CohereAPI } from '../utils/cohereAPI'

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
        console.log(`SigmaScholar: Detected ${detectedPlatform}`, window.location.href)
        onPlatformDetected?.(detectedPlatform)
        
        // Extract video data when platform is detected
        setTimeout(() => {
          const videoData = VideoExtractor.extractCurrentVideo()
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

  const handleGenerateQuestions = async () => {
    if (!currentVideo) return
    
    setIsProcessing(true)
    try {
      // For now, we'll use a placeholder API key prompt
      // In production, this should be configured in settings
      const apiKey = prompt('Enter your Cohere API key (get one free at cohere.ai):')
      if (!apiKey) {
        setIsProcessing(false)
        return
      }
      
      CohereAPI.setApiKey(apiKey)
      const questions = await CohereAPI.generateQuestions(currentVideo)
      
      await LocalStorage.saveVideo(currentVideo)
      await LocalStorage.updateVideoQuestions(currentVideo.id, questions)
      
      alert(`Generated ${questions.length} study questions!\n\n${questions.join('\n\n')}`)
    } catch (error) {
      console.error('Error generating questions:', error)
      alert('Error generating questions. Please check your API key and try again.')
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
    <div className="platform-detector">
      {show && (
        <div className={`platform-popup ${show ? 'opacity-100' : 'opacity-0'}`}>
          <h3 style={{ color: platformInfo.color }}>📱 {platformInfo.name} Detected!</h3>
          <p>SigmaScholar is ready to help with your research.</p>
          <div className="platform-actions">
            <button 
              className="action-btn" 
              onClick={handleSaveForResearch}
              disabled={isProcessing || !currentVideo}
            >
              📚 Save for Research
            </button>
            <button 
              className="action-btn" 
              onClick={handleGenerateQuestions}
              disabled={isProcessing || !currentVideo}
            >
              🧠 Generate Questions
            </button>
            <button 
              className="action-btn" 
              onClick={handleAddTags}
              disabled={isProcessing || !currentVideo}
            >
              🏷️ Add Tags
            </button>
          </div>
          {isProcessing && (
            <div className="processing-indicator">
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
      <button 
        className="platform-toggle-button" 
        onClick={toggle}
        style={{ borderColor: platformInfo.color }}
      >
        <img src={Logo} alt="SigmaScholar" className="button-icon" />
        <span className="platform-badge" style={{ backgroundColor: platformInfo.color }}>
          {platform === 'youtube-shorts' ? '▶️' : platform === 'instagram-reels' ? '📸' : '🎵'}
        </span>
      </button>
    </div>
  )
}
