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
          console.group('[PlatformDetector] 🔍 Video Data Extraction')
          console.log('Current URL:', window.location.href)
          console.log('Platform detected:', detectedPlatform)
          
          const videoData = VideoExtractor.extractCurrentVideo()
          
          if (videoData) {
            console.log('📊 Extraction Results Summary:')
            console.table({
              'Platform': videoData.platform,
              'Title Length': videoData.title?.length || 0,
              'Has Description': !!videoData.description,
              'Has Author': !!videoData.author,
              'Has Transcript': !!videoData.transcript,
              'Has Audio': !!videoData.hasAudio,
              'Duration': videoData.duration || 'Unknown',
              'Hashtags Count': videoData.hashtags?.length || 0,
              'Mentions Count': videoData.mentions?.length || 0,
              'Quality': videoData.extractionQuality || 'unknown'
            })
            
            if (videoData.extractionDetails) {
              console.log('🔧 Technical Details:')
              console.log('Title source selector:', videoData.extractionDetails.titleSource)
              console.log('Extraction attempts:', videoData.extractionDetails.extractionAttempts)
              console.log('Failed selectors:', videoData.extractionDetails.failedSelectors)
            }
            
            // Log actual content (truncated)
            console.log('📝 Content Preview:')
            if (videoData.title) console.log('Title:', videoData.title.substring(0, 100) + (videoData.title.length > 100 ? '...' : ''))
            if (videoData.description) console.log('Description:', videoData.description.substring(0, 100) + (videoData.description.length > 100 ? '...' : ''))
            if (videoData.author) console.log('Author:', videoData.author)
            if (videoData.transcript) console.log('Transcript:', videoData.transcript.substring(0, 100) + (videoData.transcript.length > 100 ? '...' : ''))
            if (videoData.hashtags && videoData.hashtags.length > 0) console.log('Hashtags:', videoData.hashtags)
            if (videoData.mentions && videoData.mentions.length > 0) console.log('Mentions:', videoData.mentions)
            
          } else {
            console.log('❌ No video data extracted')
            console.log('Available DOM elements:')
            console.log('- Video elements:', document.querySelectorAll('video').length)
            console.log('- H1 elements:', document.querySelectorAll('h1').length)
            console.log('- Meta elements:', document.querySelectorAll('meta').length)
          }
          
          console.groupEnd()
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
          <h3>📱 {platformInfo.name} Detected!</h3>
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
