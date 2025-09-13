export interface VideoData {
  platform: 'youtube-shorts' | 'instagram-reels' | 'tiktok'
  title: string
  description?: string
  author?: string
  url: string
  timestamp: number
  id: string
  transcript?: string
  captions?: string[]
  duration?: number
  topics?: string[]
  hasAudio?: boolean
  hashtags?: string[]
  mentions?: string[]
  extractionQuality?: 'high' | 'medium' | 'low'
  extractionDetails?: {
    titleSource: string
    hasTranscript: boolean
    hasDescription: boolean
    extractionAttempts: number
    failedSelectors: string[]
  }
}

export class VideoExtractor {
  static extractYouTubeShorts(): VideoData | null {
    try {
      console.log('🎬 ═══════════════════════════════════════════════')
      console.log('📍 NEW SHORT:', window.location.href.split('/shorts/')[1]?.substring(0, 10) + '...')
      
      // Extract title
      const titleSelectors = [
        // EXACT selector from your HTML - the real title!
        'h2.ytShortsVideoTitleViewModelShortsVideoTitle span[role="text"]',
        'h2.ytShortsVideoTitleViewModelShortsVideoTitle span.yt-core-attributed-string',
        'h2.ytShortsVideoTitleViewModelShortsVideoTitle',
        // Previous selectors as fallbacks
        'span.yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap.yt-core-attributed-string--link-inherit-color',
        'span.yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap',
        'span.yt-core-attributed-string[role="text"]',
        'h1.ytd-watch-metadata yt-formatted-string',
        '#title h1 yt-formatted-string', 
        'h1[class*="title"]',
        'yt-formatted-string[class*="title"]',
        '[data-e2e="video-desc"]',
        '.ytd-video-primary-info-renderer h1'
      ]
      
      let titleElement = null
      let title = 'Untitled YouTube Short'
      let titleSource = 'fallback'
      let extractionAttempts = 0
      let failedSelectors: string[] = []
      
      // Navigation-related text to skip
      const skipTexts = ['skip navigation', 'skip to content', 'skip', 'navigation', 'menu', 'search']
      
      for (const selector of titleSelectors) {
        extractionAttempts++
        titleElement = document.querySelector(selector)
        
        if (titleElement?.textContent?.trim()) {
          let candidateTitle = titleElement.textContent.trim()
          const lowerTitle = candidateTitle.toLowerCase()
          
          // Skip if it's clearly navigation text
          const isNavigation = skipTexts.some(skipText => lowerTitle.includes(skipText))
          
          if (!isNavigation && candidateTitle.length > 3) {
            // Clean up the title - remove trailing hashtags for a cleaner title
            // But keep the full text for hashtag extraction later
            const hashtagIndex = candidateTitle.lastIndexOf('#')
            if (hashtagIndex > 10) {
              // If there's a hashtag, use text before it as the main title
              const titleWithoutHashtags = candidateTitle.substring(0, hashtagIndex).trim()
              if (titleWithoutHashtags.length > 10) {
                candidateTitle = titleWithoutHashtags
              }
            }
            
            title = candidateTitle
            titleSource = selector
            break
          } else {
            failedSelectors.push(`${selector} (skipped: "${candidateTitle}")`)
          }
        } else {
          failedSelectors.push(selector)
        }
      }
      
      // Extract description first (we might need it for title fallback)
      const description = this.extractYouTubeDescription()
      
      // If we still have a navigation title, try to extract from description as fallback
      if (title.toLowerCase().includes('skip') || title.toLowerCase().includes('navigation')) {
        if (description && description.length > 10) {
          // Use first line or first part before hashtags as title
          const lines = description.split('\n')
          const firstLine = lines[0].trim()
          
          // Look for text before hashtags
          const hashtagIndex = description.indexOf('#')
          let titleCandidate = ''
          
          if (hashtagIndex > 10) {
            titleCandidate = description.substring(0, hashtagIndex).trim()
          } else if (firstLine.length > 10 && firstLine.length < 200) {
            titleCandidate = firstLine
          }
          
          if (titleCandidate && titleCandidate.length > 10) {
            title = titleCandidate.length > 150 ? titleCandidate.substring(0, 150) + '...' : titleCandidate
            titleSource = 'description-fallback'
          }
        }
      }
      
      // Extract transcript
      const transcript = this.extractYouTubeTranscript()
      
      // Extract description (already extracted above)
      // const description = this.extractYouTubeDescription()
      
      // Extract author
      const author = this.extractYouTubeAuthor()
      
      // Get video metadata
      const videoElement = document.querySelector('video')
      const duration = videoElement?.duration || 0
      const hasAudio = videoElement ? !videoElement.muted && videoElement.volume > 0 : false
      
      // Look for hashtags in description AND transcript
      const combinedText = [description, transcript, title].filter(Boolean).join(' ')
      const hashtags = this.extractHashtags(combinedText)
      const mentions = this.extractMentions(combinedText)
      
      // Determine extraction quality
      let extractionQuality: 'high' | 'medium' | 'low' = 'low'
      if (transcript && transcript.length > 50) {
        extractionQuality = 'high'
      } else if (description && description.length > 50) {
        extractionQuality = 'medium'
      } else if (transcript && transcript.length > 20) {
        extractionQuality = 'medium'
      }
      
      // Clean, compact logging
      console.log('📝 TITLE:', title ? `"${title}"` : '❌ None')
      console.log('👤 AUTHOR:', author ? `"${author}"` : '❌ None')
      console.log('🎤 TRANSCRIPT:', transcript ? `"${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}" (${transcript.length} chars)` : '❌ None')
      console.log('⏱️  DURATION:', duration > 0 ? `${duration.toFixed(1)}s` : '❌ Unknown')
      console.log('📊 QUALITY:', extractionQuality.toUpperCase())
      console.log('═══════════════════════════════════════════════')
      
      const videoData: VideoData = {
        platform: 'youtube-shorts',
        title,
        description,
        author,
        url: window.location.href,
        timestamp: Date.now(),
        id: this.extractVideoId(window.location.href, 'youtube'),
        transcript,
        duration,
        hasAudio,
        extractionQuality,
        hashtags,
        mentions,
        extractionDetails: {
          titleSource,
          hasTranscript: !!transcript,
          hasDescription: !!description,
          extractionAttempts,
          failedSelectors
        }
      }
      
      return videoData
      
    } catch (error) {
      console.error('❌ YouTube extraction error:', error)
      return null
    }
  }

  static extractHashtags(text: string): string[] {
    if (!text) return []
    
    // Multiple hashtag patterns to catch different formats
    const hashtagPatterns = [
      /#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi,  // Standard hashtags
      /#[a-zA-Z0-9_]+/gi,                     // Basic alphanumeric
      /\#\w+/gi                               // Simple word-based
    ]
    
    let allMatches: string[] = []
    
    for (const pattern of hashtagPatterns) {
      const matches = text.match(pattern) || []
      allMatches = allMatches.concat(matches)
    }
    
    // Remove duplicates and clean up
    const uniqueHashtags = [...new Set(allMatches)]
    return uniqueHashtags
  }

  static extractMentions(text: string): string[] {
    if (!text) return []
    
    // Multiple mention patterns
    const mentionPatterns = [
      /@[\w.]+/gi,           // Standard mentions
      /@[a-zA-Z0-9_]+/gi,    // Basic alphanumeric
      /\@\w+/gi              // Simple word-based
    ]
    
    let allMatches: string[] = []
    
    for (const pattern of mentionPatterns) {
      const matches = text.match(pattern) || []
      allMatches = allMatches.concat(matches)
    }
    
    // Remove duplicates
    const uniqueMentions = [...new Set(allMatches)]
    return uniqueMentions
  }

  static extractYouTubeTranscript(): string | null {
    try {
      // Method 1: Look for ACTUAL YouTube Shorts captions (from your HTML)
      const captionElements = document.querySelectorAll('span.ytp-caption-segment')
      
      if (captionElements.length > 0) {
        const captions = Array.from(captionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join(' ')
        
        if (captions.length > 10) {
          return captions
        }
      }
      
      // Method 2: Look for existing transcript panel  
      const transcriptPanel = document.querySelector('#transcript-scrollbox, [aria-label*="transcript" i]')
      
      if (transcriptPanel) {
        const transcriptItems = transcriptPanel.querySelectorAll('[data-params*="transcript"], .ytd-transcript-segment-renderer')
        
        if (transcriptItems.length > 0) {
          const transcript = Array.from(transcriptItems)
            .map(item => item.textContent?.trim())
            .filter(text => text && text.length > 0)
            .join(' ')
          return transcript
        }
      }
      
      // Method 3: Look for other caption variations
      const otherCaptionElements = document.querySelectorAll('.captions-text, .ytp-caption-window-container span, [class*="caption"]')
      
      if (otherCaptionElements.length > 0) {
        const captions = Array.from(otherCaptionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join(' ')
        
        if (captions.length > 10) {
          return captions
        }
      }
      
      return null
      
    } catch (error) {
      console.error('Transcript extraction error:', error)
      return null
    }
  }

  static extractYouTubeDescription(): string | null {
    try {
      const descriptionSelectors = [
        // Shorts-specific selectors
        '[class*="shorts"] [class*="description"]',
        '.ytd-reel-video-renderer [class*="description"]',
        '[class*="reel"] [class*="metadata"] [class*="description"]',
        '.shorts-video-cell [class*="description"]',
        
        // Standard video description selectors
        '#description-text',
        '.ytd-expandable-video-description-body-renderer',
        '#meta-contents #description',
        '.description-content',
        '[data-testid="video-description"]',
        
        // More generic selectors
        '[class*="description-text"]',
        '[class*="video-description"]',
        'div[class*="description"]:not([class*="channel"])',
        
        // Fallback to any metadata that might contain description
        '[class*="metadata"] span:not([class*="channel"]):not([class*="views"])',
        '.ytd-watch-metadata span:not([class*="channel"])'
      ]
      
      // First try standard selectors
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector)
        
        if (element?.textContent?.trim()) {
          const description = element.textContent.trim()
          // Skip if it's obviously not a description (navigation, etc.)
          if (description.length > 10 && !description.toLowerCase().includes('skip navigation')) {
            return description
          }
        }
      }
      
      // Fallback: Look for any text that contains multiple hashtags (likely video description)
      const allTextElements = document.querySelectorAll('span, div, p')
      let bestDescription = ''
      let bestScore = 0
      
      for (const element of allTextElements) {
        const text = element.textContent?.trim() || ''
        
        // Skip short text, navigation elements, and common UI text
        if (text.length < 20 || 
            text.toLowerCase().includes('skip navigation') ||
            text.toLowerCase().includes('subscribe') ||
            text.toLowerCase().includes('like') ||
            text.toLowerCase().includes('share') ||
            text.toLowerCase().includes('views')) {
          continue
        }
        
        // Score based on hashtags and content length
        const hashtags = text.match(/#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi) || []
        const score = hashtags.length * 10 + Math.min(text.length / 10, 50)
        
        if (score > bestScore) {
          bestScore = score
          bestDescription = text
        }
      }
      
      return bestDescription || null
    } catch (error) {
      console.error('Description extraction error:', error)
      return null
    }
  }

  static extractYouTubeAuthor(): string | null {
    try {
      console.log('👤 Author extraction details:')
      
      // Enhanced author selectors for YouTube Shorts specifically - Updated with actual HTML
      const authorSelectors = [
        // ACTUAL YouTube Shorts author selectors (from your HTML)
        'span.ytReelChannelBarViewModelChannelName a.yt-core-attributed-string__link',
        'span.ytReelChannelBarViewModelChannelName a',
        '.ytReelChannelBarViewModelChannelName a[href*="/@"]',
        
        // More specific variations
        'a.yt-core-attributed-string__link.yt-core-attributed-string__link--call-to-action-color[href*="/@"]',
        'a.yt-core-attributed-string__link[href*="/@"]',
        
        // Shorts-specific selectors
        '[class*="YtdRichMetadataRenderer"] [class*="channel"] a',
        '.reel-video-in-sequence [class*="owner"] a',
        '[class*="shorts"] [class*="channel-name"] a',
        '[class*="shorts-video-cell"] [class*="channel"] a',
        '.ytd-reel-video-renderer [class*="channel"] a',
        
        // Standard YouTube selectors  
        '#channel-name a',
        '.ytd-channel-name a',
        '#owner-text a',
        '.ytd-video-owner-renderer a',
        '[data-testid="channel-name"]',
        
        // More generic fallbacks
        'a[href*="/channel/"]',
        'a[href*="/@"]',
        '[class*="channel"] a:not([href*="/shorts/"])',
        'span[class*="owner"] a',
        'div[class*="metadata"] a[href*="/channel/"]'
      ]
      
      // First, let's see what channel links exist on the page
      const allChannelLinks = document.querySelectorAll('a[href*="/channel/"], a[href*="/@"]')
      console.log(`Found ${allChannelLinks.length} channel links on page`)
      
      for (let i = 0; i < Math.min(5, allChannelLinks.length); i++) {
        const link = allChannelLinks[i] as HTMLElement
        const href = link.getAttribute('href')
        const text = link.textContent?.trim()
        const classes = link.className
        console.log(`Channel link ${i + 1}: "${text}" -> ${href} (classes: ${classes.substring(0, 50)}...)`)
      }
      
      // Also check for the specific YT attributed string elements
      const ytAttributedElements = document.querySelectorAll('span.ytReelChannelBarViewModelChannelName')
      console.log(`Found ${ytAttributedElements.length} ytReelChannelBarViewModelChannelName elements`)
      
      for (const selector of authorSelectors) {
        const element = document.querySelector(selector)
        console.log(`  "${selector}":`, element ? '✅ Found' : '❌ Not found')
        
        if (element?.textContent?.trim()) {
          const author = element.textContent.trim()
          // Skip if it's clearly not a channel name (too short, contains weird characters, etc.)
          if (author.length > 1 && !author.includes('http') && !author.match(/^\d+$/)) {
            console.log(`✅ Author extracted: "${author}"`)
            return author
          } else {
            console.log(`⚠️ Skipped invalid author: "${author}"`)
          }
        }
      }
      
      // Fallback: try to extract from URL or page title
      const urlMatch = window.location.pathname.match(/@([^/]+)/)
      if (urlMatch) {
        const authorFromUrl = urlMatch[1]
        console.log(`✅ Author extracted from URL: "${authorFromUrl}"`)
        return authorFromUrl
      }
      
      console.log('❌ No author found')
      return null
    } catch (error) {
      console.error('Author extraction error:', error)
      return null
    }
  }

  static extractInstagramReels(): VideoData | null {
    try {
      // Instagram Reels title/caption extraction
      const captionElement = document.querySelector('article h1') ||
                            document.querySelector('[data-testid="post-caption"]') ||
                            document.querySelector('span[dir="auto"]') ||
                            document.querySelector('div[class*="caption"]')
      
      const title = captionElement?.textContent?.trim() || 'Instagram Reel'
      
      // Author extraction
      const authorElement = document.querySelector('header a[role="link"]') ||
                           document.querySelector('[data-testid="post-username"]') ||
                           document.querySelector('a[class*="username"]')
      
      const author = authorElement?.textContent?.trim() || 'Unknown User'
      
      return {
        platform: 'instagram-reels',
        title: title.length > 100 ? title.substring(0, 100) + '...' : title,
        author,
        url: window.location.href,
        timestamp: Date.now(),
        id: this.extractVideoId(window.location.href, 'instagram')
      }
    } catch (error) {
      console.error('Instagram extraction error:', error)
      return null
    }
  }

  static extractTikTok(): VideoData | null {
    try {
      // TikTok title/description extraction
      const titleElement = document.querySelector('[data-e2e="browse-video-desc"]') ||
                          document.querySelector('div[class*="video-meta-caption"]') ||
                          document.querySelector('span[class*="SpanText"]') ||
                          document.querySelector('h1[data-e2e="video-desc"]')
      
      const title = titleElement?.textContent?.trim() || 'TikTok Video'
      
      // Author extraction
      const authorElement = document.querySelector('[data-e2e="video-author-uniqueid"]') ||
                           document.querySelector('span[data-e2e="video-author-nickname"]') ||
                           document.querySelector('a[class*="author"]')
      
      const author = authorElement?.textContent?.trim() || 'Unknown Creator'
      
      return {
        platform: 'tiktok',
        title: title.length > 150 ? title.substring(0, 150) + '...' : title,
        author,
        url: window.location.href,
        timestamp: Date.now(),
        id: this.extractVideoId(window.location.href, 'tiktok')
      }
    } catch (error) {
      console.error('TikTok extraction error:', error)
      return null
    }
  }

  static extractVideoId(url: string, platform: string): string {
    try {
      switch (platform) {
        case 'youtube':
          const ytMatch = url.match(/\/shorts\/([^?&]+)/)
          return ytMatch ? ytMatch[1] : Date.now().toString()
        
        case 'instagram':
          const igMatch = url.match(/\/reel\/([^/?]+)/)
          return igMatch ? igMatch[1] : Date.now().toString()
        
        case 'tiktok':
          const ttMatch = url.match(/\/video\/(\d+)/)
          return ttMatch ? ttMatch[1] : Date.now().toString()
        
        default:
          return Date.now().toString()
      }
    } catch {
      return Date.now().toString()
    }
  }

  static extractCurrentVideo(): VideoData | null {
    const hostname = window.location.hostname
    const url = window.location.href

    if (hostname.includes('youtube.com') && url.includes('/shorts/')) {
      return this.extractYouTubeShorts()
    }
    
    if (hostname.includes('instagram.com') && url.includes('/reel/')) {
      return this.extractInstagramReels()
    }
    
    if (hostname.includes('tiktok.com')) {
      return this.extractTikTok()
    }

    return null
  }
}
