import dotenv from 'dotenv';
import path from 'path';
import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';
import { simpleParser } from 'mailparser';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD
  },
  logger: false 
});

async function extractNTXXDetails(emailSource) {
  try {
    const parsed = await simpleParser(emailSource);
    const textContent = parsed.text || parsed.html || "";
    
    const prompt = `Bạn là chuyên gia trích xuất dữ liệu. 
Dưới đây là email Đăng ký lịch NTXX. Hãy tìm Tên Supplier (người gửi/bên thi công) và Danh sách siêu thị.
Trả về một JSON có cấu trúc CHÍNH XÁC như sau (không markdown, không giải thích):
{
  "supplier": "Tên supplier",
  "stores": [
    { "code": "Mã số (nếu có)", "name": "Tên siêu thị", "date": "Ngày (VD: 20/6/2026)", "time": "Giờ", "address": "Địa chỉ" }
  ]
}
Nội dung Email Text (có thể bị cắt bớt):
${textContent.substring(0, 3000)}
`;

    const imageParts = [];
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        if (att.contentType && att.contentType.startsWith('image/')) {
          imageParts.push({
            inline_data: {
              data: att.content.toString("base64"),
              mime_type: att.contentType
            }
          });
        }
      }
    }

    console.log(`   [AI] Đang gửi yêu cầu tới Gemini REST API (${imageParts.length} ảnh)...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=AQ.Ab8RN6JdZoCqZkSpxTIyb2wdigT76KQJPlYyID3njcfgBXp2dA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }, ...imageParts]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
       console.log(`   [AI] Gemini API Error: ${await response.text()}`);
       return null;
    }
    
    const result = await response.json();
    let resultText = result.candidates[0].content.parts[0].text;
    
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(resultText);
  } catch(e) {
    console.error("Lỗi khi extract JSON từ Gemini:", e.message);
    return null;
  }
}

async function main() {
  console.log("⏳ Đang tải dữ liệu NTXX cần quét bổ sung...");
  const { data: missingRecords, error } = await supabase
    .from('project_progress_ai')
    .select('id, email_subject')
    .eq('detected_status', 'ntxx')
    .is('ntxx_details', null);

  if (error) {
    console.error("Lỗi DB:", error);
    return;
  }
  
  if (!missingRecords || missingRecords.length === 0) {
    console.log("✅ Toàn bộ các email NTXX đã có đầy đủ thông tin AI!");
    return;
  }
  
  console.log(`🔎 Tìm thấy ${missingRecords.length} email NTXX cần bóc tách AI.`);

  console.log("⏳ Đang kết nối tới máy chủ IMAP...");
  await client.connect();
  console.log("✅ Đã kết nối IMAP!");

  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    console.log("⏳ Đang tải danh sách email từ IMAP (từ 01/05/2026) để map với dữ liệu...");
    const emailMap = new Map();
    for await (let msg of client.fetch({ since: new Date("2026-05-01") }, { envelope: true })) {
       if (msg.envelope && msg.envelope.subject) {
          // Lưu Subject gốc và UID
          emailMap.set(msg.envelope.subject.trim(), msg.uid);
       }
    }
    console.log(`✅ Đã tải ${emailMap.size} email từ IMAP.`);

    for (const record of missingRecords) {
      console.log(`\n🤖 Đang phân tích email: ${record.email_subject}...`);
      
      let foundUid = null;
      
      // Tìm UID bằng cách match subject
      const dbSubject = record.email_subject.trim();
      if (emailMap.has(dbSubject)) {
         foundUid = emailMap.get(dbSubject);
      } else {
         // Thử tìm tương đối
         for (const [imapSubject, uid] of emailMap.entries()) {
            if (imapSubject.includes(dbSubject) || dbSubject.includes(imapSubject.replace(/^Fw:\s*|^Re:\s*|\[External\]\s*/ig, '').trim())) {
               foundUid = uid;
               break;
            }
         }
      }
      
      if (!foundUid) {
         console.log(`   ⚠️ Không tìm thấy thư trong IMAP!`);
         continue;
      }
      
      const fullMsg = await client.fetchOne(foundUid.toString(), { source: true }, { uid: true });
      if (fullMsg && fullMsg.source) {
         const details = await extractNTXXDetails(fullMsg.source);
         if (details) {
            console.log(`   ✅ AI bóc tách được: ${details.supplier || 'Không rõ'} - ${details.stores?.length || 0} stores`);
            await supabase.from('project_progress_ai')
              .update({ ntxx_details: details })
              .eq('id', record.id);
            console.log(`   🚀 Đã cập nhật vào DB thành công!`);
         }
      }
      
      // Delay to avoid Gemini rate limits (15 requests/min)
      console.log(`   ⏳ Đợi 4 giây trước khi tiếp tục để tránh giới hạn API...`);
      await new Promise(r => setTimeout(r, 4000));
    }
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    lock.release();
    await client.logout();
    console.log("👋 Đã ngắt kết nối IMAP.");
  }
}

main().catch(console.error);
