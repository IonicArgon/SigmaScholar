import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

export interface StudySessionStats {
  quizCount: number
  correctAnswers: number
  totalAnswers: number
  videosWatched: number
  accuracy?: number
}

export interface StudySession {
  sessionId: string
  subject: string
  startTime: any
  endTime?: any
  stats: StudySessionStats
  status: 'active' | 'completed'
}

export class StudySessionManager {
  private static readonly STORAGE_KEYS = {
    SESSION_ID: 'currentSessionId',
    SESSION_STATS: 'currentSessionStats'
  }

  private static async getCurrentSessionId(): Promise<string | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.SESSION_ID)
    return result[this.STORAGE_KEYS.SESSION_ID] || null
  }

  private static async setCurrentSessionId(sessionId: string | null): Promise<void> {
    if (sessionId) {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.SESSION_ID]: sessionId })
    } else {
      await chrome.storage.local.remove(this.STORAGE_KEYS.SESSION_ID)
    }
  }

  private static async getCurrentStats(): Promise<StudySessionStats> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.SESSION_STATS)
    return result[this.STORAGE_KEYS.SESSION_STATS] || {
      quizCount: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      videosWatched: 0
    }
  }

  private static async setCurrentStats(stats: StudySessionStats): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.SESSION_STATS]: stats })
  }

  private static async clearSessionData(): Promise<void> {
    await chrome.storage.local.remove([this.STORAGE_KEYS.SESSION_ID, this.STORAGE_KEYS.SESSION_STATS])
  }

  /**
   * Start a new study session
   */
  static async startSession(subject: string): Promise<string> {
    try {
      const startStudySession = httpsCallable(functions, 'startStudySession')
      const result = await startStudySession({ subject })
      const data = result.data as any

      if (data.success) {
        await this.setCurrentSessionId(data.sessionId)
        await this.setCurrentStats({
          quizCount: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          videosWatched: 0
        })

        // Send message to background script to start session
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            const sessionId = await this.getCurrentSessionId()
            const stats = await this.getCurrentStats()
            chrome.runtime.sendMessage({
              type: 'SESSION_STARTED',
              sessionId: sessionId,
              stats: stats
            })
          }
        } catch (error) {
          console.warn('Failed to notify background script of session start:', error)
        }

        console.log(`Study session started: ${data.sessionId} for subject: ${subject}`)
        return data.sessionId
      } else {
        throw new Error('Failed to start study session')
      }
    } catch (error) {
      console.error('Error starting study session:', error)
      throw error
    }
  }


  /**
   * End the current study session
   */
  static async endSession(): Promise<StudySessionStats | null> {
    const currentSessionId = await this.getCurrentSessionId()
    if (!currentSessionId) {
      console.warn('No active session to end')
      return null
    }

    console.log(`[StudySessionManager] Ending session ${currentSessionId} with stats:`, await this.getCurrentStats())

    try {
      const endStudySession = httpsCallable(functions, 'endStudySession')
      const requestData = {
        sessionId: currentSessionId,
        ...await this.getCurrentStats()
      }

      console.log(`[StudySessionManager] Calling endStudySession with data:`, requestData)
      const result = await endStudySession(requestData)
      const data = result.data as any

      console.log(`[StudySessionManager] endStudySession response:`, data)

      if (data.success) {
        const finalStats = await this.getCurrentStats()
        await this.clearSessionData()

        // Notify background script about session end
        try {
          chrome.runtime.sendMessage({
            type: 'SESSION_ENDED'
          })
        } catch (error) {
          console.warn('Failed to notify background script of session end:', error)
        }

        console.log('Study session ended successfully:', data.stats)
        return finalStats
      } else {
        console.error('endStudySession returned failure:', data)
        throw new Error('Failed to end study session')
      }
    } catch (error) {
      console.error('Error ending study session:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sessionId: currentSessionId,
        stats: await this.getCurrentStats()
      })
      throw error
    }
  }

  /**
   * Record a quiz attempt
   */
  static async recordQuizAttempt(isCorrect: boolean): Promise<void> {
    const currentSessionId = await this.getCurrentSessionId()
    if (!currentSessionId) {
      console.warn('No active session to record quiz attempt')
      return
    }

    const currentStats = await this.getCurrentStats()
    currentStats.quizCount++
    currentStats.totalAnswers++
    if (isCorrect) {
      currentStats.correctAnswers++
    }
    await this.setCurrentStats(currentStats)

    await this.updateSession()
  }

  /**
   * Record a video watched
   */
  static async recordVideoWatched(): Promise<void> {
    const currentSessionId = await this.getCurrentSessionId()
    if (!currentSessionId) {
      console.warn('No active session to record video watch')
      return
    }

    const currentStats = await this.getCurrentStats()
    currentStats.videosWatched++
    await this.setCurrentStats(currentStats)

    await this.updateSession()
  }

  /**
   * Update the current session with latest stats
   */
  private static async updateSession(): Promise<void> {
    const currentSessionId = await this.getCurrentSessionId()
    if (!currentSessionId) return

    try {
      const updateStudySession = httpsCallable(functions, 'updateStudySession')
      const currentStats = await this.getCurrentStats()
      await updateStudySession({
        sessionId: currentSessionId,
        ...currentStats
      })
    } catch (error) {
      console.error('Error updating study session:', error)
    }
  }

  /**
   * Get current session info
   */
  static async getCurrentSession(): Promise<{ sessionId: string | null, stats: StudySessionStats }> {
    return {
      sessionId: await this.getCurrentSessionId(),
      stats: await this.getCurrentStats()
    }
  }

  /**
   * Check if there's an active session
   */
  static async hasActiveSession(): Promise<boolean> {
    const currentSessionId = await this.getCurrentSessionId()
    return currentSessionId !== null
  }

  /**
   * Get study statistics for a subject
   */
  static async getStudyStats(subject?: string, limit: number = 10): Promise<any> {
    try {
      const getStudyStats = httpsCallable(functions, 'getStudyStats')
      const result = await getStudyStats({ subject, limit })
      const data = result.data as any

      if (data.success) {
        return data
      } else {
        throw new Error('Failed to get study stats')
      }
    } catch (error) {
      console.error('Error getting study stats:', error)
      throw error
    }
  }

  /**
   * Migrate existing subjects to include sessionCount and lastSessionDate
   */
  static async migrateSubjects(): Promise<void> {
    try {
      const migrateSubjects = httpsCallable(functions, 'migrateSubjects')
      const result = await migrateSubjects({})
      const data = result.data as any

      if (data.success) {
        console.log(`Successfully migrated ${data.migratedCount} subjects`)
      } else {
        throw new Error('Failed to migrate subjects')
      }
    } catch (error) {
      console.error('Error migrating subjects:', error)
      throw error
    }
  }

  /**
   * Force end any active session (used for cleanup)
   */
  static async forceEndActiveSession(): Promise<void> {
    try {
      // Try to end via background script first
      chrome.runtime.sendMessage({
        type: 'END_ACTIVE_SESSION'
      }, (_response) => {
        if (chrome.runtime.lastError) {
          console.warn('Background script not available, ending session directly')
        }
      })

      // Also clear local state
      await this.clearSessionData()
    } catch (error) {
      console.error('Error force ending session:', error)
      throw error
    }
  }
}
