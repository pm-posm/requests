import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OAuth2Client } from 'npm:google-auth-library@9.6.3'
import * as XLSX from 'npm:xlsx'
import TurndownService from 'npm:turndown'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATUS_LABELS: Record<string, string> = {
    'khao_sat': 'Đăng ký Lịch Khảo Sát',
    'hoan_thanh_khao_sat': 'Báo cáo Hoàn thành Khảo Sát',
    'ntxx': 'Đăng ký Lịch Nghiệm Thu Xuất Xưởng (NTXX)',
    'lap_dat': 'Đăng ký Lịch Lắp Đặt / Thi Công',
    'hoan_thanh_lap_dat': 'Báo cáo Hoàn thành Lắp Đặt',
    'thu_hoi': 'Đăng ký Lịch Thu Hồi',
    'hoan_tat_thu_hoi': 'Báo cáo Hoàn thành Thu Hồi',
    'brief': 'Xác nhận Brief'
};

function decodeBase64Url(str: string) {
    if (!str) return '';
    str = (str + '===').slice(0, str.length + (str.length % 4));
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return '';
    }
}

async function extractEmailData(msgData: any, token: string, messageId: string) {
    let plainText = '';
    let htmlText = '';
    let excelText = '';
    let attachments: any[] = [];

    function parseParts(parts: any[]) {
        if (!parts) return;
        for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                plainText += decodeBase64Url(part.body.data) + '\n';
            } else if (part.mimeType === 'text/html' && part.body?.data) {
                htmlText += decodeBase64Url(part.body.data) + '\n';
            } else if (part.filename && (part.filename.endsWith('.xlsx') || part.filename.endsWith('.xls'))) {
                attachments.push(part);
            } else if (part.parts) {
                parseParts(part.parts);
            }
        }
    }

    if (msgData.payload) {
        if (msgData.payload.parts) {
            parseParts(msgData.payload.parts);
        } else if (msgData.payload.body?.data) {
             if (msgData.payload.mimeType === 'text/plain') plainText += decodeBase64Url(msgData.payload.body.data);
             if (msgData.payload.mimeType === 'text/html') htmlText += decodeBase64Url(msgData.payload.body.data);
        }
    }

    let finalEmailText = plainText;
    if (htmlText && plainText.length < 50) {
        try {
            const turndownService = new TurndownService({ headingStyle: 'atx' });
            finalEmailText = turndownService.turndown(htmlText);
        } catch (e) {
            console.error("Lỗi parse HTML:", e);
        }
    }

    for (const att of attachments) {
        if (att.body?.attachmentId) {
            console.log(`[Excel] Đang tải file đính kèm: ${att.filename}`);
            try {
                const attUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${att.body.attachmentId}`;
                const attRes = await fetch(attUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const attData = await attRes.json();
                if (attData.data) {
                    let b64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');
                    const bin = atob(b64);
                    const buf = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
                    
                    const workbook = XLSX.read(buf, { type: 'array' });
                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const csv = XLSX.utils.sheet_to_csv(sheet);
                        const cleanedCsv = csv.split('\n').map((l: string) => l.trim()).filter((l: string) => l.replace(/,/g, '').length > 0).join('\n');
                        if (cleanedCsv.length > 0) {
                            excelText += `\n\n--- Excel Sheet: ${sheetName} ---\n${cleanedCsv}\n`;
                        }
                    }
                }
            } catch (e) {
                console.error(`Lỗi đọc file Excel ${att.filename}:`, e);
            }
        }
    }

    if (finalEmailText.length > 25000) finalEmailText = finalEmailText.substring(0, 25000);
    return { finalEmailText, excelText };
}

async function callGroqAPI(prompt: string, groqKey: string) {
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" }
                })
            });

            if (response.ok) {
                const resJson = await response.json();
                return resJson.choices[0].message.content;
            } else if (response.status === 429) {
                console.warn(`⏳ Groq Rate Limit (429). Ngủ 5s...`);
                await new Promise(r => setTimeout(r, 5000));
                retries--;
            } else {
                console.error(`❌ Groq lỗi ${response.status}:`, await response.text());
                return null;
            }
        } catch (e) {
            console.error(`❌ Lỗi gọi Groq:`, e);
            return null;
        }
    }
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
        const groqKey = Deno.env.get('GROQ_API_KEY');

        if (!clientId || !clientSecret || !refreshToken || !groqKey) {
            throw new Error('Thiếu biến môi trường (Google / Groq)');
        }

        const client = new OAuth2Client(clientId, clientSecret);
        client.setCredentials({ refresh_token: refreshToken });
        const tokenInfo = await client.getAccessToken();
        if (!tokenInfo.token) throw new Error('Lỗi lấy Google Access Token');

        // 1. Lấy tối đa 3 email đang pending_ai
        const { data: records, error: dbErr } = await supabase
            .from('project_progress_ai')
            .select('*')
            .eq('processing_status', 'pending_ai')
            .order('created_at', { ascending: true })
            .limit(3);

        if (dbErr) throw dbErr;
        if (!records || records.length === 0) {
            return new Response(JSON.stringify({ message: "Không có email chờ xử lý." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        console.log(`[cron-process-ai] Tìm thấy ${records.length} email cần xử lý.`);
        let successCount = 0;

        for (const record of records) {
            console.log(`Đang xử lý ID: ${record.id} - ${record.email_subject}`);
            
            // Fix Gmail ID vs Message-ID issue
            let gmailId = record.email_message_id;
            if (gmailId.startsWith('<')) {
                console.log("Phát hiện Message-ID cũ, đang lấy Gmail ID...");
                const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=rfc822msgid:${encodeURIComponent(gmailId)}`;
                const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${tokenInfo.token}` }});
                const searchData = await searchRes.json();
                if (searchData.messages && searchData.messages.length > 0) {
                    gmailId = searchData.messages[0].id;
                } else {
                    console.log("Không tìm thấy Gmail ID cho Message-ID này. Đánh dấu lỗi.");
                    await supabase.from('project_progress_ai').update({ processing_status: 'error_not_found' }).eq('id', record.id);
                    continue;
                }
            }

            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=full`;
            const msgRes = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${tokenInfo.token}` }});
            if (!msgRes.ok) {
                 await supabase.from('project_progress_ai').update({ processing_status: 'error_gmail_api' }).eq('id', record.id);
                 continue;
            }
            const msgData = await msgRes.json();
            const { finalEmailText, excelText } = await extractEmailData(msgData, tokenInfo.token, gmailId);

            const statusLabel = STATUS_LABELS[record.detected_status] || 'Lịch Khảo Sát / Thi Công';
            
            const prompt = `Trích xuất Bảng thông tin ${statusLabel} từ email/excel này.\n` +
                `Bảng dữ liệu thường nằm trong nội dung email hoặc được đính kèm dưới dạng file Excel (.xlsx).\n` +
                `Hãy đọc kỹ toàn bộ nội dung văn bản email và phần Excel đính kèm (nếu có) dưới đây để trích xuất đầy đủ thông tin.\n` +
                `Yêu cầu lấy các cột dữ liệu:\n` +
                `- Store Code: Mã cửa hàng (VD: STR-BIG-00444)\n` +
                `- Store Name: Tên siêu thị (VD: GO! THANG LONG)\n` +
                `- Quantity: Số lượng (VD: 1)\n` +
                `- Category: Hạng mục thi công (VD: Showcase Podium)\n` +
                `- Date: Ngày (Định dạng DD/MM/YYYY, VD: 28/04/2026)\n` +
                `- Time: Giờ (VD: 14h00-17h00)\n` +
                `- Address: Địa chỉ / Supplier (Đơn vị thi công phụ trách cửa hàng này, VD: Link 4)\n\n` +
                `LƯU Ý CỰC KỲ QUAN TRỌNG:\n` +
                `1. Đây có thể là một chuỗi email (email thread) chứa nhiều email cũ. Bạn chỉ được lấy bảng dữ liệu của email/lịch gửi mới nhất.\n` +
                `2. Nếu email chỉ là phản hồi xác nhận ('OK', 'Duyệt', 'Đã duyệt'), hãy trả về mảng stores rỗng [] và email_type là 'reply'.\n` +
                `3. CHỐNG ẢO GIÁC DỮ LIỆU: NẾU CỘT NÀO KHÔNG CÓ THÔNG TIN (VÍ DỤ FILE EXCEL CHỈ CÓ TÊN STORE CHỨ KHÔNG CÓ NGÀY HAY GIỜ), BẮT BUỘC ĐỂ GIÁ TRỊ LÀ null HOẶC CHUỖI RỖNG "". TUYỆT ĐỐI KHÔNG TỰ BỊA RA NGÀY GIỜ HAY HẠNG MỤC TỪ BỐI CẢNH XUNG QUANH.\n` +
                `4. XỬ LÝ Ô TRỘN (MERGED CELLS): Trong bảng dữ liệu, một số cột như Hạng mục, Ngày, Giờ, Địa chỉ/Supplier có thể bị gộp ô nên các dòng dưới sẽ bị trống. Bạn phải TỰ ĐỘNG ĐIỀN các thông tin này cho dòng dưới bằng cách lấy giá trị từ dòng gần nhất phía trên nó có chứa dữ liệu.\n` +
                `5. Chỉ trả về JSON theo định dạng sau, tuyệt đối không giải thích thêm:\n` +
                `{\n` +
                `  "email_type": "schedule", // Hoặc reply, forward\n` +
                `  "supplier": "Tên supplier chung (nếu có)",\n` +
                `  "stores": [\n` +
                `    { "code": "Mã store", "name": "Tên siêu thị", "quantity": "Số lượng", "category": "Hạng mục", "date": "Ngày", "time": "Giờ", "address": "Nhà cung cấp/Supplier phụ trách hoặc Địa chỉ" }\n` +
                `  ]\n` +
                `}\n\n` +
                `Email Body (Markdown Format):\n` +
                `${finalEmailText}\n\n` +
                (excelText ? `Excel Attachments Contents:\n${excelText}\n` : "");

            console.log("Đang gọi Groq AI...");
            let replyText = await callGroqAPI(prompt, groqKey);
            
            if (replyText) {
                replyText = replyText.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBrace = replyText.indexOf('{');
                const lastBrace = replyText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    replyText = replyText.substring(firstBrace, lastBrace + 1);
                }
                
                try {
                    const details = JSON.parse(replyText);
                    let emailType = details.email_type || 'schedule';
                    
                    const { error: updateErr } = await supabase
                        .from('project_progress_ai')
                        .update({ 
                           ntxx_details: details,
                           email_type: emailType,
                           processing_status: 'processed'
                        })
                        .eq('id', record.id);
                        
                    if (updateErr) {
                         console.error("Lỗi update DB:", updateErr);
                    } else {
                         successCount++;
                         // Tự động chèn vào project_activities
                         if (details.stores && details.stores.length > 0) {
                             const storesData = details.stores.map((s: any) => ({
                                project_code: record.detected_project_code,
                                phase_type: record.detected_status.toUpperCase(),
                                store_code: s.code,
                                store_name: s.name,
                                content: `Lịch ${statusLabel} - Ngày: ${s.date || 'N/A'}, Giờ: ${s.time || 'N/A'}`
                             }));
                             
                             await supabase.from('project_activities').insert(storesData);
                         }
                    }
                } catch (e) {
                    console.error("Lỗi parse JSON từ Groq:", e);
                    await supabase.from('project_progress_ai').update({ processing_status: 'error_ai_parse' }).eq('id', record.id);
                }
            } else {
                await supabase.from('project_progress_ai').update({ processing_status: 'error_ai_timeout' }).eq('id', record.id);
            }
        }

        return new Response(JSON.stringify({ message: "Hoàn tất xử lý AI", processed: successCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
})
