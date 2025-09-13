import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { initializeUser, getUserData, Subject, FileMetadata } from '@/lib/firestore'

// Use types from firestore.ts

interface UserProfile {
  subjects: (Subject & { files: FileMetadata[] })[]
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
            // User is onboarded, load from Firestore
            try {
              const userData = await getUserData()
              
              const profile: UserProfile = {
                subjects: userData.subjects || [],
                isOnboarded: true
              }
              setProfile(profile)
            } catch (error) {
              console.warn('Failed to load user data from Firestore:', error)
              // Fallback to empty profile
              setProfile({
                subjects: [],
                isOnboarded: true
              })
            }
          } else {
            // User is not onboarded, initialize in Firestore
            try {
              await initializeUser()
              console.log('User initialized in Firestore')
            } catch (error) {
              console.warn('Failed to initialize user in Firestore:', error)
            }
            
            // Set default profile for new users
            setProfile({
              subjects: [],
              isOnboarded: false
            })
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
          // Fallback to empty profile
          setProfile({
            subjects: [],
            isOnboarded: false
          })
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
    
    // Profile updates should be handled through Firebase Functions
    // No localStorage storage needed as data comes from Firebase/MongoDB
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
