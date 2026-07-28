import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  const tables = ['project_activities', 'project_progress_ai', 'posm_projects', 'raw_requests'];
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`Bảng ${table}: ${count} bản ghi`);
  }
}

checkCounts();
