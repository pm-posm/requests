const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('project_activities')
    .insert({
      title_mail: 'test ignored email',
      message_id: 'test_ignore_123',
      status: 'Ignored'
    });
    
  if (error) {
    console.error('Lỗi insert:', error.message);
  } else {
    console.log('Thành công!');
    await supabase.from('project_activities').delete().eq('message_id', 'test_ignore_123');
  }
}
run();
