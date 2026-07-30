import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { OAuth2Client } from 'npm:google-auth-library@9.6.3'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PHASE_FOLDER_MAP: Record<string, string> = {
  'BRIEF': 'Brief',
  'SURVEY': 'Khảo sát',
  'NTXX': 'Nghiệm thu Xuất xưởng',
  'ACCEPTANCE': 'Nghiệm thu Xuất xưởng',
  'INSTALLATION': 'Lắp đặt'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { activity_id, final_project, new_phase_type } = await req.json()

    if (!activity_id || !new_phase_type) {
      throw new Error('Thiếu tham số activity_id hoặc new_phase_type')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Cập nhật Database Supabase (Có fallback ACCEPTANCE nếu Enum không có NTXX)
    let { error: actErr } = await supabase
      .from('project_activities')
      .update({ phase_type: new_phase_type })
      .eq('id', activity_id)

    if (actErr && actErr.message.includes('enum') && new_phase_type === 'NTXX') {
      const fb = await supabase
        .from('project_activities')
        .update({ phase_type: 'ACCEPTANCE' })
        .eq('id', activity_id)
      actErr = fb.error
    }

    if (actErr) throw new Error(`Lỗi update DB activities: ${actErr.message}`)

    const { data: attachments } = await supabase
      .from('activity_attachments')
      .select('*')
      .eq('activity_id', activity_id)

    if (attachments && attachments.length > 0) {
      let { error: attErr } = await supabase
        .from('activity_attachments')
        .update({ phase_type: new_phase_type })
        .eq('activity_id', activity_id)

      if (attErr && attErr.message.includes('enum') && new_phase_type === 'NTXX') {
        await supabase
          .from('activity_attachments')
          .update({ phase_type: 'ACCEPTANCE' })
          .eq('activity_id', activity_id)
      }
    }

    // 2. Chuyển File trên Google Drive (nếu có cấu hình Drive & final_project)
    let driveMovedCount = 0
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

    if (clientId && clientSecret && refreshToken && final_project && attachments && attachments.length > 0) {
      try {
        const client = new OAuth2Client(clientId, clientSecret)
        client.setCredentials({ refresh_token: refreshToken })
        const tokenInfo = await client.getAccessToken()

        if (tokenInfo.token) {
          const accessToken = tokenInfo.token
          const targetSubfolderName = PHASE_FOLDER_MAP[new_phase_type] || new_phase_type

          // Tìm Folder ID dự án
          const q = `mimeType='application/vnd.google-apps.folder' and name contains '${final_project}' and trashed=false`
          const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`
          const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
          const searchData = await searchRes.json()
          const folders = searchData.files || []

          if (folders.length > 0) {
            const projectFolderId = folders[0].id

            // Tìm hoặc tạo subfolder Giai đoạn mới
            const subQ = `mimeType='application/vnd.google-apps.folder' and name contains '${targetSubfolderName}' and '${projectFolderId}' in parents and trashed=false`
            const subSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQ)}&fields=files(id)`
            const subRes = await fetch(subSearchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
            const subData = await subRes.json()
            const subFolders = subData.files || []

            let targetFolderId = projectFolderId
            if (subFolders.length > 0) {
              targetFolderId = subFolders[0].id
            } else {
              // Tạo subfolder mới trên Drive
              const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: targetSubfolderName,
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [projectFolderId]
                })
              })
              const createData = await createRes.json()
              if (createData.id) {
                targetFolderId = createData.id
              }
            }

            // Chuyển từng file đính kèm sang targetFolderId
            for (const att of attachments) {
              if (att.drive_file_id && att.drive_file_id !== 'unknown') {
                const fileMetaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${att.drive_file_id}?fields=parents`, {
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                })
                if (fileMetaRes.ok) {
                  const fileMeta = await fileMetaRes.json()
                  const oldParents = (fileMeta.parents || []).join(',')

                  const moveUrl = `https://www.googleapis.com/drive/v3/files/${att.drive_file_id}?addParents=${targetFolderId}&removeParents=${oldParents}&fields=id,parents`
                  const moveRes = await fetch(moveUrl, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                  })
                  if (moveRes.ok) {
                    driveMovedCount++
                  }
                }
              }
            }
          }
        }
      } catch (driveErr) {
        console.error('Lỗi di chuyển file trên Drive (vẫn lưu DB thành công):', driveErr)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Đã chuyển sang giai đoạn ${new_phase_type}`,
      drive_files_moved: driveMovedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
