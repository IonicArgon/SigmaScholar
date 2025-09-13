import React, { useState, useEffect } from 'react'
import { QuizBlocker } from '../../components/QuizBlocker'
import { ShortsTracker } from '../../utils/shortsTracker'
import { generateQuizQuestion } from '../../lib/questionGenerator'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export const ShortsDetector: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
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
      // Generate a quiz question (you'll need to implement this)
      const question = await generateQuizQuestion()
      setCurrentQuestion(question)
      setShowQuiz(true)
    } catch (error) {
      console.error('Failed to load quiz question:', error)
      // Fallback question
      setCurrentQuestion({
        id: 'fallback',
        question: 'What is the primary benefit of active learning?',
        options: [
          'It requires less effort',
          'It improves retention and understanding',
          'It takes less time',
          'It eliminates the need for practice'
        ],
        correctAnswer: 1,
        explanation: 'Active learning engages multiple cognitive processes, leading to better retention and deeper understanding of the material.'
      })
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

  return (
    <QuizBlocker
      question={currentQuestion}
      onComplete={handleQuizComplete}
      onSkip={handleQuizSkip}
    />
  )
}

export default ShortsDetector
