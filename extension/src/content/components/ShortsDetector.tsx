import React, { useState, useEffect } from 'react'
import { QuizBlocker } from '../../components/QuizBlocker'
import { ShortsTracker } from '../../utils/shortsTracker'
import { StudySessionManager } from '../../utils/studySessionManager'
import { VideoExtractor } from '../utils/videoExtractor'

interface QuizQuestion {
  id?: string
  question: string
  type: string
  options: string[]
  correctAnswer: number
  explanations: {
    correct: string
    incorrect: string[]
  }
}

export const ShortsDetector: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [incorrectQuestions, setIncorrectQuestions] = useState<QuizQuestion[]>([])
  const [questionsUntilRetry, setQuestionsUntilRetry] = useState(0)
  const [wasVideoPaused, setWasVideoPaused] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    // Register this tab with background script
    chrome.runtime.sendMessage({
      type: 'REGISTER_YOUTUBE_TAB'
    })

    // Check initial quiz state
    checkQuizState()

    // Listen for messages from background script
    const messageListener = (message: any) => {
      if (message.type === 'BLOCK_CONTENT') {
        setIsBlocked(true)
        setBlockReason(message.reason || 'Quiz active on another tab')
        pauseYouTubeVideo()
      } else if (message.type === 'UNBLOCK_CONTENT') {
        setIsBlocked(false)
        setBlockReason('')
        resumeYouTubeVideo()
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    // Set up periodic quiz state checking to catch session ends
    const stateCheckInterval = setInterval(() => {
      if (isBlocked) {
        checkQuizState()
      }
    }, 2000) // Check every 2 seconds when blocked

    // Detect when user scrolls to a new short
    const detectShortScroll = () => {
      // YouTube Shorts specific detection
      if (window.location.pathname.includes('/shorts/')) {
        handleShortViewed()
      }
    }

    // Listen for URL changes (YouTube is SPA)
    let lastUrl = location.href
    const observer = new MutationObserver(() => {
      const url = location.href
      if (url !== lastUrl) {
        lastUrl = url
        detectShortScroll()
      }
    })

    observer.observe(document, { subtree: true, childList: true })

    // Also listen for scroll events on shorts
    let scrollTimeout: number
    const handleScroll = () => {
      if (window.location.pathname.includes('/shorts/')) {
        // Debounce scroll detection
        clearTimeout(scrollTimeout)
        scrollTimeout = window.setTimeout(() => {
          handleShortViewed()
        }, 1000)
      }
    }

    window.addEventListener('scroll', handleScroll)
    
    // Initial check
    detectShortScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      chrome.runtime.onMessage.removeListener(messageListener)
      clearInterval(stateCheckInterval)
      
      // Unregister this tab
      chrome.runtime.sendMessage({
        type: 'UNREGISTER_YOUTUBE_TAB'
      })
    }
  }, [])

  const checkQuizState = async () => {
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          type: 'CHECK_QUIZ_STATE'
        }, resolve)
      })

      if (response.success && response.quizState) {
        const { isBlocked: blocked, isActiveQuizTab } = response.quizState
        
        if (blocked && !isActiveQuizTab) {
          setIsBlocked(true)
          setBlockReason(`Quiz active on another tab (${response.quizState.subject})`)
          pauseYouTubeVideo()
        } else {
          setIsBlocked(false)
          setBlockReason('')
        }
      }
    } catch (error) {
      console.error('Error checking quiz state:', error)
    }
  }

  const handleShortViewed = async () => {
    try {
      // Check if content is blocked first
      await checkQuizState()
      if (isBlocked) {
        return // Don't process if blocked
      }

      // Increment shorts count
      await ShortsTracker.incrementShortsCount()
      
      // Record video watched in study session
      try {
        await StudySessionManager.recordVideoWatched()
      } catch (error) {
        console.error('Failed to record video watched:', error)
      }
      
      // Check if quiz should be shown
      const shouldShow = await ShortsTracker.shouldShowQuiz()
      if (shouldShow && !showQuiz) {
        await loadAndShowQuiz()
      }
    } catch (error) {
      console.error('Error handling short view:', error)
    }
  }

  // YouTube video control functions
  const pauseYouTubeVideo = () => {
    // Get all video elements and find the one that's actually playing
    const allVideos = document.querySelectorAll('video') as NodeListOf<HTMLVideoElement>
    
    let playingVideo: HTMLVideoElement | null = null
    let bestVideo: HTMLVideoElement | null = null
    
    // Find the best video element to pause
    allVideos.forEach((video) => {
      const isPlaying = !video.paused && video.currentTime > 0 && video.readyState > 2
      const hasValidDuration = !isNaN(video.duration) && video.duration > 0
      const hasCurrentTime = video.currentTime > 0
      
      // Prioritize actually playing videos
      if (isPlaying) {
        playingVideo = video
      }
      
      // Fallback to video with valid duration and current time
      if (!bestVideo && hasValidDuration && (hasCurrentTime || !video.paused)) {
        bestVideo = video
      }
    })
    
    const targetVideo = playingVideo || bestVideo || allVideos[0]
    
    if (targetVideo) {
      if (!targetVideo.paused && targetVideo.readyState > 0) {
        setWasVideoPaused(false)
        targetVideo.pause()
      } else {
        setWasVideoPaused(true)
      }
    } else {
      setWasVideoPaused(true) // Assume paused if no video found
    }
  }

  const resumeYouTubeVideo = () => {
    const selectors = [
      'video',
      '.html5-video-player video',
      '#shorts-player video',
      '.ytd-shorts video'
    ]
    
    let video: HTMLVideoElement | null = null
    for (const selector of selectors) {
      video = document.querySelector(selector) as HTMLVideoElement
      if (video) break
    }
    
    if (video && !wasVideoPaused) {
      video.play().catch(() => {})
    }
  }

  const loadAndShowQuiz = async () => {
    setIsLoading(true)
    
    // Get the selected subject for quiz generation (move outside try block for scope)
    let selectedSubject: string | null = null
    
    try {
      // Check if we should show a retry question first
      if (questionsUntilRetry === 0 && incorrectQuestions.length > 0) {
        const retryQuestion = incorrectQuestions.shift()!
        setIncorrectQuestions([...incorrectQuestions])
        setCurrentQuestion(retryQuestion)
        setShowQuiz(true)
        setIsLoading(false)
        
        // Add delay before pausing to ensure DOM is ready
        setTimeout(() => {
          pauseYouTubeVideo()
        }, 100)
        return
      }

      selectedSubject = await ShortsTracker.getSelectedSubject()
      
      if (!selectedSubject) {
        console.error('No subject selected for quiz generation')
        throw new Error('No subject selected. Please select a subject in Study Mode first.')
      }

      // Extract current video data with transcript monitoring enabled (since we're generating a quiz)
      const videoData = VideoExtractor.extractCurrentVideo(true)
      
      if (!videoData) {
        console.error('No video data found for quiz generation')
        throw new Error('No video data available')
      }

      // Generating quiz question

      // Prepare YouTube context for the Firebase function
      const youtubeContext = JSON.stringify({
        title: videoData.title,
        description: videoData.description || '',
        channelName: videoData.author || 'Unknown',
        transcript: videoData.transcript || ''
      })

      // Call Firebase function via message passing to background script
      const result = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'GENERATE_QUIZ',
          data: {
            subject: selectedSubject,
            youtubeContext: youtubeContext
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response)
          }
        })
      })

      const data = result.data as any
      const quiz = data.quiz || data

      // Convert Firebase response to our QuizQuestion format
      const question: QuizQuestion = {
        question: quiz.question,
        type: quiz.type,
        options: quiz.options,
        correctAnswer: quiz.correctAnswer,
        explanations: quiz.explanations
      }
      
      setCurrentQuestion(question)
      setShowQuiz(true)
      
      // Notify background script that quiz is now displayed
      chrome.runtime.sendMessage({
        type: 'QUIZ_DISPLAYED',
        data: { subject: selectedSubject }
      })
      
      // Add delay before pausing to ensure DOM is ready
      setTimeout(() => {
        pauseYouTubeVideo()
      }, 100)
      
      // Quiz question generated successfully
      
    } catch (error) {
      console.error('Failed to load quiz question:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        error: error
      })
      
      // Show fallback question if generation fails
      const fallbackQuestion: QuizQuestion = {
        question: "Study Mode is active, but we couldn't generate a question based on this video. What's the most important thing to remember about effective learning?",
        type: "multiple_choice",
        options: [
          "Active engagement with material leads to better retention",
          "Passive consumption is the best learning strategy",
          "Multitasking while studying improves focus",
          "Cramming is more effective than spaced repetition"
        ],
        correctAnswer: 0,
        explanations: {
          correct: "Active engagement with learning material, such as asking questions, taking notes, and connecting concepts, significantly improves retention and understanding compared to passive methods.",
          incorrect: [
            "Passive consumption without engagement leads to poor retention and shallow understanding.",
            "Multitasking while studying actually decreases focus and learning effectiveness.",
            "Spaced repetition over time is scientifically proven to be more effective than cramming for long-term retention."
          ]
        }
      }
      
      setCurrentQuestion(fallbackQuestion)
      setShowQuiz(true)
      
      // Notify background script that quiz is now displayed (fallback case)
      chrome.runtime.sendMessage({
        type: 'QUIZ_DISPLAYED',
        data: { subject: selectedSubject || 'General' }
      })
      
      // Add delay before pausing to ensure DOM is ready
      setTimeout(() => {
        pauseYouTubeVideo()
      }, 100)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuizComplete = async (correct: boolean) => {
    console.log(`Quiz completed. Correct: ${correct}`)
    
    // Notify background script that quiz was answered
    try {
      await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          type: 'QUIZ_ANSWERED',
          data: { isCorrect: correct }
        }, resolve)
      })
    } catch (error) {
      console.error('Failed to notify background script:', error)
    }
    
    // Record quiz attempt in study session
    try {
      await StudySessionManager.recordQuizAttempt(correct)
    } catch (error) {
      console.error('Failed to record quiz attempt:', error)
    }
    
    // Handle incorrect answers - add to retry queue
    if (!correct && currentQuestion) {
      setIncorrectQuestions(prev => [...prev, currentQuestion])
      setQuestionsUntilRetry(2) // Retry after 2 more questions
      // Added question to retry queue
    }
    
    // Decrease retry counter if we have pending retries
    if (questionsUntilRetry > 0) {
      const newCount = questionsUntilRetry - 1
      setQuestionsUntilRetry(newCount)
      // Questions until retry countdown
    }
    
    setShowQuiz(false)
    setCurrentQuestion(null)
    resumeYouTubeVideo()
  }


  // Add navigation blocking during loading
  useEffect(() => {
    if (!isLoading) return

    const preventNavigation = (e: KeyboardEvent) => {
      // Block arrow keys and navigation keys during loading
      if ([37, 38, 39, 40, 33, 34, 35, 36].includes(e.keyCode)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventScroll = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const preventTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) return // Allow pinch zoom
      e.preventDefault()
      e.stopPropagation()
    }

    // Add event listeners during loading
    document.addEventListener('keydown', preventNavigation, { capture: true })
    document.addEventListener('wheel', preventScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', preventTouch, { passive: false, capture: true })

    return () => {
      document.removeEventListener('keydown', preventNavigation, { capture: true })
      document.removeEventListener('wheel', preventScroll, { capture: true })
      document.removeEventListener('touchmove', preventTouch, { capture: true })
    }
  }, [isLoading])

  // Show blocked state when content is blocked due to quiz on another tab
  if (isBlocked) {
    return (
      <>
        {/* Full-screen overlay to block content */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          zIndex: 999998,
          cursor: 'not-allowed'
        }} />
        
        {/* Blocked content message */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999999,
          backgroundColor: 'rgba(220, 38, 38, 0.95)',
          color: 'white',
          padding: '32px',
          borderRadius: '16px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          maxWidth: '400px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🚫</div>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
            Content Blocked
          </div>
          <div style={{ fontSize: '16px', marginBottom: '20px', lineHeight: '1.5' }}>
            {blockReason}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.4' }}>
            Complete the quiz on the other tab to continue browsing, or close that tab to end the study session.
          </div>
        </div>
      </>
    )
  }

  // Show loading state when generating quiz
  if (isLoading) {
    return (
      <>
        {/* Full-screen overlay to prevent scrolling */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 999998,
          cursor: 'wait'
        }} />
        
        {/* Loading content */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999999,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: 'white',
          padding: '32px',
          borderRadius: '16px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #333',
            borderTop: '4px solid #4CAF50',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            Generating quiz question...
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            Analyzing video content
          </div>
          <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '16px' }}>
            Please wait, do not scroll
          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `
          }} />
        </div>
      </>
    )
  }

  // Only render if we should show the quiz
  if (!showQuiz || !currentQuestion) {
    return null
  }

  // Convert QuizQuestion to Question format for QuizBlocker
  const questionForBlocker = currentQuestion ? {
    id: `quiz_${Date.now()}`,
    question: currentQuestion.question,
    options: currentQuestion.options,
    correctAnswer: currentQuestion.correctAnswer,
    explanation: currentQuestion.explanations.correct
  } : null

  return questionForBlocker ? (
    <QuizBlocker
      question={questionForBlocker}
      onComplete={handleQuizComplete}
    />
  ) : null
}

export default ShortsDetector
