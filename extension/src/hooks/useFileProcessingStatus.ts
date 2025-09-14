import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export interface FileProcessingInfo {
  id: string
  fileName: string
  originalName: string
  subjectName: string
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  uploadedAt: Date
  processedAt?: Date
  fileSize: number
  mimeType: string
  downloadUrl?: string
  textLength?: number
  elementCount?: number
  processingError?: string
}

export interface ProcessingStats {
  total: number
  processing: number
  completed: number
  failed: number
  pending: number
}

export const useFileProcessingStatus = () => {
  const { user } = useAuth()
  const [files, setFiles] = useState<FileProcessingInfo[]>([])
  const [stats, setStats] = useState<ProcessingStats>({
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    pending: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Clear state immediately when user changes or is null
    if (!user) {
      setFiles([])
      setStats({ total: 0, processing: 0, completed: 0, failed: 0, pending: 0 })
      setLoading(false)
      return
    }

    // Reset state for new user
    setFiles([])
    setStats({ total: 0, processing: 0, completed: 0, failed: 0, pending: 0 })
    setLoading(true)

    let unsubscribe: Unsubscribe

    const setupListener = async () => {
      try {
        const filesQuery = query(
          collection(db, 'files'),
          where('userId', '==', user.uid)
        )

        unsubscribe = onSnapshot(filesQuery, (snapshot) => {
          const fileData: FileProcessingInfo[] = []
          
          snapshot.forEach((doc) => {
            const data = doc.data()
            fileData.push({
              id: doc.id,
              fileName: data.fileName,
              originalName: data.originalName,
              subjectName: data.subjectName,
              processingStatus: data.processingStatus,
              uploadedAt: data.uploadedAt?.toDate() || new Date(),
              processedAt: data.processedAt?.toDate(),
              fileSize: data.fileSize,
              mimeType: data.mimeType,
              downloadUrl: data.downloadUrl,
              textLength: data.textLength,
              elementCount: data.elementCount,
              processingError: data.processingError
            })
          })

          // Sort by upload date (newest first)
          fileData.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
          
          setFiles(fileData)

          // Calculate stats
          const newStats = {
            total: fileData.length,
            processing: fileData.filter(f => f.processingStatus === 'processing').length,
            completed: fileData.filter(f => f.processingStatus === 'completed').length,
            failed: fileData.filter(f => f.processingStatus === 'failed').length,
            pending: fileData.filter(f => f.processingStatus === 'pending').length
          }
          
          setStats(newStats)
          setLoading(false)
        }, (error) => {
          console.error('Error listening to file processing status:', error)
          setLoading(false)
        })
      } catch (error) {
        console.error('Error setting up file processing listener:', error)
        setLoading(false)
      }
    }

    setupListener()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user?.uid])

  const getFilesBySubject = (subjectName: string) => {
    return files.filter(file => file.subjectName === subjectName)
  }

  const getSubjectProcessingStats = (subjectName: string) => {
    const subjectFiles = getFilesBySubject(subjectName)
    return {
      total: subjectFiles.length,
      processing: subjectFiles.filter(f => f.processingStatus === 'processing').length,
      completed: subjectFiles.filter(f => f.processingStatus === 'completed').length,
      failed: subjectFiles.filter(f => f.processingStatus === 'failed').length,
      pending: subjectFiles.filter(f => f.processingStatus === 'pending').length
    }
  }

  const isSubjectReadyForStudy = (subjectName: string) => {
    const subjectFiles = getFilesBySubject(subjectName)
    if (subjectFiles.length === 0) return false
    
    // Subject is ready if it has at least one completed file and no processing files
    const hasCompletedFiles = subjectFiles.some(f => f.processingStatus === 'completed')
    const hasProcessingFiles = subjectFiles.some(f => f.processingStatus === 'processing')
    
    return hasCompletedFiles && !hasProcessingFiles
  }

  return {
    files,
    stats,
    loading,
    getFilesBySubject,
    getSubjectProcessingStats,
    isSubjectReadyForStudy
  }
}
