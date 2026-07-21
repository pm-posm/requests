import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OAuth2Client } from 'npm:google-auth-library@9.6.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Đã xóa hàm getEmailBody vì không cần thiết nữa

// Đã xóa hàm getAttachments vì không cần thiết nữa

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
    const groqKey = Deno.env.get('GROQ_API_KEY')

    if (!clientId || !clientSecret || !refreshToken || !groqKey) {
      throw new Error('Missing environment variables')
    }

    const client = new OAuth2Client(clientId, clientSecret)
    client.setCredentials({ refresh_token: refreshToken })
    const tokenInfo = await client.getAccessToken()
    
    if (!tokenInfo.token) {
      throw new Error('Failed to get access token')
    }

    // Hàm hỗ trợ Sleep chống quá tải API (Rate Limiting)
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Cào email từ Gmail (2 ngày gần nhất) - Có xử lý phân trang (Pagination)
    let messages: any[] = [];
    let pageToken: string | undefined = undefined;
    
    do {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:2d${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const listRes = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
      });
      const listData = await listRes.json();
      
      if (listData.messages) {
        messages = messages.concat(listData.messages);
      }
      pageToken = listData.nextPageToken;
    } while (pageToken);

    let processedCount = 0;
    let skippedCount = 0;
    let errors: string[] = [];

    // Lấy danh sách message_id đã xử lý từ DB để chống trùng lặp
    const { data: existingProgress, error: dbError } = await supabase
        .from('project_progress_ai')
        .select('email_message_id')
        .not('email_message_id', 'is', null)
    
    const processedMessageIds = new Set((existingProgress || []).map(a => a.email_message_id))

const STATUS_RULES = [
  { status: 'hoan_thanh_khao_sat', phase: 'SURVEY', keywords: ['kqks', 'kết quả khảo sát', 'report khảo sát', 'trả kết quả khảo sát', 'trả hình khảo sát', 'kết quả ks', 'kq khảo sát', 'báo cáo khảo sát', 'hoàn thành khảo sát', 'nghiệm thu khảo sát', 'hình ảnh khảo sát', 'biên bản khảo sát'] },
  { status: 'hoan_thanh_lap_dat', phase: 'INSTALLATION', keywords: ['report lắp đặt', 'trả hình lắp đặt', 'report hình ảnh lắp đặt', 'báo cáo lắp đặt', 'hoàn thành lắp đặt', 'nghiệm thu lắp đặt', 'hình ảnh lắp đặt', 'biên bản lắp đặt'] },
  { status: 'hoan_tat_thu_hoi', phase: 'RECALL', keywords: ['trả hình thu hồi', 'report thu hồi', 'báo cáo thu hồi', 'hoàn thành thu hồi', 'biên bản thu hồi'] },
  { status: 'khao_sat', phase: 'SURVEY', keywords: ['đăng ký khảo sát', 'lịch khảo sát', 'đăng ký lịch khảo sát'] },
  { status: 'ntxx', phase: 'NTXX', keywords: ['nghiệm thu xuất xưởng', 'lịch ntxx', 'đăng ký lịch ntxx', 'gửi lịch ntxx', 'ntxx team vis'] },
  { status: 'lap_dat', phase: 'INSTALLATION', keywords: ['đăng ký lắp đặt', 'lắp đặt', 'lịch lắp đặt', 'lịch giao hàng', 'đăng ký giao hàng', 'đăng ký thi công', 'lịch thi công'] },
  { status: 'thu_hoi', phase: 'RECALL', keywords: ['đăng ký thu hồi', 'lịch thu hồi', 'đăng ký lịch thu hồi'] },
  { status: 'brief', phase: 'BRIEF', keywords: ['[brief confirmed]', 'duyệt brief', 'brief confirmed'] }
];

function detectStatus(subject: string) {
  const s = subject.toLowerCase();
  for (const rule of STATUS_RULES) {
    if (rule.keywords.some(k => s.includes(k))) return rule;
  }
  return null;
}

// Hàm decode tiêu đề email bị mã hóa (RFC 2047)
function decodeRFC2047(text: string) {
    if (!text) return '';
    return text.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (match, charset, encoding, data) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return decodeURIComponent(escape(atob(data)));
            } else if (encoding.toUpperCase() === 'Q') {
                const unescaped = data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                return decodeURIComponent(escape(unescaped));
            }
        } catch (e) {
            return match;
        }
        return match;
    });
}

    const PROJECT_CODE_REGEX = /(?:\b|_)(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;

    for (const msg of messages) {
      if (processedMessageIds.has(msg.id)) {
        skippedCount++;
        continue;
      }

      try {
        // Tải NHANH metadata (chỉ lấy các Header quan trọng)
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID&metadataHeaders=Date`
        const msgRes = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
        })
        const msgData = await msgRes.json()

        const headers = msgData.payload?.headers || []
        const rawSubject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || ''
        const subject = decodeRFC2047(rawSubject)
        const sender = decodeRFC2047(headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '')
        const messageIdHeader = headers.find((h: any) => h.name.toLowerCase() === 'message-id')?.value || msg.id
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString()
        
        // 1. Áp dụng Regex lấy Mã dự án
        const normalizedSubject = subject.toUpperCase().replace(/\s+/g, ' ');
        const matches = [...normalizedSubject.matchAll(PROJECT_CODE_REGEX)].map(m => m[0]);
        
        // 2. Lọc bằng Keyword
        const detectedRule = detectStatus(subject);
        
        if (matches.length > 0 && detectedRule) {
            const projectCode = matches[0];
            
            // Lấy tên dự án từ db nếu có
            const { data: dbProjects } = await supabase
                .from('posm_projects')
                .select('id, source_project_name')
                .or(`final_key.ilike.%${projectCode}%,source_key.ilike.%${projectCode}%,request_id.ilike.%${projectCode}%`)
                .limit(1);
            const matchedProjectName = (dbProjects && dbProjects.length > 0) ? dbProjects[0].source_project_name : null;
            
            // Lưu vào project_progress_ai (để sau này AI bóc tách tiếp)
            const { error: progressError } = await supabase
                .from('project_progress_ai')
                .insert({
                    email_message_id: msg.id, // Lưu Gmail ID để cron-process-ai gọi API tải full nội dung
                    email_subject: subject,
                    email_sender: sender,
                    email_received_at: new Date(dateHeader).toISOString(),
                    detected_project_code: projectCode,
                    detected_project_name: matchedProjectName,
                    detected_status: detectedRule.status,
                    processing_status: 'pending_ai', // Đánh dấu để tiến trình AI xử lý sau
                    ai_confidence_score: 1.0 // Filter cứng bằng rule nên độ tự tin là 100%
                });
            
            if (progressError) {
                console.error("Lỗi insert project_progress_ai:", progressError);
            } else {
                processedCount++;
            }
        } else {
            // Không khớp rule hoặc không có mã -> Bỏ qua nhanh
            skippedCount++;
            // Đánh dấu message_id gmail để lần sau khỏi gọi lại API lấy metadata
            await supabase.from('project_progress_ai').insert({
                email_message_id: msg.id, // Lưu gmail id để cache
                email_subject: subject,
                email_sender: sender,
                processing_status: 'ignored_not_registration'
            });
        }
      } catch (err: any) {
        errors.push(`Error processing msg ${msg.id}: ${err.message}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed', 
        processed: processedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Cron sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message || error.toString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
