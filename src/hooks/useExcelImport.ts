import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import type { StoreItem, ProjectGroup } from '@/types';
import toast from 'react-hot-toast';

export type ColumnMapping = {
    store_code: number;
    store_name: number;
    region: number;
    customer: number;
    ka: number;
    sr: number;
    category: number;
    supplier_name: number;
    vis_tech: number;
};

const defaultMapping: ColumnMapping = {
    store_code: -1, store_name: -1, region: -1, customer: -1,
    ka: -1, sr: -1, category: -1, supplier_name: -1, vis_tech: -1,
};

function detectHeaderRow(rows: any[][]): number {
    let bestRow = 0;
    let maxScore = -1;
    const limit = Math.min(rows.length, 15);
    for (let r = 0; r < limit; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        let score = 0;
        row.forEach(cell => {
            if (!cell) return;
            const s = String(cell).toLowerCase().trim();
            if (s === 'stt' || s === 'no.') score += 2;
            if (s.includes('store code') || s.includes('mã ch')) score += 5;
            if (s.includes('store name') || s.includes('tên ch') || s.includes('tên siêu thị')) score += 4;
            if (s.includes('hạng mục') || s.includes('posm')) score += 3;
        });
        if (score > maxScore) { maxScore = score; bestRow = r; }
    }
    return maxScore > 0 ? bestRow : 0;
}

function autoDetectMapping(headers: string[]): ColumnMapping {
    const m = { ...defaultMapping };
    headers.forEach((h, idx) => {
        if (!h) return;
        const n = String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (n.includes('store code') || n === 'ma ch' || n.includes('ma cua hang')) m.store_code = idx;
        else if (n.includes('ten sieu thi') || n.includes('ten ch') || n.includes('store name') || n.includes('ten cua hang')) m.store_name = idx;
        else if (n === 'region' || n.includes('vung') || n.includes('mien')) m.region = idx;
        else if (n === 'customer' || n.includes('khach hang')) m.customer = idx;
        else if (n === 'ka') m.ka = idx;
        else if (n === 'sr' || n === 'nhan vien kd' || n === 'nvkd') m.sr = idx;
        else if (n.includes('hang muc') || n === 'category') m.category = idx;
        else if (n.includes('nha thau') || n.includes('supplier')) m.supplier_name = idx;
        else if (n === 'mer' || n.includes('vis-tech') || n.includes('vis tech')) m.vis_tech = idx;
    });
    // Fallback for store_code
    if (m.store_code === -1) {
        const fb = headers.findIndex(h => h && String(h).toLowerCase().includes('store'));
        m.store_code = fb !== -1 ? fb : (headers.length > 0 ? 0 : -1);
    }
    return m;
}

export function useExcelImport(
    projectGroup: ProjectGroup,
    downloadFileId?: string,
    setDownloadFileId?: (id?: string) => void
) {
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState(!!downloadFileId);
    const [rawExcelRows, setRawExcelRows] = useState<any[][]>([]);
    const [headerRowIdx, setHeaderRowIdx] = useState(0);
    const [headers, setHeaders] = useState<string[]>([]);
    const [excelRows, setExcelRows] = useState<any[][]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
    const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ id: string; file_name: string; phase: string } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [masterStoreMap, setMasterStoreMap] = useState<Map<string, any>>(new Map());

    const allFiles = useMemo(() => {
        const files: any[] = [];
        projectGroup.activities.forEach(act => {
            if (act.activity_attachments) {
                act.activity_attachments.forEach(att => {
                    files.push({ ...att, phase: act.phase_type });
                });
            }
        });
        return files;
    }, [projectGroup]);

    const { data: storeItems } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', projectGroup.final_project],
        queryFn: async () => {
            const { data } = await supabase.from('project_store_items').select('*').eq('final_project', projectGroup.final_project);
            return (data as StoreItem[]) || [];
        }
    });

    useEffect(() => {
        if (downloadFileId && !selectedFile) {
            const info = allFiles.find(f => f.id === downloadFileId || f.drive_file_id === downloadFileId);
            if (info) setSelectedFile(info);
        }
    }, [downloadFileId, allFiles]);

    // Download and parse Excel
    useEffect(() => {
        if (!downloadFileId) return;
        const run = async () => {
            setDownloading(true);
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const tokenRes = await fetch(`${supabaseUrl}/functions/v1/download-drive-file?mode=token`, {
                    headers: { 
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey 
                    }
                });
                const tokenCT = tokenRes.headers.get('content-type') || '';
                const tokenText = await tokenRes.text();
                if (!tokenRes.ok || !tokenCT.includes('application/json') || tokenText.trim().startsWith('<')) {
                    throw new Error(`Không lấy được mã xác thực Google Drive (HTTP ${tokenRes.status}).`);
                }
                const tokenData = JSON.parse(tokenText);
                if (!tokenData.token) throw new Error('Access Token Google Drive rỗng.');

                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${downloadFileId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });
                if (!response.ok) {
                    throw new Error(`Không tải được tệp từ Google Drive (${response.status}). File có thể đã bị xóa hoặc không có quyền.`);
                }
                const driveCT = response.headers.get('content-type') || '';
                if (driveCT.includes('text/html')) {
                    throw new Error('Google Drive trả về trang lỗi HTML. File có thể không còn tồn tại.');
                }
                const buffer = await response.arrayBuffer();
                const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                if (rawRows.length === 0) throw new Error('File Excel rỗng!');
                setRawExcelRows(rawRows);
                setHeaderRowIdx(detectHeaderRow(rawRows));
            } catch (err: any) {
                toast.error('Lỗi đọc file: ' + err.message);
                setDownloadFileId && setDownloadFileId(undefined);
            } finally {
                setDownloading(false);
            }
        };
        run();
    }, [downloadFileId]);

    // Parse headers and auto-map when raw rows change
    useEffect(() => {
        if (rawExcelRows.length === 0) return;
        const headersList = rawExcelRows[headerRowIdx]
            ? rawExcelRows[headerRowIdx].map((h, i) => String(h || `Cột ${i + 1}`).trim())
            : [];
        setHeaders(headersList);
        setExcelRows(rawExcelRows.slice(headerRowIdx + 1));
        setMapping(autoDetectMapping(headersList));
    }, [rawExcelRows, headerRowIdx]);

    // Fetch master store data for auto-fill
    useEffect(() => {
        if (excelRows.length === 0 || mapping.store_code === -1) return;
        
        const fetchMasterData = async () => {
            const codes = new Set<string>();
            excelRows.forEach(row => {
                const code = row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                if (code) codes.add(code);
            });
            const uniqueCodes = Array.from(codes);
            if (uniqueCodes.length === 0) return;

            const map = new Map<string, any>();
            const chunkSize = 200;
            for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
                const chunk = uniqueCodes.slice(i, i + chunkSize);
                const { data } = await supabase
                    .from('master_stores_directory')
                    .select('*')
                    .in('store_code', chunk);
                if (data) {
                    data.forEach(item => map.set(item.store_code, item));
                }
            }
            setMasterStoreMap(map);
        };
        fetchMasterData();
    }, [excelRows, mapping.store_code]);

    // Derived: all valid, new, existing rows
    const allValidRows = useMemo(() => {
        return excelRows.map((row, idx) => ({ row, originalIdx: idx })).filter(({ row }) => {
            if (!row || row.length === 0) return false;
            const code = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
            const name = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
            if (mapping.store_name !== -1 && !name) return false;
            if (mapping.store_code !== -1 && mapping.store_name === -1 && !code) return false;
            const lc = (code + name).toLowerCase();
            if (lc.includes('tổng cộng') || lc.includes('total')) return false;
            return true;
        }).map(item => {
            const code = mapping.store_code !== -1 && item.row[mapping.store_code] ? String(item.row[mapping.store_code]).trim() : '';
            const mData = code ? masterStoreMap.get(code) : undefined;
            const enrichedData = mData ? { ...mData, vis_tech: mData.mer_name } : undefined;
            return { ...item, enrichedData };
        });
    }, [excelRows, mapping.store_code, mapping.store_name, masterStoreMap]);

    const getEffectiveCode = (row: any[]) => {
        const code = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (code) return code;
        const name = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
        if (name) {
            const safe = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return 'CH-' + safe.substring(0, 15);
        }
        return '';
    };

    const { newRows, existingRows } = useMemo(() => {
        const newR: typeof allValidRows = [];
        const existingR: typeof allValidRows = [];
        allValidRows.forEach(item => {
            const code = getEffectiveCode(item.row);
            if (code && storeItems?.find(s => s.store_code === code)) {
                existingR.push(item);
            } else {
                newR.push(item);
            }
        });
        return { newRows: newR, existingRows: existingR };
    }, [allValidRows, storeItems, mapping.store_code, mapping.store_name]);

    useEffect(() => {
        const s = new Set<number>();
        newRows.forEach(r => s.add(r.originalIdx));
        setSelectedRows(s);
    }, [newRows.length]);

    const toggleRow = (idx: number) => {
        const next = new Set(selectedRows);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        setSelectedRows(next);
    };

    // Determine phase from file type
    const mappedPhaseFromFile = (filePhase?: string) => {
        if (filePhase === 'SURVEY') return 'Khảo sát';
        if (filePhase === 'INSTALLATION') return 'Lắp đặt';
        if (filePhase === 'ACCEPTANCE') return 'NTXX';
        return 'Brief';
    };

    const handleImportAll = async (overridePhase?: string) => {
        if (mapping.store_code === -1 && mapping.store_name === -1) {
            toast.error('Vui lòng ánh xạ ít nhất cột Mã Cửa Hàng hoặc Tên Cửa Hàng!');
            return;
        }
        if (selectedRows.size === 0) { toast.error('Vui lòng chọn ít nhất 1 cửa hàng!'); return; }
        setLoading(true);
        try {
            const payloadMap = new Map<string, any>();
            excelRows.filter((_, idx) => selectedRows.has(idx)).forEach(row => {
                const storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                let f_code = storeCode;
                if (!f_code) {
                    if (storeName) {
                        const safe = storeName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        f_code = 'CH-' + safe.substring(0, 15) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                    } else {
                        f_code = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    }
                }
                const enrichedData = storeCode ? masterStoreMap.get(storeCode) : undefined;
                const mapRow = (item: any) => {
                    const row = item.row;
                    const code = getEffectiveCode(row);
                    const mData = item.enrichedData;
                    
                    const excelVisTech = mapping.vis_tech !== -1 && row[mapping.vis_tech] ? String(row[mapping.vis_tech]).trim() : '';
                    const finalVisTech = excelVisTech || (mData?.mer_name ? String(mData.mer_name) : '');

                    return {
                        id: mData?.id || crypto.randomUUID(),
                        store_code: code,
                        store_name: mData?.store_name || (mapping.store_name !== -1 ? String(row[mapping.store_name]).trim() : ''),
                        region: mapping.region !== -1 && row[mapping.region] ? String(row[mapping.region]).trim() : (mData?.region || ''),
                        customer: mapping.customer !== -1 && row[mapping.customer] ? String(row[mapping.customer]).trim() : (mData?.customer || ''),
                        ka: mapping.ka !== -1 && row[mapping.ka] ? String(row[mapping.ka]).trim() : (mData?.ka || ''),
                        sr: mapping.sr !== -1 && row[mapping.sr] ? String(row[mapping.sr]).trim() : (mData?.sr || ''),
                        category: mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : '',
                        supplier_name: mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : '',
                        vis_tech: finalVisTech,
                        current_phase: overridePhase || mappedPhaseFromFile(selectedFile?.phase),
                        final_project: projectGroup.final_project,
                        is_published: false
                    };
                };
                if (!payloadMap.has(f_code)) {
                    payloadMap.set(f_code, mapRow({ row, enrichedData }));
                }
            });
            const payload = Array.from(payloadMap.values());
            if (payload.length === 0) throw new Error('Không có dòng hợp lệ.');
            const { error } = await supabase.from('project_store_items').upsert(payload, { onConflict: 'final_project,store_code' });
            if (error) throw error;
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
            setTimeout(() => setSuccess(false), 2500);
        } catch (err: any) {
            toast.error('Lỗi import: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        downloading, selectedFile, setSelectedFile,
        allFiles, storeItems,
        headers, excelRows, headerRowIdx, setHeaderRowIdx,
        showAdvancedMapping, setShowAdvancedMapping,
        mapping, setMapping,
        allValidRows, newRows, existingRows,
        selectedRows, setSelectedRows,
        toggleRow, handleImportAll,
        loading, success,
    };
}
