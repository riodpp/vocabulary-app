import { createClient } from '@supabase/supabase-js'

// Handle both development (process.env) and production (window.env) environments
const supabaseUrl = window.env?.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = window.env?.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file or Fly.io secrets.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)