import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { OAuth2Client } from 'npm:google-auth-library@9.6.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_id } = await req.json()

    if (!file_id) {
        throw new Error('Thiếu file_id')
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_REFRESH_TOKEN')
    }

    const client = new OAuth2Client(clientId, clientSecret)
    client.setCredentials({ refresh_token: refreshToken })
    
    const tokenInfo = await client.getAccessToken()
    if (!tokenInfo.token) {
        throw new Error('Không thể làm mới Access Token từ Refresh Token')
    }

    const fetchUrl = `https://www.googleapis.com/drive/v3/files/${file_id}`
    const driveRes = await fetch(fetchUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
    })
    
    if (!driveRes.ok) {
        // Nếu file không tồn tại (404), vẫn coi như thành công
        if (driveRes.status !== 404) {
            const errText = await driveRes.text()
            console.error("Google Drive API Error:", errText)
            throw new Error(`Lỗi từ Google Drive: ${driveRes.statusText}`)
        }
    }

    return new Response(JSON.stringify({ success: true, message: 'Đã xóa file' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
