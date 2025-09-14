import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFileProcessingStatus } from '../../hooks/useFileProcessingStatus'
import './settings.css'
import { updateUserProfile, addSubject, removeSubject, removeFileMetadata } from '@/lib/firestore'
import { addFilesToSubject } from '@/lib/functions'
import { getUserData, FileMetadata, Subject } from '@/lib/firestore'
import { ShortsTracker, ShortsSettings } from '@/utils/shortsTracker'


// Use types from firestore.ts


interface UserData {
  profile: {
    displayName: string
    email: string
    createdAt: string | { seconds: number } | any
    updatedAt: string | { seconds: number } | any
  }
  subjects: (Subject & { files: FileMetadata[] })[]
}

const SettingsApp: React.FC = () => {
  console.log('SettingsApp component loaded!')
  
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'subjects' | 'files' | 'quiz'>('profile')
  
  // User data state
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // File processing status
  const { 
    files: processingFiles, 
    stats: processingStats, 
    loading: processingLoading,
    getFilesBySubject,
    getSubjectProcessingStats,
    isSubjectReadyForStudy
  } = useFileProcessingStatus()
  
  // Debug logging
  console.log('SettingsApp rendering, user:', user)
  
  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
  
  // Subject management state
  const [newSubjectName, setNewSubjectName] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  
  // File management state
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

  // Quiz settings state
  const [quizSettings, setQuizSettings] = useState<ShortsSettings>({ quizFrequency: 5, enabled: true })
  const [savingQuizSettings, setSavingQuizSettings] = useState(false)

  // Removed Firebase Functions dependency

  useEffect(() => {
    if (user && !authLoading) {
      loadUserData()
      loadQuizSettings()
    }
  }, [user, authLoading])

  const loadQuizSettings = async () => {
    try {
      const settings = await ShortsTracker.getQuizSettings()
      setQuizSettings(settings)
    } catch (error) {
      console.error('Failed to load quiz settings:', error)
    }
  }

  const saveQuizSettings = async () => {
    try {
      setSavingQuizSettings(true)
      
      // Save quiz frequency settings
      await ShortsTracker.updateQuizSettings(quizSettings)
      
      console.log('Quiz settings saved successfully')
    } catch (error) {
      console.error('Failed to save quiz settings:', error)
    } finally {
      setSavingQuizSettings(false)
    }
  }

  const loadUserData = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      
      const data = await getUserData()
      
      
      // Handle the actual data structure returned by Firestore
      const userData: UserData = {
        profile: {
          displayName: data.profile?.displayName || user?.displayName || 'User',
          email: data.profile?.email || user?.email || '',
          createdAt: data.profile?.createdAt || new Date().toISOString(),
          updatedAt: data.profile?.updatedAt || new Date().toISOString()
        },
        subjects: data.subjects || []
      }
      
      setUserData(userData)
      setNewDisplayName(userData.profile.displayName)
    } catch (err) {
      console.error('Error loading user data:', err)
      setError('Failed to load user data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!user || !newDisplayName.trim()) return
    
    try {
      setEditingProfile(false)
      await updateUserProfile({ displayName: newDisplayName.trim() })
      
      // Reload user data to reflect changes
      await loadUserData()
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile. Please try again.')
    }
  }

  const addSubjectWithFiles = async () => {
    if (!user || !newSubjectName.trim() || !selectedFiles || selectedFiles.length === 0) return
    
    try {
      setAddingSubject(true)
      
      // First create the subject
      await addSubject(newSubjectName.trim())
      
      // Then upload files to the subject
      const fileArray = Array.from(selectedFiles)
      
      // Convert files to the format expected by the backend
      const filesData = await Promise.all(
        fileArray.map(async (file) => {
          return new Promise<{name: string, size: number, type: string, data: string}>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({
              name: file.name,
              size: file.size,
              type: file.type,
              data: reader.result as string
            })
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        })
      )
      
      await addFilesToSubject({
        subjectName: newSubjectName.trim(),
        files: filesData
      })
      
      setNewSubjectName('')
      setSelectedFiles(null)
      await loadUserData()
    } catch (err) {
      console.error('Error creating subject with files:', err)
      setError('Failed to create subject with materials. Please try again.')
    } finally {
      setAddingSubject(false)
    }
  }

  const removeSubjectHandler = async (subjectName: string) => {
    if (!user || !confirm(`Are you sure you want to delete "${subjectName}" and all its files? This cannot be undone.`)) return
    
    try {
      await removeSubject(subjectName)
      
      
      await loadUserData()
    } catch (err) {
      console.error('Error removing subject:', err)
      setError('Failed to remove subject. Please try again.')
    }
  }


  const removeFile = async (fileName: string, subjectName: string) => {
    if (!user || !confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) return
    
    try {
      await removeFileMetadata(fileName, subjectName)
      
      await loadUserData()
    } catch (err) {
      console.error('Error removing file:', err)
      setError('Failed to remove file. Please try again.')
    }
  }

  const openFile = (file: FileMetadata) => {
    const fileUrl = file.downloadUrl
    
    if (!fileUrl) {
      alert('File URL not available. Please try re-uploading the file.')
      return
    }
    
    try {
      const newWindow = window.open()
      if (newWindow) {
        if (file.mimeType.startsWith('text/') || file.mimeType === 'application/pdf') {
          // For text files and PDFs, create an iframe
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.originalName}</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; }
                  .header { padding: 20px; background: #f5f5f5; border-bottom: 1px solid #ddd; }
                  .content { padding: 20px; }
                  iframe { width: 100%; height: calc(100vh - 100px); border: none; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${file.originalName}</h2>
                  <p>Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
                  <p>Source: Firebase Storage</p>
                </div>
                <div class="content">
                  <iframe src="${fileUrl}"></iframe>
                </div>
              </body>
            </html>
          `)
        } else if (file.mimeType.startsWith('image/')) {
          // For images, display directly
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.originalName}</title>
                <style>
                  body { margin: 0; padding: 20px; font-family: Arial, sans-serif; text-align: center; }
                  .header { margin-bottom: 20px; }
                  img { max-width: 100%; height: auto; border: 1px solid #ddd; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${file.originalName}</h2>
                  <p>Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
                  <p>Source: Firebase Storage</p>
                </div>
                <img src="${fileUrl}" alt="${file.originalName}" />
              </body>
            </html>
          `)
        } else {
          // For other file types, provide download link
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.originalName}</title>
                <style>
                  body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                  .download-container { text-align: center; margin-top: 50px; }
                  .download-button { 
                    display: inline-block; 
                    padding: 12px 24px; 
                    background: #007bff; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    font-weight: 500;
                  }
                  .download-button:hover { background: #0056b3; }
                </style>
              </head>
              <body>
                <div class="download-container">
                  <h2>${file.originalName}</h2>
                  <p>Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
                  <p>Source: Firebase Storage</p>
                  <p>This file type cannot be previewed in the browser.</p>
                  <a href="${fileUrl}" download="${file.originalName}" class="download-button">
                    Download File
                  </a>
                </div>
              </body>
            </html>
          `)
        }
        newWindow.document.close()
      }
    } catch (error) {
      console.error('Error opening file:', error)
      alert('Error opening file. The file may be corrupted or too large.')
    }
  }

  // Debug logging
  console.log('SettingsApp render state:', { 
    user: !!user, 
    authLoading, 
    loading, 
    userData: !!userData, 
    error,
    userDataSubjects: userData?.subjects?.length 
  })

  // Early return for debugging
  if (!user) {
    return (
      <div className="settings-container">
        <div className="error-state">
          <p>No user found. Please sign in.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-state">
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-container">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadUserData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="settings-container">
        <div className="error-state">
          <p>No user data found. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const totalFiles = userData.subjects.reduce((sum, subject) => sum + subject.files.length, 0)
  const totalSize = userData.subjects.reduce((sum, subject) => 
    sum + subject.files.reduce((fileSum, file) => fileSum + file.fileSize, 0), 0
  )
  
  // Use processing stats for more accurate counts
  const actualStats = processingStats.total > 0 ? processingStats : {
    total: totalFiles,
    processing: 0,
    completed: totalFiles,
    failed: 0,
    pending: 0
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your profile, subjects, and files</p>
      </div>

      <div className="settings-stats">
        <div className="stat-card">
          <h3>{actualStats.total}</h3>
          <p>Total Files</p>
        </div>
        <div className="stat-card">
          <h3>{userData.subjects.length}</h3>
          <p>Subjects</p>
        </div>
        <div className="stat-card">
          <h3>{(totalSize / 1024 / 1024).toFixed(2)} MB</h3>
          <p>Storage Used</p>
        </div>
        <div className="stat-card">
          <h3>{actualStats.processing}</h3>
          <p>Processing</p>
        </div>
        <div className="stat-card">
          <h3>{actualStats.completed}</h3>
          <p>Ready</p>
        </div>
        {actualStats.failed > 0 && (
          <div className="stat-card error">
            <h3>{actualStats.failed}</h3>
            <p>Failed</p>
          </div>
        )}
      </div>

      <div className="settings-tabs">
        <button 
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={`tab-button ${activeTab === 'subjects' ? 'active' : ''}`}
          onClick={() => setActiveTab('subjects')}
        >
          Subjects & Materials
        </button>
        <button 
          className={`tab-button ${activeTab === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          Quiz Settings
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'profile' && (
          <div className="profile-section">
            <div className="section-card">
              <h3>Profile Information</h3>
              <div className="profile-field">
                <label>Display Name:</label>
                {editingProfile ? (
                  <div className="edit-field">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Enter display name"
                    />
                    <div className="edit-actions">
                      <button onClick={updateProfile} className="save-button">
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setEditingProfile(false)
                          setNewDisplayName(userData.profile.displayName)
                        }} 
                        className="cancel-button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="display-field">
                    <span>{userData.profile.displayName}</span>
                    <button 
                      onClick={() => setEditingProfile(true)} 
                      className="edit-button"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div className="profile-field">
                <label>Email:</label>
                <div className="display-field">
                  <span>{userData.profile.email}</span>
                </div>
              </div>
              <div className="profile-field">
                <label>Member Since:</label>
                <div className="display-field">
                  <span>{(() => {
                    try {
                      if (!userData.profile.createdAt) {
                        return 'Unknown';
                      }
                      
                      let dateValue = userData.profile.createdAt;
                      
                      // Handle Firestore Timestamp string format: "Timestamp(seconds=1757793696, nanoseconds=68000000)"
                      if (typeof dateValue === 'string' && dateValue.startsWith('Timestamp(')) {
                        // Extract seconds and nanoseconds from string
                        const match = dateValue.match(/seconds=(\d+).*?nanoseconds=(\d+)/);
                        if (match) {
                          const seconds = parseInt(match[1]);
                          const nanoseconds = parseInt(match[2]);
                          dateValue = seconds * 1000 + Math.floor(nanoseconds / 1000000);
                        }
                      }
                      // Handle actual Firestore Timestamp objects
                      else if (typeof dateValue === 'object' && dateValue !== null) {
                        // Try to access .toDate() method if it exists (Firestore Timestamp)
                        if (typeof (dateValue as any).toDate === 'function') {
                          const date = (dateValue as any).toDate();
                          return date.toLocaleDateString();
                        }
                        
                        // Fallback to manual conversion
                        if ('seconds' in dateValue) {
                          const timestamp = dateValue as any;
                          dateValue = timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds || 0) / 1000000);
                        }
                      }
                      
                      const date = new Date(dateValue);
                      return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
                    } catch (error) {
                      return 'Unknown';
                    }
                  })()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="subjects-section">
            <div className="section-card">
              <h3>Add New Subject with Materials</h3>
              <p className="section-description">
                Create a new subject and upload study materials in one step. Materials are required to create a subject.
              </p>
              <div className="add-subject-form">
                <div className="form-row">
                  <label htmlFor="subject-name">Subject Name:</label>
                  <input
                    id="subject-name"
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Enter subject name (e.g., Mathematics, Biology)"
                    disabled={addingSubject}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="subject-files">Study Materials:</label>
                  <div className="file-input-wrapper">
                    <input
                      id="subject-files"
                      type="file"
                      multiple
                      onChange={(e) => setSelectedFiles(e.target.files)}
                      disabled={addingSubject}
                    />
                    <div 
                      className={`file-input-button ${addingSubject ? 'disabled' : ''}`}
                      onClick={() => !addingSubject && document.getElementById('subject-files')?.click()}
                    >
                      <span className="file-input-icon">📁</span>
                      <span className={`file-input-text ${selectedFiles && selectedFiles.length > 0 ? 'has-files' : ''}`}>
                        {selectedFiles && selectedFiles.length > 0 
                          ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                          : 'Choose study materials (required)'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={addSubjectWithFiles} 
                  disabled={!newSubjectName.trim() || !selectedFiles || selectedFiles.length === 0 || addingSubject}
                  className="add-button"
                >
                  {addingSubject ? 'Creating Subject...' : 'Create Subject with Materials'}
                </button>
              </div>
            </div>

            <div className="section-card">
              <h3>Your Subjects & Materials</h3>
              {userData.subjects.length === 0 ? (
                <div className="empty-state">
                  <p>No subjects found. Create your first subject with materials above.</p>
                </div>
              ) : (
                <div className="files-by-subject">
                  {userData.subjects.map((subject) => (
                    <div key={subject.name} className="subject-files">
                      <div className="subject-header">
                        <h4>{subject.name} ({subject.fileCount} files)</h4>
                        <div className="subject-actions">
                          <button 
                            onClick={() => removeSubjectHandler(subject.name)}
                            className="delete-button"
                          >
                            Delete Subject
                          </button>
                        </div>
                      </div>
                      {subject.files.length === 0 ? (
                        <p className="no-files">No files in this subject</p>
                      ) : (
                        <div className="files-grid">
                          {subject.files.map((file, fileIndex) => {
                            const processingFile = processingFiles.find(pf => pf.fileName === file.fileName)
                            const currentStatus = processingFile?.processingStatus || file.processingStatus
                            
                            return (
                              <div key={fileIndex} className="file-item">
                                <div className="file-icon">📄</div>
                                <div className="file-details">
                                  <h4>{file.originalName}</h4>
                                  <p className="file-meta">
                                    {file.mimeType} • {(file.fileSize / 1024).toFixed(1)} KB
                                  </p>
                                  <div className="file-status">
                                    <span className={`status-indicator ${currentStatus}`}>
                                      {currentStatus === 'processing' && <span className="spinner">⟳</span>}
                                      {currentStatus === 'completed' && <span className="check">✓</span>}
                                      {currentStatus === 'failed' && <span className="error">✗</span>}
                                      {currentStatus === 'pending' && <span className="pending">⏳</span>}
                                    </span>
                                    <span className="status-text">
                                      {currentStatus === 'processing' && 'Processing...'}
                                      {currentStatus === 'completed' && `Ready (${processingFile?.textLength || 0} chars)`}
                                      {currentStatus === 'failed' && 'Processing failed'}
                                      {currentStatus === 'pending' && 'Pending'}
                                    </span>
                                  </div>
                                  {processingFile?.processedAt && (
                                    <p className="file-processed-time">
                                      Processed: {processingFile.processedAt.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <div className="file-actions">
                                  <button 
                                    onClick={() => openFile(file)}
                                    className="open-button"
                                    title="Open file"
                                  >
                                    Open
                                  </button>
                                  <button 
                                    onClick={() => removeFile(file.fileName, subject.name)}
                                    className="delete-button"
                                    title="Delete file"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


        {activeTab === 'quiz' && (
          <div className="quiz-section">
            <div className="section-card">
              <h3>Quiz Blocker Settings</h3>
              <p className="section-description">
                Configure how often quiz questions appear when watching YouTube Shorts to enhance your learning experience.
              </p>
              
              <div className="quiz-settings-form">
                <div className="form-row">
                  <div className="checkbox-label">
                    <span className="checkbox-text">Enable Quiz Blocker</span>
                    <input
                      id="quiz-enabled"
                      type="checkbox"
                      checked={quizSettings.enabled}
                      onChange={(e) => setQuizSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                  </div>
                  <p className="field-description">
                    When enabled, quiz questions will appear after watching a certain number of shorts.
                  </p>
                </div>

                <div className="form-row">
                  <label htmlFor="quiz-frequency">Quiz Frequency:</label>
                  <select
                    id="quiz-frequency"
                    value={quizSettings.quizFrequency}
                    onChange={(e) => setQuizSettings(prev => ({ ...prev, quizFrequency: parseInt(e.target.value) }))}
                    disabled={!quizSettings.enabled}
                  >
                    <option value={3}>Every 3 shorts</option>
                    <option value={5}>Every 5 shorts</option>
                    <option value={7}>Every 7 shorts</option>
                    <option value={10}>Every 10 shorts</option>
                    <option value={15}>Every 15 shorts</option>
                    <option value={20}>Every 20 shorts</option>
                  </select>
                  <p className="field-description">
                    How many shorts you can watch before a quiz question appears.
                  </p>
                </div>


                <button
                  onClick={saveQuizSettings}
                  disabled={savingQuizSettings}
                  className="save-settings-button"
                >
                  {savingQuizSettings ? 'Saving...' : 'Save Quiz Settings'}
                </button>
              </div>
            </div>

            <div className="section-card">
              <h3>Quiz Statistics</h3>
              <div className="quiz-stats">
                <div className="stat-item">
                  <span className="stat-label">Current Status:</span>
                  <span className={`stat-value ${quizSettings.enabled ? 'enabled' : 'disabled'}`}>
                    {quizSettings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Quiz Frequency:</span>
                  <span className="stat-value">Every {quizSettings.quizFrequency} shorts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Quiz Generation:</span>
                  <span className="stat-value configured">
                    Backend AI Service
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsApp
