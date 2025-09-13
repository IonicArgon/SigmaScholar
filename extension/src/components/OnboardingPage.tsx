import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import './OnboardingPage.css'

export default function OnboardingPage() {
  const { updateProfile } = useAuth()
  const [currentStep, setCurrentStep] = useState<'subjects' | 'uploads'>('subjects')
  const [subjects, setSubjects] = useState<string[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({})

  const handleAddSubject = () => {
    if (newSubject.trim() && !subjects.includes(newSubject.trim())) {
      const subject = newSubject.trim()
      setSubjects([...subjects, subject])
      setUploadedFiles({ ...uploadedFiles, [subject]: [] })
      setNewSubject('')
    }
  }

  const handleRemoveSubject = (subjectToRemove: string) => {
    setSubjects(subjects.filter(s => s !== subjectToRemove))
    const newFiles = { ...uploadedFiles }
    delete newFiles[subjectToRemove]
    setUploadedFiles(newFiles)
  }

  const handleFileUpload = (subject: string, files: FileList | null) => {
    if (!files) return
    
    const fileArray = Array.from(files)
    setUploadedFiles({
      ...uploadedFiles,
      [subject]: [...(uploadedFiles[subject] || []), ...fileArray]
    })
  }

  const handleRemoveFile = (subject: string, fileIndex: number) => {
    const updatedFiles = uploadedFiles[subject].filter((_, index) => index !== fileIndex)
    setUploadedFiles({
      ...uploadedFiles,
      [subject]: updatedFiles
    })
  }

  const handleNext = () => {
    if (currentStep === 'subjects' && subjects.length > 0) {
      setCurrentStep('uploads')
    }
  }

  const handleComplete = () => {
    // Save subjects and mark as onboarded
    updateProfile({
      subjects,
      isOnboarded: true
    })
    
    // Here we would upload files to Firebase Storage
    // For now, just log them
    console.log('Subjects:', subjects)
    console.log('Files:', uploadedFiles)
  }

  const canProceed = currentStep === 'subjects' ? subjects.length > 0 : true

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <h2>Welcome to SigmaScholar!</h2>
        <p>Let's set up your study materials</p>
      </div>

      {currentStep === 'subjects' && (
        <div className="subjects-step">
          <h3>What subjects are you studying?</h3>
          <p>Add the courses or subjects you want to study for:</p>
          
          <div className="subject-input">
            <input
              type="text"
              placeholder="e.g., Calculus, Biology, History..."
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
              className="subject-field"
            />
            <button onClick={handleAddSubject} className="add-button">
              Add
            </button>
          </div>

          <div className="subjects-list">
            {subjects.map((subject, index) => (
              <div key={index} className="subject-item">
                <span>{subject}</span>
                <button 
                  onClick={() => handleRemoveSubject(subject)}
                  className="remove-button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {subjects.length === 0 && (
            <p className="empty-state">No subjects added yet. Add at least one to continue.</p>
          )}
        </div>
      )}

      {currentStep === 'uploads' && (
        <div className="uploads-step">
          <h3>Upload Study Materials</h3>
          <p>Upload lecture slides, textbook chapters, notes, etc. for each subject:</p>
          
          {subjects.map((subject) => (
            <div key={subject} className="subject-upload">
              <h4>{subject}</h4>
              
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                onChange={(e) => handleFileUpload(subject, e.target.files)}
                className="file-input"
              />
              
              {uploadedFiles[subject]?.length > 0 && (
                <div className="uploaded-files">
                  <p>Uploaded files:</p>
                  {uploadedFiles[subject].map((file, index) => (
                    <div key={index} className="file-item">
                      <span>{file.name}</span>
                      <button 
                        onClick={() => handleRemoveFile(subject, index)}
                        className="remove-button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="onboarding-actions">
        {currentStep === 'uploads' && (
          <button 
            onClick={() => setCurrentStep('subjects')} 
            className="back-button"
          >
            Back
          </button>
        )}
        
        {currentStep === 'subjects' && (
          <button 
            onClick={handleNext}
            disabled={!canProceed}
            className="next-button"
          >
            Next
          </button>
        )}
        
        {currentStep === 'uploads' && (
          <button 
            onClick={handleComplete}
            className="complete-button"
          >
            Complete Setup
          </button>
        )}
      </div>
    </div>
  )
}
