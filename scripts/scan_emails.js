import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const {
  IMAP_USER,
  IMAP_PASSWORD,
  IMAP_HOST,
  IMAP_PORT,
  IMAP_TLS,
  GROQ_API_KEY,
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY
} = process.env;

if (!IMAP_USER || !IMAP_PASSWORD || !IMAP_HOST) {
  console.error("❌ Thiếu thông tin IMAP trong .env.local");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ Thiếu GROQ_API_KEY trong .env.local");
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const client = new ImapFlow({
  host: IMAP_HOST,
  port: parseInt(IMAP_PORT || '993', 10),
  secure: IMAP_TLS !== 'false',
  auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
  logger: false
});

async function processEmailWithAI(sender, subject, textContent) {
  const systemPrompt = `You are an AI assistant specialized in extracting POSM project progress information from emails.
This task focuses on the "Đăng ký thi công" (Construction Registration/Planning) process.

Determine if the email context is related to registering, planning, or announcing a construction/installation plan ("Đăng ký thi công", "Kế hoạch lắp đặt", "Lịch thi công", etc.).
If it is NOT related, set "is_registration_email" to false and return.
If it IS related, set "is_registration_email" to true and extract the details.

Respond ONLY with a valid JSON object matching this schema:
{
  "is_registration_email": boolean,
  "detected_project_code": string | null,
  "detected_project_name": string | null,
  "detected_installation_time": string | null,
  "detected_supplier_name": string | null,
  "detected_stores_info": array of objects | null (e.g. [{"store_code": "...", "store_name": "...", "items": "..."}]),
  "ai_confidence_score": number (0.0 to 1.0)
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Email Subject: ${subject}\n\nEmail Content:\n${textContent}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  console.log("🚀 Đang kết nối tới hòm thư...");
  await client.connect();
  console.log("✅ Đã kết nối thành công!");

  let lock = await client.getMailboxLock('INBOX');
  
  try {
    const sinceDate = new Date('2026-01-01');
    console.log(`🔎 Đang tìm kiếm các email từ ngày ${sinceDate.toLocaleDateString()}...`);
    
    const messages = client.fetch({ since: sinceDate }, { source: true, envelope: true });
    
    let processedCount = 0;
    let foundRegistrationCount = 0;

    for await (let msg of messages) {
      processedCount++;
      const parsed = await simpleParser(msg.source);
      const subject = parsed.subject || '(Không có tiêu đề)';
      const sender = parsed.from?.text || '(Không rõ người gửi)';
      const contentRaw = parsed.text || parsed.textAsHtml || '';

      console.log(`\n📧 Đang phân tích email #${processedCount}: [${subject}]...`);

      try {
        const extractedData = await processEmailWithAI(sender, subject, contentRaw);

        if (!extractedData.is_registration_email) {
          console.log(`⏩ Bỏ qua (Không phải email đăng ký thi công)`);
          continue;
        }

        foundRegistrationCount++;
        console.log(`💡 Đã phát hiện Email Đăng ký Thi công! Tự tin: ${(extractedData.ai_confidence_score * 100).toFixed(0)}%`);
        console.log(`   - Dự án: ${extractedData.detected_project_name || 'N/A'}`);
        console.log(`   - Thời gian: ${extractedData.detected_installation_time || 'N/A'}`);
        console.log(`   - Cửa hàng: ${extractedData.detected_stores_info?.length || 0} cửa hàng`);

        const { error } = await supabase
          .from('project_progress_ai')
          .insert({
            email_sender: sender,
            email_subject: subject,
            email_content_raw: contentRaw,
            email_received_at: msg.envelope?.date?.toISOString() || new Date().toISOString(),
            
            detected_project_code: extractedData.detected_project_code,
            detected_project_name: extractedData.detected_project_name,
            detected_installation_time: extractedData.detected_installation_time,
            detected_supplier_name: extractedData.detected_supplier_name,
            detected_stores_info: extractedData.detected_stores_info,
            
            ai_confidence_score: extractedData.ai_confidence_score || 0.0,
            processing_status: 'success_from_script'
          });

        if (error) {
          console.error(`❌ Lỗi khi lưu lên Supabase:`, error.message);
        } else {
          console.log(`✅ Đã lưu thành công lên Supabase!`);
        }

      } catch (err) {
        console.error(`❌ Lỗi phân tích email:`, err.message);
      }
    }

    console.log(`\n🎉 HOÀN TẤT! Đã quét ${processedCount} email, tìm thấy và xử lý thành công ${foundRegistrationCount} email đăng ký thi công.`);
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(console.error);
