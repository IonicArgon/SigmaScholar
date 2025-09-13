import { useState } from 'react'
import './FileUploadAlternative.css'

interface FileUploadAlternativeProps {
  subject: string
  onFilesSelected: (subject: string, files: File[]) => void
  existingFiles: File[]
}

export default function FileUploadAlternative({ subject, onFilesSelected, existingFiles }: FileUploadAlternativeProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => 
      file.type.includes('pdf') || 
      file.type.includes('document') || 
      file.type.includes('text') ||
      file.type.includes('presentation')
    )
    
    if (validFiles.length > 0) {
      onFilesSelected(subject, validFiles)
    }
  }

  const openFileManager = () => {
    // Instead of using file input, show instructions for alternative upload
    alert(`To upload files for ${subject}:\n\n1. Save your files to a folder\n2. We'll add file upload via content script later\n3. For now, you can complete setup without files`)
  }

  return (
    <div className="file-upload-alternative">
      <div 
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileManager}
      >
        <div className="drop-zone-content">
          <div className="upload-icon">📁</div>
          <p>Drag & drop files here</p>
          <p className="upload-note">or click for instructions</p>
          <small>PDF, DOC, TXT, PPT files supported</small>
        </div>
      </div>
      
      {existingFiles.length > 0 && (
        <div className="file-list">
          <p>Selected files:</p>
          {existingFiles.map((file, index) => (
            <div key={index} className="file-item">
              <span>{file.name}</span>
              <span className="file-size">({Math.round(file.size / 1024)}KB)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
