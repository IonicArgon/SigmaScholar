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
      status: 'active',
      updatedAt: FieldValue.serverTimestamp()
    }
    
    // Add session to study-sessions collection
    await firestore.collection('study-sessions').doc(sessionId).set(sessionData)
    
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
 * End a study session
 */
export const endStudySession = onCall<{
  sessionId?: string
  quizCount?: number
  correctAnswers?: number
  totalAnswers?: number
  videosWatched?: number
  forceEnd?: boolean
  autoEnded?: boolean
}>({}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }

  const { uid } = auth.token
  const { sessionId, quizCount = 0, correctAnswers = 0, totalAnswers = 0, videosWatched = 0, forceEnd = false, autoEnded = false } = data
  
  console.log(`[endStudySession] Called for UID: ${uid}, sessionId: ${sessionId}, forceEnd: ${forceEnd}, autoEnded: ${autoEnded}`)
  
  try {
    let session: any = null
    
    if (sessionId) {
      // End specific session
      console.log(`[endStudySession] Looking for specific session: ${sessionId}`)
      const sessionDoc = await firestore.collection('study-sessions').doc(sessionId).get()
      if (!sessionDoc.exists) {
        console.error(`[endStudySession] Session ${sessionId} not found`)
        throw new Error('Session not found')
      }
      if (sessionDoc.data()?.userId !== uid) {
        console.error(`[endStudySession] Session ${sessionId} unauthorized for user ${uid}`)
        throw new Error('Session unauthorized')
      }
      session = { id: sessionDoc.id, ...sessionDoc.data() }
      console.log(`[endStudySession] Found session:`, session)
    } else {
      // Find and end any active session for this user
      console.log(`[endStudySession] Looking for active sessions for user: ${uid}`)
      const activeSessions = await firestore.collection('study-sessions')
        .where('userId', '==', uid)
        .where('status', '==', 'active')
        .get()
      
      console.log(`[endStudySession] Found ${activeSessions.docs.length} active sessions`)
      
      if (activeSessions.empty) {
        if (forceEnd) {
          console.log(`[endStudySession] No active session to force end`)
          return {
            success: true,
            message: 'No active session to end'
          }
        }
        console.error(`[endStudySession] No active session found for user ${uid}`)
        throw new Error('No active session found')
      }
      
      // Use the first active session
      const sessionDoc = activeSessions.docs[0]
      session = { id: sessionDoc.id, ...sessionDoc.data() }
      console.log(`[endStudySession] Using active session:`, session)
    }
    
    // Calculate final stats
    const finalStats = {
      quizCount: Math.max(quizCount, session.quizCount || 0),
      correctAnswers: Math.max(correctAnswers, session.correctAnswers || 0),
      totalAnswers: Math.max(totalAnswers, session.totalAnswers || 0),
      videosWatched: Math.max(videosWatched, session.videosWatched || 0),
      accuracy: 0
    }
    
    finalStats.accuracy = finalStats.totalAnswers > 0 ? 
      Math.round((finalStats.correctAnswers / finalStats.totalAnswers) * 100) : 0
    
    console.log(`[endStudySession] Final stats calculated:`, finalStats)
    
    // Update session document
    const updateData: any = {
      endTime: FieldValue.serverTimestamp(),
      status: 'completed',
      quizCount: finalStats.quizCount,
      correctAnswers: finalStats.correctAnswers,
      totalAnswers: finalStats.totalAnswers,
      videosWatched: finalStats.videosWatched,
      accuracy: finalStats.accuracy,
      updatedAt: FieldValue.serverTimestamp()
    }
    
    if (autoEnded) {
      updateData.endReason = 'auto_timeout'
    } else if (forceEnd) {
      updateData.endReason = 'force_ended'
    } else {
      updateData.endReason = 'user_ended'
    }
    
    console.log(`[endStudySession] Updating session ${session.id} with data:`, updateData)
    await firestore.collection('study-sessions').doc(session.id).update(updateData)
    console.log(`[endStudySession] Session document updated successfully`)
    
    // Update subject session count and last session date in the subjects collection
    const subjectsQuery = await firestore.collection('subjects')
      .where('userId', '==', uid)
      .where('name', '==', session.subject)
      .get()
    
    console.log(`[endStudySession] Looking for subject "${session.subject}" for user ${uid}`)
    if (!subjectsQuery.empty) {
      const subjectRef = subjectsQuery.docs[0].ref
      console.log(`[endStudySession] Updating subject session count for: ${session.subject}`)
      await subjectRef.update({
        sessionCount: FieldValue.increment(1),
        lastSessionDate: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      })
      console.log(`[endStudySession] Subject updated successfully`)
    } else {
      console.warn(`[endStudySession] Subject "${session.subject}" not found for user ${uid}`)
    }
    
    console.log(`[endStudySession] Session ${session.id} ended successfully for UID: ${uid} (${updateData.endReason})`)
    
    return {
      success: true,
      sessionId: session.id,
      stats: finalStats,
      message: 'Study session ended successfully'
    }
  } catch (error) {
    console.error('Error ending study session:', error)
    throw new Error('Failed to end study session')
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
