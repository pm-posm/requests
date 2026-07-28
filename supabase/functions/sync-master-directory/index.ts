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

        // Cấu hình Google Sheet Contact (01.13.2025)
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
                sr_name: row[14] || null,        // Cột O (Index 14 - SR Name)
                sr_email: row[16] || null,       // Cột Q (Index 16 - SR Email)
                sr_phone: row[17] || null,       // Cột R (Index 17 - SR Phone 1)
                sr_phone_2: row[18] || null,     // Cột S (Index 18 - SR Phone 2)
                opsup_name: row[21] || null,     // Cột V (Index 21 - OPSUP Name)
                opsup_email: row[22] || null,    // Cột W (Index 22 - OPSUP Email)
                mer_name: row[26] || null,       // Cột AA (Index 26 - Merchandiser)
            }
        }).filter((r: any) => r.store_code && r.store_name)

        if (parsedData.length > 0) {
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
