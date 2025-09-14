import React, { useState, useEffect } from 'react'
import './QuizBlocker.css'

// Simple function to detect and parse math/chem blocks
function parseMathBlocks(text: string): React.ReactElement[] {
  const parts: React.ReactElement[] = []
  let lastIndex = 0
  let keyIndex = 0

  // Find all [MATH]...[/MATH] and [CHEM]...[/CHEM] blocks
  const mathRegex = /\[(MATH|CHEM)\](.*?)\[\/\1\]/g
  let match

  while ((match = mathRegex.exec(text)) !== null) {
    // Add text before the math block
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index)
      if (beforeText) {
        parts.push(<span key={keyIndex++}>{beforeText}</span>)
      }
    }

    // Add the math/chem block with styling
    const blockType = match[1] // 'MATH' or 'CHEM'
    const content = match[2]
    const className = blockType === 'MATH' ? 'math-block' : 'chem-block'
    
    parts.push(
      <span key={keyIndex++} className={className}>
        {content}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex)
    if (remainingText) {
      parts.push(<span key={keyIndex++}>{remainingText}</span>)
    }
  }

  return parts.length > 0 ? parts : [<span key={0}>{text}</span>]
}

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
            <h2 className="question-text">{parseMathBlocks(question.question)}</h2>
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
                <div className="option-text">{parseMathBlocks(option)}</div>
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
                  {parseMathBlocks(question.explanation)}
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
