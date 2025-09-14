import { onCall } from 'firebase-functions/v2/https'
import { firestore } from '../lib/firebase'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * Start a new study session for a user and subject
 */
export const startStudySession = onCall<{
  subject: string
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { subject } = data
  
  if (!subject) {
    throw new Error('Subject is required')
  }
  
  console.log(`[startStudySession] Starting session for user: ${auth.token.uid}, subject: ${subject}`)
  
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create study session document
    const sessionData = {
      userId: auth.token.uid,
      subject: subject,
      sessionId: sessionId,
      startTime: FieldValue.serverTimestamp(),
      endTime: null,
      quizCount: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      videosWatched: 0,
      status: 'active'
    }
    
    // Add session to study-sessions collection
    await firestore.collection('study-sessions').doc(sessionId).set(sessionData)
    
    // Update user's subject session count
    const userRef = firestore.collection('users').doc(auth.token.uid)
    const userDoc = await userRef.get()
    
    if (userDoc.exists) {
      const userData = userDoc.data()
      const subjects = userData?.subjects || []
      
      // Find and update the subject's session count
      const updatedSubjects = subjects.map((subj: any) => {
        if (subj.name === subject) {
          return {
            ...subj,
            sessionCount: (subj.sessionCount || 0) + 1,
            lastSessionDate: new Date().toISOString()
          }
        }
        return subj
      })
      
      await userRef.update({ subjects: updatedSubjects })
    }
    
    console.log(`[startStudySession] Session ${sessionId} started successfully`)
    
    return {
      success: true,
      sessionId: sessionId,
      message: `Study session started for ${subject}`
    }
    
  } catch (error) {
    console.error(`[startStudySession] Error:`, error)
    throw new Error(`Failed to start study session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

/**
 * End a study session and record final stats
 */
export const endStudySession = onCall<{
  sessionId: string
  quizCount?: number
  correctAnswers?: number
  totalAnswers?: number
  videosWatched?: number
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { sessionId, quizCount = 0, correctAnswers = 0, totalAnswers = 0, videosWatched = 0 } = data
  
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  
  console.log(`[endStudySession] Ending session: ${sessionId}`)
  
  try {
    const sessionRef = firestore.collection('study-sessions').doc(sessionId)
    const sessionDoc = await sessionRef.get()
    
    if (!sessionDoc.exists) {
      throw new Error('Study session not found')
    }
    
    const sessionData = sessionDoc.data()
    
    // Verify session belongs to user
    if (sessionData?.userId !== auth.token.uid) {
      throw new Error('Unauthorized access to study session')
    }
    
    // Update session with final stats
    await sessionRef.update({
      endTime: FieldValue.serverTimestamp(),
      quizCount: quizCount,
      correctAnswers: correctAnswers,
      totalAnswers: totalAnswers,
      videosWatched: videosWatched,
      status: 'completed',
      accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0
    })
    
    console.log(`[endStudySession] Session ${sessionId} ended successfully`)
    
    return {
      success: true,
      message: 'Study session ended successfully',
      stats: {
        quizCount,
        correctAnswers,
        totalAnswers,
        videosWatched,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0
      }
    }
    
  } catch (error) {
    console.error(`[endStudySession] Error:`, error)
    throw new Error(`Failed to end study session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

/**
 * Update study session stats (called during active session)
 */
export const updateStudySession = onCall<{
  sessionId: string
  quizCount?: number
  correctAnswers?: number
  totalAnswers?: number
  videosWatched?: number
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { sessionId, quizCount, correctAnswers, totalAnswers, videosWatched } = data
  
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  
  try {
    const sessionRef = firestore.collection('study-sessions').doc(sessionId)
    const sessionDoc = await sessionRef.get()
    
    if (!sessionDoc.exists) {
      throw new Error('Study session not found')
    }
    
    const sessionData = sessionDoc.data()
    
    // Verify session belongs to user and is active
    if (sessionData?.userId !== auth.token.uid) {
      throw new Error('Unauthorized access to study session')
    }
    
    if (sessionData?.status !== 'active') {
      throw new Error('Cannot update inactive study session')
    }
    
    // Build update object with only provided fields
    const updateData: any = {}
    if (quizCount !== undefined) updateData.quizCount = quizCount
    if (correctAnswers !== undefined) updateData.correctAnswers = correctAnswers
    if (totalAnswers !== undefined) updateData.totalAnswers = totalAnswers
    if (videosWatched !== undefined) updateData.videosWatched = videosWatched
    
    // Calculate accuracy if we have answer data
    if (totalAnswers !== undefined && correctAnswers !== undefined) {
      updateData.accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0
    }
    
    await sessionRef.update(updateData)
    
    return {
      success: true,
      message: 'Study session updated successfully'
    }
    
  } catch (error) {
    console.error(`[updateStudySession] Error:`, error)
    throw new Error(`Failed to update study session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

/**
 * Get study session statistics for a user and subject
 */
export const getStudyStats = onCall<{
  subject?: string
  limit?: number
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { subject, limit = 10 } = data
  
  try {
    let query = firestore.collection('study-sessions')
      .where('userId', '==', auth.token.uid)
      .orderBy('startTime', 'desc')
      .limit(limit)
    
    if (subject) {
      query = query.where('subject', '==', subject)
    }
    
    const sessionsSnapshot = await query.get()
    
    const sessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[]
    
    // Calculate aggregate stats
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.status === 'completed')
    const totalQuizzes = completedSessions.reduce((sum, s) => sum + (s.quizCount || 0), 0)
    const totalCorrect = completedSessions.reduce((sum, s) => sum + (s.correctAnswers || 0), 0)
    const totalAnswers = completedSessions.reduce((sum, s) => sum + (s.totalAnswers || 0), 0)
    const averageAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0
    
    return {
      success: true,
      sessions: sessions,
      stats: {
        totalSessions,
        completedSessions: completedSessions.length,
        totalQuizzes,
        totalCorrect,
        totalAnswers,
        averageAccuracy: Math.round(averageAccuracy * 100) / 100
      }
    }
    
  } catch (error) {
    console.error(`[getStudyStats] Error:`, error)
    throw new Error(`Failed to get study stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})
