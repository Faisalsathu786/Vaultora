import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

const hasCreds = !!supabaseUrl && !!supabaseAnonKey

export const supabase = hasCreds
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
