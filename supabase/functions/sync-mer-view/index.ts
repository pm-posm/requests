import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GoogleAuth } from "npm:google-auth-library@9.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utils (migrated from regex.ts)
function normalizeEmpty(value: any): string {
    if (value === null || value === undefined) return "";
    return value.toString().trim();
}

function normalizeProjectName(name: string): string {
    if (!name) return "";
    let n = name.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    n = n.replace(/^(?:\[.*?\]\s*)+/, "");
    n = n.replace(/^(?:Re|Fwd|FW|Tr\.)\s*:\s*/ig, "");
    n = n.replace(/^(?:\[.*?\]\s*|-*\s*)*(?:GỬI LỊCH|TRẢ KẾT QUẢ|ĐĂNG KÝ LỊCH|YÊU CẦU|ĐỀ NGHỊ|GỬI|APPROVE|CẤP)?\s*(?:KHẢO SÁT|LẮP ĐẶT|THIẾT KẾ|BRIEF|PO|BÁO GIÁ|THU HỒI|BẢO HÀNH|SỬA CHỮA|THI CÔNG|SẢN XUẤT|NTXX)\s*[-:]*\s*/i, "");
    n = n.replace(/^(?:Yêu cầu\s*:?\s*)/i, "");
    n = n.replace(/^[^\w\d]*(POSM|THI CÔNG|SẢN XUẤT|THIẾT KẾ)[^\w\d]*/i, "");
    n = n.replace(/^[^\w\d]+/g, ""); 
    return n.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SPREADSHEET_ID = Deno.env.get("MER_VIEW_SPREADSHEET_ID");
    const GOOGLE_CREDS_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SPREADSHEET_ID || !GOOGLE_CREDS_JSON || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing essential environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Google Token
    const auth = new GoogleAuth({
      credentials: JSON.parse(GOOGLE_CREDS_JSON),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) throw new Error("Could not get Google Access Token");

    // Fetch Sheets Data
    const RANGE = encodeURIComponent('Mer View 2026!A2:AZ');
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;
    
    const res = await fetch(sheetsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const sheetData = await res.json();
    const rows = sheetData.values;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No data found in Google Sheets.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (new URL(req.url).searchParams.get('debug') === 'headers') {
        return new Response(JSON.stringify({ headers: rows[0] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processedCount = 0;
    const projectArray = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        const source_key = normalizeEmpty(row[27]).replace(/[\.,\s]/g, "");
        const request_id = normalizeEmpty(row[29]);
        const project_name_raw = normalizeEmpty(row[26]);
        
        const store_name = normalizeEmpty(row[5]);
        const store_code = normalizeEmpty(row[6]);

        const mer = normalizeEmpty(row[3]);
        const sr = normalizeEmpty(row[4]);

        const sr_note = normalizeEmpty(row[14]);
        const plan_option = normalizeEmpty(row[20]);
        const status = normalizeEmpty(row[23]);
        const progress_note_source = normalizeEmpty(row[24]);
        let supplier = normalizeEmpty(row[28]);
        const lowerSupplier = supplier.toLowerCase();
        if (lowerSupplier.includes('sơn decal') || lowerSupplier.includes('son decal') || lowerSupplier === 'sdc') {
            supplier = 'SDC';
        } else if (lowerSupplier.includes('liên tứ') || lowerSupplier.includes('lien tu') || lowerSupplier.includes('link4')) {
            supplier = 'Link4';
        } else if (lowerSupplier.includes('infinity') || lowerSupplier.includes('vô cực') || lowerSupplier.includes('vo cuc') || lowerSupplier === 'inf') {
            supplier = 'INF';
        } else if (lowerSupplier.includes('cát thiên minh') || lowerSupplier.includes('cat thien minh') || lowerSupplier === 'ctm') {
            supplier = 'CTM';
        }

        const vis_note = normalizeEmpty(row[30]);
        // Cột B làm request_date
        const request_date = normalizeEmpty(row[1]);
        
        let responsersRaw = normalizeEmpty(row[31]);
        if (!responsersRaw.startsWith('[')) responsersRaw = normalizeEmpty(row[32]);
        if (!responsersRaw.startsWith('[')) responsersRaw = "";

        const sheet_row_index = i + 2;
        
        const isRowEmpty = Object.values({source_key, request_id, project_name_raw, store_name, store_code, mer, sr, sr_note, plan_option, status, progress_note_source, supplier, vis_note, responsersRaw}).every(v => !v);
        if (isRowEmpty) continue;

        const normalized_project_name = normalizeProjectName(project_name_raw);
        
        let formattedResponsersText = null;
        if (responsersRaw) {
            try {
                const parsedResponsers = JSON.parse(responsersRaw);
                if (Array.isArray(parsedResponsers) && parsedResponsers.length > 0) {
                    formattedResponsersText = parsedResponsers.map((r: any) => {
                        let email = r.Email || r.email || "";
                        email = email.replace("@unilever.com", "");
                        const title = r.Title || r.title || "";
                        const resp = r.Response || r.response || "";
                        const time = r.Time_response || r.time_response || "";
                        const comment = r.Comment || r.comment || "";
                        
                        let text = `[${title}] ${email}: ${resp}`;
                        if (time && time !== "-") text += ` (${time})`;
                        if (comment && comment !== "-") text += ` - Comment: ${comment}`;
                        return text;
                    }).join("\n");
                }
            } catch(e) {}
        }

        projectArray.push({
            request_id: request_id || null,
            source_key: source_key || null,
            source_project_name: project_name_raw,
            normalized_project_name: normalized_project_name,
            store_code: store_code,
            store_name: store_name,
            sheet_row_index: sheet_row_index,
            mer: mer,
            sr: sr,
            sr_note: sr_note,
            plan_option: plan_option,
            status: status,
            progress_note_source: progress_note_source,
            supplier: supplier,
            vis_note: vis_note,
            data_responser: formattedResponsersText,
            responsersRaw: responsersRaw,
            request_date: request_date
        });
    }

    const { data: allExisting } = await supabase.from('posm_projects').select('id, request_id, source_key, normalized_project_name, sheet_row_index, store_code');
    const existingList = allExisting || [];

    const bulkUpdateList = [];
    const bulkInsertList = [];
    const responsersMap = new Map();

    for (let idx = 0; idx < projectArray.length; idx++) {
        const proj = projectArray[idx];
        const responsersRaw = proj.responsersRaw;
        delete proj.responsersRaw;

        let existingIdx = -1;
        if (proj.request_id) {
            existingIdx = existingList.findIndex(e => e.request_id === proj.request_id);
        } else if (proj.source_key) {
            existingIdx = existingList.findIndex(e => e.source_key === proj.source_key);
        } else if (proj.normalized_project_name) {
            existingIdx = existingList.findIndex(e => e.normalized_project_name === proj.normalized_project_name);
        }

        if (existingIdx === -1 && !proj.request_id && !proj.source_key && !proj.normalized_project_name) {
            existingIdx = existingList.findIndex(e => e.sheet_row_index === proj.sheet_row_index && e.store_code === proj.store_code);
        }

        if (existingIdx !== -1) {
            const existing = existingList[existingIdx];
            proj.id = existing.id;
            bulkUpdateList.push(proj);
            existingList.splice(existingIdx, 1);
        } else {
            bulkInsertList.push(proj);
        }
        
        if (responsersRaw) {
            responsersMap.set(proj.sheet_row_index, responsersRaw);
        }
    }

    let upsertedData: any[] = [];

    if (bulkUpdateList.length > 0) {
        const { data, error } = await supabase.from('posm_projects')
            .upsert(bulkUpdateList)
            .select('id, sheet_row_index');
            
        if (error) throw new Error("Lỗi Bulk Update: " + error.message);
        if (data) upsertedData = upsertedData.concat(data);
    }

    if (bulkInsertList.length > 0) {
        const { data, error } = await supabase.from('posm_projects')
            .insert(bulkInsertList)
            .select('id, sheet_row_index');
            
        if (error) throw new Error("Lỗi Bulk Insert: " + error.message);
        if (data) upsertedData = upsertedData.concat(data);
    }

    processedCount = upsertedData.length;

    if (upsertedData.length > 0) {
        const allUpsertedIds = upsertedData.map(d => d.id);
            
        await supabase.from('posm_project_responsers').delete().in('project_id', allUpsertedIds);

        const responsersToInsert: any[] = [];
        for (const d of upsertedData) {
            const raw = responsersMap.get(d.sheet_row_index);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                            for (const r of parsed) {
                                responsersToInsert.push({
                                    project_id: d.id,
                                    email: r.Email || r.email || null,
                                    title: r.Title || r.title || null,
                                    response: r.Response || r.response || null,
                                    comment: r.Comment || r.comment || null,
                                    time_response: r.Time_response || r.time_response || null
                                });
                            }
                        }
                    } catch(e) {}
                }
            }

        if (responsersToInsert.length > 0) {
            await supabase.from('posm_project_responsers').insert(responsersToInsert);
        }
    }
    let deletedCount = 0;
    if (existingList.length > 0) {
        const idsToDelete = existingList.map((e: any) => e.id);
        await supabase.from('posm_project_responsers').delete().in('project_id', idsToDelete);
        const { error: deleteError } = await supabase.from('posm_projects').delete().in('id', idsToDelete);
        if (deleteError) throw new Error("Lỗi xóa rác: " + deleteError.message);
        deletedCount = idsToDelete.length;
    }

    return new Response(JSON.stringify({ success: true, message: `Đồng bộ thành công! Cập nhật ${processedCount} dòng, dọn dẹp ${deletedCount} dòng cũ.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
