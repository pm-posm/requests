import { supabase } from '@/lib/supabase';

export interface RawRequestRecord {
    id?: string;
    request_key: string;
    email: string;
    date_of_rq: string;
    week: string;
    mer: string;
    sr: string;
    store_name: string;
    ess_store_code: string;
    ka: string;
    customer: string;
    loai_rq: string;
    posm: string;
    so_luong: string;
    cat: string;
    brand: string;
    sr_note: string;
    img_overview: string;
    img_detail_01: string;
    img_detail_02: string;
    img_detail_03: string;
    deadline: string;
    phuong_an: string;
    ngay_quick_fix: string;
    link_rq: string;
    status: string;
    tien_do: string;
    title_email_request: string;
    ma_du_an: string;
    supplier: string;
    request_id: string;
    vis_note: string;
    data_responser: string;
    mer_note: string;
    sent_mail_sr: string;
    sheet_row_index: number;
    is_mer_modified?: boolean;
    is_deleted_in_sheet?: boolean;
    created_at?: string;
    updated_at?: string;
}

export const SHEET_COLUMNS = {
    EMAIL: 0,
    DATE_OF_RQ: 1,
    WEEK: 2,
    MER: 3,
    SR: 4,
    STORE_NAME: 5,
    ESS_STORE_CODE: 6,
    KA: 7,
    CUSTOMER: 8,
    LOAI_RQ: 9,
    POSM: 10,
    SO_LUONG: 11,
    CAT: 12,
    BRAND: 13,
    SR_NOTE: 14,
    IMG_OVERVIEW: 15,
    IMG_DETAIL_01: 16,
    IMG_DETAIL_02: 17,
    IMG_DETAIL_03: 18,
    DEADLINE: 19,
    PHUONG_AN: 20,
    NGAY_QUICK_FIX: 21,
    LINK_RQ: 22,
    STATUS: 23,
    TIEN_DO: 24,
    TITLE_EMAIL_REQUEST: 26,
    MA_DU_AN: 27,
    SUPPLIER: 28,
    REQUEST_ID: 29,
    VIS_NOTE: 30,
    DATA_RESPONSER: 31,
    MER_NOTE: 32,
    SENT_MAIL_SR: 33,
} as const;

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU/gviz/tq?tqx=out:csv&sheet=Mer%20View%202026';

// Helper function to robustly parse CSV text with multi-line quote handling
function parseCSV(text: string): string[][] {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c.length > 0)) {
                lines.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        lines.push(currentRow);
    }
    return lines;
}

// Data Sanitizer & Normalizer
function sanitizeText(val: any): string {
    if (val === undefined || val === null) return '';
    return String(val).trim();
}

function sanitizeCode(val: any): string {
    return sanitizeText(val).toUpperCase().replace(/\s+/g, '');
}

export function normalizeDataResponser(val: any): string {
    if (!val) return '';
    let text = String(val).trim();
    if (!text || text === 'null' || text === 'undefined') return '';

    // If it looks like JSON, parse and format case-insensitively
    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && parsed !== null) {
                const list = Array.isArray(parsed) ? parsed : [parsed];
                
                const formattedList = list.map(item => {
                    if (typeof item !== 'object' || item === null) return String(item);
                    
                    const getCase = (keys: string[]) => {
                        for (const k of Object.keys(item)) {
                            if (keys.map(x => x.toLowerCase()).includes(k.toLowerCase())) {
                                return item[k];
                            }
                        }
                        return '';
                    };

                    const email = getCase(['Email', 'email', 'mail']);
                    const title = getCase(['Title', 'title', 'role', 'position']);
                    const response = getCase(['Response', 'response', 'status', 'action', 'result']);
                    const comment = getCase(['Comment', 'comment', 'note', 'reason']);
                    const timeResponse = getCase(['Time_response', 'time_response', 'date', 'time', 'timestamp']);

                    const parts: string[] = [];
                    if (email) parts.push(`Email: ${email}`);
                    if (title) parts.push(`Chức vụ: ${title}`);
                    if (response) parts.push(`Duyệt: ${response}`);
                    if (comment && comment !== '-') parts.push(`Comment: ${comment}`);
                    if (timeResponse) parts.push(`Lúc: ${timeResponse}`);

                    return parts.join(' • ');
                });

                return formattedList.filter(Boolean).join(' | ');
            }
        } catch (e) {
            // keep raw text if JSON parse fails
        }
    }

    return text;
}

export async function fetchAndSyncSheetData(): Promise<{ totalSynced: number; message: string }> {
    try {
        const response = await fetch(SHEET_CSV_URL);
        if (!response.ok) {
            throw new Error(`Không thể kết nối Google Sheet: ${response.statusText}`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length <= 1) {
            return { totalSynced: 0, message: 'File Google Sheet rỗng hoặc không đúng định dạng.' };
        }

        // Header row is index 0
        const dataRows = rows.slice(1);
        const payload: RawRequestRecord[] = [];

        dataRows.forEach((row, idx) => {
            const email = sanitizeText(row[SHEET_COLUMNS.EMAIL]);
            const dateOfRq = sanitizeText(row[SHEET_COLUMNS.DATE_OF_RQ]);
            const week = sanitizeText(row[SHEET_COLUMNS.WEEK]);
            const mer = sanitizeText(row[SHEET_COLUMNS.MER]);
            const sr = sanitizeText(row[SHEET_COLUMNS.SR]);
            const storeName = sanitizeText(row[SHEET_COLUMNS.STORE_NAME]);
            const essStoreCode = sanitizeCode(row[SHEET_COLUMNS.ESS_STORE_CODE]);
            const ka = sanitizeText(row[SHEET_COLUMNS.KA]);
            const customer = sanitizeText(row[SHEET_COLUMNS.CUSTOMER]);
            const loaiRq = sanitizeText(row[SHEET_COLUMNS.LOAI_RQ]);
            const posm = sanitizeText(row[SHEET_COLUMNS.POSM]);
            const soLuong = sanitizeText(row[SHEET_COLUMNS.SO_LUONG]);
            const cat = sanitizeText(row[SHEET_COLUMNS.CAT]);
            const brand = sanitizeText(row[SHEET_COLUMNS.BRAND]);
            const srNote = sanitizeText(row[SHEET_COLUMNS.SR_NOTE]);
            const imgOverview = sanitizeText(row[SHEET_COLUMNS.IMG_OVERVIEW]);
            const imgDetail01 = sanitizeText(row[SHEET_COLUMNS.IMG_DETAIL_01]);
            const imgDetail02 = sanitizeText(row[SHEET_COLUMNS.IMG_DETAIL_02]);
            const imgDetail03 = sanitizeText(row[SHEET_COLUMNS.IMG_DETAIL_03]);
            const deadline = sanitizeText(row[SHEET_COLUMNS.DEADLINE]);
            const rawPhuongAn = sanitizeText(row[SHEET_COLUMNS.PHUONG_AN]);
            let phuongAn = rawPhuongAn || 'Visibility Request';
            if (rawPhuongAn.toLowerCase().includes('bảo hành') || rawPhuongAn.toLowerCase().includes('bao hanh')) {
                phuongAn = 'Supplier Bảo Hành';
            } else if (rawPhuongAn.toLowerCase().includes('quick fix')) {
                phuongAn = 'Mer Quick Fix';
            } else if (rawPhuongAn.toLowerCase().includes('visibility')) {
                phuongAn = 'Visibility Request';
            } else if (rawPhuongAn.toLowerCase().includes('store')) {
                phuongAn = 'Đưa vào RQ by Store';
            } else if (rawPhuongAn.toLowerCase().includes('tuần')) {
                phuongAn = 'Đã đưa vào RQ tuần';
            }

            const ngayQuickFix = sanitizeText(row[SHEET_COLUMNS.NGAY_QUICK_FIX]);
            const linkRq = sanitizeText(row[SHEET_COLUMNS.LINK_RQ]);
            const status = sanitizeText(row[SHEET_COLUMNS.STATUS]) || 'New';
            const tienDo = sanitizeText(row[SHEET_COLUMNS.TIEN_DO]) || 'Not started';
            const titleEmailRequest = sanitizeText(row[SHEET_COLUMNS.TITLE_EMAIL_REQUEST]);
            const maDuAn = sanitizeText(row[SHEET_COLUMNS.MA_DU_AN]);
            const supplier = sanitizeText(row[SHEET_COLUMNS.SUPPLIER]);
            const requestId = sanitizeText(row[SHEET_COLUMNS.REQUEST_ID]);
            const visNote = sanitizeText(row[SHEET_COLUMNS.VIS_NOTE]);
            const rawDataResponser = sanitizeText(row[SHEET_COLUMNS.DATA_RESPONSER]);
            const merNote = sanitizeText(row[SHEET_COLUMNS.MER_NOTE]);
            const sentMailSr = sanitizeText(row[SHEET_COLUMNS.SENT_MAIL_SR]);

            // Skip empty rows
            if (!storeName && !essStoreCode && !email) return;

            // Preserve original SharePoint data_responser JSON/text
            const dataResponser = rawDataResponser;

            const sheetRowIndex = idx + 2;

            // ANCHOR COMPOSITE KEY ALGORITHM: Unique content-based key + Fallback row_X
            // Guarantees 100% row-drift immunity when rows are inserted or deleted in Google Sheet
            const anchorRaw = `${essStoreCode || storeName}_${posm}_${dateOfRq}_${sr}`;
            const cleanAnchorKey = anchorRaw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
            const requestKey = cleanAnchorKey.length > 6 ? cleanAnchorKey : `row_${sheetRowIndex}`;

            payload.push({
                request_key: requestKey,
                email,
                date_of_rq: dateOfRq,
                week,
                mer,
                sr,
                store_name: storeName,
                ess_store_code: essStoreCode,
                ka,
                customer,
                loai_rq: loaiRq,
                posm,
                so_luong: soLuong,
                cat,
                brand,
                sr_note: srNote,
                img_overview: imgOverview,
                img_detail_01: imgDetail01,
                img_detail_02: imgDetail02,
                img_detail_03: imgDetail03,
                deadline,
                phuong_an: phuongAn,
                ngay_quick_fix: ngayQuickFix,
                link_rq: linkRq,
                status,
                tien_do: tienDo,
                title_email_request: titleEmailRequest,
                ma_du_an: maDuAn,
                supplier,
                request_id: requestId,
                vis_note: visNote,
                data_responser: dataResponser,
                mer_note: merNote,
                sent_mail_sr: sentMailSr,
                sheet_row_index: sheetRowIndex,
                is_deleted_in_sheet: false
            });
        });

        if (payload.length === 0) {
            return { totalSynced: 0, message: 'Không tìm thấy dữ liệu hợp lệ.' };
        }

        // Deduplicate payload by request_key to guarantee zero ON CONFLICT collisions
        const safeMap = new Map<string, RawRequestRecord>();
        payload.forEach(item => safeMap.set(item.request_key, item));
        const safePayload = Array.from(safeMap.values());

        // Direct high-performance bulk upsert to guarantee sheet_row_index updates
        const chunkSize = 200;
        for (let i = 0; i < safePayload.length; i += chunkSize) {
            const chunk = safePayload.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('raw_requests')
                .upsert(chunk, { onConflict: 'request_key' });

            if (error) {
                console.error('Lỗi khi đồng bộ dữ liệu vào Supabase:', error);
                throw error;
            }
        }

        // Hard Cleanup of Stale/Duplicate Database Records: 1-to-1 sheet row index cleanup
        try {
            // SAFEGUARD: Do not run Hard Cleanup if safePayload is unexpectedly small (< 50 rows)
            if (safePayload.length < 50) {
                console.warn('⚠️ Bỏ qua bước Hard Cleanup do số lượng dòng nạp từ Google Sheet quá ít (< 50 dòng), nhằm bảo vệ dữ liệu Supabase.');
            } else {
                const { data: existingRecords } = await supabase
                    .from('raw_requests')
                    .select('id, sheet_row_index, request_key');

                if (existingRecords && existingRecords.length > 0) {
                    const activeRowIndexes = new Set(safePayload.map(r => r.sheet_row_index));
                    const idsToDelete: string[] = [];
                    const seenRowIndexesInDb = new Set<number>();

                    for (const rec of existingRecords) {
                        const rowIndex = rec.sheet_row_index;

                        // Case 1: Row index is not in active Google Sheet -> Delete (Orphan)
                        // Case 2: Row index already encountered in DB -> Delete (Duplicate)
                        if (!rowIndex || !activeRowIndexes.has(rowIndex) || seenRowIndexesInDb.has(rowIndex)) {
                            idsToDelete.push(rec.id);
                        } else {
                            seenRowIndexesInDb.add(rowIndex);
                        }
                    }

                    if (idsToDelete.length > 0) {
                        console.log(`🧹 Dọn dẹp ${idsToDelete.length} bản ghi trùng lặp/rác khỏi Database...`);
                        for (let i = 0; i < idsToDelete.length; i += chunkSize) {
                            const chunk = idsToDelete.slice(i, i + chunkSize);
                            const { error: delErr } = await supabase
                                .from('raw_requests')
                                .delete()
                                .in('id', chunk);
                            
                            if (delErr) {
                                console.error('Lỗi khi xóa bản ghi trùng lặp:', delErr);
                            }
                        }
                    }
                }
            }
        } catch (cleanupErr) {
            console.warn('Cảnh báo khi dọn dẹp các dòng trùng lặp rác:', cleanupErr);
        }



        return {
            totalSynced: payload.length,
            message: `Đồng bộ thành công ${payload.length} dòng dữ liệu từ Google Sheet!`
        };


    } catch (err: any) {
        console.error('Error in fetchAndSyncSheetData:', err);
        throw new Error(err.message || 'Đã xảy ra lỗi khi đồng bộ Google Sheet.');
    }
}

const MASTER_CONTACT_CSV_URL = 'https://docs.google.com/spreadsheets/d/1Lct6U-pSOCpGUEGG_uDrjS5joQCJA4UvC66-QrkDKgE/gviz/tq?tqx=out:csv&sheet=01.13.2025';

export async function syncMasterStoreDirectoryFromCSV(): Promise<{ totalSynced: number; message: string }> {
    try {
        const response = await fetch(MASTER_CONTACT_CSV_URL);
        if (!response.ok) {
            throw new Error(`Không thể kết nối Google Sheet Contact: ${response.statusText}`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length <= 1) {
            return { totalSynced: 0, message: 'Sheet Contact rỗng.' };
        }

        const dataRows = rows.slice(1);
        const payload: any[] = [];

        dataRows.forEach(row => {
            const ka = sanitizeText(row[0]);
            const customer = sanitizeText(row[1]);
            const storeCode = sanitizeCode(row[2]);
            const storeName = sanitizeText(row[3]);
            const region = sanitizeText(row[4]);
            const storeLevel = sanitizeText(row[5]);
            const province = sanitizeText(row[6]);
            const district = sanitizeText(row[7]);
            const address = sanitizeText(row[9]);
            const srName = sanitizeText(row[14]);
            const srEmail = sanitizeText(row[16]);
            const srPhone = sanitizeText(row[17]);
            const srPhone2 = sanitizeText(row[18]);
            const opsupName = sanitizeText(row[21]);
            const opsupEmail = sanitizeText(row[22]);
            const merName = sanitizeText(row[26]);

            if (storeCode && storeName) {
                payload.push({
                    store_code: storeCode,
                    store_name: storeName,
                    ka: ka || null,
                    customer: customer || null,
                    region: region || null,
                    store_level: storeLevel || null,
                    province: province || null,
                    district: district || null,
                    address: address || null,
                    sr_name: srName || null,
                    sr: srName || null,
                    sr_email: srEmail || null,
                    sr_phone: srPhone || null,
                    sr_phone_2: srPhone2 || null,
                    opsup_name: opsupName || null,
                    opsup_email: opsupEmail || null,
                    mer_name: merName || null,
                    updated_at: new Date().toISOString()
                });
            }
        });

        if (payload.length === 0) {
            return { totalSynced: 0, message: 'Không tìm thấy dữ liệu hợp lệ.' };
        }

        // Upsert to Supabase in chunks of 500
        const chunkSize = 500;
        let syncedCount = 0;

        for (let i = 0; i < payload.length; i += chunkSize) {
            const chunk = payload.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('master_stores_directory')
                .upsert(chunk, { onConflict: 'store_code' });

            if (error) {
                console.warn('Lỗi khi upsert chunk vào Supabase:', error);
                const basicChunk = chunk.map(item => ({
                    store_code: item.store_code,
                    store_name: item.store_name,
                    ka: item.ka,
                    customer: item.customer,
                    region: item.region,
                    province: item.province,
                    district: item.district,
                    address: item.address,
                    sr_name: item.sr_name,
                    sr_phone: item.sr_phone,
                    mer_name: item.mer_name
                }));
                await supabase.from('master_stores_directory').upsert(basicChunk, { onConflict: 'store_code' });
            }
            syncedCount += chunk.length;
        }

        return {
            totalSynced: syncedCount,
            message: `Đồng bộ thành công ${syncedCount} cửa hàng từ Google Sheet Contact!`
        };
    } catch (err: any) {
        console.error('Error in syncMasterStoreDirectoryFromCSV:', err);
        throw new Error(err.message || 'Lỗi khi đồng bộ Sheet Contact.');
    }
}

export interface MasterStoreContactInfo {
    store_code: string;
    store_name: string;
    ka?: string;
    customer?: string;
    region?: string;
    province?: string;
    district?: string;
    address?: string;
    sr_name?: string;
    sr_email?: string;
    sr_phone?: string;
    sr_phone_2?: string;
    opsup_name?: string;
    opsup_email?: string;
    opsup_phone?: string;
    mer_name?: string;
}

let contactMapCache: Map<string, MasterStoreContactInfo> | null = null;
let lastFetchTime = 0;

export async function getLiveMasterContactMap(forceRefresh = false): Promise<Map<string, MasterStoreContactInfo>> {
    const now = Date.now();
    if (contactMapCache && !forceRefresh && (now - lastFetchTime < 5 * 60 * 1000)) {
        return contactMapCache;
    }

    try {
        const response = await fetch(MASTER_CONTACT_CSV_URL);
        if (!response.ok) return contactMapCache || new Map();

        const csvText = await response.text();
        const rows = parseCSV(csvText);
        const map = new Map<string, MasterStoreContactInfo>();

        const sanitizePhone = (val: any) => {
            const p = sanitizeText(val);
            if (!p || p === '0' || p === '-') return '';
            return p;
        };

        if (rows.length > 1) {
            rows.slice(1).forEach(row => {
                const storeCode = sanitizeCode(row[2]);
                const storeName = sanitizeText(row[3]);
                if (storeCode) {
                    map.set(storeCode.toUpperCase().trim(), {
                        store_code: storeCode,
                        store_name: storeName,
                        ka: sanitizeText(row[0]),
                        customer: sanitizeText(row[1]),
                        region: sanitizeText(row[4]),
                        province: sanitizeText(row[6]),
                        district: sanitizeText(row[7]),
                        address: sanitizeText(row[9]),
                        sr_name: sanitizeText(row[14]),
                        sr_email: sanitizeText(row[16]),
                        sr_phone: sanitizePhone(row[17]),
                        sr_phone_2: sanitizePhone(row[18]),
                        opsup_name: sanitizeText(row[21]),
                        opsup_email: sanitizeText(row[22]),
                        opsup_phone: sanitizePhone(row[23]),
                        mer_name: sanitizeText(row[26])
                    });
                }
            });
        }
        contactMapCache = map;
        lastFetchTime = now;
        return map;
    } catch (e) {
        console.error("Error fetching live contact map:", e);
        return contactMapCache || new Map();
    }
}


