import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserData, removeFileMetadata, FileMetadata, Subject } from '@/lib/firestore'

// Use types from firestore.ts
type FileData = FileMetadata & { subjectName: string }

const FilesApp: React.FC = () => {
  const { user, loading } = useAuth()
  const [files, setFiles] = useState<FileData[]>([])
  const [subjects, setSubjects] = useState<(Subject & { files: FileMetadata[] })[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')

  useEffect(() => {
    if (user && !loading) {
      loadUserData()
    }
  }, [user, loading])

  const loadUserData = async () => {
    try {
      const userData = await getUserData()
      
      const subjects = userData.subjects || []
      setSubjects(subjects)
      
      // Flatten all files from all subjects
      const allFiles: FileData[] = []
      subjects.forEach((subject) => {
        subject.files.forEach((file) => {
          allFiles.push({
            ...file,
            subjectName: subject.name
          })
        })
      })
      setFiles(allFiles)
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const openFile = (file: FileData) => {
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
                  <p>Subject: ${file.subjectName} | Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
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
                  <p>Subject: ${file.subjectName} | Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
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
                  <p>Subject: ${file.subjectName} | Size: ${(file.fileSize / 1024).toFixed(1)} KB</p>
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

  const deleteFile = async (fileName: string, subjectName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) return
    
    try {
      await removeFileMetadata(fileName, subjectName)
      
      // Reload data after deletion
      await loadUserData()
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file. Please try again.')
    }
  }

  const clearAllFiles = async () => {
    if (!confirm('Are you sure you want to delete all files? This cannot be undone.')) return
    
    try {
      // Delete all files from all subjects
      for (const subject of subjects) {
        for (const file of subject.files) {
          await removeFileMetadata(file.fileName, subject.name)
        }
      }
      
      // Reload data after deletion
      await loadUserData()
    } catch (error) {
      console.error('Error clearing all files:', error)
      alert('Failed to clear all files. Please try again.')
    }
  }

  const filteredFiles = selectedSubject === 'all' 
    ? files 
    : files.filter(f => f.subjectName === selectedSubject)

  const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0)

  if (loading) {
    return (
      <div className="files-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading your files...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="files-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please sign in to view your files.</p>
          <button onClick={() => window.close()}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="files-container">
      <div className="files-header">
        <h1>File Manager</h1>
        <p>View and manage your uploaded study materials</p>
      </div>

      <div className="files-stats">
        <div className="stat-card">
          <h3>{files.length}</h3>
          <p>Total Files</p>
        </div>
        <div className="stat-card">
          <h3>{subjects.length}</h3>
          <p>Subjects</p>
        </div>
        <div className="stat-card">
          <h3>{(totalSize / 1024 / 1024).toFixed(2)} MB</h3>
          <p>Storage Used</p>
        </div>
      </div>

      <div className="files-controls">
        <div className="filter-section">
          <label htmlFor="subject-filter">Filter by Subject:</label>
          <select 
            id="subject-filter"
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject.name} value={subject.name}>
                {subject.name} ({subject.fileCount} files)
              </option>
            ))}
          </select>
        </div>
        
        <button onClick={clearAllFiles} className="danger-button">
          Clear All Files
        </button>
      </div>

      <div className="files-grid">
        {filteredFiles.length === 0 ? (
          <div className="empty-state">
            <p>No files found{selectedSubject !== 'all' ? ` for ${selectedSubject}` : ''}.</p>
            <p>Upload files through the onboarding process to see them here.</p>
          </div>
        ) : (
          filteredFiles.map((file, index) => (
            <div key={`${file.fileName}-${file.subjectName}-${index}`} className="file-card">
              <div className="file-icon">
                {file.mimeType.startsWith('image/') ? '🖼️' : 
                 file.mimeType.includes('pdf') ? '📄' : 
                 file.mimeType.startsWith('text/') ? '📝' : 
                 file.mimeType.includes('word') ? '📄' : 
                 file.mimeType.includes('presentation') ? '📊' : '📁'}
              </div>
              
              <div className="file-info">
                <h4 title={file.originalName}>{file.originalName}</h4>
                <p className="file-subject">Subject: {file.subjectName}</p>
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
                  onClick={() => deleteFile(file.fileName, file.subjectName)}
                  className="delete-button"
                  title="Delete file"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="debug-section">
        <details>
          <summary>Debug Information</summary>
          <div className="debug-content">
            <h4>Data Source:</h4>
            <ul>
              <li>Source: Firebase Functions + MongoDB</li>
              <li>Storage: Firebase Storage</li>
              <li>Files loaded: {files.length}</li>
              <li>Subjects loaded: {subjects.length}</li>
            </ul>
            
            <h4>Raw Data:</h4>
            <pre>{JSON.stringify({ files: files.length, subjects: subjects.length }, null, 2)}</pre>
          </div>
        </details>
      </div>
    </div>
  )
}

export default FilesApp
