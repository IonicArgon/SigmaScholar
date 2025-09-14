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
  private static currentSessionId: string | null = null
  private static currentStats: StudySessionStats = {
    quizCount: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    videosWatched: 0
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
        this.currentSessionId = data.sessionId
        this.currentStats = {
          quizCount: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          videosWatched: 0
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
    if (!this.currentSessionId) {
      console.warn('No active study session to end')
      return null
    }

    try {
      const endStudySession = httpsCallable(functions, 'endStudySession')
      const result = await endStudySession({
        sessionId: this.currentSessionId,
        ...this.currentStats
      })
      const data = result.data as any

      if (data.success) {
        const finalStats = this.currentStats
        this.currentSessionId = null
        this.currentStats = {
          quizCount: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          videosWatched: 0
        }
        
        console.log('Study session ended successfully:', data.stats)
        return finalStats
      } else {
        throw new Error('Failed to end study session')
      }
    } catch (error) {
      console.error('Error ending study session:', error)
      throw error
    }
  }

  /**
   * Record a quiz attempt
   */
  static async recordQuizAttempt(isCorrect: boolean): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('No active study session for quiz attempt')
      return
    }

    this.currentStats.quizCount++
    this.currentStats.totalAnswers++
    if (isCorrect) {
      this.currentStats.correctAnswers++
    }

    await this.updateSession()
  }

  /**
   * Record a video watched
   */
  static async recordVideoWatched(): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('No active study session for video tracking')
      return
    }

    this.currentStats.videosWatched++
    await this.updateSession()
  }

  /**
   * Update the current session with latest stats
   */
  private static async updateSession(): Promise<void> {
    if (!this.currentSessionId) return

    try {
      const updateStudySession = httpsCallable(functions, 'updateStudySession')
      await updateStudySession({
        sessionId: this.currentSessionId,
        ...this.currentStats
      })
    } catch (error) {
      console.error('Error updating study session:', error)
    }
  }

  /**
   * Get current session info
   */
  static getCurrentSession(): { sessionId: string | null, stats: StudySessionStats } {
    return {
      sessionId: this.currentSessionId,
      stats: { ...this.currentStats }
    }
  }

  /**
   * Check if there's an active session
   */
  static hasActiveSession(): boolean {
    return this.currentSessionId !== null
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
}
