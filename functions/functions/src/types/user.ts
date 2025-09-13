import { ObjectId } from 'mongodb'

export interface User {
  _id?: ObjectId
  firebaseUid: string
  profile: {
    displayName: string
    email: string
    isOnboarded: boolean
    createdAt: Date
    updatedAt: Date
  }
  subjects: Subject[] // Embedded subjects array
}

export interface Subject {
  _id?: ObjectId
  name: string
  createdAt: Date
  fileCount: number
  files?: FileMetadata[] // Optional embedded files
}

export interface FileMetadata {
  _id?: ObjectId
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  storagePath: string // Firebase Storage path: users/{uid}/subjects/{subjectName}/{fileName}
  downloadUrl?: string // Firebase Storage download URL
  uploadedAt: Date
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  processingQueuedAt?: Date
  processingStartedAt?: Date
  processingFailedAt?: Date
  processingError?: string
  processingData?: {
    chunks: ProcessedChunk[]
    totalChunks: number
    totalTokens: number
    processedAt: Date
    completedAt: Date
  }
}

export interface ProcessedChunk {
  raw_text: string
  cleaned_text: string
  chunk_index: number
  element_type: string
  metadata?: any
}

export interface OnboardingData {
  subjects: Array<{
    name: string
    files: Array<{
      name: string
      size: number
      type: string
      data: string // base64 data URL
    }>
  }>
}
