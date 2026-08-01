import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
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

function autoDetectMapping(headers: string[], projectKey?: string): ColumnMapping {
    if (projectKey) {
        try {
            const saved = localStorage.getItem(`posm_mapping_memory_${projectKey}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    return { ...defaultMapping, ...parsed };
                }
            }
        } catch (e) {
            console.warn('Mapping memory read error:', e);
        }
    }

    const m = { ...defaultMapping };
    headers.forEach((h, idx) => {
        if (!h) return;
        const n = String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (m.store_code === -1 && (n.includes('store code') || n === 'ma ch' || n.includes('ma cua hang') || n.includes('ma diem ban') || n === 'code')) m.store_code = idx;
        else if (m.store_name === -1 && (n.includes('ten sieu thi') || n.includes('ten ch') || n.includes('store name') || n.includes('ten cua hang') || n.includes('ten diem ban'))) m.store_name = idx;
        else if (m.region === -1 && (n === 'region' || n.includes('vung') || n.includes('mien') || n === 'kv')) m.region = idx;
        else if (m.customer === -1 && (n === 'customer' || n.includes('khach hang'))) m.customer = idx;
        else if (m.ka === -1 && (n === 'ka' || n.includes('kenh ka'))) m.ka = idx;
        else if (m.sr === -1 && (n === 'sr' || n.includes('nhan vien kd') || n.includes('nvkd') || n.includes('sales'))) m.sr = idx;
        else if (m.category === -1 && (n.includes('hang muc') || n === 'category' || n.includes('vat tu'))) m.category = idx;
        else if (m.supplier_name === -1 && (n.includes('nha thau') || n.includes('supplier'))) m.supplier_name = idx;
        else if (m.vis_tech === -1 && (n === 'mer' || n.includes('vis-tech') || n.includes('vis tech') || n.includes('ky thuat'))) m.vis_tech = idx;
    });
    // Fallback for store_code
    if (m.store_code === -1) {
        const fb = headers.findIndex(h => h && String(h).toLowerCase().includes('store'));
        m.store_code = fb !== -1 ? fb : (headers.length > 0 ? 0 : -1);
    }
    return m;
}

export function saveMappingMemory(projectKey: string, mapping: ColumnMapping) {
    localStorage.setItem(`posm_mapping_memory_${projectKey}`, JSON.stringify(mapping));
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
                const tokenRes = await fetch(`${supabaseUrl}/functions/v1/download-drive-file?mode=token`, {
                    headers: { 
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey 
                    }
                });
                const tokenText = await tokenRes.text();
                if (!tokenRes.ok || tokenText.trim().startsWith('<')) {
                    throw new Error(`Không lấy được mã xác thực Google Drive (HTTP ${tokenRes.status}).`);
                }
                
                let tokenData: any;
                try {
                    tokenData = JSON.parse(tokenText);
                } catch {
                    throw new Error('Dữ liệu xác thực không phải JSON.');
                }
                
                if (!tokenData?.token) {
                    throw new Error(tokenData?.error || 'Access Token Google Drive rỗng.');
                }
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
        setMapping(autoDetectMapping(headersList, projectGroup.final_project));
    }, [rawExcelRows, headerRowIdx, projectGroup.final_project]);

    // Fetch master store data for auto-fill
    useEffect(() => {
        if (excelRows.length === 0) return;
        
        const fetchMasterData = async () => {
            const codes = new Set<string>();
            const names = new Set<string>();
            excelRows.forEach(row => {
                const code = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                const name = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                if (code && isNaN(Number(code))) codes.add(code.toUpperCase());
                if (name && name.length >= 2) names.add(name.trim());
            });

            const map = new Map<string, any>();

            // 1. Fetch by store_code
            const uniqueCodes = Array.from(codes);
            if (uniqueCodes.length > 0) {
                const chunkSize = 200;
                for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
                    const chunk = uniqueCodes.slice(i, i + chunkSize);
                    const { data } = await supabase
                        .from('master_stores_directory')
                        .select('*')
                        .in('store_code', chunk);
                    if (data) {
                        data.forEach(item => {
                            if (item.store_code) map.set(item.store_code.toUpperCase(), item);
                        });
                    }
                }
            }

            // 2. Fetch by store_name
            const validNames = Array.from(names).filter(n => !['stt', 'mã số đh', 'tên siêu thị', 'hạng mục', 'cột 1', 'cột 2'].includes(n.toLowerCase()));
            if (validNames.length > 0) {
                const orExpr = validNames.slice(0, 30).map(n => `store_name.ilike.%${n}%`).join(',');
                const { data: nameData } = await supabase
                    .from('master_stores_directory')
                    .select('*')
                    .or(orExpr);

                if (nameData) {
                    nameData.forEach(item => {
                        if (!item.store_name) return;
                        const norm = item.store_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (!map.has('NAME:' + norm)) map.set('NAME:' + norm, item);
                        if (item.store_code && !map.has(item.store_code.toUpperCase())) map.set(item.store_code.toUpperCase(), item);
                    });
                }
            }

            setMasterStoreMap(map);
        };
        fetchMasterData();
    }, [excelRows, mapping.store_code, mapping.store_name]);

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
            const rawCode = mapping.store_code !== -1 && item.row[mapping.store_code] ? String(item.row[mapping.store_code]).trim() : '';
            const rawName = mapping.store_name !== -1 && item.row[mapping.store_name] ? String(item.row[mapping.store_name]).trim() : '';

            let mData = (rawCode && isNaN(Number(rawCode))) ? masterStoreMap.get(rawCode.toUpperCase()) : undefined;
            if (!mData && rawName) {
                const normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
                mData = masterStoreMap.get('NAME:' + normName);
            }

            const enrichedData = mData ? { ...mData, vis_tech: mData.mer_name || mData.sr } : undefined;
            return { ...item, enrichedData };
        });
    }, [excelRows, mapping.store_code, mapping.store_name, masterStoreMap]);

    const getEffectiveCode = (row: any[]) => {
        const rawCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (rawCode && isNaN(Number(rawCode))) return rawCode;

        const name = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
        if (name) {
            const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const mData = masterStoreMap.get('NAME:' + normName);
            if (mData?.store_code) return mData.store_code;

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

    const mappedPhaseFromFile = (filePhase?: string) => {
        if (filePhase === 'SURVEY') return 'Khảo sát';
        if (filePhase === 'INSTALLATION') return 'Lắp đặt';
        if (filePhase === 'ACCEPTANCE') return 'NTXX';
        return 'Brief';
    };

    const handleImportAll = async (overridePhase?: string, rowOverrides?: Record<number, any>) => {
        if (mapping.store_code === -1 && mapping.store_name === -1) {
            toast.error('Vui lòng ánh xạ ít nhất cột Mã Cửa Hàng hoặc Tên Cửa Hàng!');
            return;
        }
        if (selectedRows.size === 0) {
            toast.error('Vui lòng chọn ít nhất 1 cửa hàng để import!');
            return;
        }
        setLoading(true);
        try {
            const payloadMap = new Map();
            const targetPhase = overridePhase || mappedPhaseFromFile(selectedFile?.phase);

            allValidRows.filter(r => selectedRows.has(r.originalIdx)).forEach(item => {
                const row = item.row;
                const override = rowOverrides?.[item.originalIdx] || {};

                const rawCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                const rawStoreName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                const enriched = item.enrichedData;

                let masterData = override.masterData || enriched;
                if (!masterData) {
                    if (rawCode && isNaN(Number(rawCode))) {
                        masterData = masterStoreMap.get(rawCode.toUpperCase());
                    }
                    if (!masterData && rawStoreName) {
                        const normName = rawStoreName.toLowerCase().replace(/[^a-z0-9]/g, '');
                        masterData = masterStoreMap.get('NAME:' + normName);
                    }
                }

                const storeCode = override.store_code || (rawCode && isNaN(Number(rawCode)) ? rawCode : (masterData?.store_code || ''));
                const storeName = override.store_name || rawStoreName || masterData?.store_name || '';
                const region = override.region || (mapping.region !== -1 && row[mapping.region] ? String(row[mapping.region]).trim() : (masterData?.region || undefined));
                const customer = override.customer || (mapping.customer !== -1 && row[mapping.customer] ? String(row[mapping.customer]).trim() : (masterData?.customer || undefined));
                const ka = override.ka || (mapping.ka !== -1 && row[mapping.ka] ? String(row[mapping.ka]).trim() : (masterData?.ka || undefined));
                const sr = override.sr || (mapping.sr !== -1 && row[mapping.sr] ? String(row[mapping.sr]).trim() : (masterData?.sr || undefined));
                const category = override.category || (mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM');
                const supplierName = override.supplier_name || (mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined);
                const visTech = override.vis_tech || (mapping.vis_tech !== -1 && row[mapping.vis_tech] ? String(row[mapping.vis_tech]).trim() : (masterData?.mer_name || masterData?.sr || undefined));

                let f_storeCode = storeCode;
                if (!f_storeCode) {
                    if (storeName) {
                        const safeName = storeName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        f_storeCode = 'CH-' + safeName.substring(0, 15) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                    } else {
                        f_storeCode = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    }
                }

                if (!payloadMap.has(f_storeCode)) {
                    payloadMap.set(f_storeCode, {
                        final_project: projectGroup.final_project,
                        store_name: storeName || undefined,
                        region,
                        customer,
                        ka,
                        sr,
                        category,
                        supplier_name: supplierName,
                        vis_tech: visTech,
                        is_published: false,
                        store_code: f_storeCode,
                        current_phase: targetPhase,
                        survey_data: { current_phase: targetPhase }
                    });
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
