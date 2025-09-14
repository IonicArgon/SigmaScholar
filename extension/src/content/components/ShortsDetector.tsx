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
  const [, setIsLoading] = useState(false)

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

  const loadAndShowQuiz = async () => {
    setIsLoading(true)
    
    try {
      // Get the selected subject for quiz generation
      const selectedSubject = await ShortsTracker.getSelectedSubject()
      
      if (!selectedSubject) {
        console.error('No subject selected for quiz generation')
        throw new Error('No subject selected. Please select a subject in Study Mode first.')
      }

      // Extract current video data
      const videoData = VideoExtractor.extractCurrentVideo()
      
      if (!videoData) {
        console.error('No video data found for quiz generation')
        throw new Error('Unable to extract video information for quiz generation.')
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
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuizComplete = (correct: boolean) => {
    console.log(`Quiz completed. Correct: ${correct}`)
    setShowQuiz(false)
    setCurrentQuestion(null)
    
    // Optional: Track quiz performance
    // You could store this data for analytics
  }

  const handleQuizSkip = () => {
    console.log('Quiz skipped')
    setShowQuiz(false)
    setCurrentQuestion(null)
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
