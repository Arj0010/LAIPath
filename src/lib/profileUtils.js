import { supabase } from './supabase'

/**
 * Profile Utilities
 * 
 * Handles automatic profile creation on first login
 * Includes fallback safety for Supabase unavailability
 */

/**
 * Auto-create profile on first login
 * 
 * Checks if profile exists, creates if not found
 * Falls back gracefully if Supabase is unavailable
 */
export async function ensureProfileExists(user) {
  if (!user) {
    console.warn('No user provided for profile creation')
    return null
  }

  try {
    // Check if profile already exists by id
    // FALLBACK: If Supabase fails, return null (non-critical)
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    // If profile exists, return early
    if (existingProfile && !checkError) {
      console.log('Profile already exists for user:', user.id)
      return existingProfile
    }

    // Profile doesn't exist (PGRST116 = no rows returned)
    // This is expected for first-time users
    if (checkError && checkError.code !== 'PGRST116') {
      // AUTHORIZATION: Treat 406 Not Acceptable as authorization issue
      if (checkError.status === 406 || checkError.message?.includes('406')) {
        console.warn('⚠️  Authorization issue (406): User may not have access to check profile')
        console.warn('   Falling back to in-memory state')
        return null
      }
      // Only throw if it's a real error (not "not found")
      throw checkError
    }

    // Create new profile
    // FALLBACK: If Supabase fails, return null (non-critical)
    // NOTE: created_at and updated_at are optional - database may handle them automatically
    const profileData = {
      id: user.id, // Use user.id as primary key
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      preferred_study_time: '20:00',
    }

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single()

    if (insertError) {
      // AUTHORIZATION: Treat 406 Not Acceptable as authorization issue
      if (insertError.status === 406 || insertError.message?.includes('406')) {
        console.warn('⚠️  Authorization issue (406): User may not have access to create profile')
        console.warn('   Falling back to in-memory state')
        return null
      }
      throw insertError
    }

    console.log('Profile auto-created for user:', user.id)
    return newProfile

  } catch (error) {
    // AUTHORIZATION: Treat 406 Not Acceptable as authorization issue
    if (error.status === 406 || error.message?.includes('406')) {
      console.warn('⚠️  Authorization issue (406): User may not have access to create profile')
      console.warn('   Falling back to in-memory state')
      return null
    }
    // Fallback: Log warning but don't crash
    console.warn('⚠️  Supabase unavailable or error creating profile:', error.message)
    console.warn('   App will continue with in-memory state only')
    return null
  }
}

