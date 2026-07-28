import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Whitelisted Admin emails and explicit metadata checker
export const ADMIN_WHITELIST = [
  'admin@unilever.com',
  'mer.admin@unilever.com',
  'system.admin@posm.com'
];

export function checkIsAdminUser(user: any): boolean {
  if (!user || (!user.email && !user.id)) return false;
  
  // If explicitly assigned viewer role, restrict admin write operations
  if (user.user_metadata?.role === 'viewer' || user.app_metadata?.role === 'viewer') {
    return false;
  }

  // Any authenticated user registered in Supabase Auth is granted Admin permissions
  return true;
}
