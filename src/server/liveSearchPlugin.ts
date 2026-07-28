import type { Plugin } from 'vite';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import url from 'url';

dotenv.config({ path: '.env.local' });

const {
  IMAP_USER,
  IMAP_PASSWORD,
  IMAP_HOST,
  IMAP_PORT,
  IMAP_TLS,
  GROQ_API_KEY,
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY
} = process.env;

const defaultSupabaseUrl = "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const targetUrl = (VITE_SUPABASE_URL && VITE_SUPABASE_URL.startsWith('http')) ? VITE_SUPABASE_URL : defaultSupabaseUrl;
const targetKey = VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;

const supabase = createClient(targetUrl, targetKey);

async function processEmailWithAI(sender: string, subject: string, textContent: string, retryCount = 0): Promise<any> {
  const systemPrompt = `You are an AI assistant specialized in extracting POSM project progress information from emails.
  This task focuses on tracking the entire POSM project lifecycle: Survey, Brief, NTXX (Factory Acceptance), Installation, and Completion.
  
  CRITICAL:
  1. If the email is completely unrelated (e.g., "thu nhập", "bidding", personal emails), set "is_target_email" to false and return.
  2. If the email relates to POSM progress, set "is_target_email" to true and extract the details.
  3. The most important fields are "detected_project_code" and "detected_project_name".
  4. Determine "email_type" exactly as one of the following strings:
     - "survey_registration"
     - "survey_result"
     - "brief_confirmed"
     - "ntxx"
     - "installation_registration"
     - "completion_report"
     - "request_posm"
     - "field_force_request"
  
  Respond ONLY with a valid JSON object matching this schema:
  {
    "is_target_email": boolean,
    "email_type": "survey_registration" | "survey_result" | "brief_confirmed" | "ntxx" | "installation_registration" | "completion_report" | "request_posm" | "field_force_request" | null,
    "detected_project_code": string | null,
    "detected_project_name": string | null,
    "detected_installation_time": string | null,
    "detected_supplier_name": string | null,
    "detected_stores_info": array of objects | null,
    "ai_confidence_score": number
  }`;

  const truncatedContent = textContent.length > 8000 ? textContent.substring(0, 8000) + '\\n...[TRUNCATED]' : textContent;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Email Subject: ${subject}\n\nEmail Content:\n${truncatedContent}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    const data = await response.json();
    if ((data as any).error) {
      if ((data as any).error.message.includes('Rate limit') && retryCount < 5) {
        // Parse the wait time from error message, e.g., "Please try again in 31.83s."
        const match = (data as any).error.message.match(/try again in ([\d\.]+)s/);
        const waitSeconds = match ? parseFloat(match[1]) : 5;
        const waitMs = Math.ceil(waitSeconds * 1000) + 1000; // add 1 second padding
        
        console.log(`[API] Rate limit reached. Waiting ${waitMs}ms before retry ${retryCount + 1}...`);
        await new Promise(r => setTimeout(r, waitMs));
        return processEmailWithAI(sender, subject, textContent, retryCount + 1);
      }
      throw new Error((data as any).error.message);
    }
    return JSON.parse((data as any).choices[0].message.content);
  } catch (err: any) {
    if (err.message?.includes('Rate limit') && retryCount < 5) {
      const match = err.message.match(/try again in ([\d\.]+)s/);
      const waitSeconds = match ? parseFloat(match[1]) : 5;
      const waitMs = Math.ceil(waitSeconds * 1000) + 1000;
      
      console.log(`[API] Rate limit reached. Waiting ${waitMs}ms before retry ${retryCount + 1}...`);
      await new Promise(r => setTimeout(r, waitMs));
      return processEmailWithAI(sender, subject, textContent, retryCount + 1);
    }
    throw err;
  }
}

export function liveSearchPlugin(): Plugin {
  return {
    name: 'live-search-api',
    configureServer(server) {
      server.middlewares.use('/api/live-search', async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url || '', true);
          const reqId = parsedUrl.query.reqId as string;
          
          if (!reqId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing reqId' }));
            return;
          }

          console.log(`[API] Live Search requested for reqId: ${reqId}`);
          
          const client = new ImapFlow({
            host: IMAP_HOST || '',
            port: parseInt(IMAP_PORT || '993', 10),
            secure: IMAP_TLS !== 'false',
            auth: { user: IMAP_USER || '', pass: IMAP_PASSWORD || '' },
            logger: false
          });

          await client.connect();
          const lock = await client.getMailboxLock('INBOX');
          
          const results = [];
          
          try {
            // Find emails that match the requested ID in subject or body
            const messages = client.fetch({ or: [{ subject: reqId }, { body: reqId }] }, { source: true, envelope: true });
            
            for await (let msg of messages) {
              if (!msg.envelope || !msg.source) continue;
              const parsed: any = await simpleParser(msg.source as any);
              const subject = parsed.subject || '(Không có tiêu đề)';
              const sender = parsed.from?.text || '(Không rõ người gửi)';
              const contentRaw = parsed.text || '';
              const emailDate = msg.envelope.date?.toISOString() || new Date().toISOString();

              console.log(`[API] Found email: ${subject}`);
              
              // Process via AI
              const extractedData = await processEmailWithAI(sender, subject, contentRaw);
              
              const record = {
                email_sender: sender,
                email_subject: subject,
                email_content_raw: contentRaw,
                email_received_at: emailDate,
                detected_project_code: extractedData.detected_project_code || null,
                detected_project_name: extractedData.detected_project_name || null,
                detected_installation_time: extractedData.detected_installation_time || null,
                detected_supplier_name: extractedData.detected_supplier_name || null,
                detected_stores_info: extractedData.detected_stores_info || null,
                detected_status: extractedData.email_type || null,
                ai_confidence_score: extractedData.ai_confidence_score || 0.0,
                processing_status: extractedData.is_target_email ? 'success_from_live' : 'raw_saved'
              };
              
              // Push to local array
              results.push(record);
              
              // Also save to Supabase asynchronously
              supabase.from('project_progress_ai').insert(record).then(({error}) => {
                if (error) console.error('[API] Failed to save to Supabase:', error.message);
              });
            }
          } finally {
            lock.release();
            await client.logout();
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: results }));
          
        } catch (error: any) {
          console.error('[API] Live Search error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}
