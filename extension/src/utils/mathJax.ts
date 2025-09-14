// Simple MathJax-based math rendering for Chrome extension
declare global {
  interface Window {
    MathJax: any;
  }
}

// Initialize MathJax with a simple approach
export const initializeMathJax = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      // Check if already initialized
      if (window.MathJax && window.MathJax.typesetPromise) {
        resolve()
        return
      }

      // Set up a simple MathJax-compatible interface
      window.MathJax = {
        typesetPromise: (elements: HTMLElement[]) => {
          return Promise.all(elements.map(element => {
            if (!element) return Promise.resolve()
            
            try {
              // Simple AsciiMath to basic HTML conversion
              const html = element.innerHTML
              const processedHtml = html.replace(/`([^`]+)`/g, (match, asciiMath) => {
                try {
                  // Basic AsciiMath to HTML conversion
                  let converted = asciiMath.trim()
                  
                  // Handle common mathematical expressions
                  converted = converted
                    // Greek letters
                    .replace(/\balpha\b/g, 'α')
                    .replace(/\bbeta\b/g, 'β')
                    .replace(/\bgamma\b/g, 'γ')
                    .replace(/\bdelta\b/g, 'δ')
                    .replace(/\bepsilon\b/g, 'ε')
                    .replace(/\btheta\b/g, 'θ')
                    .replace(/\bpi\b/g, 'π')
                    .replace(/\bsigma\b/g, 'σ')
                    .replace(/\bphi\b/g, 'φ')
                    .replace(/\bomega\b/g, 'ω')
                    
                    // Mathematical operators
                    .replace(/\binfty\b/g, '∞')
                    .replace(/\bpm\b/g, '±')
                    .replace(/\bmp\b/g, '∓')
                    .replace(/\bcdot\b/g, '·')
                    .replace(/\btimes\b/g, '×')
                    .replace(/\bdiv\b/g, '÷')
                    .replace(/\bne\b/g, '≠')
                    .replace(/\ble\b/g, '≤')
                    .replace(/\bge\b/g, '≥')
                    .replace(/\bin\b/g, '∈')
                    .replace(/\bnotin\b/g, '∉')
                    .replace(/\bsubset\b/g, '⊂')
                    .replace(/\bsupset\b/g, '⊃')
                    .replace(/\bcap\b/g, '∩')
                    .replace(/\bcup\b/g, '∪')
                    .replace(/\band\b/g, '∧')
                    .replace(/\bor\b/g, '∨')
                    .replace(/\bnot\b/g, '¬')
                    .replace(/\bAA\b/g, '∀')
                    .replace(/\bEE\b/g, '∃')
                    .replace(/\boo\b/g, '∞')
                    .replace(/\+-/g, '±')
                    
                    // Handle fractions: (a)/(b) or a/b
                    .replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '<sup>$1</sup>⁄<sub>$2</sub>')
                    .replace(/([^/\s]+)\/([^/\s]+)/g, '<sup>$1</sup>⁄<sub>$2</sub>')
                    
                    // Handle subscripts: x_1
                    .replace(/([a-zA-Z0-9])_([a-zA-Z0-9]+)/g, '$1<sub>$2</sub>')
                    
                    // Handle superscripts: x^2
                    .replace(/([a-zA-Z0-9])\^([a-zA-Z0-9]+)/g, '$1<sup>$2</sup>')
                    
                    // Handle square roots: sqrt(x)
                    .replace(/sqrt\(([^)]+)\)/g, '√($1)')
                    
                    // Handle integrals: int_a^b
                    .replace(/int_([^\s]+)\^([^\s]+)/g, '∫<sub>$1</sub><sup>$2</sup>')
                    .replace(/\bint\b/g, '∫')
                    
                    // Handle summation: sum_a^b
                    .replace(/sum_([^\s]+)\^([^\s]+)/g, '∑<sub>$1</sub><sup>$2</sup>')
                    .replace(/\bsum\b/g, '∑')
                    
                    // Handle products: prod_a^b
                    .replace(/prod_([^\s]+)\^([^\s]+)/g, '∏<sub>$1</sub><sup>$2</sup>')
                    .replace(/\bprod\b/g, '∏')
                  
                  return `<span class="math-expression" style="font-style: italic; color: #2563eb;">${converted}</span>`
                } catch (error) {
                  console.warn('Math conversion error for:', asciiMath, error)
                  return match // Return original if conversion fails
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

      console.log('Simple MathJax-compatible renderer initialized successfully')
      resolve()
      
    } catch (error) {
      console.error('Failed to initialize math renderer:', error)
      resolve() // Don't reject, just continue without math rendering
    }
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
