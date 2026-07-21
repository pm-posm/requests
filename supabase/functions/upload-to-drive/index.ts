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
    const formData = await req.formData()
    const file = formData.get('file') as File
    const finalProject = formData.get('final_project') as string
    const subfolderName = formData.get('subfolder_name') as string | null
    
    if (!file || !finalProject) {
      throw new Error('Thiếu file hoặc final_project')
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

    // BƯỚC 1: Tìm Folder ID của dự án
    const q = `mimeType='application/vnd.google-apps.folder' and name contains '${finalProject}' and trashed=false`
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`
    
    const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
    })
    const searchData = await searchRes.json()
    const folders = searchData.files || []
    
    if (folders.length === 0) {
        throw new Error(`Không tìm thấy thư mục Drive cho dự án ${finalProject}`)
    }
    let targetFolderId = folders[0].id

    // BƯỚC 1.5: Nếu có subfolder_name, tìm hoặc tạo subfolder
    if (subfolderName) {
        const subQ = `mimeType='application/vnd.google-apps.folder' and name='${subfolderName}' and '${targetFolderId}' in parents and trashed=false`
        const subSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQ)}&fields=files(id)`
        const subSearchRes = await fetch(subSearchUrl, { headers: { 'Authorization': `Bearer ${tokenInfo.token}` } })
        const subSearchData = await subSearchRes.json()
        const subFolders = subSearchData.files || []

        if (subFolders.length > 0) {
            targetFolderId = subFolders[0].id
        } else {
            // Create subfolder
            const createUrl = 'https://www.googleapis.com/drive/v3/files?fields=id'
            const createRes = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenInfo.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: subfolderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [targetFolderId]
                })
            })
            const createData = await createRes.json()
            if (createData.id) {
                targetFolderId = createData.id
            }
        }
    }

    // BƯỚC 2: Upload File lên Folder (Multipart Upload)
    const boundary = 'foo_bar_baz'
    const metadata = {
        name: file.name,
        parents: [targetFolderId]
    }
    
    const fileBuffer = await file.arrayBuffer()
    const fileUint8 = new Uint8Array(fileBuffer)
    
    // Xây dựng body multipart
    const encoder = new TextEncoder()
    const parts = [
        encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
        encoder.encode(`--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`),
        fileUint8,
        encoder.encode(`\r\n--${boundary}--`)
    ]
    
    const totalLength = parts.reduce((acc, part) => acc + part.length, 0)
    const body = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) {
        body.set(part, offset)
        offset += part.length
    }

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name'
    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenInfo.token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': body.length.toString()
        },
        body: body
    })

    if (!uploadRes.ok) {
        const errText = await uploadRes.text()
        throw new Error(`Lỗi upload Google Drive: ${errText}`)
    }

    const uploadedFile = await uploadRes.json()

    return new Response(JSON.stringify({ 
        drive_file_id: uploadedFile.id,
        drive_url: uploadedFile.webViewLink,
        file_name: uploadedFile.name
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
