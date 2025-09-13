// Shorts tracking utility for quiz blocker functionality
export interface ShortsSettings {
  quizFrequency: number // Show quiz every N shorts (default: 5)
  enabled: boolean
}

export class ShortsTracker {
  private static readonly STORAGE_KEY = 'sigmascholar_shorts_count'
  private static readonly SETTINGS_KEY = 'sigmascholar_quiz_settings'
  
  // Get current shorts count from storage
  static async getShortsCount(): Promise<number> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY)
      return result[this.STORAGE_KEY] || 0
    } catch (error) {
      console.error('Failed to get shorts count:', error)
      return 0
    }
  }
  
  // Increment shorts count
  static async incrementShortsCount(): Promise<number> {
    try {
      const currentCount = await this.getShortsCount()
      const newCount = currentCount + 1
      await chrome.storage.local.set({ [this.STORAGE_KEY]: newCount })
      return newCount
    } catch (error) {
      console.error('Failed to increment shorts count:', error)
      return 0
    }
  }
  
  // Get quiz settings
  static async getQuizSettings(): Promise<ShortsSettings> {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY)
      return result[this.SETTINGS_KEY] || { quizFrequency: 5, enabled: true }
    } catch (error) {
      console.error('Failed to get quiz settings:', error)
      return { quizFrequency: 5, enabled: true }
    }
  }
  
  // Update quiz settings
  static async updateQuizSettings(settings: Partial<ShortsSettings>): Promise<void> {
    try {
      const currentSettings = await this.getQuizSettings()
      const newSettings = { ...currentSettings, ...settings }
      await chrome.storage.local.set({ [this.SETTINGS_KEY]: newSettings })
    } catch (error) {
      console.error('Failed to update quiz settings:', error)
    }
  }
  
  // Check if quiz should be shown
  static async shouldShowQuiz(): Promise<boolean> {
    try {
      const settings = await this.getQuizSettings()
      if (!settings.enabled) return false
      
      const count = await this.getShortsCount()
      return count > 0 && count % settings.quizFrequency === 0
    } catch (error) {
      console.error('Failed to check quiz condition:', error)
      return false
    }
  }
  
  // Reset shorts count (for testing purposes)
  static async resetShortsCount(): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: 0 })
    } catch (error) {
      console.error('Failed to reset shorts count:', error)
    }
  }
  
  // Get debug info
  static async getDebugInfo(): Promise<{ count: number; settings: ShortsSettings; shouldShow: boolean }> {
    const count = await this.getShortsCount()
    const settings = await this.getQuizSettings()
    const shouldShow = await this.shouldShowQuiz()
    
    return { count, settings, shouldShow }
  }
}
