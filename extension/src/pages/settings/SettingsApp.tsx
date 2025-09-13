import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { initializeUser, updateUserProfile, addSubject, removeSubject, removeFileMetadata } from '@/lib/firestore'
import { addFilesToSubject } from '@/lib/functions'
import { getUserData, FileMetadata, Subject } from '@/lib/firestore'


// Use types from firestore.ts


interface UserData {
  profile: {
    displayName: string
    email: string
    createdAt: Date
    updatedAt: Date
  }
  subjects: (Subject & { files: FileMetadata[] })[]
}

const SettingsApp: React.FC = () => {
  const { user } = useAuth()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'subjects' | 'files'>('profile')
  
  // Debug logging
  console.log('SettingsApp rendering, user:', user)
  
  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
  
  // Subject management state
  const [newSubjectName, setNewSubjectName] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  
  // File management state
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

  // Removed Firebase Functions dependency

  useEffect(() => {
    loadUserData()
  }, [user])

  const loadUserData = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      
      const data = await getUserData()
      
      console.log('Raw getUserData response:', data)
      
      // Handle the actual data structure returned by Firestore
      const userData: UserData = {
        profile: {
          displayName: data.profile.displayName || user?.displayName || 'User',
          email: data.profile.email || user?.email || '',
          createdAt: data.profile.createdAt ? new Date(data.profile.createdAt) : new Date(),
          updatedAt: data.profile.updatedAt ? new Date(data.profile.updatedAt) : new Date()
        },
        subjects: data.subjects || []
      }
      
      setUserData(userData)
      setNewDisplayName(userData.profile.displayName)
      if (userData.subjects.length > 0 && !selectedSubject) {
        setSelectedSubject(userData.subjects[0].name)
      }
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

  const addSubjectHandler = async () => {
    if (!user || !newSubjectName.trim()) return
    
    try {
      setAddingSubject(true)
      await addSubject(newSubjectName.trim())
      
      setNewSubjectName('')
      await loadUserData()
    } catch (err) {
      console.error('Error adding subject:', err)
      setError('Failed to add subject. Please try again.')
    } finally {
      setAddingSubject(false)
    }
  }

  const removeSubjectHandler = async (subjectName: string) => {
    if (!user || !confirm(`Are you sure you want to delete "${subjectName}" and all its files? This cannot be undone.`)) return
    
    try {
      await removeSubject(subjectName)
      
      // Reset selected subject if it was deleted
      if (selectedSubject === subjectName) {
        setSelectedSubject('')
      }
      
      await loadUserData()
    } catch (err) {
      console.error('Error removing subject:', err)
      setError('Failed to remove subject. Please try again.')
    }
  }

  const uploadFiles = async () => {
    if (!user || !selectedFiles || !selectedSubject) return
    
    try {
      setUploadingFiles(true)
      
      // Convert FileList to array and process each file
      const filesArray = Array.from(selectedFiles)
      const fileDataArray = await Promise.all(
        filesArray.map(async (file) => {
          return new Promise<{ name: string; data: string; size: number; type: string }>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                name: file.name,
                data: reader.result as string,
                size: file.size,
                type: file.type
              })
            }
            reader.readAsDataURL(file)
          })
        })
      )
      
      // Upload files using the backend function
      const result = await addFilesToSubject({
        subjectName: selectedSubject,
        files: fileDataArray
      })
      
      const uploadResult = result.data as any
      if (uploadResult?.success) {
        console.log(`Uploaded ${uploadResult.filesAdded} files successfully`)
        if (uploadResult.filesFailed > 0) {
          setError(`${uploadResult.filesFailed} files failed to upload`)
        }
        
        // Document processing is automatically triggered by the backend
        // after successful file uploads via Pub/Sub
        console.log('Document processing will be triggered automatically by the backend')
      } else {
        throw new Error('Upload failed')
      }
      
      setSelectedFiles(null)
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      await loadUserData()
    } catch (err) {
      console.error('Error uploading files:', err)
      setError('Failed to upload files. Please try again.')
    } finally {
      setUploadingFiles(false)
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

  const totalFiles = userData.subjects.reduce((sum, subject) => sum + subject.fileCount, 0)
  const totalSize = userData.subjects.reduce((sum, subject) => 
    sum + subject.files.reduce((fileSum, file) => fileSum + file.fileSize, 0), 0
  )

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your profile, subjects, and files</p>
      </div>

      <div className="settings-stats">
        <div className="stat-card">
          <h3>{totalFiles}</h3>
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
          Subjects
        </button>
        <button 
          className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
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
                <span>{userData.profile.email}</span>
              </div>
              <div className="profile-field">
                <label>Member Since:</label>
                <span>{new Date(userData.profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="subjects-section">
            <div className="section-card">
              <h3>Add New Subject</h3>
              <div className="add-subject-form">
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Enter subject name"
                  disabled={addingSubject}
                />
                <button 
                  onClick={addSubjectHandler} 
                  disabled={!newSubjectName.trim() || addingSubject}
                  className="add-button"
                >
                  {addingSubject ? 'Adding...' : 'Add Subject'}
                </button>
              </div>
            </div>

            <div className="section-card">
              <h3>Your Subjects</h3>
              {userData.subjects.length === 0 ? (
                <div className="empty-state">
                  <p>No subjects found. Add your first subject above.</p>
                </div>
              ) : (
                <div className="subjects-grid">
                  {userData.subjects.map((subject) => (
                    <div key={subject.name} className="subject-card">
                      <div className="subject-info">
                        <h4>{subject.name}</h4>
                        <p>{subject.fileCount} files</p>
                        <p className="subject-date">
                          Created: {new Date(subject.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="subject-actions">
                        <button 
                          onClick={() => removeSubjectHandler(subject.name)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-section">
            <div className="section-card">
              <h3>Upload Files</h3>
              <div className="upload-form">
                <div className="form-row">
                  <label htmlFor="subject-select">Subject:</label>
                  <select
                    id="subject-select"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={uploadingFiles}
                  >
                    <option value="">Select a subject</option>
                    {userData.subjects.map((subject) => (
                      <option key={subject.name} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="file-upload">Files:</label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    disabled={uploadingFiles}
                  />
                </div>
                <button
                  onClick={uploadFiles}
                  disabled={!selectedSubject || !selectedFiles || uploadingFiles}
                  className="upload-button"
                >
                  {uploadingFiles ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>
            </div>

            <div className="section-card">
              <h3>Your Files</h3>
              {totalFiles === 0 ? (
                <div className="empty-state">
                  <p>No files found. Upload files above to get started.</p>
                </div>
              ) : (
                <div className="files-by-subject">
                  {userData.subjects.map((subject) => (
                    <div key={subject.name} className="subject-files">
                      <h4>{subject.name} ({subject.fileCount} files)</h4>
                      {subject.files.length === 0 ? (
                        <p className="no-files">No files in this subject</p>
                      ) : (
                        <div className="files-grid">
                          {subject.files.map((file) => (
                            <div key={file.fileName} className="file-card">
                              <div className="file-icon">
                                {file.mimeType.startsWith('image/') ? '🖼️' : 
                                 file.mimeType.includes('pdf') ? '📄' : 
                                 file.mimeType.startsWith('text/') ? '📝' : 
                                 file.mimeType.includes('word') ? '📄' : 
                                 file.mimeType.includes('presentation') ? '📊' : '📁'}
                              </div>
                              
                              <div className="file-info">
                                <h5 title={file.originalName}>{file.originalName}</h5>
                                <p className="file-details">
                                  {file.mimeType} • {(file.fileSize / 1024).toFixed(1)} KB
                                </p>
                                <p className="file-status">
                                  Status: {file.processingStatus}
                                </p>
                              </div>
                              
                              <div className="file-actions">
                                <button 
                                  onClick={() => openFile(file)}
                                  className="open-button"
                                  title="Open file in new tab"
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
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsApp
