import Logo from '@/assets/crx.svg'
import { useState, useEffect } from 'react'
import './PlatformDetector.css'

type Platform = 'youtube-shorts' | 'instagram-reels' | 'tiktok' | 'other'

interface PlatformDetectorProps {
  onPlatformDetected?: (platform: Platform) => void
}

export default function PlatformDetector({ onPlatformDetected }: PlatformDetectorProps) {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [isDetected, setIsDetected] = useState(false)
  
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

  return (
    <div className="platform-detector">
      {show && (
        <div className={`platform-popup ${show ? 'opacity-100' : 'opacity-0'}`}>
          <h3 style={{ color: platformInfo.color }}>📱 {platformInfo.name} Detected!</h3>
          <p>SigmaScholar is ready to help with your research.</p>
          <div className="platform-actions">
            <button className="action-btn">📚 Save for Research</button>
            <button className="action-btn">🏷️ Add Tags</button>
            <button className="action-btn">📝 Take Notes</button>
          </div>
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
