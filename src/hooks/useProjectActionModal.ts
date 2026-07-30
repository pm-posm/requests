import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import type { StoreItem, ProjectGroup } from '@/types';
import toast from 'react-hot-toast';

export function useProjectActionModal(projectGroup: ProjectGroup, downloadFileId?: string, setDownloadFileId?: (id?: string) => void) {
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState(!!downloadFileId);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'EXTRACT' | 'MASTER'>('EXTRACT');
    const [selectedFile, setSelectedFile] = useState<{id: string, file_name: string, phase: string} | null>(null);

    // Brief State
    const { data: briefDecision } = useQuery({
        queryKey: ['project_decision', projectGroup.final_project, 'BRIEF'],
        queryFn: async () => {
            const { data } = await supabase
                .from('project_decisions')
                .select('*')
                .eq('final_project', projectGroup.final_project)
                .eq('phase_type', 'BRIEF')
                .maybeSingle();
            return data || null;
        }
    });

    const [briefStatus, setBriefStatus] = useState('');
    useEffect(() => {
        if (briefDecision) {
            setBriefStatus(briefDecision.decision_status || '');
        }
    }, [briefDecision]);

    const saveBriefMutation = useMutation({
        mutationFn: async (status: string) => {
            const { error } = await supabase
                .from('project_decisions')
                .upsert({
                    final_project: projectGroup.final_project,
                    phase_type: 'BRIEF',
                    decision_status: status,
                    updated_by: 'Admin',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'final_project,phase_type' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_decision', projectGroup.final_project, 'BRIEF'] });
            toast.success('Lưu Brief thành công!');
        },
        onError: (err: any) => {
            toast.error('Lỗi khi lưu Brief: ' + err.message);
        }
    });

    // Excel Parsing State
    const [headers, setHeaders] = useState<string[]>([]);
    const [excelRows, setExcelRows] = useState<any[][]>([]);
    const [rawExcelRows, setRawExcelRows] = useState<any[][]>([]);
    const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
    const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(true);
    
    const [globalSupplier, setGlobalSupplier] = useState('');
    const { data: suppliers = [] } = useQuery<any[]>({
        queryKey: ['project_suppliers'],
        queryFn: async () => {
            const { data } = await supabase.from('project_suppliers').select('*').order('name', { ascending: true });
            return data || [];
        }
    });
    
    const [mapping, setMapping] = useState<Record<string, number>>({
        store_code: -1, store_name: -1, region: -1, customer: -1, ka: -1, sr: -1, category: -1, supplier_name: -1, notes: -1
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Filter all excel files from all phases
    const allExcelFiles = useMemo(() => {
        const files: any[] = [];
        projectGroup.activities.forEach(act => {
            if (act.activity_attachments) {
                act.activity_attachments.forEach(att => {
                    if (att.file_name.toLowerCase().endsWith('.xlsx') || att.file_name.toLowerCase().endsWith('.xls')) {
                        files.push({ ...att, phase: act.phase_type });
                    }
                });
            }
        });
        return files;
    }, [projectGroup]);

    useEffect(() => {
        if (!downloadFileId) return;

        // Giải mã downloadFileId: nếu là UUID (id bảng Supabase), tìm drive_file_id thực sự hoặc bóc tách từ drive_url
        let targetDriveId = downloadFileId;
        const matchedFile = allExcelFiles.find(f => f.id === downloadFileId || f.drive_file_id === downloadFileId);
        if (matchedFile) {
            setSelectedFile(matchedFile);
            if (matchedFile.drive_file_id && matchedFile.drive_file_id.length > 20 && !matchedFile.drive_file_id.includes('-')) {
                targetDriveId = matchedFile.drive_file_id;
            } else if (matchedFile.drive_url) {
                const extracted = matchedFile.drive_url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || matchedFile.drive_url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
                if (extracted) targetDriveId = extracted;
            }
        }

        if (!targetDriveId || targetDriveId.includes('-') || targetDriveId.length < 15) {
            toast.error('File này chưa được lưu Mã Google Drive (Drive File ID) hợp lệ.');
            setDownloading(false);
            return;
        }

        const downloadAndParse = async () => {
            setDownloading(true);
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                // 1. Lấy Access Token từ Edge Function
                const tokenRes = await fetch(`${supabaseUrl}/functions/v1/download-drive-file?mode=token`, {
                    headers: { 
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey 
                    }
                });
                
                const tokenText = await tokenRes.text();
                if (!tokenRes.ok || tokenText.trim().startsWith('<')) {
                    throw new Error('Dịch vụ Google Drive Token chưa sẵn sàng. Hãy thử lại sau ít phút.');
                }

                let tokenData: any;
                try {
                    tokenData = JSON.parse(tokenText);
                } catch {
                    throw new Error('Dữ liệu xác thực từ máy chủ không đúng định dạng JSON.');
                }

                if (!tokenData.token) throw new Error('Mã Access Token Google Drive rỗng.');

                // 2. Tải trực tiếp file từ Google Drive API
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${targetDriveId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${tokenData.token}` }
                });

                if (!response.ok) {
                    throw new Error(`Google Drive trả về lỗi HTTP ${response.status}. File có thể đã bị xóa trên Drive.`);
                }

                const blob = await response.blob();
                const textPreview = await blob.slice(0, 100).text();

                if (textPreview.trim().startsWith('<')) {
                    throw new Error('File trên Google Drive bị phản hồi trang HTML thay vì file Excel.');
                }

                const buffer = await blob.arrayBuffer();
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
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

        downloadAndParse();
    }, [downloadFileId, allExcelFiles]);

    useEffect(() => {
        if (rawExcelRows.length === 0) return;
        const headersList = rawExcelRows[headerRowIdx] ? rawExcelRows[headerRowIdx].map((h, i) => String(h || `Cột ${i + 1}`).trim()) : [];
        setHeaders(headersList);
        setExcelRows(rawExcelRows.slice(headerRowIdx + 1));

        const autoMap: Record<string, number> = { store_code: -1, store_name: -1, region: -1, customer: -1, ka: -1, sr: -1, category: -1, supplier_name: -1, notes: -1 };
        headersList.forEach((h, idx) => {
            if (!h) return;
            const hl = String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (hl.includes('store code') || hl.includes('ma ch')) autoMap.store_code = idx;
            else if (hl.includes('ten sieu thi') || hl.includes('ten ch')) autoMap.store_name = idx;
            else if (hl.includes('region') || hl.includes('vung')) autoMap.region = idx;
            else if (hl.includes('customer')) autoMap.customer = idx;
            else if (hl.includes('ka')) autoMap.ka = idx;
            else if (hl.includes('sr') && !hl.includes('hang muc')) autoMap.sr = idx;
            else if (hl.includes('hang muc') || hl.includes('category')) autoMap.category = idx;
            else if (hl.includes('nha thau') || hl.includes('supplier')) autoMap.supplier_name = idx;
            else if (hl.includes('ghi chu') || hl.includes('note')) autoMap.notes = idx;
        });
        if (autoMap.store_code === -1) {
            const fallbackIdx = headersList.findIndex(h => h && String(h).toLowerCase().includes('store'));
            autoMap.store_code = fallbackIdx !== -1 ? fallbackIdx : 0;
        }
        setMapping(autoMap);
    }, [rawExcelRows, headerRowIdx]);

    const { data: storeItems } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', projectGroup.final_project],
        queryFn: async () => {
            const { data } = await supabase.from('project_store_items').select('*').eq('final_project', projectGroup.final_project);
            return data as StoreItem[] || [];
        }
    });

    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const allValidRows = useMemo(() => {
        return excelRows.map((row, idx) => ({ row, originalIdx: idx })).filter(({ row }) => {
            if (!row || row.length === 0) return false;
            
            const code = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
            const name = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
            
            if (mapping.store_name !== -1 && !name) return false;
            if (mapping.store_code !== -1 && mapping.store_name === -1 && !code) return false;

            const lowerCode = code.toLowerCase();
            const lowerName = name.toLowerCase();
            if (lowerCode.includes('tổng cộng') || lowerCode.includes('total') || lowerName.includes('tổng cộng') || lowerName.includes('total')) return false;

            return true;
        });
    }, [excelRows, mapping.store_code, mapping.store_name]);

    const { newRows, existingRows } = useMemo(() => {
        const newR: typeof allValidRows = [];
        const existingR: typeof allValidRows = [];
        allValidRows.forEach(item => {
            const code = mapping.store_code !== -1 && item.row[mapping.store_code] ? String(item.row[mapping.store_code]).trim() : '';
            const name = mapping.store_name !== -1 && item.row[mapping.store_name] ? String(item.row[mapping.store_name]).trim() : '';
            
            let effectiveCode = code;
            if (!effectiveCode && name) {
                const safeName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                effectiveCode = 'CH-' + safeName.substring(0, 15); 
            }

            if (effectiveCode && storeItems?.find((s: any) => s.store_code === effectiveCode || (s.store_code && s.store_code.startsWith(effectiveCode)))) {
                existingR.push(item);
            } else {
                newR.push(item);
            }
        });
        return { newRows: newR, existingRows: existingR };
    }, [allValidRows, mapping.store_code, mapping.store_name, storeItems]);

    useEffect(() => {
        const newSet = new Set<number>();
        newRows.forEach(r => newSet.add(r.originalIdx));
        setSelectedRows(newSet);
    }, [newRows.length]); 

    const toggleRow = (idx: number) => {
        const next = new Set(selectedRows);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedRows(next);
    };

    const handleImportAll = async () => {
        if (mapping.store_code === -1 && mapping.store_name === -1) { 
            toast.error('Vui lòng ánh xạ ít nhất cột Mã Cửa Hàng hoặc Tên Cửa Hàng!'); 
            return; 
        }
        if (selectedRows.size === 0) { toast.error('Vui lòng chọn ít nhất 1 cửa hàng để import!'); return; }
        setLoading(true);
        try {
            const payloadMap = new Map();
            excelRows.filter((_, idx) => selectedRows.has(idx)).forEach(row => {
                const storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                
                let f_storeCode = storeCode;
                if (!f_storeCode) {
                    if (storeName) {
                        const safeName = storeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                        f_storeCode = 'CH-' + safeName.substring(0, 15) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                    } else {
                        f_storeCode = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    }
                }

                if (!payloadMap.has(f_storeCode)) {
                    const mappedPhase = selectedFile?.phase === 'SURVEY' ? 'Khảo sát' :
                                        selectedFile?.phase === 'INSTALLATION' ? 'Lắp đặt' :
                                        selectedFile?.phase === 'ACCEPTANCE' ? 'NTXX' : 'Brief';
                    
                    payloadMap.set(f_storeCode, {
                        final_project: projectGroup.final_project,
                        store_name: storeName || undefined,
                        region: mapping.region !== -1 && row[mapping.region] ? String(row[mapping.region]).trim() : undefined,
                        customer: mapping.customer !== -1 && row[mapping.customer] ? String(row[mapping.customer]).trim() : undefined,
                        ka: mapping.ka !== -1 && row[mapping.ka] ? String(row[mapping.ka]).trim() : undefined,
                        sr: mapping.sr !== -1 && row[mapping.sr] ? String(row[mapping.sr]).trim() : undefined,
                        category: mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM',
                        supplier_name: globalSupplier || (mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined),
                        notes: mapping.notes !== -1 && row[mapping.notes] ? String(row[mapping.notes]).trim() : undefined,
                        is_published: false,
                        store_code: f_storeCode,
                        survey_data: { current_phase: mappedPhase }
                    });
                }
            });
            const payload = Array.from(payloadMap.values());
            if (payload.length === 0) throw new Error('Không có dòng hợp lệ.');
            const { error } = await supabase.from('project_store_items').upsert(payload, { onConflict: 'final_project,store_code' });
            if (error) throw error;
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
            setTimeout(() => setSuccess(false), 2000);
        } catch (err: any) { 
            toast.error('Lỗi import: ' + err.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return {
        downloading,
        activeTab, setActiveTab,
        selectedFile, setSelectedFile,
        briefStatus, setBriefStatus,
        saveBriefMutation,
        headers, excelRows, headerRowIdx,
        showAdvancedMapping, setShowAdvancedMapping,
        globalSupplier, setGlobalSupplier, suppliers,
        mapping, setMapping,
        loading, success,
        allExcelFiles,
        storeItems,
        selectedRows, setSelectedRows,
        allValidRows, newRows, existingRows,
        toggleRow, handleImportAll
    };
}
