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

function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, 'src=""')
    .replace(/style\s*=\s*['"][^'"]*['"]/gi, '')
    .replace(/class\s*=\s*['"][^'"]*['"]/gi, '')
    .replace(/width\s*=\s*['"][^'"]*['"]/gi, '')
    .replace(/valign\s*=\s*['"][^'"]*['"]/gi, '')
    .replace(/align\s*=\s*['"][^'"]*['"]/gi, '')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '');
}

function stripQuotedHistory(text) {
  if (!text) return '';
  const separators = [
    /^[>\s]*From:\s/mi,
    /^[>\s]*To:\s/mi,
    /^[>\s]*Cc:\s/mi,
    /^[>\s]*Sent:\s/mi,
    /^[>\s]*-----Original Message-----/mi,
    /^[>\s]*----- Original Message -----/mi,
    /^[>\s]*Vào lúc\s.*,\s.*đã viết:/mi,
    /^[>\s]*On\s.*,\s.*wrote:/mi,
    /^[>\s]*\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}\sGMT\+\d{1,2}\s.*:/mi
  ];

  let cutIndex = text.length;
  for (const sep of separators) {
    const match = text.match(sep);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }
  return text.substring(0, cutIndex).trim();
}

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

async function extractInstallDetails(emailSource) {
  try {
    const parsed = await simpleParser(emailSource);
    
    let finalEmailText = parsed.text || "";
    if (parsed.html) {
      let htmlCleaned = cleanHtml(parsed.html);
      const turndownService = new TurndownService({ headingStyle: 'atx' });
      turndownService.use(gfm);
      finalEmailText = turndownService.turndown(htmlCleaned);
    } else if (parsed.textAsHtml) {
      let htmlCleaned = cleanHtml(parsed.textAsHtml);
      const turndownService = new TurndownService({ headingStyle: 'atx' });
      turndownService.use(gfm);
      finalEmailText = turndownService.turndown(htmlCleaned);
    }
    
    finalEmailText = stripQuotedHistory(finalEmailText);

    if (finalEmailText.length > 25000) {
      finalEmailText = finalEmailText.substring(0, 25000);
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
    
    const prompt = "Trích xuất Bảng thông tin Đăng ký Lịch Lắp Đặt / Thi Công từ email/excel/ảnh này.\n" +
      "Bảng dữ liệu lịch Lắp Đặt / Thi Công thường nằm trong nội dung email, hoặc được đính kèm dưới dạng file Excel (.xlsx), hoặc dạng ảnh.\n" +
      "Hãy đọc kỹ toàn bộ nội dung văn bản email và phần Excel đính kèm (nếu có) dưới đây để trích xuất đầy đủ thông tin.\n" +
      "Yêu cầu lấy các cột dữ liệu:\n" +
      "- Store Code: Mã cửa hàng (VD: STR-BIG-00444)\n" +
      "- Store Name: Tên siêu thị (VD: GO! THANG LONG)\n" +
      "- Quantity: Số lượng (VD: 1)\n" +
      "- Category: Hạng mục thi công (VD: Showcase Podium)\n" +
      "- Date: Ngày lắp đặt (Định dạng DD/MM/YYYY, VD: 28/04/2026)\n" +
      "- Time: Giờ lắp đặt (VD: 14h00-17h00)\n" +
      "- Address: Địa chỉ / Supplier (Đơn vị thi công/lắp đặt phụ trách cửa hàng này, VD: Link 4)\n\n" +
      "LƯU Ý CỰC KỲ QUAN TRỌNG:\n" +
      "1. Đây có thể là một chuỗi email (email thread) chứa nhiều email cũ. Bạn chỉ được lấy bảng dữ liệu của email/lịch gửi mới nhất. Nếu email chỉ là phản hồi xác nhận ('OK', 'Duyệt', 'Đã duyệt'), hãy trả về mảng stores rỗng [] và email_type là 'install_reply'.\n" +
      "2. ƯU TIÊN VĂN BẢN/EXCEL: Các hình ảnh đính kèm có thể chỉ là logo chữ ký hoặc bản vẽ thiết kế thiết bị. Nếu phần văn bản email hoặc file Excel đã chứa bảng thông tin lịch lắp đặt đầy đủ, bạn phải ƯU TIÊN trích xuất từ văn bản/Excel và bỏ qua các hình ảnh đính kèm. Chỉ bóc tách từ hình ảnh nếu phần văn bản/Excel hoàn toàn không có thông tin lịch lắp đặt.\n" +
      "3. CHỐNG ẢO GIÁC DỮ LIỆU: NẾU CỘT NÀO KHÔNG CÓ THÔNG TIN (VÍ DỤ FILE EXCEL CHỈ CÓ TÊN STORE CHỨ KHÔNG CÓ NGÀY HAY GIỜ), BẮT BUỘC ĐỂ GIÁ TRỊ LÀ null HOẶC CHUỖI RỖNG \"\". TUYỆT ĐỐI KHÔNG TỰ BỊA RA NGÀY GIỜ HAY HẠNG MỤC TỪ BỐI CẢNH XUNG QUANH.\n" +
      "4. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu (đặc biệt là bảng dạng text hoặc Excel), một số cột như Hạng mục (Category), Ngày (Date), Giờ (Time), Địa chỉ/Supplier có thể bị gộp ô (merged cells) nên các dòng dưới sẽ bị trống các thông tin này. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu. TUYỆT ĐỐI KHÔNG BỎ SÓT BẤT KỲ DÒNG NÀO CỦA BẢNG.\n" +
      "5. Phân biệt rõ giữa Brand/Client (như Unilever, Lotte) và Supplier (nhà cung cấp thi công như Link4, Gia Khang, SDC...). TUYỆT ĐỐI không gán tên nhân viên Unilever làm Supplier.\n" +
      "6. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n" +
      "{\n" +
      '  "email_type": "install_schedule", // Hoặc install_reply, install_forward\n' +
      '  "supplier": "Tên supplier chung (nếu có)",\n' +
      '  "stores": [\n' +
      '    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày lắp đặt", "time": "Giờ lắp đặt", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n' +
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

    let replyText = await callAIWithFallback(fullPrompt, imageParts);
    if (!replyText) {
      return null;
    }

    replyText = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBrace = replyText.indexOf('{');
    const lastBrace = replyText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      replyText = replyText.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(replyText);
  } catch (err) {
    console.error("   ❌ Lỗi trong extractInstallDetails:", err.message);
    return null;
  }
}

const client = new ImapFlow({
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  secure: process.env.IMAP_SECURE !== 'false',
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD
  },
  logger: false
});

async function main() {
  // 1. Quét lịch lắp đặt (lap_dat)
  console.log("⏳ Đang truy vấn các bản ghi Lắp Đặt thiếu thông tin bóc tách...");
  const { data: records, error } = await supabase
    .from('project_progress_ai')
    .select('*')
    .eq('detected_status', 'lap_dat')
    .is('ntxx_details', null)
    .ilike('detected_project_code', '%141639%')
    .not('email_message_id', 'is', null)
    .order('email_received_at', { ascending: true });

  if (error) {
    console.error("❌ Lỗi truy vấn DB:", error.message);
    return;
  }

  // 2. Quét báo cáo hoàn thành lắp đặt (hoan_thanh_lap_dat)
  console.log("⏳ Đang truy vấn các bản ghi Báo Cáo Lắp Đặt thiếu thông tin đính kèm...");
  const { data: reportRecords, error: reportErr } = await supabase
    .from('project_progress_ai')
    .select('id, email_subject, email_message_id, detected_project_code')
    .eq('detected_status', 'hoan_thanh_lap_dat')
    .is('ntxx_details', null);

  if (reportErr) {
    console.error("❌ Lỗi truy vấn DB báo cáo:", reportErr.message);
    return;
  }

  const hasRecords = records && records.length > 0;
  const hasReports = reportRecords && reportRecords.length > 0;

  if (!hasRecords && !hasReports) {
    console.log("✅ Không có email Lắp Đặt hay Báo Cáo Lắp Đặt nào cần xử lý!");
    return;
  }

  console.log(`🔎 Tìm thấy ${records?.length || 0} email Lắp Đặt và ${reportRecords?.length || 0} Báo Cáo Lắp Đặt cần xử lý.`);

  console.log("⏳ Đang kết nối tới máy chủ IMAP...");
  await client.connect();
  console.log("✅ Đã kết nối IMAP!");

  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    console.log("⏳ Đang nạp danh sách email từ IMAP để so khớp Subject...");
    const emailMap = new Map();
    // Quét mail từ giữa tháng 5/2026
    for await (let msg of client.fetch({ since: new Date("2026-05-15") }, { envelope: true })) {
      if (msg.envelope && msg.envelope.subject) {
        emailMap.set(msg.envelope.subject.trim(), msg.uid);
      }
    }
    console.log(`✅ Đã nạp ${emailMap.size} email từ IMAP.`);

    let successCount = 0;

    // --- A. XỬ LÝ LỊCH LẮP ĐẶT ---
    if (hasRecords) {
      console.log("\n====== BẮT ĐẦU XỬ LÝ LỊCH LẮP ĐẶT (lap_dat) ======");
      for (const record of records) {
        console.log(`\n--------------------------------------------------`);
        console.log(`👉 Đang xử lý email: ${record.email_subject}`);
        
        let foundUid = null;
        const dbSubject = record.email_subject.trim();

        if (emailMap.has(dbSubject)) {
          foundUid = emailMap.get(dbSubject);
        } else {
          const cleanDbSub = dbSubject.replace(/^Fw:\s*|^Re:\s*|\[External\]\s*/ig, '').trim();
          for (const [imapSubject, uid] of emailMap.entries()) {
            const cleanImapSub = imapSubject.replace(/^Fw:\s*|^Re:\s*|\[External\]\s*/ig, '').trim();
            if (cleanImapSub.includes(cleanDbSub) || cleanDbSub.includes(cleanImapSub)) {
              foundUid = uid;
              break;
            }
          }
        }

        if (!foundUid) {
          console.log(`   ⚠️ Không tìm thấy email này trong IMAP.`);
          continue;
        }

        console.log(`   ✅ Khớp email IMAP UID: ${foundUid}. Đang tải nội dung...`);
        const fullMsg = await client.fetchOne(foundUid.toString(), { source: true }, { uid: true });
        if (fullMsg && fullMsg.source) {
          const details = await extractInstallDetails(fullMsg.source);
          if (details) {
            let storeHash = null;
            if (details.stores && details.stores.length > 0) {
              const sortedStores = [...details.stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
              const storeStr = JSON.stringify(sortedStores);
              storeHash = crypto.createHash('md5').update(storeStr).digest('hex');
            }

            let emailType = details.email_type || 'install_schedule';
            let finalEmailType = emailType;
            let phaseIndex = null;
            let linkedPhaseId = null;

            if (storeHash && emailType === 'install_schedule') {
              const { data: existingPhases } = await supabase
                .from('project_progress_ai')
                .select('id, phase_index')
                .eq('detected_project_code', record.detected_project_code)
                .eq('store_hash', storeHash)
                .eq('email_type', 'install_schedule')
                .order('email_received_at', { ascending: true })
                .limit(1);

              if (existingPhases && existingPhases.length > 0) {
                finalEmailType = 'install_duplicate';
                linkedPhaseId = existingPhases[0].id;
                phaseIndex = existingPhases[0].phase_index;
              } else {
                const { data: maxPhase } = await supabase
                  .from('project_progress_ai')
                  .select('phase_index')
                  .eq('detected_project_code', record.detected_project_code)
                  .eq('detected_status', 'lap_dat')
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
              console.error(`   ❌ Lỗi cập nhật Supabase: ${updateErr.message}`);
            } else {
              console.log(`   ✅ Bóc tách AI & cập nhật thành công! Type: ${finalEmailType}, Phase: ${phaseIndex || 'N/A'}`);
              successCount++;
            }
          } else {
            console.log(`   ⚠️ AI trả về dữ liệu trống.`);
          }
        }
      }
    }

    // --- B. XỬ LÝ BÁO CÁO HOÀN THÀNH LẮP ĐẶT ---
    if (hasReports) {
      console.log("\n====== BẮT ĐẦU XỬ LÝ BÁO CÁO LẮP ĐẶT (hoan_thanh_lap_dat) ======");
      for (const record of reportRecords) {
        console.log(`\n--------------------------------------------------`);
        console.log(`👉 Đang xử lý báo cáo: ${record.email_subject}`);

        let foundUid = null;
        const dbSubject = record.email_subject.trim();

        if (emailMap.has(dbSubject)) {
          foundUid = emailMap.get(dbSubject);
        } else {
          const cleanDbSub = dbSubject.replace(/^Fw:\s*|^Re:\s*|\[External\]\s*/ig, '').trim();
          for (const [imapSubject, uid] of emailMap.entries()) {
            const cleanImapSub = imapSubject.replace(/^Fw:\s*|^Re:\s*|\[External\]\s*/ig, '').trim();
            if (cleanImapSub.includes(cleanDbSub) || cleanDbSub.includes(cleanImapSub)) {
              foundUid = uid;
              break;
            }
          }
        }

        if (!foundUid) {
          console.log(`   ⚠️ Không tìm thấy email này trong IMAP.`);
          continue;
        }

        console.log(`   ✅ Khớp báo cáo IMAP UID: ${foundUid}. Đang tải nội dung...`);
        const fullMsg = await client.fetchOne(foundUid.toString(), { source: true }, { uid: true });
        if (fullMsg && fullMsg.source) {
          const parsed = await simpleParser(fullMsg.source);
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

          // Cập nhật ntxx_details với danh sách file đính kèm
          const { error: updateErr } = await supabase
            .from('project_progress_ai')
            .update({
              ntxx_details: {
                email_type: 'install_completed_report',
                attachments: attachmentsList
              },
              email_type: 'install_completed_report'
            })
            .eq('id', record.id);

          if (updateErr) {
            console.error(`   ❌ Lỗi cập nhật file đính kèm: ${updateErr.message}`);
          } else {
            console.log(`   ✅ Đã cập nhật file đính kèm thành công!`);
            successCount++;
          }
        }
      }
    }

    console.log(`\n🎉 ĐÃ HOÀN THÀNH! Xử lý thành công tổng cộng ${successCount} email Lắp đặt.`);

  } catch (err) {
    console.error("❌ Lỗi trong IMAP block:", err.message);
  } finally {
    lock.release();
    await client.logout();
    console.log("👋 Đã ngắt kết nối IMAP.");
  }
}

main().catch(console.error);
