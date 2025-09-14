// KaTeX-based math rendering for Chrome extension
import katex from 'katex'
import 'katex/dist/katex.min.css'

declare global {
  interface Window {
    MathJax: any;
  }
}

// AsciiMath to LaTeX conversion map for common expressions
const asciiMathToLatex: Record<string, string> = {
  'sqrt': '\\sqrt',
  'int': '\\int',
  'sum': '\\sum',
  'prod': '\\prod',
  'alpha': '\\alpha',
  'beta': '\\beta',
  'gamma': '\\gamma',
  'delta': '\\delta',
  'epsilon': '\\epsilon',
  'theta': '\\theta',
  'pi': '\\pi',
  'sigma': '\\sigma',
  'phi': '\\phi',
  'omega': '\\omega',
  'infty': '\\infty',
  'pm': '\\pm',
  'mp': '\\mp',
  'cdot': '\\cdot',
  'times': '\\times',
  'div': '\\div',
  'ne': '\\neq',
  'le': '\\leq',
  'ge': '\\geq',
  'lt': '<',
  'gt': '>',
  'in': '\\in',
  'notin': '\\notin',
  'subset': '\\subset',
  'supset': '\\supset',
  'cap': '\\cap',
  'cup': '\\cup',
  'and': '\\land',
  'or': '\\lor',
  'not': '\\neg',
  'AA': '\\forall',
  'EE': '\\exists',
  'oo': '\\infty',
  '+-': '\\pm'
}

// Convert basic AsciiMath to LaTeX
const convertAsciiMathToLatex = (asciiMath: string): string => {
  let latex = asciiMath

  // Replace common AsciiMath symbols with LaTeX equivalents
  Object.entries(asciiMathToLatex).forEach(([ascii, latexSymbol]) => {
    const regex = new RegExp(`\\b${ascii}\\b`, 'g')
    latex = latex.replace(regex, latexSymbol)
  })

  // Handle fractions: (a)/(b) -> \frac{a}{b}
  latex = latex.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '\\frac{$1}{$2}')
  latex = latex.replace(/([^/\s]+)\/([^/\s]+)/g, '\\frac{$1}{$2}')

  // Handle subscripts: x_1 -> x_{1}
  latex = latex.replace(/([a-zA-Z])_([a-zA-Z0-9]+)/g, '$1_{$2}')

  // Handle superscripts: x^2 -> x^{2}
  latex = latex.replace(/([a-zA-Z0-9])(\^)([a-zA-Z0-9]+)/g, '$1^{$3}')

  // Handle square roots: sqrt(x) -> \sqrt{x}
  latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')

  // Handle integrals: int_a^b -> \int_a^b
  latex = latex.replace(/int_([^\\s]+)\^([^\\s]+)/g, '\\int_{$1}^{$2}')

  return latex
}

// Initialize KaTeX (no async initialization needed)
export const initializeMathJax = (): Promise<void> => {
  return new Promise((resolve) => {
    // Set up global MathJax object for compatibility
    window.MathJax = {
      typesetPromise: (elements: HTMLElement[]) => {
        return Promise.all(elements.map(element => {
          if (!element) return Promise.resolve()
          
          try {
            // Process AsciiMath expressions (backtick delimited)
            const html = element.innerHTML
            const processedHtml = html.replace(/`([^`]+)`/g, (match, asciiMath) => {
              try {
                // Convert AsciiMath to LaTeX
                const latex = convertAsciiMathToLatex(asciiMath.trim())
                
                // Render with KaTeX
                const rendered = katex.renderToString(latex, {
                  throwOnError: false,
                  displayMode: false
                })
                
                return rendered
              } catch (error) {
                console.warn('KaTeX rendering error for:', asciiMath, error)
                return match // Return original if rendering fails
              }
            })
            
            element.innerHTML = processedHtml
            return Promise.resolve()
          } catch (error) {
            console.warn('Math processing error:', error)
            return Promise.resolve()
          }
        }))
      }
    }

    console.log('KaTeX math rendering initialized successfully')
    resolve()
  })
}

// Render math in specific element
export const renderMathInElement = (element: HTMLElement): Promise<void> => {
  if (!element || !window.MathJax) {
    return Promise.resolve()
  }

  return window.MathJax.typesetPromise([element]).catch((err: any) => {
    console.warn('MathJax rendering error:', err)
  })
}

// Process text to ensure proper AsciiMath delimiters
export const processTextForMath = (text: string): string => {
  // Ensure backtick-wrapped expressions are properly formatted for MathJax AsciiMath
  return text.replace(/`([^`]+)`/g, '`$1`')
}
