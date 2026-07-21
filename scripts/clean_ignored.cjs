const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Must use SERVICE_ROLE key to bypass RLS for delete
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Đang xóa các bản ghi bị ignore nhầm...');
  const { data, error } = await supabase
    .from('project_progress_ai')
    .delete()
    .eq('processing_status', 'ignored_not_registration');
    
  if (error) {
    console.error('Lỗi khi xóa:', error.message);
  } else {
    console.log('Đã xóa thành công!');
  }
}
run();
