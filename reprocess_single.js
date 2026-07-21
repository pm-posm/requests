import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import XLSX from 'xlsx';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
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

async function extractSurveyDetails(emailSource) {
  try {
    const parsed = await simpleParser(emailSource);
    let finalEmailText = parsed.text || "";
    if (parsed.html) {
      let htmlCleaned = cleanHtml(parsed.html);
      const turndownService = new TurndownService({ headingStyle: 'atx' });
      turndownService.use(gfm);
      finalEmailText = turndownService.turndown(htmlCleaned);
    }
    
    if (finalEmailText.length > 25000) {
      finalEmailText = finalEmailText.substring(0, 25000);
    }

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
    
    const prompt = "Trích xuất Bảng thông tin Đăng ký Lịch Khảo Sát từ email/excel/ảnh này.\n" +
      "Bảng dữ liệu lịch Khảo Sát thường nằm trong nội dung email, hoặc được đính kèm dưới dạng file Excel (.xlsx), hoặc dạng ảnh.\n" +
      "Hãy đọc kỹ toàn bộ nội dung văn bản email và phần Excel đính kèm (nếu có) dưới đây để trích xuất đầy đủ thông tin.\n" +
      "Yêu cầu lấy các cột dữ liệu:\n" +
      "- Store Code: Mã cửa hàng (VD: STR-BIG-00444)\n" +
      "- Store Name: Tên siêu thị (VD: GO! THANG LONG)\n" +
      "- Quantity: Số lượng (VD: 1)\n" +
      "- Category: Hạng mục thi công (VD: Showcase Podium)\n" +
      "- Date: Ngày khảo sát (Định dạng DD/MM/YYYY, VD: 28/04/2026)\n" +
      "- Time: Giờ khảo sát (VD: 14h00-17h00)\n" +
      "- Address: Địa chỉ / Supplier (Đơn vị khảo sát phụ trách cửa hàng này, VD: Link 4)\n\n" +
      "LƯU Ý CỰC KỲ QUAN TRỌNG:\n" +
      "1. Đây có thể là một chuỗi email (email thread) chứa nhiều email cũ. Bạn chỉ được lấy bảng dữ liệu của email/lịch gửi mới nhất. Nếu email chỉ là phản hồi xác nhận ('OK', 'Duyệt', 'Đã duyệt'), hãy trả về mảng stores rỗng [] và email_type là 'survey_reply'.\n" +
      "2. ƯU TIÊN VĂN BẢN/EXCEL: Các hình ảnh đính kèm có thể chỉ là logo chữ ký hoặc bản vẽ thiết kế thiết bị. Nếu phần văn bản email hoặc file Excel đã chứa bảng thông tin lịch khảo sát đầy đủ, bạn phải ƯU TIÊN trích xuất từ văn bản/Excel và bỏ qua các hình ảnh đính kèm. Chỉ bóc tách từ hình ảnh nếu phần văn bản/Excel hoàn toàn không có thông tin lịch khảo sát.\n" +
      "3. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu (đặc biệt là bảng dạng text hoặc Excel), một số cột như Hạng mục (Category), Ngày (Date), Giờ (Time), Địa chỉ/Supplier có thể bị gộp ô (merged cells) nên các dòng dưới sẽ bị trống các thông tin này. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu. TUYỆT ĐỐI KHÔNG BỎ SÓT BẤT KỲ DÒNG NÀO CỦA BẢNG.\n" +
      "4. Phân biệt rõ giữa Brand/Client (như Unilever, Lotte) và Supplier (nhà cung cấp thi công như Link4, Gia Khang, SDC...). TUYỆT ĐỐI không gán tên nhân viên Unilever làm Supplier.\n" +
      "5. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n" +
      "{\n" +
      '  "email_type": "survey_schedule", // Hoặc survey_reply, survey_forward\n' +
      '  "supplier": "Tên supplier chung (nếu có)",\n' +
      '  "stores": [\n' +
      '    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày khảo sát", "time": "Giờ khảo sát", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n' +
      '  ]\n' +
      "}\n\n" +
      "Email Body (Markdown Format):\n" +
      `${finalEmailText}\n\n` +
      (excelText ? `Excel Attachments Contents:\n${excelText}\n` : "");

    const response = await fetch(process.env.GEMINI_WEB2API_URL || 'http://localhost:8081/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NINEROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }]
        }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error(`   ❌ Lỗi API Gemini 9Router: ${response.status}`);
      return null;
    }

    const resJson = await response.json();
    let replyText = resJson.choices[0].message.content;
    replyText = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(replyText);
  } catch (err) {
    console.error("   ❌ Lỗi trong extractSurveyDetails:", err.message);
    return null;
  }
}

async function reprocess(recordId, uid) {
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
    logger: false
  });
  await client.connect();
  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    console.log(`Đang xử lý recordId: ${recordId}, UID: ${uid}...`);
    const fullMsg = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
    if (fullMsg && fullMsg.source) {
      const details = await extractSurveyDetails(fullMsg.source);
      if (details) {
        console.log(`=> Kết quả bóc tách từ AI: email_type = ${details.email_type}`);
        console.log(`=> Số lượng store bóc tách được: ${details.stores ? details.stores.length : 0}`);
        if (details.stores && details.stores.length > 0) {
          console.log(`=> Danh sách store:`, details.stores.map(s => s.name));
        }
        
        let storeHash = null;
        if (details.stores && details.stores.length > 0) {
          const sortedStores = [...details.stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
          const storeStr = JSON.stringify(sortedStores);
          storeHash = crypto.createHash('md5').update(storeStr).digest('hex');
        }

        const { error: updateErr } = await supabase
          .from('project_progress_ai')
          .update({ 
             ntxx_details: details,
             store_hash: storeHash
          })
          .eq('id', recordId);

        if (updateErr) {
          console.error(`   ❌ Lỗi cập nhật Supabase: ${updateErr.message}`);
        } else {
          console.log(`   ✅ Cập nhật Supabase thành công!`);
        }
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }
}

async function main() {
  // Reprocess Nhi's June 8th email reply which got truncated
  await reprocess('40883ed5-f029-4202-b415-cc0fbce5962b', 17606);
}
main().catch(console.error);
