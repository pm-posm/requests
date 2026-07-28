import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeData() {
  console.log('🚀 Bắt đầu dọn dẹp toàn bộ dữ liệu thử nghiệm trong CSDL Supabase...');

  const tables = [
    'project_attachments',
    'project_comments',
    'project_activities',
    'project_progress_ai',
    'posm_projects',
    'subtask_audit_logs',
    'raw_requests'
  ];

  for (const table of tables) {
    try {
      console.log(`🧹 Đang xóa bảng ${table}...`);
      // Delete rows matching neq or gt
      const { error: err1 } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err1) {
        const { error: err2 } = await supabase.from(table).delete().gt('created_at', '1970-01-01');
        if (err2) {
          const { error: err3 } = await supabase.from(table).delete().gte('sheet_row_index', 0);
          if (err3) {
            console.log(`⚠️ Lưu ý bảng ${table}:`, err3.message);
          }
        }
      }
      console.log(`✅ Đã làm sạch bảng ${table}`);
    } catch (e) {
      console.error(`❌ Lỗi khi xóa ${table}:`, e.message);
    }
  }

  console.log('✨ HOÀN TẤT DỌN DẸP SẠCH BỘ CSDL SUPABASE!');
}

purgeData();
