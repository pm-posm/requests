import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

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
            throw new Error('Không thể lấy Access Token từ Google')
        }

        // Cấu hình Google Sheet
        const sheetId = '1Lct6U-pSOCpGUEGG_uDrjS5joQCJA4UvC66-QrkDKgE'
        const range = '01.13.2025!A2:AA'

        const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
        const sheetRes = await fetch(sheetUrl, {
            headers: { 'Authorization': `Bearer ${tokenInfo.token}` }
        })

        if (!sheetRes.ok) {
            const err = await sheetRes.text()
            throw new Error(`Lỗi khi đọc Google Sheet: ${err}`)
        }

        const sheetData = await sheetRes.json()
        const rows = sheetData.values || []

        if (rows.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: 'Google Sheet không có dữ liệu' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const parsedData = rows.map((row: any[]) => {
            return {
                ka: row[0] || null,           
                customer: row[1] || null,     
                store_code: row[2] || '',     
                store_name: row[3] || '',     
                region: row[4] || null,       
                store_level: row[5] || null,  
                province: row[6] || null,     
                district: row[7] || null,     
                sr: row[14] || null,          // Cột O (Index 14)
                sr_email: row[16] || null,    // Cột Q (Index 16)
                sr_phone: row[17] || null,    // Cột R (Index 17)
                mer_name: row[26] || null,    // Cột AA (Index 26)
            }
        }).filter((r: any) => r.store_code && r.store_name) // Chỉ lấy các dòng có mã CH và Tên CH

        if (parsedData.length > 0) {
            // Upsert vào Supabase (chia nhỏ nếu mảng quá lớn, nhưng Supabase upsert thường cân được ~10k dòng/lần)
            const chunkSize = 1000
            for (let i = 0; i < parsedData.length; i += chunkSize) {
                const chunk = parsedData.slice(i, i + chunkSize)
                const { error } = await supabase
                    .from('master_stores_directory')
                    .upsert(chunk, { onConflict: 'store_code' })

                if (error) throw error
            }
        }
        
        return new Response(
            JSON.stringify({ success: true, count: parsedData.length, message: `Đã đồng bộ ${parsedData.length} cửa hàng` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
