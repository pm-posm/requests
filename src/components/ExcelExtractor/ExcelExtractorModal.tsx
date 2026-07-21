import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, X, FileSpreadsheet, Check } from 'lucide-react';
import { PhaseActionModal } from '../ActionModal/PhaseActionModal';

import { useExcelUploader } from '@/hooks/useExcelUploader';
import { useStoreItemsSync } from '@/hooks/useStoreItemsSync';

import { ExcelUploadZone } from './ExcelUploadZone';
import { ExcelMappingTable } from './ExcelMappingTable';
import { ExcelImportedList } from './ExcelImportedList';

import type { StoreItem, ExcelExtractorModalProps } from '@/types';

export function ExcelExtractorModal({ phaseType, projectGroup, downloadFileId, setDownloadFileId, onClose }: ExcelExtractorModalProps) {
    const queryClient = useQueryClient();

    // Setup Hooks
    const { 
        downloading, rawExcelRows, headerRowIdx, setHeaderRowIdx, 
        headers, excelRows, mapping, handleMapChange, handleFileChange 
    } = useExcelUploader(projectGroup, phaseType, downloadFileId || null, setDownloadFileId, onClose);
    
    const { 
        storeItems, importStoreMutation, deleteItemMutation, 
        ntxxMutation 
    } = useStoreItemsSync(projectGroup.final_project, phaseType);

    // Local state
    const [localExpectedDate, setLocalExpectedDate] = React.useState<string>('');
    const [isConfirmed, setIsConfirmed] = React.useState<boolean>(false);
    const [loading, setLoading] = React.useState(false);
    const [success, setSuccess] = React.useState(false);
    const [activeDragCol, setActiveDragCol] = React.useState<string | null>(null);

    // Modal state for NTXX
    const [selectedNtxxItem, setSelectedNtxxItem] = React.useState<StoreItem | null>(null);
    const [showNtxxModal, setShowNtxxModal] = React.useState(false);

    // Auto-close modal after successful sync
    React.useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [success, onClose]);

    // Fetch existing project decision to check expected date
    React.useEffect(() => {
        const fetchDecision = async () => {
            const { data } = await supabase
                .from('project_decisions')
                .select('*')
                .eq('final_project', projectGroup.final_project)
                .eq('phase_type', phaseType)
                .maybeSingle();
            
            if (data?.checklist_data?.expected_date) {
                setLocalExpectedDate(data.checklist_data.expected_date);
            }
        };
        fetchDecision();
    }, [projectGroup.final_project, phaseType]);

    const saveExpectedDateAndProceed = async () => {
        if (!localExpectedDate) return false;
        
        const { data: existingDecision } = await supabase
            .from('project_decisions')
            .select('*')
            .eq('final_project', projectGroup.final_project)
            .eq('phase_type', phaseType)
            .maybeSingle();

        const currentChecklist = existingDecision?.checklist_data || {};
        const updatedChecklist = { ...currentChecklist, expected_date: localExpectedDate };

        const { error } = await supabase.from('project_decisions').upsert({
            final_project: projectGroup.final_project,
            phase_type: phaseType,
            decision_status: existingDecision?.decision_status || null,
            checklist_data: updatedChecklist,
            notes: existingDecision?.notes || null,
            updated_by: 'Admin',
            updated_at: new Date().toISOString()
        }, { onConflict: 'final_project,phase_type' });

        if (error) {
            alert('Lỗi lưu Ngày dự kiến: ' + error.message);
            return false;
        }

        queryClient.invalidateQueries({ queryKey: ['project_decision', projectGroup.final_project, phaseType] });
        queryClient.invalidateQueries({ queryKey: ['project_decisions', projectGroup.final_project] });
        return true;
    };

    const handleImportRowToStatus = async (rowIdx: number, targetStatus: string) => {
        const row = excelRows[rowIdx];
        if (!row) return;

        if (mapping.store_code === -1) {
            alert('Vui lòng ánh xạ cột "Mã Cửa Hàng (Store Code)" trước khi kéo nhập!');
            return;
        }

        const storeCode = row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (!storeCode) {
            alert('Dòng dữ liệu này không có Mã Cửa Hàng hợp lệ.');
            return;
        }

        const existingStore = storeItems?.find((s: any) => s.store_code === storeCode);
        if (existingStore?.is_locked) {
            alert(`Cửa hàng ${storeCode} đang bị khóa tiến độ. Vui lòng mở khóa trên Dashboard trước khi nhập!`);
            return;
        }

        if (!localExpectedDate || !isConfirmed) {
            alert('Vui lòng điền Ngày dự kiến triển khai và tick Cam kết ở cột bên trái để mở khóa thao tác!');
            return;
        }

        const dateSaved = await saveExpectedDateAndProceed();
        if (!dateSaved) return;

        const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : undefined;
        const category = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM';
        const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined;
        const notes = mapping.notes !== -1 && row[mapping.notes] ? String(row[mapping.notes]).trim() : undefined;

        const statusField = phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALL' ? 'installation_status' : 'acceptance_status';
        const notesField = phaseType === 'SURVEY' ? 'survey_notes' : phaseType === 'INSTALL' ? 'installation_notes' : 'acceptance_notes';

        importStoreMutation.mutate({
            final_project: projectGroup.final_project,
            store_code: storeCode,
            store_name: storeName,
            category: category,
            supplier_name: supplierName,
            [statusField]: null,
            [notesField]: notes
        });
    };

    const handleImportAll = async (targetStatus: string = 'Chờ làm') => {
        if (mapping.store_code === -1) {
            alert('Vui lòng ánh xạ cột "Mã Cửa Hàng" trước khi import!');
            return;
        }
        if (!localExpectedDate || !isConfirmed) {
            alert('Vui lòng điền Ngày dự kiến triển khai và tick Cam kết để mở khóa thao tác!');
            return;
        }

        setLoading(true);
        try {
            const dateSaved = await saveExpectedDateAndProceed();
            if (!dateSaved) { setLoading(false); return; }

            const payloadMap = new Map();
            excelRows.forEach(row => {
                let storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                if (!storeCode) storeCode = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();

                const existingStore = storeItems?.find((s: any) => s.store_code === storeCode);
                if (existingStore) return; // Skip already imported

                const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : undefined;
                const category = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM';
                const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined;
                const notes = mapping.notes !== -1 && row[mapping.notes] ? String(row[mapping.notes]).trim() : undefined;
                
                const statusField = phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALL' ? 'installation_status' : 'acceptance_status';
                const notesField = phaseType === 'SURVEY' ? 'survey_notes' : phaseType === 'INSTALL' ? 'installation_notes' : 'acceptance_notes';
                
                if (!payloadMap.has(storeCode)) {
                    payloadMap.set(storeCode, {
                        final_project: projectGroup.final_project,
                        store_code: storeCode,
                        store_name: storeName,
                        category: category,
                        supplier_name: supplierName,
                        [statusField]: null,
                        [notesField]: notes
                    });
                }
            });

            const payload = Array.from(payloadMap.values());
            if (payload.length === 0) {
                throw new Error('Không tìm thấy dòng dữ liệu hợp lệ nào để import.');
            }

            importStoreMutation.mutate(payload, {
                onSuccess: () => setSuccess(true),
                onError: (err: any) => alert('Lỗi import dữ liệu: ' + err.message)
            });
        } catch (err: any) {
            alert('Lỗi import dữ liệu: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const unimportedRows = excelRows.map((row, idx) => ({ row, originalIdx: idx })).filter(({ row }) => {
        if (mapping.store_code === -1) return true;
        const code = row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (!code) return true;
        const existingStore = storeItems?.find((s: any) => s.store_code === code);
        return !existingStore;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 relative">
                
                {success && (
                    <div className="absolute inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center border border-emerald-250 dark:border-emerald-900/30 mb-4 animate-bounce">
                            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-450" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">Đồng bộ thành công!</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Danh sách cửa hàng đã được lưu và cập nhật tiến độ.</p>
                    </div>
                )}
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <div>
                            <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100">
                                Kéo Thả Trích xuất Lịch trình Excel ({phaseType === 'SURVEY' ? 'Khảo Sát' : 'Lắp Đặt'})
                            </h3>
                            <p className="text-[10px] text-slate-450 font-semibold truncate max-w-lg">
                                Dự án: {projectGroup.final_project}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-455 hover:text-slate-655 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content body */}
                <div className="p-5 overflow-y-auto flex-1 flex flex-col md:flex-row gap-5 min-h-0 text-slate-700 dark:text-slate-300">
                    {downloading || loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 animate-duration-1000" />
                            <p className="text-sm font-semibold text-slate-500">
                                {loading ? 'Đang lưu dữ liệu...' : 'Đang tải và trích xuất tệp từ Google Drive...'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {!downloadFileId && rawExcelRows.length === 0 && (
                                <ExcelUploadZone handleFileChange={handleFileChange} />
                            )}

                            {(rawExcelRows.length > 0) && (
                                <>
                                    <ExcelMappingTable
                                        localExpectedDate={localExpectedDate}
                                        setLocalExpectedDate={setLocalExpectedDate}
                                        isConfirmed={isConfirmed}
                                        setIsConfirmed={setIsConfirmed}
                                        projectGroup={projectGroup}
                                        downloadFileId={downloadFileId || null}
                                        setDownloadFileId={setDownloadFileId}
                                        rawExcelRows={rawExcelRows}
                                        headerRowIdx={headerRowIdx}
                                        setHeaderRowIdx={setHeaderRowIdx}
                                        headers={headers}
                                        mapping={mapping}
                                        handleMapChange={handleMapChange}
                                        unimportedRows={unimportedRows}
                                        handleImportRowToStatus={handleImportRowToStatus}
                                        handleImportAll={handleImportAll}
                                    />
                                    
                                    <ExcelImportedList 
                                        phaseType={phaseType}
                                        storeItems={storeItems || []}
                                        localExpectedDate={localExpectedDate}
                                        isConfirmed={isConfirmed}
                                        deleteItemMutation={deleteItemMutation}
                                        setSelectedNtxxItem={setSelectedNtxxItem}
                                        setShowNtxxModal={setShowNtxxModal}
                                        activeDragCol={activeDragCol}
                                    />
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* NTXX Action Modal */}
                {showNtxxModal && selectedNtxxItem && (
                    <PhaseActionModal 
                        item={selectedNtxxItem} 
                        phaseName="Nghiệm Thu Xưởng (NTXX)"
                        rawData={selectedNtxxItem.ntxx_data}
                        onClose={() => { setShowNtxxModal(false); setSelectedNtxxItem(null); }}
                        onSave={async (newData: any) => {
                            await ntxxMutation.mutateAsync({ id: selectedNtxxItem.id, ntxxData: newData });
                        }}
                        onBulkSave={async (newData: any) => {
                            await ntxxMutation.mutateAsync({ ntxxData: newData, bulkProject: projectGroup.final_project });
                        }}
                    />
                )}
            </div>
        </div>
    );
}
