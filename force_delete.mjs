import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceDelete() {
  console.log('🔥 Bắt đầu xóa triệt để project_activities và posm_projects...');

  // 1. Fetch all project_activities IDs
  const { data: actData } = await supabase.from('project_activities').select('id');
  if (actData && actData.length > 0) {
    const ids = actData.map(a => a.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const { error } = await supabase.from('project_activities').delete().in('id', chunk);
      if (error) console.log('Lỗi delete chunk activities:', error.message);
    }
  }

  // 2. Fetch all posm_projects IDs
  const { data: prjData } = await supabase.from('posm_projects').select('id');
  if (prjData && prjData.length > 0) {
    const ids = prjData.map(p => p.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const { error } = await supabase.from('posm_projects').delete().in('id', chunk);
      if (error) console.log('Lỗi delete chunk posm_projects:', error.message);
    }
  }

  // 3. Verify final counts
  const { count: c1 } = await supabase.from('project_activities').select('*', { count: 'exact', head: true });
  const { count: c2 } = await supabase.from('posm_projects').select('*', { count: 'exact', head: true });
  console.log(`📊 Kết quả sau khi xóa: project_activities = ${c1}, posm_projects = ${c2}`);
}

forceDelete();
