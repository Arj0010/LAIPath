import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Client Configuration
 * 
 * Loads credentials from .env file (root directory)
 * Vite automatically loads .env files and exposes variables prefixed with VITE_
 * 
 * Required .env variables:
 * VITE_SUPABASE_URL=your_supabase_project_url
 * VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
 */

// Load credentials from environment variables
// Vite reads from .env file in root directory
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Debug: Log credential status (only in development)
if (import.meta.env.DEV) {
  if (supabaseUrl && supabaseAnonKey) {
    console.log('✅ Supabase credentials loaded from .env')
    console.log('   URL:', supabaseUrl.substring(0, 30) + '...')
    console.log('   Key:', supabaseAnonKey.substring(0, 20) + '...')
  } else {
    console.warn('⚠️  Supabase credentials not found in .env')
    console.warn('   Create a .env file in the root directory with:')
    console.warn('   VITE_SUPABASE_URL=your_supabase_project_url')
    console.warn('   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key')
  }
}

// Create a dummy client if credentials are missing (prevents crashes)
let supabase
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials not found. App will work in demo mode without persistence.')
  // Create a minimal client with dummy values to prevent crashes
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
} else {
  // Create Supabase client with real credentials from .env
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
}

export { supabase }

