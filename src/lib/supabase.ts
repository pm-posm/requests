import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = "https://ikfychmglmunznceopnh.supabase.co";
export const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnljaG1nbG11bnpuY2VvcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njc0MjAsImV4cCI6MjEwMjQ0MzQyMH0.2eMYy8NPMC66OldPPtmm606zlqOByPv-_zbcNKioM_Y";

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
