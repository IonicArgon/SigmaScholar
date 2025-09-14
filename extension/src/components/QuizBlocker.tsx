import React, { useState, useEffect } from 'react'
import './QuizBlocker.css'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

interface QuizBlockerProps {
  question: Question
  onComplete: (correct: boolean) => void
  onSkip?: () => void
}

export const QuizBlocker: React.FC<QuizBlockerProps> = ({ 
  question, 
  onComplete, 
  onSkip 
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setMounted(true), 50)

    // Prevent navigation only if the event target is not within the quiz container
    const preventNavigation = (e: KeyboardEvent) => {
      const target = e.target as Element
      const quizContainer = document.querySelector('.quiz-blocker-container')
      
      // Allow navigation within the quiz container
      if (quizContainer && quizContainer.contains(target)) {
        return
      }
      
      // Block arrow keys and navigation keys for YouTube
      if ([37, 38, 39, 40, 33, 34, 35, 36].includes(e.keyCode)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventScroll = (e: WheelEvent) => {
      const target = e.target as Element
      const quizContainer = document.querySelector('.quiz-blocker-container')
      
      // Allow scrolling within the quiz container
      if (quizContainer && quizContainer.contains(target)) {
        return
      }
      
      // Block scrolling on YouTube content
      e.preventDefault()
      e.stopPropagation()
    }

    const preventTouch = (e: TouchEvent) => {
      const target = e.target as Element
      const quizContainer = document.querySelector('.quiz-blocker-container')
      
      // Allow touch within the quiz container
      if (quizContainer && quizContainer.contains(target)) {
        return
      }
      
      if (e.touches.length > 1) return // Allow pinch zoom
      e.preventDefault()
      e.stopPropagation()
    }

    // Add event listeners to prevent navigation
    document.addEventListener('keydown', preventNavigation, { capture: true })
    document.addEventListener('wheel', preventScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', preventTouch, { passive: false, capture: true })

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', preventNavigation, { capture: true })
      document.removeEventListener('wheel', preventScroll, { capture: true })
      document.removeEventListener('touchmove', preventTouch, { capture: true })
    }
  }, [])

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return
    setSelectedAnswer(answerIndex)
  }

  const handleSubmit = () => {
    if (selectedAnswer === null) return
    
    const correct = selectedAnswer === question.correctAnswer
    setIsCorrect(correct)
    setShowResult(true)
    
    // Remove auto-complete - let user manually continue
  }

  const handleContinue = () => {
    onComplete(isCorrect)
  }

  const handleSkipQuiz = () => {
    if (onSkip) {
      onSkip()
    }
  }

  return (
    <div className={`quiz-blocker-overlay ${mounted ? 'mounted' : ''}`}>
      <div className="quiz-blocker-backdrop" />
      
      <div className={`quiz-blocker-container ${mounted ? 'slide-in' : ''}`}>
        {/* Header */}
        <div className="quiz-header">
          <div className="quiz-logo">
            <span className="sigma-symbol">Σ</span>
            <span className="quiz-title">SigmaScholar Quiz</span>
          </div>
          <div className="quiz-progress">
            <div className="progress-indicator pulse" />
          </div>
        </div>

        {/* Question Section */}
        <div className={`quiz-content ${showResult ? 'show-result' : ''}`}>
          <div className="question-section">
            <h2 className="question-text">{question.question}</h2>
          </div>

          {/* Answer Options */}
          <div className="answers-section">
            {question.options.map((option, index) => (
              <button
                key={index}
                className={`answer-option ${
                  selectedAnswer === index ? 'selected' : ''
                } ${
                  showResult && index === question.correctAnswer ? 'correct' : ''
                } ${
                  showResult && selectedAnswer === index && index !== question.correctAnswer ? 'incorrect' : ''
                }`}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
              >
                <div className="option-letter">{String.fromCharCode(65 + index)}</div>
                <div className="option-text">{option}</div>
                {showResult && index === question.correctAnswer && (
                  <div className="check-icon">✓</div>
                )}
                {showResult && selectedAnswer === index && index !== question.correctAnswer && (
                  <div className="cross-icon">✗</div>
                )}
              </button>
            ))}
          </div>

          {/* Result Section */}
          {showResult && (
            <div className={`result-section ${isCorrect ? 'correct' : 'incorrect'} fade-in`}>
              <div className="result-icon">
                {isCorrect ? '🎉' : '💡'}
              </div>
              <div className="result-text">
                {isCorrect ? 'Excellent!' : 'Not quite right'}
              </div>
              {question.explanation && (
                <div className="explanation">
                  {question.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!showResult ? (
          <div className="quiz-actions">
            <button 
              className="submit-button"
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
            >
              <span>Submit Answer</span>
              <div className="button-glow" />
            </button>
            
            {onSkip && (
              <button className="skip-button" onClick={handleSkipQuiz}>
                Skip Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="quiz-actions">
            <button 
              className="submit-button"
              onClick={handleContinue}
            >
              <span>Next Question</span>
              <div className="button-glow" />
            </button>
            
            <button className="skip-button" onClick={handleContinue}>
              Keep Scrolling
            </button>
          </div>
        )}

        {/* Decorative Elements */}
        <div className="quiz-decorations">
          <div className="floating-particle particle-1" />
          <div className="floating-particle particle-2" />
          <div className="floating-particle particle-3" />
          <div className="floating-particle particle-4" />
          <div className="floating-particle particle-5" />
        </div>
      </div>
    </div>
  )
}

export default QuizBlocker
