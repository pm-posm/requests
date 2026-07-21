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
    const finalProject = url.searchParams.get('final_project')
    const phaseType = url.searchParams.get('phase_type')
    
    if (!finalProject) {
      throw new Error('Thiếu tham số final_project')
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

    // Tiêu chí tìm kiếm: Tên thư mục chứa mã dự án, và là một thư mục
    const q = `mimeType='application/vnd.google-apps.folder' and name contains '${finalProject}' and trashed=false`
    const fetchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`
    
    const driveRes = await fetch(fetchUrl, {
        headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
    })
    
    if (!driveRes.ok) {
        const errText = await driveRes.text()
        throw new Error(`Google Drive API error: ${errText}`)
    }

    const data = await driveRes.json()
    const files = data.files || []
    
    if (files.length === 0) {
        // Không tìm thấy thư mục nào
        return new Response(JSON.stringify({ folder_url: null, folder_id: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Nếu tìm thấy, chọn thư mục đầu tiên
    const folder = files[0]

    return new Response(JSON.stringify({ 
        folder_url: folder.webViewLink,
        folder_id: folder.id,
        folder_name: folder.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
