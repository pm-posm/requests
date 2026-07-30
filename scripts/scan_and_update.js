import { ImapFlow } from 'imapflow';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import sizeOf from 'image-size';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import * as XLSX from 'xlsx';

// Nạp biến môi trường từ .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Khởi tạo Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Regex tìm Mã dự án - bắt được cả dạng phức tạp như 151537U01-U02_U05-U06
const PROJECT_CODE_REGEX = /\b(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;

// Chuẩn hóa subject: 'U01 -U11' -> 'U01-U11' (khi có khoảng trắng trước gạch nối)
function normalizeSubject(subject) {
  return subject.replace(/(U\d{2})\s+-\s*(U\d{2})/g, '$1-$2');
}

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
    /^[>\s]*\**From:\**/mi,
    /^[>\s]*\**To:\**/mi,
    /^[>\s]*\**Cc:\**/mi,
    /^[>\s]*\**Sent:\**/mi,
    /^[>\s]*\**Subject:\**/mi,
    /^[>\s]*-----Original Message-----/mi,
    /^[>\s]*----- Original Message -----/mi,
    /^[>\s]*\**Vào lúc\s.*,\s.*đã viết:\**/mi,
    /^[>\s]*\**On\s.*,\s.*wrote:\**/mi,
    /^[>\s]*\**Người gửi:\**/mi,
    /^[>\s]*\**Tới:\**/mi,
    /^[>\s]*\**Ngày gửi:\**/mi,
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
    const response = await fetch('http://localhost:8081/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NINEROUTER_API_KEY || 'sk-gemini'}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Trả về chuỗi JSON chính xác theo định dạng, không giải thích." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...imageParts.map(img => ({
                type: "image_url",
                image_url: { url: img.image_url.url }
              }))
            ]
          }
        ]
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

  // 2. Fallback sang Groq API sử dụng Llama 3.3 / Llama 3.2 Vision
  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
    if (!GROQ_API_KEY) {
      console.error("   ❌ Không có GROQ_API_KEY để chạy fallback.");
      return null;
    }
    
    // Groq vision model nếu có ảnh, ngược lại dùng model text mạnh nhất
    const model = (imageParts && imageParts.length > 0) ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
    console.log(`   [AI Fallback] Đang gửi yêu cầu tới Groq Cloud (${model})...`);
    
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
          content: [
            { type: "text", text: prompt },
            ...imageParts.map(img => ({
              type: "image_url",
              image_url: { url: img.image_url.url }
            }))
          ]
        }],
        response_format: { type: "json_object" }
      })
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      const resJson = await response.json();
      console.log(`   ✅ Thành công từ Groq Fallback!`);
      return resJson.choices[0].message.content;
    } else {
      console.error(`   ❌ Groq API trả về lỗi: ${response.status} - ${await response.text()}`);
    }
  } catch (err) {
    console.error(`   ❌ Lỗi khi gọi Groq Fallback:`, err.message);
  }
  return null;
}

async function extractGenericDetails(emailSource, prompt) {
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

    const fullPrompt = prompt + "\n\n" +
      "Email Body (Markdown Format):\n" +
      `${finalEmailText}\n\n` +
      (excelText ? `Excel Attachments Contents:\n${excelText}\n` : "");

    const imageParts = [];
    // Chỉ quét ảnh nếu KHÔNG có Excel đính kèm để tránh quá dung lượng payload gửi tới 9Router Proxy
    if (!excelText && parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        if (att.contentType && att.contentType.startsWith('image/')) {
          const isInline = (att.contentDisposition === 'inline' || att.cid);
          // Lọc sơ bộ bằng dung lượng (> 15KB và < 1.5MB để tránh quá giới hạn request size)
          if (isInline && att.size && att.size > 15000 && att.size < 1500000) { 
            let shouldPush = false;
            try {
              const dimensions = sizeOf(att.content);
              if (dimensions.width > 350 && dimensions.height > 150) {
                shouldPush = true;
              } else {
                console.log(`   [Filter] Đã loại bỏ 1 ảnh logo/icon do quá nhỏ (Width: ${dimensions.width}, Height: ${dimensions.height})`);
              }
            } catch (err) {
              shouldPush = true;
            }

            if (shouldPush) {
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
    }
    // Giới hạn tối đa 3 ảnh dán trực tiếp để tránh lỗi payload too large / HTTP 405 Method Not Allowed của Proxy
    if (imageParts.length > 3) imageParts.length = 3;

    let resultText = await callAIWithFallback(fullPrompt, imageParts);
    if (!resultText) {
      return null;
    }
    
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    } else {
      resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    
    return JSON.parse(resultText);
  } catch(e) {
    console.error("Lỗi khi extract JSON qua AI:", e.message);
    return null;
  }
}

async function extractNTXXDetails(emailSource) {
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
    "3. CHỐNG ẢO GIÁC DỮ LIỆU: NẾU CỘT NÀO KHÔNG CÓ THÔNG TIN (VÍ DỤ FILE EXCEL CHỈ CÓ TÊN STORE CHỨ KHÔNG CÓ NGÀY HAY GIỜ), BẮT BUỘC ĐỂ GIÁ TRỊ LÀ null HOẶC CHUỖI RỖNG \"\". TUYỆT ĐỐI KHÔNG TỰ BỊA RA NGÀY GIỜ HAY HẠNG MỤC TỪ BỐI CẢNH XUNG QUANH.\n" +
    "4. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu (đặc biệt là bảng dạng text hoặc Excel), một số cột như Hạng mục (Category), Ngày (Date), Giờ (Time), Địa chỉ/Supplier có thể bị gộp ô (merged cells) nên các dòng dưới sẽ bị trống các thông tin này. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu. TUYỆT ĐỐI KHÔNG BỎ SÓT BẤT KỲ DÒNG NÀO CỦA BẢNG.\n" +
    "5. Phân biệt rõ giữa Brand/Client (như Unilever, Lotte) và Supplier (nhà cung cấp thi công như Link4, Gia Khang, SDC...). TUYỆT ĐỐI không gán tên nhân viên Unilever làm Supplier.\n" +
    "6. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n" +
    "{\n" +
    '  "email_type": "ntxx_schedule", // Hoặc ntxx_reply, ntxx_forward\n' +
    '  "supplier": "Tên supplier chung (nếu có)",\n' +
    '  "stores": [\n' +
    '    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày NTXX", "time": "Giờ NTXX", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n' +
    '  ]\n' +
    "}\n\n";
  return extractGenericDetails(emailSource, prompt);
}

async function extractSurveyDetails(emailSource) {
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
    "3. CHỐNG ẢO GIÁC DỮ LIỆU: NẾU CỘT NÀO KHÔNG CÓ THÔNG TIN (VÍ DỤ FILE EXCEL CHỈ CÓ TÊN STORE CHỨ KHÔNG CÓ NGÀY HAY GIỜ), BẮT BUỘC ĐỂ GIÁ TRỊ LÀ null HOẶC CHUỖI RỖNG \"\". TUYỆT ĐỐI KHÔNG TỰ BỊA RA NGÀY GIỜ HAY HẠNG MỤC TỪ BỐI CẢNH XUNG QUANH.\n" +
    "4. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu (đặc biệt là bảng dạng text hoặc Excel), một số cột như Hạng mục (Category), Ngày (Date), Giờ (Time), Địa chỉ/Supplier có thể bị gộp ô (merged cells) nên các dòng dưới sẽ bị trống các thông tin này. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu. TUYỆT ĐỐI KHÔNG BỎ SÓT BẤT KỲ DÒNG NÀO CỦA BẢNG.\n" +
    "5. Phân biệt rõ giữa Brand/Client (như Unilever, Lotte) và Supplier (nhà cung cấp thi công như Link4, Gia Khang, SDC...). TUYỆT ĐỐI không gán tên nhân viên Unilever làm Supplier.\n" +
    "6. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n" +
    "{\n" +
    '  "email_type": "survey_schedule", // Hoặc survey_reply, survey_forward\n' +
    '  "supplier": "Tên supplier chung (nếu có)",\n' +
    '  "stores": [\n' +
    '    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày khảo sát", "time": "Giờ khảo sát", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n' +
    '  ]\n' +
    "}\n\n";
  return extractGenericDetails(emailSource, prompt);
}

async function extractInstallDetails(emailSource) {
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
    "}\n\n";
  return extractGenericDetails(emailSource, prompt);
}

// Định nghĩa Keyword cho từng trạng thái
// THỨ TỰ QUAN TRỌNG: cụ thể → tổng quát để tránh bắt nhầm
function detectStatus(subject) {
  const s = subject.toLowerCase();
  for (const rule of STATUS_RULES) {
    if (rule.keywords.some(k => s.includes(k))) return rule.status;
  }
  return null;
}

const STATUS_RULES = [
  // === Hoàn thành (kiểm tra TRƯỚC để tránh bị che bởi keyword ngắn hơn) ===
  {
    status: 'hoan_thanh_khao_sat',
    keywords: ['kqks', 'kết quả khảo sát', 'report khảo sát', 'trả kết quả khảo sát', 'trả hình khảo sát', 'kết quả ks', 'kq khảo sát', 'báo cáo khảo sát', 'hoàn thành khảo sát', 'nghiệm thu khảo sát', 'hình ảnh khảo sát', 'biên bản khảo sát']
  },
  {
    status: 'hoan_thanh_lap_dat',
    keywords: ['report lắp đặt', 'trả hình lắp đặt', 'report hình ảnh lắp đặt', 'báo cáo lắp đặt', 'hoàn thành lắp đặt', 'nghiệm thu lắp đặt', 'hình ảnh lắp đặt', 'biên bản lắp đặt']
  },
  {
    status: 'hoan_tat_thu_hoi',
    keywords: ['trả hình thu hồi', 'report thu hồi', 'báo cáo thu hồi', 'hoàn thành thu hồi', 'biên bản thu hồi']
  },
  // === Lịch / Đăng ký ===
  {
    status: 'khao_sat',
    keywords: ['đăng ký khảo sát', 'lịch khảo sát', 'đăng ký lịch khảo sát']
  },
  {
    status: 'ntxx', // Nghiệm thu xuất xưởng — ưu tiên hơn lắp đặt
    keywords: ['nghiệm thu xuất xưởng', 'lịch ntxx', 'đăng ký lịch ntxx', 'gửi lịch ntxx', 'ntxx team vis']
  },
  {
    status: 'lap_dat',
    keywords: ['đăng ký lắp đặt', 'lắp đặt', 'lịch lắp đặt', 'lịch giao hàng', 'đăng ký giao hàng', 'đăng ký thi công', 'lịch thi công']
  },
  {
    status: 'thu_hoi',
    keywords: ['đăng ký thu hồi', 'lịch thu hồi', 'đăng ký lịch thu hồi']
  },
  // === Brief — để cuối vì keyword ngắn, dễ false positive nhất ===
  {
    status: 'brief',
    keywords: ['[brief confirmed]', 'duyệt brief', 'brief confirmed']
  }
];

async function main() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    },
    logger: false
  });

  try {
    await client.connect();
    console.log("✅ Đã kết nối IMAP thành công.");
    let lock = await client.getMailboxLock('INBOX');
    
    // Lấy danh sách email đã lưu để tránh duplicate
    const { data: existingRecords } = await supabase.from('project_progress_ai').select('email_message_id, email_subject');
    const existingMessageIds = new Set(existingRecords?.map(r => r.email_message_id).filter(Boolean) || []);
    const existingSubjects = new Set(existingRecords?.map(r => r.email_subject).filter(Boolean) || []);

    const sinceDate = new Date('2026-01-01');
    const messages = client.fetch({ since: sinceDate }, { envelope: true, uid: true });

    let processedCount = 0;
    let matchedCount = 0;
    let ntxxToProcess = [];
    let surveyToProcess = [];
    let installToProcess = [];
    let surveyCompletedToProcess = [];
    let installCompletedToProcess = [];
    
    for await (let msg of messages) {
      processedCount++;
      const subject = msg.envelope.subject || "";
      const messageId = msg.envelope.messageId || "";
      
      const fromArr = msg.envelope.from || [];
      const sender = fromArr.length > 0 ? (fromArr[0].name || fromArr[0].address) : null;
      
      // 1. Chuẩn hóa subject rồi tìm Mã Dự Án
      const normalizedSubject = normalizeSubject(subject);
      const matches = [...normalizedSubject.matchAll(PROJECT_CODE_REGEX)].map(m => m[0]);
      
      if (matches.length > 0) {
        // Lấy mã dự án đầu tiên tìm thấy
        const projectCode = matches[0];
        
        // 2. Tìm Keyword trạng thái
        const detectedStatus = detectStatus(subject);
        
        if (detectedStatus) {
          if (messageId && existingMessageIds.has(messageId)) {
             continue; // Bỏ qua nếu đã lưu
          }
          if (!messageId && existingSubjects.has(subject)) {
             continue; // Fallback cho các mail cũ không có message_id
          }
          matchedCount++;
          console.log(`\n📧 [${msg.seq}] Subject: ${subject}`);
          console.log(`   ➡️ Found Code: ${projectCode} | Status: ${detectedStatus}`);
          
          // 3. Query DB để tìm dự án
          // So khớp projectCode với final_key, source_key hoặc request_id
          const { data: dbProjects, error: fetchErr } = await supabase
            .from('posm_projects')
            .select('id, source_project_name')
            .or(`final_key.ilike.%${projectCode}%,source_key.ilike.%${projectCode}%,request_id.ilike.%${projectCode}%`)
            .limit(1);
            
          const matchedProjectName = (dbProjects && dbProjects.length > 0) ? dbProjects[0].source_project_name : null;
          
          if (matchedProjectName) {
            console.log(`   ✅ Matched DB Project: ${matchedProjectName}`);
          } else {
             console.log(`   ⚠️ Không tìm thấy dự án nào trong DB khớp mã ${projectCode}`);
          }
          
          // 4. Insert vào bảng project_progress_ai
          const { data: insertedData, error: insertErr } = await supabase
            .from('project_progress_ai')
            .insert({
              email_message_id: messageId,
              email_subject: subject,
              email_received_at: msg.envelope.date || new Date(),
              detected_project_code: projectCode,
              detected_project_name: matchedProjectName,
              detected_status: detectedStatus,
              processing_status: 'processed',
              sender: sender
            })
            .select();
         if (insertErr) {
              console.error(`   ❌ Lỗi insert: ${insertErr.message}`);
          } else {
              console.log(`   🚀 Đã lưu tracking thành công!`);
              if (insertedData && insertedData.length > 0) {
                if (detectedStatus === 'ntxx') {
                  ntxxToProcess.push({ 
                    uid: msg.uid, 
                    subject, 
                    code: projectCode, 
                    dbId: insertedData[0].id 
                  });
                } else if (detectedStatus === 'khao_sat') {
                  surveyToProcess.push({ 
                    uid: msg.uid, 
                    subject, 
                    code: projectCode, 
                    dbId: insertedData[0].id 
                  });
                } else if (detectedStatus === 'lap_dat') {
                  installToProcess.push({ 
                    uid: msg.uid, 
                    subject, 
                    code: projectCode, 
                    dbId: insertedData[0].id 
                  });
                } else if (detectedStatus === 'hoan_thanh_khao_sat') {
                  surveyCompletedToProcess.push({
                    uid: msg.uid, 
                    subject, 
                    code: projectCode, 
                    dbId: insertedData[0].id 
                  });
                } else if (detectedStatus === 'hoan_thanh_lap_dat') {
                  installCompletedToProcess.push({
                    uid: msg.uid, 
                    subject, 
                    code: projectCode, 
                    dbId: insertedData[0].id 
                  });
                }
              }
          }
        }
      }
      
      if (processedCount % 100 === 0) {
        console.log(`...đã xử lý ${processedCount} emails...`);
      }
    }
    
    console.log(`\n=== TỔNG KẾT ===`);
    console.log(`Tổng email quét: ${processedCount}`);
    console.log(`Tổng email khớp Code & Status: ${matchedCount}`);
    
    // Process NTXX emails after main loop closes
    if (ntxxToProcess.length > 0) {
      console.log(`\n=== XỬ LÝ AI CHO ${ntxxToProcess.length} EMAIL NTXX ===`);
      for (const item of ntxxToProcess) {
        console.log(`\n🤖 Đang phân tích email NTXX: ${item.subject}...`);
        try {
          const fullMsg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (fullMsg && fullMsg.source) {
             const details = await extractNTXXDetails(fullMsg.source);
             if (details) {
                let storeHash = null;
                if (details.stores && details.stores.length > 0) {
                  const sortedStores = [...details.stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
                  const storeStr = JSON.stringify(sortedStores);
                  storeHash = crypto.createHash('md5').update(storeStr).digest('hex');
                }

                let emailType = details.email_type || 'ntxx_schedule';
                // Đề phòng AI trả về lộn xộn
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
                    .eq('detected_project_code', item.code)
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
                      .eq('detected_project_code', item.code)
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
                  .eq('id', item.dbId);
                  
                if (updateErr) {
                   console.error(`   ❌ Lỗi update JSON NTXX: ${updateErr.message}`);
                } else {
                   console.log(`   ✅ Cập nhật thành công JSON vào DB. Type: ${finalEmailType}, Phase: ${phaseIndex || 'N/A'}`);
                }
             } else {
                console.log(`   ⚠️ AI trả về rỗng, bỏ qua lưu JSON.`);
             }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi khi xử lý email UID ${item.uid}: ${err.message}`);
        }
      }
    }

    // Process Survey (khao_sat) emails
    if (surveyToProcess.length > 0) {
      console.log(`\n=== XỬ LÝ AI CHO ${surveyToProcess.length} EMAIL KHẢO SÁT ===`);
      for (const item of surveyToProcess) {
        console.log(`\n🤖 Đang phân tích email Khảo sát: ${item.subject}...`);
        try {
          const fullMsg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
          if (fullMsg && fullMsg.source) {
             const details = await extractSurveyDetails(fullMsg.source);
             if (details) {
                let storeHash = null;
                if (details.stores && details.stores.length > 0) {
                  const sortedStores = [...details.stores].sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''));
                  const storeStr = JSON.stringify(sortedStores);
                  storeHash = crypto.createHash('md5').update(storeStr).digest('hex');
                }

                let emailType = details.email_type || 'survey_schedule';
                if (!['survey_schedule', 'survey_reply', 'survey_forward'].includes(emailType)) {
                  emailType = 'survey_schedule';
                }

                let finalEmailType = emailType;
                let phaseIndex = null;
                let linkedPhaseId = null;

                if (storeHash && emailType === 'survey_schedule') {
                  const { data: existingPhases } = await supabase
                    .from('project_progress_ai')
                    .select('id, phase_index')
                    .eq('detected_project_code', item.code)
                    .eq('store_hash', storeHash)
                    .eq('email_type', 'survey_schedule')
                    .order('email_received_at', { ascending: true })
                    .limit(1);

                  if (existingPhases && existingPhases.length > 0) {
                    finalEmailType = 'survey_duplicate';
                    linkedPhaseId = existingPhases[0].id;
                    phaseIndex = existingPhases[0].phase_index;
                  } else {
                    const { data: maxPhase } = await supabase
                      .from('project_progress_ai')
                      .select('phase_index')
                      .eq('detected_project_code', item.code)
                      .eq('detected_status', 'khao_sat')
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
                  .eq('id', item.dbId);
                  
                if (updateErr) {
                   console.error(`   ❌ Lỗi update JSON Khảo sát: ${updateErr.message}`);
                } else {
                   console.log(`   ✅ Cập nhật thành công JSON vào DB. Type: ${finalEmailType}, Phase: ${phaseIndex || 'N/A'}`);
                }
             } else {
                console.log(`   ⚠️ AI trả về rỗng, bỏ qua lưu JSON.`);
             }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi khi xử lý email UID ${item.uid}: ${err.message}`);
        }
      }
    }

    // Process Installation (lap_dat) emails
    if (installToProcess.length > 0) {
      console.log(`\n=== XỬ LÝ AI CHO ${installToProcess.length} EMAIL LẮP ĐẶT ===`);
      for (const item of installToProcess) {
        console.log(`\n🤖 Đang phân tích email Lắp đặt: ${item.subject}...`);
        try {
          const fullMsg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
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
                if (!['install_schedule', 'install_reply', 'install_forward'].includes(emailType)) {
                  emailType = 'install_schedule';
                }

                let finalEmailType = emailType;
                let phaseIndex = null;
                let linkedPhaseId = null;

                if (storeHash && emailType === 'install_schedule') {
                  const { data: existingPhases } = await supabase
                    .from('project_progress_ai')
                    .select('id, phase_index')
                    .eq('detected_project_code', item.code)
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
                      .eq('detected_project_code', item.code)
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
                  .eq('id', item.dbId);
                  
                if (updateErr) {
                   console.error(`   ❌ Lỗi update JSON Lắp đặt: ${updateErr.message}`);
                } else {
                   console.log(`   ✅ Cập nhật thành công JSON vào DB. Type: ${finalEmailType}, Phase: ${phaseIndex || 'N/A'}`);
                }
             } else {
                console.log(`   ⚠️ AI trả về rỗng, bỏ qua lưu JSON.`);
             }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi khi xử lý email UID ${item.uid}: ${err.message}`);
        }
      }
    }

    // Process hoan_thanh_khao_sat emails to extract attachment filenames
    if (surveyCompletedToProcess.length > 0) {
      console.log(`\n=== TRÍCH XUẤT FILE ĐÍNH KÈM CHO ${surveyCompletedToProcess.length} BÁO CÁO KHẢO SÁT ===`);
      for (const item of surveyCompletedToProcess) {
        console.log(`\n📄 Đang phân tích báo cáo khảo sát: ${item.subject}...`);
        try {
          const fullMsg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
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
                  email_type: 'survey_completed_report',
                  attachments: attachmentsList
                },
                email_type: 'survey_completed_report'
              })
              .eq('id', item.dbId);

            if (updateErr) {
              console.error(`   ❌ Lỗi cập nhật file đính kèm: ${updateErr.message}`);
            } else {
              console.log(`   ✅ Đã cập nhật file đính kèm thành công!`);
            }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi xử lý email báo cáo khảo sát:`, err.message);
        }
      }
    }

    // Process hoan_thanh_lap_dat emails to extract attachment filenames
    if (installCompletedToProcess.length > 0) {
      console.log(`\n=== TRÍCH XUẤT FILE ĐÍNH KÈM CHO ${installCompletedToProcess.length} BÁO CÁO LẮP ĐẶT ===`);
      for (const item of installCompletedToProcess) {
        console.log(`\n📄 Đang phân tích báo cáo lắp đặt: ${item.subject}...`);
        try {
          const fullMsg = await client.fetchOne(item.uid.toString(), { source: true }, { uid: true });
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
              .eq('id', item.dbId);

            if (updateErr) {
              console.error(`   ❌ Lỗi cập nhật file đính kèm: ${updateErr.message}`);
            } else {
              console.log(`   ✅ Đã cập nhật file đính kèm thành công!`);
            }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi xử lý email báo cáo lắp đặt:`, err.message);
        }
      }
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
