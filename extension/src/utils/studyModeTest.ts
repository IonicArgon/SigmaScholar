import { StudySessionManager } from './studySessionManager'
import { ShortsTracker } from './shortsTracker'

/**
 * Test utility to verify the complete Study Mode workflow
 */
export class StudyModeTest {
  /**
   * Test the complete study session workflow
   */
  static async testStudySessionWorkflow(testSubject: string = 'Test Subject'): Promise<void> {
    console.log('🧪 Starting Study Mode workflow test...')
    
    try {
      // 1. Test starting a study session
      console.log('1. Testing session start...')
      const sessionId = await StudySessionManager.startSession(testSubject)
      console.log(`✅ Session started: ${sessionId}`)
      
      // 2. Test recording video watches
      console.log('2. Testing video tracking...')
      await StudySessionManager.recordVideoWatched()
      await StudySessionManager.recordVideoWatched()
      console.log('✅ Video watches recorded')
      
      // 3. Test recording quiz attempts
      console.log('3. Testing quiz attempt tracking...')
      await StudySessionManager.recordQuizAttempt(true)  // Correct answer
      await StudySessionManager.recordQuizAttempt(false) // Incorrect answer
      await StudySessionManager.recordQuizAttempt(true)  // Correct answer
      console.log('✅ Quiz attempts recorded')
      
      // 4. Check current session stats
      console.log('4. Checking session stats...')
      const currentSession = await StudySessionManager.getCurrentSession()
      console.log('Current session stats:', currentSession.stats)
      
      // 5. Test ending the session
      console.log('5. Testing session end...')
      const finalStats = await StudySessionManager.endSession()
      console.log('✅ Session ended. Final stats:', finalStats)
      
      // 6. Test getting study statistics
      console.log('6. Testing study stats retrieval...')
      const studyStats = await StudySessionManager.getStudyStats(testSubject, 5)
      console.log('✅ Study stats retrieved:', studyStats)
      
      console.log('🎉 Study Mode workflow test completed successfully!')
      
    } catch (error) {
      console.error('❌ Study Mode workflow test failed:', error)
      throw error
    }
  }
  
  /**
   * Test ShortsTracker integration
   */
  static async testShortsTrackerIntegration(): Promise<void> {
    console.log('🧪 Testing ShortsTracker integration...')
    
    try {
      // Test setting and getting selected subject
      const testSubject = 'Integration Test Subject'
      await ShortsTracker.setSelectedSubject(testSubject)
      const retrievedSubject = await ShortsTracker.getSelectedSubject()
      
      if (retrievedSubject === testSubject) {
        console.log('✅ Subject selection works correctly')
      } else {
        throw new Error(`Subject mismatch: expected ${testSubject}, got ${retrievedSubject}`)
      }
      
      // Test quiz settings
      await ShortsTracker.updateQuizSettings({ enabled: true })
      const settings = await ShortsTracker.getQuizSettings()
      
      if (settings.enabled) {
        console.log('✅ Quiz settings work correctly')
      } else {
        throw new Error('Quiz settings not updated correctly')
      }
      
      console.log('🎉 ShortsTracker integration test completed successfully!')
      
    } catch (error) {
      console.error('❌ ShortsTracker integration test failed:', error)
      throw error
    }
  }
  
  /**
   * Run all tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🚀 Running complete Study Mode test suite...')
    
    try {
      await this.testShortsTrackerIntegration()
      await this.testStudySessionWorkflow()
      
      console.log('🎊 All Study Mode tests passed successfully!')
      
    } catch (error) {
      console.error('💥 Study Mode test suite failed:', error)
      throw error
    }
  }
}

// Export for use in development/testing
declare global {
  interface Window {
    StudyModeTest: typeof StudyModeTest
  }
}

if (typeof window !== 'undefined') {
  window.StudyModeTest = StudyModeTest
}
