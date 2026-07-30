import React from 'react';
import * as XLSX from 'xlsx';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useExcelUploader(
    projectGroup: any, 
    phaseType: string, 
    downloadFileId: string | null, 
    setDownloadFileId?: (id: string | null) => void,
    onClose?: () => void
) {
    const queryClient = useQueryClient();
    
    const [downloading, setDownloading] = React.useState(!!downloadFileId);
    const [rawExcelRows, setRawExcelRows] = React.useState<any[][]>([]);
    const [headerRowIdx, setHeaderRowIdx] = React.useState<number>(0);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [excelRows, setExcelRows] = React.useState<any[][]>([]);
    
    const [mapping, setMapping] = React.useState<Record<string, number>>({
        store_code: -1,
        store_name: -1,
        category: -1,
        supplier_name: -1,
        notes: -1
    });

    const detectHeaderRow = (rows: any[][]) => {
        let bestRowIdx = 0;
        let maxScore = 0;
        
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const row = rows[r];
            if (!row || !Array.isArray(row)) continue;
            let score = 0;
            
            row.forEach(cell => {
                if (!cell) return;
                const str = String(cell).toLowerCase().trim();
                if (str === 'stt' || str === 'no.') score += 2;
                if (str.includes('store code') || str.includes('store_code') || str.includes('mã ch') || str.includes('mã cửa hàng') || str.includes('storeid') || str.includes('site id')) score += 5;
                if (str.includes('store name') || str.includes('store_name') || str.includes('tên ch') || str.includes('tên cửa hàng') || str.includes('tên siêu thị') || str.includes('siêu thị')) score += 4;
                if (str.includes('khách hàng') || str.includes('khach hang') || str.includes('area') || str.includes('khu vực')) score += 2;
                if (str.includes('hạng mục') || str.includes('posm') || str.includes('item') || str.includes('loại')) score += 3;
                if (str.includes('nhà thầu') || str.includes('supplier') || str.includes('vendor') || str.includes('đơn vị') || str.includes('thầu')) score += 3;
                if (str.includes('thi công') || str.includes('ngày') || str.includes('lịch') || str.includes('tiến độ')) score += 2;
            });
            
            if (score > maxScore) {
                maxScore = score;
                bestRowIdx = r;
            }
        }
        
        return maxScore > 0 ? bestRowIdx : 0;
    };

    // Effect to auto-update headers and excel data rows when raw rows or header row index changes
    React.useEffect(() => {
        if (rawExcelRows.length === 0) return;

        const headersList = rawExcelRows[headerRowIdx]
            ? rawExcelRows[headerRowIdx].map((h, i) => String(h || `Cột ${i + 1}`).trim())
            : [];
        setHeaders(headersList);
        
        // Data starts from the row immediately after the header row
        setExcelRows(rawExcelRows.slice(headerRowIdx + 1));

        // Auto mapping algorithm
        const autoMap: Record<string, number> = {
            store_code: -1,
            store_name: -1,
            category: -1,
            supplier_name: -1,
            notes: -1
        };

        headersList.forEach((h, idx) => {
            if (!h) return;
            const hl = String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            if (hl.includes('storecode') || hl.includes('store code') || hl.includes('store_code') || hl.includes('site id') || hl.includes('ma ch') || hl.includes('ma cua hang') || hl.includes('ma store') || hl.includes('essstorecode')) {
                autoMap.store_code = idx;
            } else if (hl.includes('ten sieu thi') || hl.includes('ten ch') || hl.includes('ten cua hang') || hl.includes('ten store') || hl.includes('store name') || hl.includes('store_name') || hl.includes('site name') || hl.includes('sieu thi')) {
                autoMap.store_name = idx;
            } else if (hl.includes('hang muc') || hl.includes('category') || hl.includes('posm') || hl.includes('item') || hl.includes('loai') || hl.includes('cat')) {
                autoMap.category = idx;
            } else if (hl.includes('nha thau') || hl.includes('supplier') || hl.includes('vendor') || hl.includes('don vi') || hl.includes('thau') || hl.includes('agency')) {
                autoMap.supplier_name = idx;
            } else if (hl.includes('ghi chu') || hl.includes('note') || hl.includes('y kien') || hl.includes('luu y')) {
                autoMap.notes = idx;
            }
        });

        if (autoMap.store_code === -1) {
            const fallbackIdx = headersList.findIndex(h => {
                if (!h) return false;
                const hl = String(h).toLowerCase();
                return hl.includes('store') || hl.includes('code') || hl.includes('ch') || hl.includes('mã');
            });
            autoMap.store_code = fallbackIdx !== -1 ? fallbackIdx : 0;
        }

        setMapping(autoMap);
    }, [rawExcelRows, headerRowIdx]);

    const handleMapChange = (field: string, colIdx: number) => {
        setMapping(prev => ({ ...prev, [field]: colIdx }));
    };

    React.useEffect(() => {
        if (!downloadFileId) return;

        const downloadAndParse = async () => {
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
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (rawRows.length === 0) {
                    throw new Error('File Excel rỗng!');
                }

                setRawExcelRows(rawRows);
                const detectedIdx = detectHeaderRow(rawRows);
                setHeaderRowIdx(detectedIdx);
            } catch (err: any) {
                alert('Lỗi đọc file Excel từ Drive: ' + err.message);
                if (onClose) onClose();
            } finally {
                setDownloading(false);
            }
        };

        downloadAndParse();
    }, [downloadFileId]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setDownloading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('final_project', projectGroup.final_project);
            
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
                body: formData
            });
            
            if (res.ok) {
                const uploadData = await res.json();
                
                const { data: actData, error: actErr } = await supabase.from('project_activities').insert({
                    final_project: projectGroup.final_project,
                    key_project: projectGroup.key_project || '',
                    name_project: projectGroup.name_project || '',
                    phase_type: phaseType,
                    title_mail: '[Manual] File tải lên từ Dashboard',
                    sender: 'Admin',
                    date: new Date().toISOString()
                }).select().single();
                
                if (!actErr && actData) {
                    await supabase.from('activity_attachments').insert({
                        activity_id: actData.id,
                        file_name: uploadData.file_name || selectedFile.name,
                        drive_file_id: uploadData.drive_file_id,
                        drive_url: uploadData.drive_url,
                        is_manual_upload: true
                    });
                    
                    queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
                    queryClient.invalidateQueries({ queryKey: ['project_activities'] });
                    
                    if (setDownloadFileId) {
                        setDownloadFileId(uploadData.drive_file_id);
                    }
                }
            } else {
                console.warn('Lỗi upload file lên Google Drive, bạn cần cấu hình GOOGLE_PRIVATE_KEY trong Supabase Edge Functions');
            }
        } catch (e: any) {
            console.error('Lỗi khi upload file:', e.message);
        } finally {
            setDownloading(false);
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (rawRows.length === 0) {
                    alert('File Excel rỗng!');
                    return;
                }

                setRawExcelRows(rawRows);
                const detectedIdx = detectHeaderRow(rawRows);
                setHeaderRowIdx(detectedIdx);
            } catch (err: any) {
                alert('Lỗi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    return {
        downloading,
        rawExcelRows,
        headerRowIdx,
        setHeaderRowIdx,
        headers,
        excelRows,
        mapping,
        handleMapChange,
        handleFileChange
    };
}
