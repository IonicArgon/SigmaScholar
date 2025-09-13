import { VideoData } from './videoExtractor'

export interface ExportedVideo {
  extractedAt: string
  url: string
  platform: string
  videoData: VideoData
  contentSummary: {
    hasTitle: boolean
    hasAuthor: boolean
    hasTranscript: boolean
    hasDescription: boolean
    transcriptLength: number
    descriptionLength: number
    hashtagCount: number
    mentionCount: number
    duration: number | null
    extractionQuality: string
  }
}

export class JSONExporter {
  static exportVideoData(videoData: VideoData): ExportedVideo {
    const exportData: ExportedVideo = {
      extractedAt: new Date().toISOString(),
      url: window.location.href,
      platform: videoData.platform,
      videoData: videoData,
      contentSummary: {
        hasTitle: !!videoData.title && videoData.title !== 'Untitled YouTube Short',
        hasAuthor: !!videoData.author,
        hasTranscript: !!videoData.transcript,
        hasDescription: !!videoData.description,
        transcriptLength: videoData.transcript?.length || 0,
        descriptionLength: videoData.description?.length || 0,
        hashtagCount: videoData.hashtags?.length || 0,
        mentionCount: videoData.mentions?.length || 0,
        duration: videoData.duration || null,
        extractionQuality: videoData.extractionQuality || 'unknown'
      }
    }

    return exportData
  }

  static downloadJSON(videoData: VideoData, filename?: string): void {
    const exportData = this.exportVideoData(videoData)
    
    // Create filename if not provided
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      const platform = videoData.platform.replace('-', '_')
      const videoId = videoData.id.substring(0, 8)
      filename = `sigmascholar_${platform}_${videoId}_${timestamp}.json`
    }

    // Create and download the file
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the object URL
    URL.revokeObjectURL(url)
    
    console.log(`[JSONExporter] ✅ Downloaded: ${filename}`)
    console.log(`[JSONExporter] File size: ${(blob.size / 1024).toFixed(2)} KB`)
  }

  static copyToClipboard(videoData: VideoData): Promise<void> {
    const exportData = this.exportVideoData(videoData)
    const jsonString = JSON.stringify(exportData, null, 2)
    
    return navigator.clipboard.writeText(jsonString).then(() => {
      console.log('[JSONExporter] ✅ Copied to clipboard')
    }).catch(err => {
      console.error('[JSONExporter] ❌ Failed to copy to clipboard:', err)
      throw err
    })
  }

  static logToConsole(videoData: VideoData): void {
    const exportData = this.exportVideoData(videoData)
    
    console.group('[JSONExporter] 📋 Video Data Export')
    console.log('🔗 URL:', exportData.url)
    console.log('📱 Platform:', exportData.platform)
    console.log('⏰ Extracted at:', exportData.extractedAt)
    console.log('📊 Content Summary:')
    console.table(exportData.contentSummary)
    console.log('📋 Full JSON Data:')
    console.log(JSON.stringify(exportData, null, 2))
    console.groupEnd()
  }

  static exportMultiple(videos: VideoData[]): void {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalVideos: videos.length,
      videos: videos.map(video => this.exportVideoData(video))
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const filename = `sigmascholar_batch_${videos.length}_videos_${timestamp}.json`
    
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    
    console.log(`[JSONExporter] ✅ Downloaded batch: ${filename}`)
    console.log(`[JSONExporter] Total videos: ${videos.length}`)
  }
}