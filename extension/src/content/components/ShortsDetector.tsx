import React, { useState, useEffect } from 'react'
import { QuizBlocker } from '../../components/QuizBlocker'
import { ShortsTracker } from '../../utils/shortsTracker'
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

  useEffect(() => {
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
    }
  }, [])

  const handleShortViewed = async () => {
    try {
      // Increment shorts count
      const newCount = await ShortsTracker.incrementShortsCount()
      
      // Check if quiz should be shown
      const shouldShow = await ShortsTracker.shouldShowQuiz()
      
      if (shouldShow && !showQuiz) {
        await loadAndShowQuiz()
      }
      
      console.log(`Shorts viewed: ${newCount}`)
    } catch (error) {
      console.error('Error handling short view:', error)
    }
  }

  // YouTube video control functions
  const pauseYouTubeVideo = () => {
    // Try multiple selectors for YouTube Shorts video
    const selectors = [
      'video',
      '.html5-video-player video',
      '#shorts-player video',
      '[data-layer="4"] video',
      '.ytd-shorts video'
    ]
    
    let video: HTMLVideoElement | null = null
    for (const selector of selectors) {
      video = document.querySelector(selector) as HTMLVideoElement
      if (video) break
    }
    
    if (video) {
      console.log('🎵 Video found, current state:', video.paused ? 'paused' : 'playing')
      if (!video.paused) {
        setWasVideoPaused(false)
        video.pause()
        console.log('⏸️ Video paused for quiz')
      } else {
        setWasVideoPaused(true)
        console.log('⏸️ Video was already paused')
      }
    } else {
      console.log('❌ No video element found with any selector')
      // Try again after a short delay
      setTimeout(() => {
        const retryVideo = document.querySelector('video') as HTMLVideoElement
        if (retryVideo && !retryVideo.paused) {
          setWasVideoPaused(false)
          retryVideo.pause()
          console.log('⏸️ Video paused for quiz (retry)')
        }
      }, 500)
    }
  }

  const resumeYouTubeVideo = () => {
    const selectors = [
      'video',
      '.html5-video-player video',
      '#shorts-player video',
      '[data-layer="4"] video',
      '.ytd-shorts video'
    ]
    
    let video: HTMLVideoElement | null = null
    for (const selector of selectors) {
      video = document.querySelector(selector) as HTMLVideoElement
      if (video) break
    }
    
    if (video) {
      console.log('🎵 Resuming video, was originally paused:', wasVideoPaused)
      if (!wasVideoPaused) {
        video.play().catch(e => console.log('Play failed:', e))
        console.log('▶️ Video resumed')
      }
    } else {
      console.log('❌ No video element found for resume')
    }
  }

  const loadAndShowQuiz = async () => {
    setIsLoading(true)
    
    try {
      // Check if we should show a retry question first
      if (questionsUntilRetry === 0 && incorrectQuestions.length > 0) {
        const retryQuestion = incorrectQuestions.shift()!
        setIncorrectQuestions([...incorrectQuestions])
        setCurrentQuestion(retryQuestion)
        setShowQuiz(true)
        setIsLoading(false)
        pauseYouTubeVideo()
        console.log('🔄 Showing retry question:', retryQuestion.question.substring(0, 50) + '...')
        return
      }

      // Get the selected subject for quiz generation
      const selectedSubject = await ShortsTracker.getSelectedSubject()
      
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

      console.log('🎯 Generating quiz question for:', {
        subject: selectedSubject,
        video: videoData.title
      })

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
      pauseYouTubeVideo()
      
      console.log('✅ Quiz question generated successfully')
      
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
      pauseYouTubeVideo()
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuizComplete = (correct: boolean) => {
    console.log(`Quiz completed. Correct: ${correct}`)
    
    // Handle incorrect answers - add to retry queue
    if (!correct && currentQuestion) {
      setIncorrectQuestions(prev => [...prev, currentQuestion])
      setQuestionsUntilRetry(2) // Retry after 2 more questions
      console.log('❌ Added question to retry queue. Will retry after 2 more questions.')
    }
    
    // Decrease retry counter if we have pending retries
    if (questionsUntilRetry > 0) {
      const newCount = questionsUntilRetry - 1
      setQuestionsUntilRetry(newCount)
      console.log(`⏳ Questions until retry: ${newCount}`)
    }
    
    setShowQuiz(false)
    setCurrentQuestion(null)
    resumeYouTubeVideo()
    
    // Optional: Track quiz performance
    // You could store this data for analytics
  }

  const handleQuizSkip = () => {
    console.log('Quiz skipped')
    setShowQuiz(false)
    setCurrentQuestion(null)
    resumeYouTubeVideo()
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
      onSkip={handleQuizSkip}
    />
  ) : null
}

export default ShortsDetector
