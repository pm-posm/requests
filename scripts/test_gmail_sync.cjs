const { OAuth2Client } = require('google-auth-library');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

const client = new OAuth2Client(clientId, clientSecret);
client.setCredentials({ refresh_token: refreshToken });

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

function detectStatus(subject) {
  const s = subject.toLowerCase();
  for (const rule of STATUS_RULES) {
    if (rule.keywords.some(k => s.includes(k))) return rule;
  }
  return null;
}

const PROJECT_CODE_REGEX = /\b(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;

async function run() {
  try {
    const tokenInfo = await client.getAccessToken();
    const token = tokenInfo.token;
    
    console.log("Fetching messages from last 7 days...");
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:7d&maxResults=500`;
    const listRes = await fetch(listUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const listData = await listRes.json();
    
    if (!listData.messages) {
      console.log("No messages found.");
      return;
    }
    
    console.log(`Found ${listData.messages.length} messages.`);
    let matched = 0;
    
    for (const msg of listData.messages) {
      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject`;
      const msgRes = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const msgDataObj = await msgRes.json();
      const headers = msgDataObj.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      
      const normalizedSubject = subject.toUpperCase().replace(/\s+/g, ' ');
      const matches = [...normalizedSubject.matchAll(PROJECT_CODE_REGEX)].map(m => m[0]);
      const detectedRule = detectStatus(subject);
      
      if (matches.length > 0) {
        console.log(`[Code Matched] Subject: ${subject}`);
        if (detectedRule) {
           console.log(`  => [FULL MATCH] Code: ${matches[0]}, Status: ${detectedRule.status}`);
           matched++;
        }
      }
    }
    
    console.log(`Total fully matched emails: ${matched}`);
  } catch (err) {
    console.error(err);
  }
}
run();
