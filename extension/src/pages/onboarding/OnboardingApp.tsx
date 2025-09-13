import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/lib/functions'

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
    
    // Store only metadata in localStorage, not the actual file data
    const subjectsMetadata = updatedSubjects.map(subject => ({
      id: subject.id,
      name: subject.name,
      files: subject.files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
        // Don't store 'data' field to avoid quota issues
      }))
    }))
    
    localStorage.setItem('sigma_subjects', JSON.stringify(subjectsMetadata))
    
    // Store files separately with size limit check
    try {
      const allFiles = updatedSubjects.flatMap(s => s.files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        subjectName: s.name
        // Don't store 'data' field here either
      })))
      localStorage.setItem('sigma_files', JSON.stringify(allFiles))
    } catch (storageError) {
      console.warn('Could not save files to localStorage due to quota:', storageError)
      // Continue without localStorage backup - the backend will handle the files
    }
  }

  const completeOnboardingFlow = async () => {
    if (!user) {
      alert('User not authenticated')
      return
    }

    try {
      // Complete onboarding - the backend handles file storage and user initialization
      const result = await completeOnboarding({
        subjects: subjects.map(subject => ({
          name: subject.name,
          files: subject.files // Send full file data to backend
        }))
      })

      console.log('Onboarding completed:', result.data)
      
      // Only store minimal data in localStorage
      localStorage.setItem('sigma_onboarded', 'true')
      
      // Store only subject names and file metadata (without data)
      const subjectsMetadata = subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        files: subject.files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type
        }))
      }))
      
      try {
        localStorage.setItem('sigma_subjects', JSON.stringify(subjectsMetadata))
      } catch (storageError) {
        console.warn('Could not save subjects to localStorage:', storageError)
        // Continue anyway - the backend has the data
      }
      
      // Send message to background script
      chrome.runtime.sendMessage({
        type: 'ONBOARDING_COMPLETE',
        subjects: subjectsMetadata, // Send metadata only
        userId: user.uid,
        backendResult: result.data
      })

      // Close the tab
      window.close()
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      
      // Provide more specific error information
      let errorMessage = 'Failed to save onboarding data. Please try again.'
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          errorMessage = 'Files are too large for local storage. They will be saved to the cloud instead.'
          // Continue with cloud-only storage
          try {
            const result = await completeOnboarding({
              subjects: subjects.map(subject => ({
                name: subject.name,
                files: subject.files
              }))
            })
            
            if (result.data) {
              localStorage.setItem('sigma_onboarded', 'true')
              window.close()
              return
            }
          } catch (cloudError) {
            errorMessage = `Error: ${cloudError instanceof Error ? cloudError.message : 'Cloud storage failed'}`
          }
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      
      alert(errorMessage)
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
