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
    const url = new URL(req.url)
    const fileId = url.searchParams.get('fileId')
    const mode = url.searchParams.get('mode')

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

    if (mode === 'token') {
        return new Response(JSON.stringify({ token: tokenInfo.token }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    if (!fileId) {
      throw new Error('Thiếu tham số fileId')
    }

    const fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    const driveRes = await fetch(fetchUrl, {
        headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
    })
    
    if (!driveRes.ok) {
        const errText = await driveRes.text()
        console.error("Google Drive API Error:", errText)
        throw new Error(`Lỗi từ Google Drive: ${driveRes.statusText}`)
    }

    const fileBuffer = await driveRes.arrayBuffer()

    return new Response(fileBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="drive_file_${fileId}.xlsx"`,
      },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
