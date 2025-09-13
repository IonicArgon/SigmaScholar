export interface VideoData {
  platform: 'youtube-shorts' | 'instagram-reels' | 'tiktok'
  title: string
  description?: string
  author?: string
  url: string
  timestamp: number
  id: string
}

export class VideoExtractor {
  static extractYouTubeShorts(): VideoData | null {
    try {
      // YouTube Shorts title extraction
      const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                          document.querySelector('#title h1 yt-formatted-string') ||
                          document.querySelector('h1[class*="title"]')
      
      const title = titleElement?.textContent?.trim() || 'Untitled YouTube Short'
      
      // Author extraction
      const authorElement = document.querySelector('#owner-name a') ||
                           document.querySelector('ytd-channel-name a') ||
                           document.querySelector('[class*="channel-name"]')
      
      const author = authorElement?.textContent?.trim() || 'Unknown Creator'
      
      // Description extraction (if available)
      const descElement = document.querySelector('#description-text') ||
                         document.querySelector('[class*="description"]')
      
      const description = descElement?.textContent?.trim()
      
      return {
        platform: 'youtube-shorts',
        title,
        description,
        author,
        url: window.location.href,
        timestamp: Date.now(),
        id: this.extractVideoId(window.location.href, 'youtube')
      }
    } catch (error) {
      console.error('YouTube extraction error:', error)
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
