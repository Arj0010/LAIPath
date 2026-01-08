import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ensureProfileExists } from '../lib/profileUtils.js'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Track profile creation attempts to prevent endless retries (once per session)
  const profileCreationAttempted = useRef(new Set())

  useEffect(() => {
    // Timeout fallback: If auth check takes too long, show landing page
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('⚠️  Auth check timeout, showing landing page')
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    }, 2000) // 2 second timeout (reduced for faster UX)

    // Check if Supabase is properly configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    
    // If no credentials, skip auth check entirely
    if (!supabaseUrl || !supabaseAnonKey) {
      clearTimeout(timeoutId)
      console.log('📝 No Supabase credentials - showing landing page in demo mode')
      setSession(null)
      setUser(null)
      setLoading(false)
      return () => clearTimeout(timeoutId)
    }

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeoutId)
        
        if (error) {
          console.warn('⚠️  Auth session error:', error.message)
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }
        
        setSession(session)
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        // Auto-create profile on first login (only once per session)
        if (currentUser && !profileCreationAttempted.current.has(currentUser.id)) {
          profileCreationAttempted.current.add(currentUser.id)
          ensureProfileExists(currentUser).catch(err => {
            console.warn('Profile creation failed (non-critical):', err)
          })
        }
        
        setLoading(false)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        // Fallback: If Supabase fails, allow app to continue without auth
        console.warn('⚠️  Supabase auth check failed, showing landing page:', error.message)
        setSession(null)
        setUser(null)
        setLoading(false)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      // Auto-create profile on first login (after OAuth redirect, only once per session)
      if (currentUser && _event === 'SIGNED_IN' && !profileCreationAttempted.current.has(currentUser.id)) {
        profileCreationAttempted.current.add(currentUser.id)
        ensureProfileExists(currentUser).catch(err => {
          console.warn('Profile creation failed (non-critical):', err)
        })
      }
      
      setLoading(false)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google"
    });
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
