import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface FileData {
  name: string
  size: number
  type: string
  data?: string // Keep for backward compatibility
  downloadUrl?: string // Firebase Storage download URL
  subjectName: string
}

interface Subject {
  id: string
  name: string
  files: Array<{
    name: string
    size: number
    type: string
    data: string
  }>
}

const FilesApp: React.FC = () => {
  const { } = useAuth()
  const [files, setFiles] = useState<FileData[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')

  useEffect(() => {
    // Load files and subjects from localStorage
    const savedFiles = localStorage.getItem('sigma_files')
    const savedSubjects = localStorage.getItem('sigma_subjects')
    
    if (savedFiles) {
      setFiles(JSON.parse(savedFiles))
    }
    
    if (savedSubjects) {
      setSubjects(JSON.parse(savedSubjects))
    }
  }, [])

  const openFile = (file: FileData) => {
    // Use Firebase Storage download URL if available, fallback to data URL
    const fileUrl = file.downloadUrl || file.data
    
    if (!fileUrl) {
      alert('File URL not available. Please try re-uploading the file.')
      return
    }
    
    try {
      const newWindow = window.open()
      if (newWindow) {
        if (file.type.startsWith('text/') || file.type === 'application/pdf') {
          // For text files and PDFs, create an iframe
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.name}</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; }
                  .header { padding: 20px; background: #f5f5f5; border-bottom: 1px solid #ddd; }
                  .content { padding: 20px; }
                  iframe { width: 100%; height: calc(100vh - 100px); border: none; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${file.name}</h2>
                  <p>Subject: ${file.subjectName} | Size: ${(file.size / 1024).toFixed(1)} KB</p>
                  <p>Source: ${file.downloadUrl ? 'Firebase Storage' : 'Local Data'}</p>
                </div>
                <div class="content">
                  <iframe src="${fileUrl}"></iframe>
                </div>
              </body>
            </html>
          `)
        } else if (file.type.startsWith('image/')) {
          // For images, display directly
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.name}</title>
                <style>
                  body { margin: 0; padding: 20px; font-family: Arial, sans-serif; text-align: center; }
                  .header { margin-bottom: 20px; }
                  img { max-width: 100%; height: auto; border: 1px solid #ddd; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${file.name}</h2>
                  <p>Subject: ${file.subjectName} | Size: ${(file.size / 1024).toFixed(1)} KB</p>
                  <p>Source: ${file.downloadUrl ? 'Firebase Storage' : 'Local Data'}</p>
                </div>
                <img src="${fileUrl}" alt="${file.name}" />
              </body>
            </html>
          `)
        } else {
          // For other file types, provide download link
          newWindow.document.write(`
            <html>
              <head>
                <title>${file.name}</title>
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
                  <h2>${file.name}</h2>
                  <p>Subject: ${file.subjectName} | Size: ${(file.size / 1024).toFixed(1)} KB</p>
                  <p>Source: ${file.downloadUrl ? 'Firebase Storage' : 'Local Data'}</p>
                  <p>This file type cannot be previewed in the browser.</p>
                  <a href="${fileUrl}" download="${file.name}" class="download-button">
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

  const deleteFile = (fileName: string, subjectName: string) => {
    // Remove from files list
    const updatedFiles = files.filter(f => !(f.name === fileName && f.subjectName === subjectName))
    setFiles(updatedFiles)
    localStorage.setItem('sigma_files', JSON.stringify(updatedFiles))
    
    // Remove from subjects
    const updatedSubjects = subjects.map(subject => {
      if (subject.name === subjectName) {
        return {
          ...subject,
          files: subject.files.filter(f => f.name !== fileName)
        }
      }
      return subject
    })
    setSubjects(updatedSubjects)
    localStorage.setItem('sigma_subjects', JSON.stringify(updatedSubjects))
  }

  const clearAllFiles = () => {
    if (confirm('Are you sure you want to delete all files? This cannot be undone.')) {
      setFiles([])
      localStorage.removeItem('sigma_files')
      
      const clearedSubjects = subjects.map(subject => ({ ...subject, files: [] }))
      setSubjects(clearedSubjects)
      localStorage.setItem('sigma_subjects', JSON.stringify(clearedSubjects))
    }
  }

  const filteredFiles = selectedSubject === 'all' 
    ? files 
    : files.filter(f => f.subjectName === selectedSubject)

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

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
              <option key={subject.id} value={subject.name}>
                {subject.name} ({subject.files.length} files)
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
            <div key={`${file.name}-${file.subjectName}-${index}`} className="file-card">
              <div className="file-icon">
                {file.type.startsWith('image/') ? '🖼️' : 
                 file.type.includes('pdf') ? '📄' : 
                 file.type.startsWith('text/') ? '📝' : 
                 file.type.includes('word') ? '📄' : 
                 file.type.includes('presentation') ? '📊' : '📁'}
              </div>
              
              <div className="file-info">
                <h4 title={file.name}>{file.name}</h4>
                <p className="file-subject">Subject: {file.subjectName}</p>
                <p className="file-details">
                  {file.type} • {(file.size / 1024).toFixed(1)} KB
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
                  onClick={() => deleteFile(file.name, file.subjectName)}
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
            <h4>localStorage Keys:</h4>
            <ul>
              <li>sigma_files: {localStorage.getItem('sigma_files') ? 'Present' : 'Missing'}</li>
              <li>sigma_subjects: {localStorage.getItem('sigma_subjects') ? 'Present' : 'Missing'}</li>
              <li>sigma_onboarded: {localStorage.getItem('sigma_onboarded') || 'false'}</li>
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
