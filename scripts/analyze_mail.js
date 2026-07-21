const { createClient } = require('@supabase/supabase-js');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const cheerio = require('cheerio');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: record } = await supabase.from('project_progress_ai')
    .select('email_message_id')
    .eq('id', '38fd89b9-5558-433a-8200-44e27f2be072')
    .single();

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

  await client.connect();
  let lock = await client.getMailboxLock('[Gmail]/Tất cả thư');
  try {
    const searchResult = await client.search({ header: { 'message-id': record.email_message_id } }, { uid: true });
    if (searchResult && searchResult.length > 0) {
      const msg = await client.fetchOne(searchResult[0].toString(), { source: true }, { uid: true });
      const parsed = await simpleParser(msg.source);
      
      if (parsed.html) {
        const $ = cheerio.load(parsed.html);
        $('style').remove();
        $('script').remove();
        $('head').remove();
        
        const tables = $('table');
        console.log('Number of tables found:', tables.length);
        
        const bodyText = $.text().replace(/\s+/g, ' ').trim();
        console.log('Cleaned Text Length:', bodyText.length);
        console.log('Cleaned Text Preview (1000 chars):');
        console.log(bodyText.substring(0, 1000));
        
        if (tables.length > 0) {
          console.log('--- FIRST TABLE TEXT ---');
          const firstTable = tables.eq(0);
          console.log(firstTable.text().replace(/\s+/g, ' ').trim().substring(0, 1000));
        }
      } else {
        console.log('No HTML body found!');
      }
    } else {
      console.log('Email not found in IMAP!');
    }
  } finally {
    await lock.release();
    await client.logout();
  }
}
run().catch(console.error);
