const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { ImapFlow } = require('imapflow');
const mailparser = require('mailparser');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: parseInt(process.env.IMAP_PORT, 10) || 993,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD
  },
  logger: false
});

async function main() {
  console.log("📥 Đang truy vấn cơ sở dữ liệu các email hoàn thành khảo sát...");
  const { data: dbRecords, error } = await supabase
    .from('project_progress_ai')
    .select('id, email_subject, email_message_id, ntxx_details')
    .eq('detected_status', 'hoan_thanh_khao_sat');

  if (error) {
    console.error("❌ Lỗi truy vấn database:", error.message);
    return;
  }

  const recordsToUpdate = dbRecords.filter(r => !r.ntxx_details || !r.ntxx_details.attachments);
  console.log(`💡 Tìm thấy ${recordsToUpdate.length} email hoàn thành khảo sát cần cập nhật file đính kèm.`);

  if (recordsToUpdate.length === 0) {
    console.log("✅ Không có bản ghi nào cần cập nhật.");
    return;
  }

  console.log("🔑 Đang kết nối tới máy chủ IMAP...");
  await client.connect();

  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    for (const record of recordsToUpdate) {
      console.log(`\n🔎 Đang tìm email trên IMAP: "${record.email_subject}"...`);
      
      // Tìm kiếm theo subject
      const searchResults = await client.search({
        subject: record.email_subject
      });

      if (searchResults.length === 0) {
        console.log(`⚠️ Không tìm thấy email này trên IMAP.`);
        continue;
      }

      // Lấy email khớp
      const uid = searchResults[0];
      const fullMsg = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      
      if (fullMsg && fullMsg.source) {
        const parsed = await mailparser.simpleParser(fullMsg.source);
        const attachmentsList = [];
        if (parsed.attachments && parsed.attachments.length > 0) {
          for (const att of parsed.attachments) {
            if (att.filename) {
              attachmentsList.push({
                filename: att.filename,
                size: att.size,
                contentType: att.contentType
              });
            }
          }
        }

        console.log(`   📎 Tìm thấy ${attachmentsList.length} files đính kèm:`, attachmentsList.map(a => a.filename));

        // Cập nhật lại ntxx_details
        const currentDetails = record.ntxx_details || {};
        const updatedDetails = {
          ...currentDetails,
          email_type: 'survey_completed_report',
          attachments: attachmentsList
        };

        const { error: updateErr } = await supabase
          .from('project_progress_ai')
          .update({ ntxx_details: updatedDetails })
          .eq('id', record.id);

        if (updateErr) {
          console.error(`   ❌ Lỗi cập nhật DB: ${updateErr.message}`);
        } else {
          console.log(`   ✅ Đã cập nhật thành công file đính kèm vào DB!`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Lỗi trong quá trình quét:", err);
  } finally {
    lock.release();
    await client.logout();
    console.log("👋 Đã ngắt kết nối IMAP.");
  }
}

main().catch(console.error);
