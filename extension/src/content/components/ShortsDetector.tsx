import React, { useState, useEffect } from 'react'
import { QuizBlocker } from '../../components/QuizBlocker'
import { ShortsTracker } from '../../utils/shortsTracker'

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
      // For now, use your existing question generation system
      // This should be replaced with your actual API call that returns the JSON format you showed
      const question: QuizQuestion = {
        question: "Just like how you're procrastinating on your assignment by watching cat videos, imagine you're avoiding solving a first-order linear ODE. Which of these strategies would actually help you solve the equation \\(x^2 \\frac{dy}{dx} + e^x y = 3\\sin(x)\\) instead of just watching cats?",
        type: "multiple_choice",
        options: [
          "Use the integrating factor method because the equation is linear and nonhomogeneous",
          "Apply separation of variables since it's a simple trick for any ODE",
          "Guess the solution by randomly meowing at your calculator",
          "Transform it into a nonlinear equation to make it more interesting"
        ],
        correctAnswer: 0,
        explanations: {
          correct: "The equation \\(x^2 \\frac{dy}{dx} + e^x y = 3\\sin(x)\\) is a first-order linear nonhomogeneous ODE. The integrating factor method is the correct approach for solving such equations, as it directly addresses the linearity and nonhomogeneity.",
          incorrect: [
            "Separation of variables works for separable equations, but this one isn't separable due to the linear combination of \\(y\\) and \\(\\frac{dy}{dx}\\).",
            "Random guessing (or meowing) won't solve a mathematical problem—it's as ineffective as procrastinating with cat videos.",
            "Transforming a linear equation into a nonlinear one would complicate the problem unnecessarily and defeat the purpose of using established methods for linear ODEs."
          ]
        }
      }
      
      setCurrentQuestion(question)
      setShowQuiz(true)
      
    } catch (error) {
      console.error('Failed to load quiz question:', error)
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
