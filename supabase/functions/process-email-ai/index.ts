import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const groqKey = Deno.env.get('GROQ_API_KEY')
    
    if (!groqKey) {
      throw new Error('GROQ_API_KEY is not set')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const payload = await req.json()
    const { sender, subject, content_raw } = payload

    if (!content_raw) {
      throw new Error('Missing email content')
    }

    const systemPrompt = `You are an AI assistant specialized in extracting POSM project progress information from emails.
This specific task focuses on the "Đăng ký thi công" (Construction Registration/Planning) process.

Determine if the email context is related to registering, planning, or announcing a construction/installation plan ("Đăng ký thi công", "Kế hoạch lắp đặt", "Plan thi công", etc.).
If it is NOT related, set "is_registration_email" to false and you can leave other fields null.
If it IS related, set "is_registration_email" to true and extract the details.

Respond ONLY with a valid JSON object matching this schema:
{
  "is_registration_email": boolean,
  "detected_project_code": string | null,
  "detected_project_name": string | null,
  "detected_installation_time": string | null,
  "detected_supplier_name": string | null,
  "detected_stores_info": array of objects | null (e.g. [{"store_code": "...", "store_name": "...", "items": "..."}]),
  "ai_confidence_score": number (0.0 to 1.0)
}`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Email Subject: ${subject}\n\nEmail Content:\n${content_raw}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    })

    const dataFromGroq = await response.json()
    if (dataFromGroq.error) {
      throw new Error(`Groq API error: ${dataFromGroq.error.message}`)
    }

    const extractedData = JSON.parse(dataFromGroq.choices[0].message.content)
    const processingStatus = extractedData.is_registration_email ? 'success' : 'ignored_not_registration'

    const { data, error } = await supabase
      .from('project_progress_ai')
      .insert({
        email_sender: sender || '',
        email_subject: subject || '',
        email_content_raw: content_raw,
        email_received_at: new Date().toISOString(),
        
        detected_project_code: extractedData.detected_project_code,
        detected_project_name: extractedData.detected_project_name,
        detected_installation_time: extractedData.detected_installation_time,
        detected_supplier_name: extractedData.detected_supplier_name,
        detected_stores_info: extractedData.detected_stores_info,
        
        ai_confidence_score: extractedData.ai_confidence_score || 0.0,
        processing_status: processingStatus
      })
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        message: extractedData.is_registration_email ? 'Email processed successfully' : 'Email ignored', 
        data 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing email:', error)
    return new Response(
      JSON.stringify({ error: error.message || error.toString() }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
