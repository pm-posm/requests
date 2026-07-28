import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (envUrl && envUrl.startsWith('http')) ? envUrl : defaultSupabaseUrl;
const supabaseAnonKey = envKey || defaultSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
