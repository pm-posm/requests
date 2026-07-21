import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import * as XLSX from 'xlsx';

// Nạp biến môi trường từ .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Khởi tạo Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function callAIWithFallback(prompt, imageParts) {
  // 1. Cố gắng gọi qua local gemini-web2api proxy trước
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    console.log(`   [AI] Đang gửi yêu cầu tới 9Router Proxy (${imageParts.length} ảnh)...`);
    const response = await fetch(process.env.GEMINI_WEB2API_URL || 'http://localhost:8081/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NINEROUTER_API_KEY || 'sk-gemini'}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageParts
          ]
        }],
        response_format: { type: "json_object" }
      })
    });
    
    clearTimeout(timeoutId);
    if (response.ok) {
      const resJson = await response.json();
      return resJson.choices[0].message.content;
    } else {
      console.warn(`   ⚠️ Local proxy trả về lỗi: ${response.status}. Chuyển sang gọi Groq API...`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Không kết nối được local proxy: ${err.message}. Chuyển sang gọi Groq API...`);
  }

  // 2. Fallback sang Groq API sử dụng Llama 3.3 (Bỏ qua ảnh để tránh lỗi Vision deprecated, có retry 429)
  let groqRetries = 3;
  while (groqRetries > 0) {
    try {
      const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
      if (!GROQ_API_KEY) {
        console.error("   ❌ Không có GROQ_API_KEY để chạy fallback.");
        return null;
      }
      
      const model = "llama-3.3-70b-versatile";
      console.log(`   [AI Fallback] Đang gửi yêu cầu tới Groq Cloud (${model}) (Bỏ qua ảnh) (Lần thử ${4 - groqRetries}/3)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model,
          messages: [{
            role: "user",
            content: prompt
          }],
          response_format: { type: "json_object" }
        })
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        const resJson = await response.json();
        console.log(`   ✅ Thành công từ Groq Fallback!`);
        return resJson.choices[0].message.content;
      } else if (response.status === 429) {
        console.warn(`   ⏳ Groq API bị giới hạn Rate Limit (429). Đang ngủ 20 giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, 20000));
        groqRetries--;
      } else {
        console.error(`   ❌ Groq API trả về lỗi: ${response.status} - ${await response.text()}`);
        return null;
      }
    } catch (err) {
      console.error(`   ❌ Lỗi khi gọi Groq Fallback:`, err.message);
      return null;
    }
  }
  return null;
}

async function extractNTXXDetails(emailSource) {
  try {
    const parsed = await simpleParser(emailSource);
    
    let finalEmailText = parsed.text || "";
    if (parsed.html) {
      let htmlCleaned = parsed.html;
      htmlCleaned = htmlCleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      htmlCleaned = htmlCleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
      htmlCleaned = htmlCleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      htmlCleaned = htmlCleaned.replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, 'src=""');

      const turndownService = new TurndownService({ headingStyle: 'atx' });
      turndownService.use(gfm);
      finalEmailText = turndownService.turndown(htmlCleaned);
    } else if (parsed.textAsHtml) {
      let htmlCleaned = parsed.textAsHtml;
      htmlCleaned = htmlCleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      htmlCleaned = htmlCleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
      htmlCleaned = htmlCleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      htmlCleaned = htmlCleaned.replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, 'src=""');

      const turndownService = new TurndownService({ headingStyle: 'atx' });
      turndownService.use(gfm);
      finalEmailText = turndownService.turndown(htmlCleaned);
    }
    
    if (finalEmailText.length > 20000) {
      finalEmailText = finalEmailText.substring(0, 20000);
    }

    // Đọc file đính kèm Excel nếu có
    let excelText = "";
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        if (att.filename && (att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls'))) {
          try {
            console.log(`   [Excel] Đang đọc file đính kèm: ${att.filename}`);
            const workbook = XLSX.read(att.content, { type: 'buffer' });
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              const cleanedCsv = csv.split('\n')
                .map(line => line.trim())
                .filter(line => line.replace(/,/g, '').trim().length > 0)
                .join('\n');
              
              if (cleanedCsv.length > 0) {
                excelText += `\n\n--- Excel Sheet: ${sheetName} ---\n${cleanedCsv}\n`;
              }
            }
          } catch (err) {
            console.error(`   ❌ Lỗi đọc file Excel ${att.filename}:`, err.message);
          }
        }
      }
    }
    
    const prompt = "Trích xuất Bảng thông tin Nghiệm thu Xưởng sản xuất (NTXX) từ email/excel/ảnh này.\n" +
      "Bảng dữ liệu lịch NTXX thường nằm trong nội dung email, hoặc được đính kèm dưới dạng file Excel (.xlsx), hoặc dạng ảnh.\n" +
      "Hãy đọc kỹ toàn bộ nội dung văn bản email và phần Excel đính kèm (nếu có) dưới đây để trích xuất đầy đủ thông tin.\n" +
      "Yêu cầu lấy các cột dữ liệu:\n" +
      "- Store Code: Mã cửa hàng (VD: STR-BIG-00444)\n" +
      "- Store Name: Tên siêu thị (VD: GO! THANG LONG)\n" +
      "- Quantity: Số lượng (VD: 1)\n" +
      "- Category: Hạng mục thi công (VD: Showcase Podium)\n" +
      "- Date: Ngày nghiệm thu (Định dạng DD/MM/YYYY, VD: 28/04/2026)\n" +
      "- Time: Giờ nghiệm thu (VD: 14h00-17h00)\n" +
      "- Address: Địa chỉ / Supplier (Đơn vị thi công phụ trách cửa hàng này, VD: Link 4)\n\n" +
      "LƯU Ý CỰC KỲ QUAN TRỌNG:\n" +
      "1. Đây có thể là một chuỗi email (email thread) chứa nhiều email cũ. Bạn chỉ được lấy bảng dữ liệu của email/lịch gửi mới nhất. Nếu email chỉ là phản hồi xác nhận ('OK', 'Duyệt', 'Đã duyệt'), hãy trả về mảng stores rỗng [] và email_type là 'ntxx_reply'.\n" +
      "2. ƯU TIÊN VĂN BẢN/EXCEL: Các hình ảnh đính kèm có thể chỉ là logo chữ ký hoặc bản vẽ thiết kế thiết bị. Nếu phần văn bản email hoặc file Excel đã chứa bảng thông tin lịch NTXX đầy đủ, bạn phải ƯU TIÊN trích xuất từ văn bản/Excel và bỏ qua các hình ảnh đính kèm. Chỉ bóc tách từ hình ảnh nếu phần văn bản/Excel hoàn toàn không có thông tin lịch NTXX.\n" +
      "3. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu (đặc biệt là bảng dạng text hoặc Excel), một số cột như Hạng mục (Category), Ngày (Date), Giờ (Time), Địa chỉ/Supplier có thể bị gộp ô (merged cells) nên các dòng dưới sẽ bị trống các thông tin này. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu. TUYỆT ĐỐI KHÔNG BỎ SÓT BẤT KỲ DÒNG NÀO CỦA BẢNG.\n" +
      "4. Phân biệt rõ giữa Brand/Client (như Unilever, Lotte) và Supplier (nhà cung cấp thi công như Link4, Gia Khang, SDC...). TUYỆT ĐỐI không gán tên nhân viên Unilever làm Supplier.\n" +
      "5. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n" +
      "{\n" +
      '  "email_type": "ntxx_schedule", // Hoặc ntxx_reply, ntxx_forward\n' +
      '  "supplier": "Tên supplier chung (nếu có)",\n' +
      '  "stores": [\n' +
      '    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày NTXX", "time": "Giờ NTXX", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n' +
      '  ]\n' +
      "}\n\n" +
      "Email Body (Markdown Format):\n" +
      `${finalEmailText}\n\n` +
      (excelText ? `Excel Attachments Contents:\n${excelText}\n` : "");

    const imageParts = [];
    if (!excelText && parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        if (att.contentType && att.contentType.startsWith('image/')) {
          if (att.size && att.size > 20000 && att.size < 1500000) { 
            imageParts.push({
              type: "image_url",
              image_url: {
                url: `data:${att.contentType};base64,${att.content.toString("base64")}`
              }
            });
          }
        }
      }
    }
    if (imageParts.length > 2) imageParts.length = 2;

    const fullPrompt = prompt;

    let resultText = await callAIWithFallback(fullPrompt, imageParts);
    if (!resultText) {
      return null;
    }
    
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Tìm đoạn JSON hợp lệ bằng cách lấy từ { đầu tiên đến } cuối cùng
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    } else {
      resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    
    return JSON.parse(resultText);
  } catch(e) {
    console.error("Lỗi khi extract JSON từ Gemini:", e.message);
    return { _error: true }; // Trả về object lỗi thay vì null để không bị break loop
  }
}

async function main() {
  console.log("🚀 Đang khởi động tiến trình Retry NTXX queue...");

  // 1. Lấy danh sách record NTXX bị rỗng (NULL) từ DB
  const { data: recordsToRetry, error: fetchErr } = await supabase
    .from('project_progress_ai')
    .select('id, email_message_id, detected_project_code, email_subject')
    .eq('detected_status', 'ntxx')
    .is('ntxx_details', null);

  if (fetchErr) {
    console.error("❌ Lỗi truy vấn DB:", fetchErr);
    return;
  }

  if (!recordsToRetry || recordsToRetry.length === 0) {
    console.log("✅ Không có email NTXX nào cần retry. Mọi thứ đã hoàn tất!");
    return;
  }

  console.log(`🔍 Tìm thấy ${recordsToRetry.length} email NTXX chưa có dữ liệu AI. Bắt đầu xử lý...`);

  // 2. Khởi tạo IMAP client
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

  client.on('error', err => {
    console.error("⚠️ Lỗi IMAP Client:", err.message);
  });

  try {
    await client.connect();
    console.log("✅ Đã kết nối IMAP thành công.");
    let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');

    try {
      for (const record of recordsToRetry) {
        console.log(`\n📧 Đang tìm email: ${record.email_subject}...`);
        
        let uid = null;
        if (record.email_message_id) {
           const searchResult = await client.search({ header: { 'message-id': record.email_message_id } }, { uid: true });
           if (searchResult && searchResult.length > 0) {
             uid = searchResult[0];
           }
        }
        
        // Fallback search bằng subject nếu không tìm thấy bằng message_id
        if (!uid) {
           const subjectForSearch = record.email_subject.replace(/[\r\n]/g, '').trim();
           const fallbackSearch = await client.search({ subject: subjectForSearch }, { uid: true });
           if (fallbackSearch && fallbackSearch.length > 0) {
              uid = fallbackSearch[fallbackSearch.length - 1]; // Lấy cái mới nhất
           }
        }

        if (!uid) {
          console.error(`   ❌ Không tìm thấy email này trong Inbox, bỏ qua.`);
          continue;
        }

        // Lấy source
        const msg = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
        if (!msg || !msg.source) {
          console.error(`   ❌ Không lấy được nội dung email.`);
          continue;
        }

        // Chạy Gemini
        const details = await extractNTXXDetails(msg.source);
        if (details && !details._error) {
          let storeHash = null;
          if (details.stores && details.stores.length > 0) {
            const sortedStores = [...details.stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
            const storeStr = JSON.stringify(sortedStores);
            storeHash = crypto.createHash('md5').update(storeStr).digest('hex');
          }

          let emailType = details.email_type || 'ntxx_schedule';
          if (!['ntxx_schedule', 'ntxx_reply', 'ntxx_forward'].includes(emailType)) {
            emailType = 'ntxx_schedule';
          }

          let finalEmailType = emailType;
          let phaseIndex = null;
          let linkedPhaseId = null;

          if (storeHash && emailType === 'ntxx_schedule') {
            const { data: existingPhases } = await supabase
              .from('project_progress_ai')
              .select('id, phase_index')
              .eq('detected_project_code', record.detected_project_code)
              .eq('store_hash', storeHash)
              .eq('email_type', 'ntxx_schedule')
              .order('email_received_at', { ascending: true })
              .limit(1);

            if (existingPhases && existingPhases.length > 0) {
              finalEmailType = 'ntxx_duplicate';
              linkedPhaseId = existingPhases[0].id;
              phaseIndex = existingPhases[0].phase_index;
            } else {
              const { data: maxPhase } = await supabase
                .from('project_progress_ai')
                .select('phase_index')
                .eq('detected_project_code', record.detected_project_code)
                .not('phase_index', 'is', null)
                .order('phase_index', { ascending: false })
                .limit(1);
              phaseIndex = (maxPhase && maxPhase.length > 0 && maxPhase[0].phase_index != null) 
                            ? maxPhase[0].phase_index + 1 
                            : 1;
            }
          }

          const { error: updateErr } = await supabase
            .from('project_progress_ai')
            .update({ 
               ntxx_details: details,
               email_type: finalEmailType,
               store_hash: storeHash,
               phase_index: phaseIndex,
               linked_phase_id: linkedPhaseId
            })
            .eq('id', record.id);
            
          if (updateErr) {
             console.error(`   ❌ Lỗi update JSON: ${updateErr.message}`);
          } else {
             console.log(`   ✅ Cập nhật thành công JSON vào DB. Type: ${finalEmailType}, Phase: ${phaseIndex || 'N/A'}`);
          }
        } else {
          console.log(`   ⚠️ AI trả về rỗng hoặc lỗi parse JSON. Bỏ qua email này.`);
          // continue thay vì break để không dừng toàn bộ tiến trình
          continue;
        }
        
        // Trễ 15s để tránh hit rate limit của bản Web
        console.log("   ⏳ Đang chờ 15s để tránh bị block...");
        await new Promise(r => setTimeout(r, 15000));
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.logout();
    console.log("👋 Đã ngắt kết nối IMAP.");
  }
}

main().catch(console.error);
