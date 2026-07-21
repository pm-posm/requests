// Script sửa lại toàn bộ detected_project_code sai trong DB
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Regex mới - giống y trong scan_and_update.js
const PROJECT_CODE_REGEX = /\b(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;

function normalizeSubject(subject) {
  return subject.replace(/(U\d{2})\s+-\s*(U\d{2})/g, '$1-$2');
}

function extractCode(subject) {
  if (!subject) return null;
  const normalized = normalizeSubject(subject);
  const matches = [...normalized.matchAll(PROJECT_CODE_REGEX)].map(m => m[0]);
  return matches[0] || null;
}

async function main() {
  console.log('Đang lấy tất cả records từ DB...');
  const { data: records, error } = await supabase
    .from('project_progress_ai')
    .select('id, email_subject, detected_project_code');
  
  if (error) { console.error(error); return; }
  console.log(`Tổng số records: ${records.length}`);

  let fixCount = 0;
  for (const r of records) {
    const correct = extractCode(r.email_subject);
    if (correct && correct !== r.detected_project_code) {
      console.log(`[FIX] "${r.detected_project_code}" -> "${correct}" | Subject: ${(r.email_subject || '').substring(0, 70)}`);
      const { error: updateErr } = await supabase
        .from('project_progress_ai')
        .update({ detected_project_code: correct })
        .eq('id', r.id);
      if (updateErr) console.error('  ERR:', updateErr.message);
      else fixCount++;
    }
  }

  console.log(`\nHoàn tất! Đã sửa ${fixCount}/${records.length} records.`);
}

main().catch(console.error);
