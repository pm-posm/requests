import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
  logger: false
});

async function run() {
  await client.connect();
  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    const fullMsg = await client.fetchOne('17606', { source: true }, { uid: true });
    const parsed = await simpleParser(fullMsg.source);
    
    let htmlCleaned = parsed.html || parsed.textAsHtml || '';
    htmlCleaned = htmlCleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
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
                             
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    turndownService.use(gfm);
    const finalEmailText = turndownService.turndown(htmlCleaned);
    
    console.log('Turndown output length:', finalEmailText.length);
    console.log('Index of GO! DA LAT:', finalEmailText.indexOf('GO! DA LAT'));
    console.log('Index of GO! QUANG NGAI:', finalEmailText.indexOf('GO! QUANG NGAI'));
    
    const idx = finalEmailText.indexOf('GO! DA LAT');
    if (idx !== -1) {
      console.log('--- Sample table text ---');
      console.log(finalEmailText.substring(idx - 100, idx + 2000));
    }
  } finally {
    lock.release();
    await client.logout();
  }
}
run().catch(console.error);
