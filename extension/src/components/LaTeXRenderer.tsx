import { useEffect, useRef } from 'react'
import './LaTeXRenderer.css'

interface LaTeXRendererProps {
  latex: string
  className?: string
  displayMode?: boolean
}

export default function LaTeXRenderer({ latex, className = '', displayMode = false }: LaTeXRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !latex) return

    // Use requestIdleCallback for better performance
    const renderLaTeX = () => {
      import('katex').then((katex) => {
        try {
          if (containerRef.current) {
            katex.default.render(latex, containerRef.current, {
              displayMode,
              throwOnError: false,
              errorColor: '#cc0000',
              strict: 'warn'
            })
          }
        } catch (error) {
          console.error('LaTeX rendering error:', error)
          if (containerRef.current) {
            containerRef.current.textContent = latex // Fallback to raw text
          }
        }
      }).catch((error) => {
        console.error('Failed to load KaTeX:', error)
        if (containerRef.current) {
          containerRef.current.textContent = latex // Fallback to raw text
        }
      })
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(renderLaTeX)
    } else {
      setTimeout(renderLaTeX, 0)
    }
  }, [latex, displayMode])

  return <div ref={containerRef} className={`latex-renderer ${className}`} />
}

// Helper function to detect LaTeX in text (optimized)
export function hasLaTeX(text: string): boolean {
  if (!text || text.length === 0) return false
  
  // Quick checks for most common LaTeX indicators
  if (text.includes('$') || text.includes('\\')) {
    // More specific patterns only if basic indicators found
    const latexPatterns = [
      /\$.*?\$/,           // Inline math: $x^2$
      /\$\$.*?\$\$/,       // Display math: $$x^2$$
      /\\[a-zA-Z]+/        // LaTeX commands: \frac, \sqrt, etc.
    ]
    return latexPatterns.some(pattern => pattern.test(text))
  }
  
  // Quick check for superscripts/subscripts with math context
  return /[a-zA-Z0-9][\^_][a-zA-Z0-9]/.test(text)
}

// Helper function to split text with LaTeX
export function parseTextWithLaTeX(text: string): Array<{ type: 'text' | 'latex', content: string, displayMode?: boolean }> {
  const parts: Array<{ type: 'text' | 'latex', content: string, displayMode?: boolean }> = []
  
  // Split by display math first ($$...$$)
  const displayMathRegex = /\$\$(.*?)\$\$/g
  let lastIndex = 0
  let match
  
  while ((match = displayMathRegex.exec(text)) !== null) {
    // Add text before the math
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index)
      parts.push(...parseInlineMath(beforeText))
    }
    
    // Add display math
    parts.push({ type: 'latex', content: match[1], displayMode: true })
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex)
    parts.push(...parseInlineMath(remainingText))
  }
  
  return parts
}

function parseInlineMath(text: string): Array<{ type: 'text' | 'latex', content: string, displayMode?: boolean }> {
  const parts: Array<{ type: 'text' | 'latex', content: string, displayMode?: boolean }> = []
  const inlineMathRegex = /\$(.*?)\$/g
  let lastIndex = 0
  let match
  
  while ((match = inlineMathRegex.exec(text)) !== null) {
    // Add text before the math
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    
    // Add inline math
    parts.push({ type: 'latex', content: match[1], displayMode: false })
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }
  
  return parts
}

// Component for rendering mixed text and LaTeX
interface MixedContentProps {
  content: string
  className?: string
}

export function MixedContent({ content, className = '' }: MixedContentProps) {
  const parts = parseTextWithLaTeX(content)
  
  return (
    <span className={className}>
      {parts.map((part, index) => (
        part.type === 'latex' ? (
          <LaTeXRenderer 
            key={index} 
            latex={part.content} 
            displayMode={part.displayMode}
            className="inline-latex"
          />
        ) : (
          <span key={index}>{part.content}</span>
        )
      ))}
    </span>
  )
}
