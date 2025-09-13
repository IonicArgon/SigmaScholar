import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface UserProfile {
  subjects: string[]
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
        // For now, we'll store profile data in localStorage
        // Later this can be moved to Firestore
        const savedProfile = localStorage.getItem(`profile_${user.uid}`)
        if (savedProfile) {
          setProfile(JSON.parse(savedProfile))
        } else {
          // Default profile for new users
          const defaultProfile: UserProfile = {
            subjects: [],
            isOnboarded: false
          }
          setProfile(defaultProfile)
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
