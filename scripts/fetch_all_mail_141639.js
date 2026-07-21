import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const PROJECT_CODE_REGEX = /\b(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;

const STATUS_RULES = [
  { status: 'hoan_thanh_khao_sat', keywords: ['kqks', 'kết quả khảo sát', 'report khảo sát', 'trả kết quả khảo sát', 'trả hình khảo sát', 'kết quả ks', 'kq khảo sát', 'báo cáo khảo sát', 'hoàn thành khảo sát', 'nghiệm thu khảo sát', 'hình ảnh khảo sát', 'biên bản khảo sát'] },
  { status: 'hoan_thanh_lap_dat', keywords: ['report lắp đặt', 'trả hình lắp đặt', 'report hình ảnh lắp đặt', 'báo cáo lắp đặt', 'hoàn thành lắp đặt', 'nghiệm thu lắp đặt', 'hình ảnh lắp đặt', 'biên bản lắp đặt'] },
  { status: 'hoan_tat_thu_hoi', keywords: ['trả hình thu hồi', 'report thu hồi', 'báo cáo thu hồi', 'hoàn thành thu hồi', 'biên bản thu hồi'] },
  { status: 'khao_sat', keywords: ['đăng ký khảo sát', 'lịch khảo sát', 'đăng ký lịch khảo sát'] },
  { status: 'ntxx', keywords: ['nghiệm thu xuất xưởng', 'lịch ntxx', 'đăng ký lịch ntxx', 'gửi lịch ntxx', 'ntxx team vis'] },
  { status: 'lap_dat', keywords: ['đăng ký lắp đặt', 'lắp đặt', 'lịch lắp đặt', 'lịch giao hàng', 'đăng ký giao hàng', 'đăng ký thi công', 'lịch thi công'] },
  { status: 'thu_hoi', keywords: ['đăng ký thu hồi', 'lịch thu hồi', 'đăng ký lịch thu hồi'] },
  { status: 'brief', keywords: ['[brief confirmed]', 'duyệt brief', 'brief confirmed'] }
];

function normalizeSubject(subject) {
  return subject.toUpperCase().replace(/\s+/g, ' ');
}

function detectStatus(subject) {
  const s = subject.toLowerCase();
  for (const rule of STATUS_RULES) {
    if (rule.keywords.some(k => s.includes(k))) return rule.status;
  }
  return null;
}

async function main() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
    logger: false
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('POSM');
    console.log("✅ Đã kết nối IMAP POSM.");
    
    // Search for 141639 in All Mail
    const messages = client.fetch({ or: [{ subject: '141639' }, { body: '141639' }] }, { envelope: true, uid: true });
    
    const { data: existingRecords } = await supabase.from('project_progress_ai').select('email_message_id, email_subject');
    const existingMessageIds = new Set(existingRecords?.map(r => r.email_message_id).filter(Boolean) || []);

    let count = 0;
    for await (let msg of messages) {
      const subject = msg.envelope.subject || "";
      const messageId = msg.envelope.messageId || "";
      const fromArr = msg.envelope.from || [];
      const sender = fromArr.length > 0 ? (fromArr[0].name || fromArr[0].address) : null;
      
      const normalizedSubject = normalizeSubject(subject);
      const matches = [...normalizedSubject.matchAll(PROJECT_CODE_REGEX)].map(m => m[0]);
      
      if (matches.length > 0) {
        const projectCode = matches[0];
        const detectedStatus = detectStatus(subject);
        
        if (detectedStatus) {
          if (messageId && existingMessageIds.has(messageId)) continue;
          
          console.log(`\n📧 [${msg.seq}] ${subject}`);
          console.log(`   ➡️ Code: ${projectCode} | Status: ${detectedStatus}`);
          
          const { data: dbProjects } = await supabase.from('posm_projects').select('id, source_project_name').or(`final_key.ilike.%${projectCode}%,source_key.ilike.%${projectCode}%,request_id.ilike.%${projectCode}%`).limit(1);
          const matchedProjectName = (dbProjects && dbProjects.length > 0) ? dbProjects[0].source_project_name : null;
          
          await supabase.from('project_progress_ai').insert({
            email_message_id: messageId,
            email_subject: subject,
            email_received_at: msg.envelope.date || new Date(),
            detected_project_code: projectCode,
            detected_project_name: matchedProjectName,
            detected_status: detectedStatus,
            processing_status: 'processed',
            sender: sender
          });
          console.log(`   🚀 Đã lưu tracking thành công!`);
          count++;
        }
      }
    }
    console.log(`\n🎉 Xong! Đã lưu ${count} emails mới.`);
    lock.release();
  } catch (err) {
    console.error(err);
  } finally {
    await client.logout();
  }
}
main();
