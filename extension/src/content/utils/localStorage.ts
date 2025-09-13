import { VideoData } from './videoExtractor'

export interface StoredVideo extends VideoData {
  questions?: string[]
  tags?: string[]
  notes?: string
}

export class LocalStorage {
  private static readonly STORAGE_KEY = 'sigmascholar_videos'

  static async saveVideo(videoData: VideoData): Promise<void> {
    try {
      const existingVideos = await this.getAllVideos()
      const videoWithId: StoredVideo = {
        ...videoData,
        questions: [],
        tags: [],
        notes: ''
      }
      
      // Check if video already exists (by URL or ID)
      const existingIndex = existingVideos.findIndex(v => 
        v.url === videoData.url || v.id === videoData.id
      )
      
      if (existingIndex >= 0) {
        // Update existing video but preserve questions, tags, notes
        existingVideos[existingIndex] = {
          ...videoWithId,
          questions: existingVideos[existingIndex].questions || [],
          tags: existingVideos[existingIndex].tags || [],
          notes: existingVideos[existingIndex].notes || ''
        }
      } else {
        // Add new video
        existingVideos.push(videoWithId)
      }
      
      await chrome.storage.local.set({ [this.STORAGE_KEY]: existingVideos })
      console.log('Video saved to local storage:', videoData.title)
    } catch (error) {
      console.error('Error saving video:', error)
    }
  }

  static async getAllVideos(): Promise<StoredVideo[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY])
      return result[this.STORAGE_KEY] || []
    } catch (error) {
      console.error('Error getting videos:', error)
      return []
    }
  }

  static async getVideoById(id: string): Promise<StoredVideo | null> {
    try {
      const videos = await this.getAllVideos()
      return videos.find(v => v.id === id) || null
    } catch (error) {
      console.error('Error getting video by ID:', error)
      return null
    }
  }

  static async updateVideoQuestions(id: string, questions: string[]): Promise<void> {
    try {
      const videos = await this.getAllVideos()
      const videoIndex = videos.findIndex(v => v.id === id)
      
      if (videoIndex >= 0) {
        videos[videoIndex].questions = questions
        await chrome.storage.local.set({ [this.STORAGE_KEY]: videos })
        console.log('Questions updated for video:', id)
      }
    } catch (error) {
      console.error('Error updating questions:', error)
    }
  }

  static async addVideoTag(id: string, tag: string): Promise<void> {
    try {
      const videos = await this.getAllVideos()
      const videoIndex = videos.findIndex(v => v.id === id)
      
      if (videoIndex >= 0) {
        const currentTags = videos[videoIndex].tags || []
        if (!currentTags.includes(tag)) {
          videos[videoIndex].tags = [...currentTags, tag]
          await chrome.storage.local.set({ [this.STORAGE_KEY]: videos })
          console.log('Tag added to video:', tag)
        }
      }
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  static async updateVideoNotes(id: string, notes: string): Promise<void> {
    try {
      const videos = await this.getAllVideos()
      const videoIndex = videos.findIndex(v => v.id === id)
      
      if (videoIndex >= 0) {
        videos[videoIndex].notes = notes
        await chrome.storage.local.set({ [this.STORAGE_KEY]: videos })
        console.log('Notes updated for video:', id)
      }
    } catch (error) {
      console.error('Error updating notes:', error)
    }
  }

  static async deleteVideo(id: string): Promise<void> {
    try {
      const videos = await this.getAllVideos()
      const filteredVideos = videos.filter(v => v.id !== id)
      await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredVideos })
      console.log('Video deleted:', id)
    } catch (error) {
      console.error('Error deleting video:', error)
    }
  }

  static async getVideosByPlatform(platform: VideoData['platform']): Promise<StoredVideo[]> {
    try {
      const videos = await this.getAllVideos()
      return videos.filter(v => v.platform === platform)
    } catch (error) {
      console.error('Error getting videos by platform:', error)
      return []
    }
  }
}
