const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function hashStores(stores) {
  const sorted = [...stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
}

async function main() {
  console.log("Xóa dữ liệu test cũ...");
  await supabase.from('project_progress_ai').delete().in('detected_project_code', ['151537U01-U04', '151537U01-U02_U05-U06', '151537', '151639']);

  console.log("Chèn Case 151537 (Sub-projects)...");
  
  // Phase 1 cho 151537U01-U02_U05-U06
  const stores1 = [{ code: 'S01', name: 'ThanhKhe' }];
  const hash1 = hashStores(stores1);
  const { data: rec1, error: err1 } = await supabase.from('project_progress_ai').insert({
    detected_project_code: '151537U01-U02_U05-U06',
    detected_project_name: 'Dự án GLAM BEAUTIQUE',
    email_subject: 'ĐĂNG KÝ LỊCH NTXX - 151537U01-U02_U05-U06 Multiple Brands Skin MT GLAM BEAUTIQUEProduce GE Customize_ThanhKhe',
    email_sender: 'test@unilever.com',
    email_received_at: new Date('2026-06-01T10:00:00Z'),
    email_type: 'ntxx_schedule',
    phase_index: 1,
    store_hash: hash1,
    ntxx_details: { email_type: 'ntxx_schedule', supplier: 'Supplier A', stores: stores1 }
  }).select().single();

  // Phase 2 cho 151537U01-U02_U05-U06
  const stores2 = [{ code: 'S02', name: 'Smart CIty' }];
  const hash2 = hashStores(stores2);
  await supabase.from('project_progress_ai').insert({
    detected_project_code: '151537U01-U02_U05-U06',
    detected_project_name: 'Dự án GLAM BEAUTIQUE',
    email_subject: 'ĐĂNG KÝ LỊCH NTXX - 151537U01-U02_U05-U06 Multiple Brands Skin MT GLAM BEAUTIQUEProduce GE Customize_Smart CIty',
    email_sender: 'test@unilever.com',
    email_received_at: new Date('2026-06-02T10:00:00Z'),
    email_type: 'ntxx_schedule',
    phase_index: 2,
    store_hash: hash2,
    ntxx_details: { email_type: 'ntxx_schedule', supplier: 'Supplier B', stores: stores2 }
  });

  console.log("Chèn Case 151639 (Phases)...");
  
  const storesA = Array.from({length: 10}, (_, i) => ({ code: `S${i+1}`, name: `Store ${i+1}` }));
  const hashA = hashStores(storesA);
  
  // Phase 1
  const { data: p1 } = await supabase.from('project_progress_ai').insert({
    detected_project_code: '151639',
    detected_project_name: 'Chiến dịch Vaseline',
    email_subject: 'Lịch NTXX 151639',
    email_sender: 'test2@unilever.com',
    email_received_at: new Date('2026-05-22T10:00:00Z'),
    email_type: 'ntxx_schedule',
    phase_index: 1,
    store_hash: hashA,
    ntxx_details: { email_type: 'ntxx_schedule', stores: storesA }
  }).select().single();

  // Phase 2
  const storesB = Array.from({length: 10}, (_, i) => ({ code: `S${i+11}`, name: `Store ${i+11}` }));
  const hashB = hashStores(storesB);
  await supabase.from('project_progress_ai').insert({
    detected_project_code: '151639',
    detected_project_name: 'Chiến dịch Vaseline',
    email_subject: 'Lịch NTXX 151639',
    email_sender: 'test2@unilever.com',
    email_received_at: new Date('2026-05-26T10:00:00Z'),
    email_type: 'ntxx_schedule',
    phase_index: 2,
    store_hash: hashB,
    ntxx_details: { email_type: 'ntxx_schedule', stores: storesB }
  });

  // Phase 3
  const storesC = Array.from({length: 10}, (_, i) => ({ code: `S${i+21}`, name: `Store ${i+21}` }));
  const hashC = hashStores(storesC);
  await supabase.from('project_progress_ai').insert({
    detected_project_code: '151639',
    detected_project_name: 'Chiến dịch Vaseline',
    email_subject: 'Lịch NTXX 151639',
    email_sender: 'test2@unilever.com',
    email_received_at: new Date('2026-06-01T10:00:00Z'),
    email_type: 'ntxx_schedule',
    phase_index: 3,
    store_hash: hashC,
    ntxx_details: { email_type: 'ntxx_schedule', stores: storesC }
  });

  // Duplicate của Phase 1 (Reply)
  await supabase.from('project_progress_ai').insert({
    detected_project_code: '151639',
    detected_project_name: 'Chiến dịch Vaseline',
    email_subject: 'Re: Lịch NTXX 151639',
    email_sender: 'vendor@agency.com',
    email_received_at: new Date('2026-05-23T10:00:00Z'),
    email_type: 'ntxx_reply',
    phase_index: 1,
    linked_phase_id: p1.id,
    store_hash: hashA,
    ntxx_details: { email_type: 'ntxx_reply', stores: storesA, supplier: 'Agency X' }
  });

  console.log("Hoàn tất chèn dữ liệu test!");
}

main().catch(console.error);
