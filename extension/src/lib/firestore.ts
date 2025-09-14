import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Initialize Firestore
const db = getFirestore()

// Firestore collection references
const USERS_COLLECTION = 'users'
const SUBJECTS_COLLECTION = 'subjects'
const FILES_COLLECTION = 'files'

// Types
export interface UserProfile {
  firebaseUid: string
  displayName: string
  email: string
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
  isOnboarded: boolean
}

export interface Subject {
  id?: string
  userId: string
  name: string
  createdAt: any // Firestore Timestamp
  fileCount?: number
  sessionCount?: number
  lastSessionDate?: string
}

export interface FileMetadata {
  id?: string
  userId: string
  subjectId: string
  subjectName: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  storagePath: string
  downloadUrl?: string
  uploadedAt: any // Firestore Timestamp
  processingStatus: 'pending' | 'completed' | 'failed'
}

/**
 * Initialize a new user profile in Firestore
 */
export async function initializeUser(): Promise<UserProfile> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const userProfile: UserProfile = {
    firebaseUid: user.uid,
    displayName: user.displayName || 'User',
    email: user.email || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isOnboarded: false
  }

  // Use user UID as document ID for easy lookup
  await setDoc(doc(db, USERS_COLLECTION, user.uid), userProfile)
  
  return userProfile
}

/**
 * Get user profile data
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const userDoc = await getDoc(doc(db, USERS_COLLECTION, user.uid))
  
  if (!userDoc.exists()) {
    return null
  }

  return userDoc.data() as UserProfile
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const updateData = {
    ...updates,
    updatedAt: serverTimestamp()
  }

  await updateDoc(doc(db, USERS_COLLECTION, user.uid), updateData)
}

/**
 * Complete user onboarding
 */
export async function completeOnboarding(): Promise<void> {
  await updateUserProfile({ isOnboarded: true })
}

/**
 * Get all subjects for the current user
 */
export async function getUserSubjects(): Promise<Subject[]> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const q = query(
    collection(db, SUBJECTS_COLLECTION),
    where('userId', '==', user.uid)
  )
  
  const querySnapshot = await getDocs(q)
  const subjects: Subject[] = []
  
  querySnapshot.forEach((doc) => {
    subjects.push({
      id: doc.id,
      ...doc.data()
    } as Subject)
  })

  return subjects
}

/**
 * Add a new subject
 */
export async function addSubject(subjectName: string): Promise<Subject> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  const subject: Omit<Subject, 'id'> = {
    userId: user.uid,
    name: subjectName,
    createdAt: serverTimestamp(),
    fileCount: 0
  }

  const docRef = await addDoc(collection(db, SUBJECTS_COLLECTION), subject)
  
  return {
    id: docRef.id,
    ...subject
  }
}

/**
 * Remove a subject and all its files
 */
export async function removeSubject(subjectName: string): Promise<void> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  // Get the subject to delete
  const subjectsQuery = query(
    collection(db, SUBJECTS_COLLECTION),
    where('userId', '==', user.uid),
    where('name', '==', subjectName)
  )
  
  const subjectsSnapshot = await getDocs(subjectsQuery)
  
  if (subjectsSnapshot.empty) {
    throw new Error('Subject not found')
  }

  const batch = writeBatch(db)
  
  // Delete all files in the subject
  for (const subjectDoc of subjectsSnapshot.docs) {
    const subjectId = subjectDoc.id
    
    // Get all files for this subject
    const filesQuery = query(
      collection(db, FILES_COLLECTION),
      where('userId', '==', user.uid),
      where('subjectId', '==', subjectId)
    )
    
    const filesSnapshot = await getDocs(filesQuery)
    
    // Delete each file document
    filesSnapshot.forEach((fileDoc) => {
      batch.delete(fileDoc.ref)
    })
    
    // Delete the subject document
    batch.delete(subjectDoc.ref)
  }

  await batch.commit()
}

/**
 * Get all files for a user, organized by subject
 */
export async function getUserData(): Promise<{
  profile: UserProfile
  subjects: (Subject & { files: FileMetadata[] })[]
}> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  // Get user profile
  const profile = await getUserProfile()
  if (!profile) {
    throw new Error('User profile not found')
  }

  // Get all subjects
  const subjects = await getUserSubjects()

  // Get all files for each subject
  const subjectsWithFiles = await Promise.all(
    subjects.map(async (subject) => {
      const filesQuery = query(
        collection(db, FILES_COLLECTION),
        where('userId', '==', user.uid),
        where('subjectId', '==', subject.id)
      )
      
      const filesSnapshot = await getDocs(filesQuery)
      const files: FileMetadata[] = []
      
      filesSnapshot.forEach((doc) => {
        files.push({
          id: doc.id,
          ...doc.data()
        } as FileMetadata)
      })

      return {
        ...subject,
        files
      }
    })
  )

  return {
    profile,
    subjects: subjectsWithFiles
  }
}

/**
 * Add file metadata to Firestore (called after Firebase Storage upload)
 */
export async function addFileMetadata(
  subjectName: string,
  fileData: Omit<FileMetadata, 'id' | 'userId' | 'subjectId' | 'subjectName'>
): Promise<FileMetadata> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  // Find the subject
  const subjectsQuery = query(
    collection(db, SUBJECTS_COLLECTION),
    where('userId', '==', user.uid),
    where('name', '==', subjectName)
  )
  
  const subjectsSnapshot = await getDocs(subjectsQuery)
  
  if (subjectsSnapshot.empty) {
    throw new Error('Subject not found')
  }

  const subjectDoc = subjectsSnapshot.docs[0]
  const subjectId = subjectDoc.id

  const fileMetadata: Omit<FileMetadata, 'id'> = {
    userId: user.uid,
    subjectId,
    subjectName,
    ...fileData
  }

  // Add file metadata
  const fileDocRef = await addDoc(collection(db, FILES_COLLECTION), fileMetadata)

  // Update subject file count
  await updateDoc(subjectDoc.ref, {
    fileCount: (subjectDoc.data().fileCount || 0) + 1
  })

  return {
    id: fileDocRef.id,
    ...fileMetadata
  }
}

/**
 * Remove file metadata from Firestore
 */
export async function removeFileMetadata(fileName: string, subjectName: string): Promise<void> {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('No authenticated user found')
  }

  // Find the file
  const filesQuery = query(
    collection(db, FILES_COLLECTION),
    where('userId', '==', user.uid),
    where('fileName', '==', fileName),
    where('subjectName', '==', subjectName)
  )
  
  const filesSnapshot = await getDocs(filesQuery)
  
  if (filesSnapshot.empty) {
    throw new Error('File not found')
  }

  const batch = writeBatch(db)
  
  // Delete file documents and update subject file counts
  for (const fileDoc of filesSnapshot.docs) {
    const fileData = fileDoc.data() as FileMetadata
    
    // Delete file document
    batch.delete(fileDoc.ref)
    
    // Update subject file count
    const subjectRef = doc(db, SUBJECTS_COLLECTION, fileData.subjectId)
    const subjectDoc = await getDoc(subjectRef)
    
    if (subjectDoc.exists()) {
      batch.update(subjectRef, {
        fileCount: Math.max(0, (subjectDoc.data().fileCount || 1) - 1)
      })
    }
  }

  await batch.commit()
}
