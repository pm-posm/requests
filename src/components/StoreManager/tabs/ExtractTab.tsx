import React, { useState } from 'react';
import { Loader2, CheckCircle2, Layers, Save, FileSpreadsheet, FileText, ExternalLink } from 'lucide-react';
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
    handleImportAll: (overridePhase?: string) => Promise<void>;
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
    
    const [extractPhase, setExtractPhase] = useState<string>('Brief');
    const [rowOverrides, setRowOverrides] = useState<Record<number, any>>({});

    React.useEffect(() => {
        if (!selectedFile) return;
        const name = selectedFile.file_name.toLowerCase();
        let detected = selectedFile.phase;
        
        // Smart detect from filename
        if (name.includes('lắp đặt') || name.includes('lap dat') || name.includes('install')) {
            detected = 'INSTALLATION';
        } else if (name.includes('khảo sát') || name.includes('khao sat') || name.includes('survey')) {
            detected = 'SURVEY';
        } else if (name.includes('nghiệm thu') || name.includes('ntxx') || name.includes('acceptance')) {
            detected = 'ACCEPTANCE';
        } else if (name.includes('brief')) {
            detected = 'BRIEF';
        }

        // Map to Vietnamese phase strings that backend uses
        const phaseStr = detected === 'SURVEY' ? 'Khảo sát' : 
                         (detected === 'INSTALLATION' || detected === 'INSTALL') ? 'Lắp đặt' : 
                         detected === 'ACCEPTANCE' ? 'NTXX' : 'Brief';
                         
        setExtractPhase(phaseStr);
    }, [selectedFile]);

    const {
        manualStores, setManualStores,
        selectedRows: manualSelectedRows, setSelectedRows: setManualSelectedRows,
        toggleRow: toggleManualRow,
        isSavingManual, handleSaveManual
    } = useManualExtract(projectGroup, selectedFile || null, lastAddedStore, isExcel);

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

    return (
        <div className="flex-1 flex h-full overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            {/* Cột Phải: Xử lý Dữ liệu */}
            <div className="flex flex-col h-full overflow-hidden w-full relative">
                {/* File banner */}
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isExcel ? <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" /> : <FileText className="w-5 h-5 text-rose-500 shrink-0" />}
                        <span className={`text-[10px] px-2 py-1 rounded font-black shrink-0 ${PHASE_BADGE[selectedFile.phase] || 'bg-slate-100 text-slate-600'}`}>
                            {PHASE_LABEL[selectedFile.phase] || selectedFile.phase}
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={selectedFile.file_name}>{selectedFile.file_name}</span>
                        {selectedFile.drive_url && (
                            <a 
                                href={selectedFile.drive_url}
                                target="_blank" rel="noreferrer"
                                className="ml-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Mở Xem Tệp (Tab mới)
                            </a>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 mr-2">
                            <span className="text-[10px] font-semibold text-slate-500 px-2">Giai đoạn:</span>
                            <select 
                                value={extractPhase}
                                onChange={e => setExtractPhase(e.target.value)}
                                className="text-xs font-bold bg-transparent outline-none cursor-pointer text-indigo-600 dark:text-indigo-400"
                            >
                                <option value="Brief">Brief</option>
                                <option value="Khảo sát">Khảo sát</option>
                                <option value="Lắp đặt">Lắp đặt</option>
                                <option value="NTXX">NTXX</option>
                            </select>
                        </div>

                        <button
                            onClick={onAddStore}
                            className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            + Thêm Store thủ công
                        </button>
                        {isExcel ? (
                            <button
                                onClick={() => handleImportAll(extractPhase, rowOverrides)}
                                disabled={loading || excelSelectedRows.size === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-[11px] font-bold py-1.5 px-4 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Lưu vào Master
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleSaveManual(extractPhase)}
                                disabled={isSavingManual}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[11px] font-bold py-1.5 px-4 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                {isSavingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Lưu & Công bố
                            </button>
                        )}
                    </div>
                </div>

                {isExcel ? (
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
                rowOverrides={rowOverrides}
                setRowOverrides={setRowOverrides}
                finalProject={projectGroup.final_project}
            />
        ) : (
            <ExtractManualPanel 
                manualStores={manualStores}
                setManualStores={setManualStores}
                selectedRows={manualSelectedRows}
                setSelectedRows={setManualSelectedRows}
                toggleRow={toggleManualRow}
            />
        )}
            </div>
        </div>
    );
}
