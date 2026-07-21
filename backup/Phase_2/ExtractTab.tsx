import React, { useState } from 'react';
import { Loader2, CheckCircle2, Layers, ChevronDown, ChevronUp, Save, FileSpreadsheet, FileText } from 'lucide-react';
import type { ColumnMapping } from '@/hooks/useExcelImport';
import type { ProjectGroup } from '@/types';
import { useManualExtract } from '@/hooks/useManualExtract';
import { ExtractExcelPanel } from './ExtractExcelPanel';
import { ExtractManualPanel } from './ExtractManualPanel';

const PHASE_LABEL: Record<string, string> = {
    SURVEY: 'Khảo sát', INSTALLATION: 'Lắp đặt', ACCEPTANCE: 'NTXX', BRIEF: 'Brief',
};

const PHASE_BADGE: Record<string, string> = {
    SURVEY: 'bg-purple-100 text-purple-700',
    INSTALLATION: 'bg-amber-100 text-amber-700',
    ACCEPTANCE: 'bg-emerald-100 text-emerald-700',
    BRIEF: 'bg-violet-100 text-violet-700',
};

interface ExtractTabProps {
    projectGroup: ProjectGroup;
    downloading: boolean;
    downloadFileId?: string;
    selectedFile?: { id: string; file_name: string; phase: string; drive_url?: string } | null;
    selectedRows: Set<number>;
    setSelectedRows: (s: Set<number>) => void;
    allValidRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    newRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    existingRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    toggleRow: (idx: number) => void;
    handleImportAll: () => Promise<void>;
    loading: boolean;
    success: boolean;
    headers: string[];
    showAdvancedMapping: boolean;
    setShowAdvancedMapping: (v: boolean) => void;
    mapping: ColumnMapping;
    setMapping: (m: ColumnMapping | ((prev: ColumnMapping) => ColumnMapping)) => void;
    storeCount: number;
    onAddStore: () => void;
    lastAddedStore?: any;
}

export function ExtractTab({
    projectGroup,
    downloading, downloadFileId, selectedFile,
    selectedRows: excelSelectedRows, setSelectedRows: setExcelSelectedRows,
    allValidRows, newRows, existingRows,
    toggleRow: toggleExcelRow, handleImportAll,
    loading, success,
    headers, showAdvancedMapping, setShowAdvancedMapping,
    mapping, setMapping,
    storeCount, onAddStore, lastAddedStore
}: ExtractTabProps) {
    const isExcel = !!(selectedFile?.file_name?.toLowerCase().endsWith('.xlsx') || selectedFile?.file_name?.toLowerCase().endsWith('.xls'));
    
    const {
        manualStores, setManualStores,
        selectedRows: manualSelectedRows, setSelectedRows: setManualSelectedRows,
        toggleRow: toggleManualRow,
        isSavingManual, handleSaveManual
    } = useManualExtract(projectGroup, selectedFile, lastAddedStore, isExcel);

    const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

    // Split-view logic requires file to have a preview URL (drive_url)
    const previewUrl = selectedFile?.drive_url ? selectedFile.drive_url.replace(/\/view.*$/, '/preview') : '';

    if (!selectedFile) {
        return (
            <div className="flex-1 flex flex-col gap-4 p-6">
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Layers className="w-10 h-10 opacity-30" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Chọn tài liệu đính kèm từ thanh bên trái</p>
                        <p className="text-xs mt-1">Hệ thống hỗ trợ Excel, PDF, PPT</p>
                    </div>
                    <button
                        onClick={onAddStore}
                        className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                        + Thêm Store Thủ Công
                    </button>
                </div>
            </div>
        );
    }

        );
    }

    return (
        <div className="flex-1 flex h-full overflow-hidden">
            {/* Cột Trái: Iframe (Chỉ hiển thị nếu có link preview) */}
            {previewUrl && (
                <div className={`h-full border-r border-slate-200 dark:border-slate-800 bg-[#1a1b1e] shrink-0 transition-all duration-300 relative ${isRightPanelCollapsed ? 'flex-1' : 'w-[45%]'}`}>
                    <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-none"
                        allow="autoplay"
                        title="Document Preview"
                    />
                    {/* Toggle Button placed here to avoid right panel's overflow-hidden */}
                    <button 
                        onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
                        className="absolute top-2 -right-3 z-50 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow hover:bg-slate-50 cursor-pointer"
                        title={isRightPanelCollapsed ? "Mở rộng bảng xử lý" : "Thu gọn bảng xử lý"}
                    >
                        {isRightPanelCollapsed ? <ChevronDown className="w-3 h-3 text-slate-500 rotate-90" /> : <ChevronUp className="w-3 h-3 text-slate-500 rotate-90" />}
                    </button>
                </div>
            )}

            {/* Cột Phải: Xử lý Dữ liệu */}
            <div className={`flex flex-col h-full overflow-hidden transition-all duration-300 relative ${isRightPanelCollapsed ? 'w-0 border-none' : previewUrl ? 'w-[55%]' : 'w-full'}`}>
                
                {!isRightPanelCollapsed && (
                    <>
                        {/* File banner */}
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-3 min-w-0">
                        {isExcel ? <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" /> : <FileText className="w-4 h-4 text-rose-500 shrink-0" />}
                        <span className={`text-[10px] px-2 py-1 rounded font-black shrink-0 ${PHASE_BADGE[selectedFile.phase] || 'bg-slate-100 text-slate-600'}`}>
                            {PHASE_LABEL[selectedFile.phase] || selectedFile.phase}
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{selectedFile.file_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onAddStore}
                            className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            + Thêm Store thủ công
                        </button>
                        {isExcel ? (
                            <button
                                onClick={handleImportAll}
                                disabled={loading || excelSelectedRows.size === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-[11px] font-bold py-1.5 px-4 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Lưu vào Master
                            </button>
                        ) : (
                            <button 
                                onClick={handleSaveManual}
                                disabled={isSavingManual}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[11px] font-bold py-1.5 px-4 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                {isSavingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Lưu & Công bố
                            </button>
                        )}
                    </div>
                </div>
            </>
        )}

        {!isRightPanelCollapsed && (isExcel ? (
            <ExtractExcelPanel 
                downloading={downloading}
                loading={loading}
                success={success}
                selectedRows={excelSelectedRows}
                setSelectedRows={setExcelSelectedRows}
                allValidRows={allValidRows}
                newRows={newRows}
                existingRows={existingRows}
                toggleRow={toggleExcelRow}
                headers={headers}
                showAdvancedMapping={showAdvancedMapping}
                setShowAdvancedMapping={setShowAdvancedMapping}
                mapping={mapping}
                setMapping={setMapping}
            />
        ) : (
            <ExtractManualPanel 
                manualStores={manualStores}
                setManualStores={setManualStores}
                selectedRows={manualSelectedRows}
                setSelectedRows={setManualSelectedRows}
                toggleRow={toggleManualRow}
            />
        ))}
            </div>
        </div>
    );
}
