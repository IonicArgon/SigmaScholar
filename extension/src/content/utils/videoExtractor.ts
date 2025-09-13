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
      console.group('[VideoExtractor] 🎬 YouTube Shorts Extraction Started')
      console.log('URL:', window.location.href)
      console.log('Page Title:', document.title)
      
      // DOM exploration for debugging
      console.log('🔍 DOM Exploration:')
      console.log('- Total links on page:', document.querySelectorAll('a').length)
      console.log('- Channel links (@):', document.querySelectorAll('a[href*="/@"]').length)
      console.log('- Channel links (/channel/):', document.querySelectorAll('a[href*="/channel/"]').length)
      console.log('- Elements with "channel" class:', document.querySelectorAll('[class*="channel"]').length)
      console.log('- Elements with "description" class:', document.querySelectorAll('[class*="description"]').length)
      console.log('- Elements with "metadata" class:', document.querySelectorAll('[class*="metadata"]').length)
      console.log('- YT attributed string elements:', document.querySelectorAll('span.yt-core-attributed-string').length)
      console.log('- YTP caption segments:', document.querySelectorAll('span.ytp-caption-segment').length)
      console.log('- YT Reel channel elements:', document.querySelectorAll('span.ytReelChannelBarViewModelChannelName').length)
      console.log('- YT attributed string links:', document.querySelectorAll('a.yt-core-attributed-string__link').length)
      
      // Enhanced selectors with fallbacks - Updated with actual YouTube Shorts HTML
      const titleSelectors = [
        // ACTUAL YouTube Shorts title selector (from your HTML)
        'span.yt-core-attributed-string[role="text"]',
        'span.yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap',
        
        // Fallbacks for other variations
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
      
      console.log('🔍 Trying title selectors...')
      for (const selector of titleSelectors) {
        extractionAttempts++
        titleElement = document.querySelector(selector)
        console.log(`  ${extractionAttempts}. "${selector}"`, titleElement ? '✅ Found' : '❌ Not found')
        
        if (titleElement?.textContent?.trim()) {
          title = titleElement.textContent.trim()
          titleSource = selector
          console.log(`✅ Title extracted: "${title.substring(0, 100)}${title.length > 100 ? '...' : ''}"`)
          break
        } else {
          failedSelectors.push(selector)
        }
      }
      
      // Extract transcript
      console.log('🎤 Attempting transcript extraction...')
      const transcript = this.extractYouTubeTranscript()
      console.log('Transcript result:', transcript ? `✅ ${transcript.length} characters` : '❌ None found')
      
      // Extract description
      console.log('📝 Attempting description extraction...')
      const description = this.extractYouTubeDescription()
      console.log('Description result:', description ? `✅ ${description.length} characters` : '❌ None found')
      
      // Extract author
      console.log('👤 Attempting author extraction...')
      const author = this.extractYouTubeAuthor()
      console.log('Author result:', author ? `✅ "${author}"` : '❌ None found')
      
      // Get video metadata
      console.log('🎞️ Extracting video metadata...')
      const videoElement = document.querySelector('video')
      const duration = videoElement?.duration || 0
      const hasAudio = videoElement ? !videoElement.muted && videoElement.volume > 0 : false
      console.log('Video element found:', !!videoElement)
      console.log('Duration:', duration > 0 ? `${duration.toFixed(1)}s` : 'Unknown')
      console.log('Has audio:', hasAudio)
      console.log('Video muted:', videoElement?.muted)
      console.log('Video volume:', videoElement?.volume)
      
      // Look for hashtags in description AND transcript
      console.log('🏷️ Looking for hashtags...')
      const combinedText = [description, transcript, title].filter(Boolean).join(' ')
      console.log('Combined text content:', `"${combinedText.substring(0, 200)}..."`)
      console.log('Combined text length:', combinedText.length)
      
      const hashtags = this.extractHashtags(combinedText)
      console.log('Hashtags found:', hashtags.length > 0 ? hashtags : 'None')
      
      // Look for mentions
      console.log('📢 Looking for mentions...')
      const mentions = this.extractMentions(combinedText)
      console.log('Mentions found:', mentions.length > 0 ? mentions : 'None')
      
      // Determine extraction quality
      let extractionQuality: 'high' | 'medium' | 'low' = 'low'
      if (transcript && transcript.length > 50) {
        extractionQuality = 'high'  // Lowered threshold since Shorts captions are shorter
      } else if (description && description.length > 50) {
        extractionQuality = 'medium'
      } else if (transcript && transcript.length > 20) {
        extractionQuality = 'medium'  // Even short transcripts are valuable
      }
      console.log('📊 Content quality assessment:', extractionQuality)
      
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
      
      console.log('📋 Final extraction summary:')
      console.table({
        'Title': title.length > 0 ? `✅ ${title.length} chars` : '❌ None',
        'Description': description ? `✅ ${description.length} chars` : '❌ None',
        'Author': author ? `✅ ${author}` : '❌ None',
        'Transcript': transcript ? `✅ ${transcript.length} chars` : '❌ None',
        'Duration': duration > 0 ? `✅ ${duration.toFixed(1)}s` : '❌ Unknown',
        'Audio': hasAudio ? '✅ Yes' : '❌ No/Muted',
        'Hashtags': hashtags.length > 0 ? `✅ ${hashtags.length}` : '❌ None',
        'Mentions': mentions.length > 0 ? `✅ ${mentions.length}` : '❌ None',
        'Quality': extractionQuality
      })
      
      console.groupEnd()
      return videoData
      
    } catch (error) {
      console.error('[VideoExtractor] ❌ YouTube extraction error:', error)
      console.groupEnd()
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
    console.log('Raw hashtag matches:', uniqueHashtags)
    console.log('Searching in text:', `"${text.substring(0, 100)}..."`)
    
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
    console.log('Raw mention matches:', uniqueMentions)
    console.log('Searching in text:', `"${text.substring(0, 100)}..."`)
    
    return uniqueMentions
  }

  static extractYouTubeTranscript(): string | null {
    try {
      console.log('🎤 Transcript extraction details:')
      
      // Method 1: Look for ACTUAL YouTube Shorts captions (from your HTML)
      const captionElements = document.querySelectorAll('span.ytp-caption-segment')
      console.log('YT Shorts caption elements found:', captionElements.length)
      
      if (captionElements.length > 0) {
        const captions = Array.from(captionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join(' ')
        console.log('Caption text length:', captions.length)
        
        if (captions.length > 10) {
          console.log('✅ Extracted captions from ytp-caption-segment:', captions.length, 'chars')
          return captions
        }
      }
      
      // Method 2: Look for existing transcript panel  
      const transcriptPanel = document.querySelector('#transcript-scrollbox, [aria-label*="transcript" i]')
      console.log('Transcript panel found:', !!transcriptPanel)
      
      if (transcriptPanel) {
        const transcriptItems = transcriptPanel.querySelectorAll('[data-params*="transcript"], .ytd-transcript-segment-renderer')
        console.log('Transcript items found:', transcriptItems.length)
        
        if (transcriptItems.length > 0) {
          const transcript = Array.from(transcriptItems)
            .map(item => item.textContent?.trim())
            .filter(text => text && text.length > 0)
            .join(' ')
          console.log('✅ Extracted transcript from panel:', transcript.length, 'chars')
          return transcript
        }
      }
      
      // Method 3: Look for other caption variations
      const otherCaptionElements = document.querySelectorAll('.captions-text, .ytp-caption-window-container span, [class*="caption"]')
      console.log('Other caption elements found:', otherCaptionElements.length)
      
      if (otherCaptionElements.length > 0) {
        const captions = Array.from(otherCaptionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join(' ')
        console.log('Other caption text length:', captions.length)
        
        if (captions.length > 10) {
          console.log('✅ Extracted other captions:', captions.length, 'chars')
          return captions
        }
      }
      
      // Method 4: Try to find transcript button
      const transcriptButton = document.querySelector('[aria-label*="transcript" i], [aria-label*="captions" i]')
      console.log('Transcript button found:', !!transcriptButton)
      if (transcriptButton) {
        console.log('Transcript button text:', transcriptButton.textContent)
        console.log('Transcript button aria-label:', transcriptButton.getAttribute('aria-label'))
      }
      
      console.log('❌ No transcript extracted')
      return null
      
    } catch (error) {
      console.error('Transcript extraction error:', error)
      return null
    }
  }

  static extractYouTubeDescription(): string | null {
    try {
      console.log('📝 Description extraction details:')
      
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
      
      // Also check for any text that might contain hashtags
      console.log('🔍 Looking for any text with hashtags...')
      const allTextElements = document.querySelectorAll('span, div, p')
      let bestHashtagText = ''
      let hashtagCount = 0
      
      for (const element of allTextElements) {
        const text = element.textContent || ''
        const hashtags = text.match(/#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi) || []
        if (hashtags.length > hashtagCount) {
          hashtagCount = hashtags.length
          bestHashtagText = text.trim()
        }
      }
      
      if (hashtagCount > 0) {
        console.log(`Found element with ${hashtagCount} hashtags: "${bestHashtagText.substring(0, 100)}..."`)
      }
      
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector)
        console.log(`  "${selector}":`, element ? '✅ Found' : '❌ Not found')
        
        if (element?.textContent?.trim()) {
          const description = element.textContent.trim()
          console.log(`✅ Description extracted (${description.length} chars):`, description.substring(0, 100) + (description.length > 100 ? '...' : ''))
          return description
        }
      }
      
      // Fallback: return the text with hashtags if we found any
      if (bestHashtagText && hashtagCount > 0) {
        console.log(`✅ Using hashtag-containing text as description (${bestHashtagText.length} chars)`)
        return bestHashtagText
      }
      
      console.log('❌ No description found')
      return null
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
