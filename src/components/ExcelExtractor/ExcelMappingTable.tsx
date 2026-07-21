import React from 'react';
import { Calendar, Mail, Check, Move } from 'lucide-react';

interface ExcelMappingTableProps {
    localExpectedDate: string;
    setLocalExpectedDate: (v: string) => void;
    isConfirmed: boolean;
    setIsConfirmed: (v: boolean) => void;
    projectGroup: any;
    downloadFileId: string | null;
    setDownloadFileId?: (id: string | null) => void;
    rawExcelRows: any[][];
    headerRowIdx: number;
    setHeaderRowIdx: (v: number) => void;
    headers: string[];
    mapping: Record<string, number>;
    handleMapChange: (field: string, colIdx: number) => void;
    unimportedRows: any[];
    handleImportRowToStatus: (rowIdx: number, targetStatus: string) => void;
    handleImportAll: (targetStatus: string) => void;
}

const fields = [
    { key: 'store_code', label: 'Mã Cửa Hàng (Store Code) *', required: true },
    { key: 'store_name', label: 'Tên Cửa Hàng (Store Name)', required: false },
    { key: 'category', label: 'Hạng mục POSM (Category)', required: false },
    { key: 'supplier_name', label: 'Nhà thầu (Supplier)', required: false },
    { key: 'notes', label: 'Ghi chú (Notes)', required: false }
];

export function ExcelMappingTable({
    localExpectedDate,
    setLocalExpectedDate,
    isConfirmed,
    setIsConfirmed,
    projectGroup,
    downloadFileId,
    setDownloadFileId,
    rawExcelRows,
    headerRowIdx,
    setHeaderRowIdx,
    headers,
    mapping,
    handleMapChange,
    unimportedRows,
    handleImportRowToStatus,
    handleImportAll
}: ExcelMappingTableProps) {
    const [showAdvancedMapping, setShowAdvancedMapping] = React.useState<boolean>(false);

    const currentActivity = projectGroup.activities.find((act: any) => 
        act.activity_attachments?.some((att: any) => att.id === downloadFileId)
    );

    return (
        <div className="w-full md:w-[38%] flex flex-col gap-4 min-h-0 border-r border-slate-100 dark:border-slate-800/80 pr-4">
            
            {/* A. XÁC NHẬN NGÀY DỰ KIẾN & CAM KẾT */}
            <div className="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <label className="text-[10px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                        Xác nhận Ngày Dự Kiến Triển Khai
                    </label>
                </div>
                <input
                    type="date"
                    value={localExpectedDate}
                    onChange={(e) => setLocalExpectedDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none text-slate-700 dark:text-slate-200"
                />
                <div className="flex items-start gap-2 pt-1.5 border-t border-indigo-150/40 dark:border-indigo-900/20">
                    <input
                        type="checkbox"
                        id="confirm-commitment"
                        checked={isConfirmed}
                        onChange={(e) => setIsConfirmed(e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="confirm-commitment" className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal cursor-pointer select-none">
                        Tôi xác nhận ngày dự kiến này và đồng ý đồng bộ danh sách store.
                    </label>
                </div>
            </div>

            {/* B. DANH SÁCH FILE TRONG MAIL THREAD ĐỂ ĐỐI CHIẾU */}
            {currentActivity && currentActivity.activity_attachments && currentActivity.activity_attachments.length > 0 && (
                <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/40 p-3 rounded-xl space-y-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                        <Mail className="w-3.5 h-3.5 text-indigo-500" />
                        Tệp đính kèm trong Mail Thread:
                    </div>
                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                        {currentActivity.activity_attachments.map((att: any) => {
                            const isCurrent = att.id === downloadFileId;
                            const isExcel = att.file_name.toLowerCase().endsWith('.xlsx') || att.file_name.toLowerCase().endsWith('.xls');
                            return (
                                <div 
                                    key={att.id} 
                                    className={`flex items-center justify-between p-1.5 rounded text-[10px] border transition-all ${
                                        isCurrent 
                                            ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/40 text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    <span className="truncate max-w-[150px]" title={att.file_name}>{att.file_name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <a href={att.drive_url || `https://drive.google.com/uc?export=download&id=${att.drive_file_id || att.id}`} target="_blank" rel="noreferrer" className="text-[8px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-800 transition-all">Tải</a>
                                        {isExcel && !isCurrent && setDownloadFileId && (
                                            <button
                                                type="button"
                                                onClick={() => setDownloadFileId(att.drive_file_id || att.id)}
                                                className="text-[8px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-1.5 py-0.5 border border-emerald-100 dark:border-emerald-900/30 rounded bg-emerald-50/20 transition-all font-bold cursor-pointer"
                                                title="Trích xuất file này"
                                            >
                                                Xem
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* C. NÚT TOGGLE CẤU HÌNH ÁNH XẠ NÂNG CAO */}
            <div className="flex items-center">
                <button
                    type="button"
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800/60 px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer"
                >
                    {showAdvancedMapping ? '⚙️ Ẩn cấu hình cột' : '⚙️ Hiện cấu hình cột'}
                </button>
            </div>

            {showAdvancedMapping && (
                <div className="bg-slate-50/40 dark:bg-slate-950/10 border border-slate-150 dark:border-slate-850 p-3 rounded-xl space-y-3">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            1. Chọn dòng chứa tiêu đề cột (Header Row):
                        </label>
                        <select
                            value={headerRowIdx}
                            onChange={(e) => setHeaderRowIdx(Number(e.target.value))}
                            className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            {rawExcelRows.slice(0, 15).map((row, idx) => {
                                const rowPreview = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').slice(0, 4).join(' | ');
                                return (
                                    <option key={idx} value={idx}>
                                        Dòng {idx + 1}: {rowPreview ? (rowPreview.length > 60 ? rowPreview.slice(0, 60) + '...' : rowPreview) : '(Trống)'}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            2. Kéo thả Cột tiêu đề vào các ô bên dưới để ánh xạ:
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-200/50 dark:border-slate-800/60 rounded-xl max-h-24 overflow-y-auto">
                            {headers.map((h, i) => {
                                const isMapped = Object.values(mapping).includes(i);
                                return (
                                    <div
                                        key={i}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', `col:${i}`);
                                        }}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all cursor-grab flex items-center gap-1 select-none ${
                                            isMapped 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30 opacity-60' 
                                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:scale-105'
                                        }`}
                                        title="Kéo thả cột này"
                                    >
                                        <Move className="w-2.5 h-2.5 shrink-0" />
                                        {h}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {fields.map(f => {
                                const mappedIdx = mapping[f.key];
                                const mappedName = mappedIdx !== -1 ? headers[mappedIdx] : null;
                                
                                return (
                                    <div
                                        key={f.key}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            const val = e.dataTransfer.getData('text/plain');
                                            if (val && val.startsWith('col:')) {
                                                const colIdx = Number(val.split(':')[1]);
                                                handleMapChange(f.key, colIdx);
                                            }
                                        }}
                                        className={`p-2 rounded-xl border border-dashed transition-all space-y-1 min-h-[50px] flex flex-col justify-center ${
                                            mappedName 
                                                ? 'bg-emerald-50/20 border-emerald-400/80 dark:bg-emerald-950/10 dark:border-emerald-900/40' 
                                                : 'bg-slate-50/50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-850'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{f.label}</span>
                                            {mappedName && (
                                                <button 
                                                    onClick={() => handleMapChange(f.key, -1)}
                                                    className="text-rose-500 hover:text-rose-700 text-[9px] font-bold cursor-pointer"
                                                >
                                                    Gỡ
                                                </button>
                                            )}
                                        </div>
                                        {mappedName ? (
                                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                {mappedName}
                                            </div>
                                        ) : (
                                            <select
                                                value={mappedIdx}
                                                onChange={(e) => handleMapChange(f.key, Number(e.target.value))}
                                                className="w-full text-[9px] p-0.5 bg-transparent border-0 outline-none text-slate-400 cursor-pointer"
                                            >
                                                <option value={-1}>-- Kéo hoặc chọn --</option>
                                                {headers.map((h, i) => (
                                                    <option key={i} value={i}>{h}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            
            {/* List of excel row cards */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <div className="flex items-center justify-between shrink-0">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        3. Thẻ cửa hàng từ Excel ({unimportedRows.length} thẻ chưa nhập):
                    </label>
                    {mapping.store_code !== -1 && unimportedRows.length > 0 && (
                        <button
                            type="button"
                            disabled={!localExpectedDate || !isConfirmed}
                            onClick={() => handleImportAll('Chờ làm')}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all border flex items-center gap-1 cursor-pointer ${
                                (!localExpectedDate || !isConfirmed)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                            title="Nhập tất cả store này"
                        >
                            Nhập tất cả
                        </button>
                    )}
                </div>
                
                <div style={{ height: '240px', minHeight: '240px' }} className="overflow-y-auto space-y-2 bg-slate-50/20 dark:bg-slate-950/10 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    {unimportedRows.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-10 gap-2">
                            <Check className="w-6 h-6 text-emerald-500" />
                            <span className="text-[10px] text-slate-455 font-bold italic text-center">Đã nhập toàn bộ hoặc tệp Excel rỗng!</span>
                        </div>
                    ) : (
                        unimportedRows.map(({ row, originalIdx }) => {
                            const storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                            const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                            const categoryName = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : '';
                            const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : '';

                            return (
                                <div
                                    key={originalIdx}
                                    draggable={mapping.store_code !== -1}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', `row:${originalIdx}`);
                                    }}
                                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-2xs space-y-1.5 transition-all group select-none ${
                                        mapping.store_code !== -1 
                                            ? 'cursor-grab hover:border-indigo-400 dark:hover:border-indigo-900 hover:shadow-xs' 
                                            : 'opacity-70'
                                    }`}
                                    title={mapping.store_code !== -1 ? "Kéo thẻ này sang cột Kanban bên phải để import" : "Ánh xạ cột Store Code trước để kéo thẻ"}
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-[9px] font-bold text-slate-400">Dòng {originalIdx + headerRowIdx + 2}</span>
                                        <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded uppercase">Excel</span>
                                    </div>
                                    
                                    {mapping.store_code !== -1 ? (
                                        <div className="space-y-1 text-xs">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                                <Move className="w-3 h-3 text-slate-350 shrink-0 cursor-grab" />
                                                {storeCode || <span className="text-slate-400 italic font-normal">(Trống mã ch)</span>}
                                            </div>
                                            {storeName && <div className="text-[10px] text-slate-400 pl-4">{storeName}</div>}
                                            {(categoryName || supplierName) && (
                                                <div className="flex items-center gap-1.5 flex-wrap pl-4 pt-0.5">
                                                    {categoryName && <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 px-1 py-0 rounded">{categoryName}</span>}
                                                    {supplierName && <span className="text-[8px] font-bold text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-1 py-0 rounded">{supplierName}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 italic truncate pl-1">
                                            {row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '').slice(0, 3).join(' | ')}
                                        </div>
                                    )}
                                    
                                    {mapping.store_code !== -1 && (
                                        <div className="flex items-center gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end border-t border-slate-50 dark:border-slate-850 mt-1">
                                            <button
                                                onClick={() => handleImportRowToStatus(originalIdx, 'Pending')}
                                                className="text-[8px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30 transition-all cursor-pointer"
                                            >
                                                + Chờ làm
                                            </button>
                                            <button
                                                onClick={() => handleImportRowToStatus(originalIdx, 'Hoàn tất')}
                                                className="text-[8px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-955/40 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30 transition-all cursor-pointer"
                                            >
                                                + Xong
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
