import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new ImapFlow({
  host: 'imap.gmail.com', port: 993, secure: true,
  auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
  logger: false
});

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
    if (match) {
      console.log('Matched sep:', sep, 'at index:', match.index);
      if (match.index < cutIndex) {
        cutIndex = match.index;
      }
    }
  }
  return text.substring(0, cutIndex).trim();
}

async function run() {
  await client.connect();
  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    const fullMsg = await client.fetchOne('17606', { source: true }, { uid: true });
    const parsed = await simpleParser(fullMsg.source);
    let htmlCleaned = cleanHtml(parsed.html || parsed.textAsHtml || '');
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    turndownService.use(gfm);
    const finalEmailText = turndownService.turndown(htmlCleaned);
    console.log('Markdown length:', finalEmailText.length);
    const stripped = stripQuotedHistory(finalEmailText);
    console.log('Stripped length:', stripped.length);
    console.log('--- Stripped Markdown ---');
    console.log(stripped);
  } finally {
    lock.release();
    await client.logout();
  }
}
run();
