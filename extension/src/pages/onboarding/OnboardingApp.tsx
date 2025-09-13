import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboardingTransactional } from '@/lib/functions'

interface Subject {
  id: string
  name: string
  files: Array<{
    name: string
    size: number
    type: string
  }>
}

const OnboardingApp: React.FC = () => {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [newSubject, setNewSubject] = useState('')

  useEffect(() => {
    // Load existing subjects from localStorage
    const savedSubjects = localStorage.getItem('sigma_subjects')
    if (savedSubjects) {
      setSubjects(JSON.parse(savedSubjects))
    }
  }, [])

  const addSubject = () => {
    if (newSubject.trim()) {
      const subject: Subject = {
        id: Date.now().toString(),
        name: newSubject.trim(),
        files: []
      }
      const updatedSubjects = [...subjects, subject]
      setSubjects(updatedSubjects)
      localStorage.setItem('sigma_subjects', JSON.stringify(updatedSubjects))
      setNewSubject('')
    }
  }

  const removeSubject = (id: string) => {
    const updatedSubjects = subjects.filter(s => s.id !== id)
    setSubjects(updatedSubjects)
    localStorage.setItem('sigma_subjects', JSON.stringify(updatedSubjects))
  }

  const handleFileUpload = async (subjectId: string, files: FileList) => {
    const filePromises = Array.from(files).map(async (file) => {
      return new Promise<{name: string, size: number, type: string, data: string}>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            data: reader.result as string
          })
        }
        reader.readAsDataURL(file)
      })
    })
    
    const fileData = await Promise.all(filePromises)
    
    const updatedSubjects = subjects.map(subject => {
      if (subject.id === subjectId) {
        return {
          ...subject,
          files: [...subject.files, ...fileData]
        }
      }
      return subject
    })
    setSubjects(updatedSubjects)
    localStorage.setItem('sigma_subjects', JSON.stringify(updatedSubjects))
    
    // Also store files separately for easy access
    const allFiles = updatedSubjects.flatMap(s => s.files.map(f => ({...f, subjectName: s.name})))
    localStorage.setItem('sigma_files', JSON.stringify(allFiles))
  }

  const completeOnboardingFlow = async () => {
    if (!user) {
      alert('User not authenticated')
      return
    }

    try {
      // Call Firebase Function to complete onboarding
      const result = await completeOnboardingTransactional({
        subjects: subjects.map(subject => ({
          name: subject.name,
          files: subject.files
        }))
      })

      console.log('Onboarding completed:', result.data)
      
      // Keep localStorage as fallback
      localStorage.setItem('sigma_onboarded', 'true')
      localStorage.setItem('sigma_subjects', JSON.stringify(subjects))
      
      // Send message to background script
      chrome.runtime.sendMessage({
        type: 'ONBOARDING_COMPLETE',
        subjects: subjects,
        userId: user.uid,
        backendResult: result.data
      })

      // Close the tab
      window.close()
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      alert('Failed to save onboarding data. Please try again.')
    }
  }

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <h1>Welcome to SigmaScholar</h1>
        <p>Let's set up your academic profile</p>
      </div>

      <div className="step-indicator">
        <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
          <span>1</span>
          <label>Subjects</label>
        </div>
        <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
          <span>2</span>
          <label>Files</label>
        </div>
        <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
          <span>3</span>
          <label>Complete</label>
        </div>
      </div>

      <div className="step-content">
        {currentStep === 1 && (
          <div className="subjects-step">
            <h2>Add Your Subjects</h2>
            <p>What subjects or courses are you studying?</p>
            
            <div className="subject-input">
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g., Calculus, Biology, History..."
                onKeyPress={(e) => e.key === 'Enter' && addSubject()}
              />
              <button onClick={addSubject} disabled={!newSubject.trim()}>
                Add Subject
              </button>
            </div>

            <div className="subjects-list">
              {subjects.map(subject => (
                <div key={subject.id} className="subject-item">
                  <span>{subject.name}</span>
                  <button onClick={() => removeSubject(subject.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="files-step">
            <h2>Upload Study Materials</h2>
            <p>Upload files for each subject (optional)</p>
            
            {subjects.map(subject => (
              <div key={subject.id} className="subject-files">
                <h3>{subject.name}</h3>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                  onChange={(e) => e.target.files && handleFileUpload(subject.id, e.target.files)}
                />
                {subject.files.length > 0 && (
                  <div className="uploaded-files">
                    {subject.files.map((file, index) => (
                      <div key={index} className="file-item">
                        <span>{file.name}</span>
                        <small>({(file.size / 1024).toFixed(1)} KB)</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {currentStep === 3 && (
          <div className="complete-step">
            <h2>Setup Complete!</h2>
            <p>You've added {subjects.length} subjects and are ready to start using SigmaScholar.</p>
            
            <div className="summary">
              <h3>Your Subjects:</h3>
              <ul>
                {subjects.map(subject => (
                  <li key={subject.id}>
                    {subject.name} ({subject.files.length} files)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        {currentStep > 1 && (
          <button onClick={prevStep} className="btn-secondary">
            Previous
          </button>
        )}
        
        {currentStep < 3 ? (
          <button 
            onClick={nextStep} 
            className="btn-primary"
            disabled={currentStep === 1 && subjects.length === 0}
          >
            Next
          </button>
        ) : (
          <button onClick={completeOnboardingFlow} className="btn-primary">
            Complete Setup
          </button>
        )}
      </div>
    </div>
  )
}

export default OnboardingApp
