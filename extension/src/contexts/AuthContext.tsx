import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { initializeUserTransactional } from '@/lib/functions'

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

interface UserProfile {
  subjects: Subject[]
  isOnboarded: boolean
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  updateProfile: (profile: Partial<UserProfile>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      
      if (user) {
        try {
          // Check Firebase custom claims for onboarding status (force refresh)
          const idTokenResult = await user.getIdTokenResult(true)
          const isOnboarded = idTokenResult.claims.isOnboarded || false
          
          console.log('Firebase custom claims:', { isOnboarded })
          
          if (isOnboarded) {
            // User is onboarded, check for saved profile or load from localStorage fallback
            const savedProfile = localStorage.getItem(`profile_${user.uid}`)
            const savedSubjects = localStorage.getItem('sigma_subjects')
            
            if (savedProfile) {
              const profile = JSON.parse(savedProfile)
              setProfile({ ...profile, isOnboarded: true })
            } else if (savedSubjects) {
              // Fallback to localStorage subjects
              const subjects = JSON.parse(savedSubjects)
              const normalizedSubjects = subjects.map((subject: any) => {
                if (typeof subject === 'string') {
                  return {
                    id: Date.now().toString() + Math.random(),
                    name: subject,
                    files: []
                  }
                }
                return subject
              })
              const profile: UserProfile = {
                subjects: normalizedSubjects,
                isOnboarded: true
              }
              setProfile(profile)
              localStorage.setItem(`profile_${user.uid}`, JSON.stringify(profile))
            } else {
              // User is onboarded but no local data
              setProfile({
                subjects: [],
                isOnboarded: true
              })
            }
          } else {
            // User is not onboarded, initialize in backend
            try {
              const result = await initializeUserTransactional()
              console.log('User initialized in backend:', result.data)
            } catch (error) {
              console.warn('Failed to initialize user in backend:', error)
            }
            
            // Set default profile for new users
            setProfile({
              subjects: [],
              isOnboarded: false
            })
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
          // Fallback to localStorage-only approach
          const savedProfile = localStorage.getItem(`profile_${user.uid}`)
          if (savedProfile) {
            setProfile(JSON.parse(savedProfile))
          } else {
            setProfile({
              subjects: [],
              isOnboarded: false
            })
          }
        }
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user || !profile) return
    
    const newProfile = { ...profile, ...updates }
    setProfile(newProfile)
    
    // Save to localStorage (later move to Firestore)
    localStorage.setItem(`profile_${user.uid}`, JSON.stringify(newProfile))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
