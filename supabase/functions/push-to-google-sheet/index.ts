import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { OAuth2Client } from 'npm:google-auth-library@9.6.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateItem {
    sheetRowIndex: number;
    phuongAn?: string;
    ngayQuickFix?: string;
    status?: string;
    tienDo?: string;
    supplier?: string;
    requestId?: string;
    merNote?: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verify User Authentication Token
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: 'Truy cập bị từ chối: Yêu cầu đăng nhập xác thực.' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authErr } = await supabaseClient.auth.getUser()
        if (authErr || !user) {
            return new Response(
                JSON.stringify({ success: false, error: 'Xác thực thất bại: Token không hợp lệ hoặc đã hết hạn.' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Parse & Validate Payload Inputs
        const body = await req.json()
        const rawUpdates: UpdateItem[] = body.updates || []

        // Strict range & integer validation for sheetRowIndex (must be between row 2 and 100,000)
        const updates = rawUpdates.filter(u => 
            typeof u.sheetRowIndex === 'number' && 
            Number.isInteger(u.sheetRowIndex) && 
            u.sheetRowIndex >= 2 && 
            u.sheetRowIndex <= 100000
        )

        if (updates.length === 0) {
            return new Response(
                JSON.stringify({ success: true, count: 0, message: 'Không có dữ liệu hợp lệ cần đẩy.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
        const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
        const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

        let accessToken = ''

        if (clientId && clientSecret && refreshToken) {
            const client = new OAuth2Client(clientId, clientSecret)
            client.setCredentials({ refresh_token: refreshToken })
            const tokenInfo = await client.getAccessToken()
            accessToken = tokenInfo.token || ''
        }

        const sheetId = '1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU'
        const sheetName = 'Mer View 2026'

        // Build Google Sheets API Batch Update data payload
        const batchData: any[] = []

        updates.forEach(u => {
            const row = u.sheetRowIndex
            if (!row || row < 2) return

            if (u.phuongAn !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!U${row}`,
                    values: [[u.phuongAn]]
                })
            }
            if (u.ngayQuickFix !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!V${row}`,
                    values: [[u.ngayQuickFix]]
                })
            }
            if (u.status !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!X${row}`,
                    values: [[u.status]]
                })
            }
            if (u.tienDo !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!Y${row}`,
                    values: [[u.tienDo]]
                })
            }
            if (u.supplier !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!AC${row}`,
                    values: [[u.supplier]]
                })
            }
            if (u.requestId !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!AD${row}`,
                    values: [[u.requestId]]
                })
            }
            if (u.merNote !== undefined) {
                batchData.push({
                    range: `'${sheetName}'!AK${row}`,
                    values: [[u.merNote]]
                })
            }
        })

        if (batchData.length === 0) {
            return new Response(
                JSON.stringify({ success: true, count: 0, message: 'Không có ô dữ liệu nào thay đổi.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (accessToken) {
            // Call Google Sheets API batchUpdate values
            const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`
            const batchRes = await fetch(batchUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueInputOption: 'USER_ENTERED',
                    data: batchData
                })
            })

            if (!batchRes.ok) {
                const errText = await batchRes.text()
                console.error("Google Sheet Batch Update Error:", errText)
                throw new Error(`Lỗi từ Google Sheets API: ${errText}`)
            }

            const batchResult = await batchRes.json()
            return new Response(
                JSON.stringify({ 
                    success: true, 
                    count: updates.length, 
                    totalCellsUpdated: batchData.length,
                    message: `Đã đẩy tự động ${updates.length} dòng (${batchData.length} ô) về Google Sheet Source!` 
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
            // Fallback response if Google Auth is missing
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    isSheetUpdated: false,
                    count: updates.length, 
                    message: `Đã lưu trên Dashboard & Supabase (Cảnh báo: Chưa cấu hình Google OAuth Write Token trên Supabase Secrets để tự động đẩy về Google Sheet).` 
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error: any) {
        console.error("push-to-google-sheet error:", error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
