import React from 'react';
import { Loader2, CheckCircle2, Layers, AlertCircle } from 'lucide-react';

export function ProjectActionExtract({
    downloading,
    downloadFileId,
    selectedFile,
    selectedRows,
    setSelectedRows,
    allValidRows,
    newRows,
    existingRows,
    toggleRow,
    handleImportAll,
    loading,
    headers,
    showAdvancedMapping,
    setShowAdvancedMapping,
    mapping,
    setMapping,
    headerRowIdx,
    masterDirMap
}: any) {

    if (downloading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-500">Đang đọc dữ liệu Excel...</p>
            </div>
        );
    }

    if (!downloadFileId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Layers className="w-12 h-12 opacity-30" />
                <p className="text-sm font-semibold">Chọn một file Excel ở cột bên trái để bắt đầu trích xuất</p>
            </div>
        );
    }

    const renderChecklistItem = ({ row, originalIdx }: { row: any[], originalIdx: number }, isExisting: boolean) => {
        const isChecked = selectedRows.has(originalIdx);
        const rawCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        const rawName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';

        let masterData = (rawCode && isNaN(Number(rawCode)) && masterDirMap) ? masterDirMap.get(rawCode.toUpperCase()) : null;
        if (!masterData && rawName && masterDirMap) {
            const normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            masterData = masterDirMap.get('NAME:' + normName);
        }

        const displayCode = (rawCode && isNaN(Number(rawCode))) ? rawCode : (masterData?.store_code || rawCode || '-');
        const displayName = rawName || masterData?.store_name || '-';
        const displayRegion = (mapping.region !== -1 && row[mapping.region]) ? row[mapping.region] : (masterData?.region || '-');
        const displayCustomer = (mapping.customer !== -1 && row[mapping.customer]) ? row[mapping.customer] : (masterData?.customer || '-');
        const displayKa = (mapping.ka !== -1 && row[mapping.ka]) ? row[mapping.ka] : (masterData?.ka || '-');
        const displaySr = (mapping.sr !== -1 && row[mapping.sr]) ? row[mapping.sr] : (masterData?.sr || '-');
        const displayCategory = (mapping.category !== -1 && row[mapping.category]) ? row[mapping.category] : '-';

        return (
            <tr key={originalIdx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExisting ? 'bg-amber-50/20 text-slate-500' : 'bg-white dark:bg-slate-900'} border-b border-slate-100 dark:border-slate-800`}>
                <td className="p-2 text-center w-10">
                    <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => { if(!isExisting) toggleRow(originalIdx); }} 
                        disabled={isExisting}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </td>
                <td className="p-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <div className="flex flex-col gap-0.5">
                        <span>{displayCode}</span>
                        {masterData && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded w-fit border border-emerald-200 dark:border-emerald-800">
                                ⚡ Tự động map từ Danh bạ
                            </span>
                        )}
                    </div>
                </td>
                <td className="p-2 text-xs text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={displayName}>{displayName}</td>
                <td className="p-2 text-xs text-slate-500 font-medium">{displayRegion}</td>
                <td className="p-2 text-xs text-slate-500 font-medium">{displayCustomer}</td>
                <td className="p-2 text-xs text-slate-500 font-medium">{displayKa}</td>
                <td className="p-2 text-xs text-slate-500 font-medium">{displaySr}</td>
                <td className="p-2 text-xs text-slate-500 font-medium">{displayCategory}</td>
                <td className="p-2 text-center">
                    <button className="text-indigo-500 hover:bg-indigo-50 p-1 rounded transition-colors" title="Thêm file tùy chỉnh">
                        <Layers className="w-4 h-4 mx-auto" />
                    </button>
                </td>
            </tr>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top: File Info Header */}
            {selectedFile && (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between shrink-0">
                    <div>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Tệp Excel Đang Chọn:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedFile.file_name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${selectedFile.phase === 'SURVEY' ? 'bg-purple-100 text-purple-700' : selectedFile.phase === 'INSTALLATION' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {selectedFile.phase}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            Đã chọn <span className="text-indigo-600">{selectedRows.size}</span>/{allValidRows.length} cửa hàng
                        </span>
                        <button 
                            onClick={handleImportAll}
                            disabled={loading || selectedRows.size === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold py-2 px-5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Lưu Tạm vào Master (Bản nháp)
                        </button>
                    </div>
                </div>
            )}

            {/* Middle: Preview Data Checklist */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-950/10 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                    {/* New Rows */}
                    <div>
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <h4 className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{newRows.length}</span>
                                Cửa hàng chờ thêm mới
                            </h4>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => alert("Tính năng Add Store thủ công đang được phát triển...")}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold py-1 px-3 rounded transition-colors"
                                >
                                    + Thêm Store Thủ Công
                                </button>
                                <button 
                                    onClick={() => {
                                        const next = new Set(selectedRows);
                                        const allSelected = newRows.every((r: any) => selectedRows.has(r.originalIdx));
                                        newRows.forEach((r: any) => {
                                            if (allSelected) next.delete(r.originalIdx);
                                            else next.add(r.originalIdx);
                                        });
                                        setSelectedRows(next);
                                    }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                                >
                                    {newRows.length > 0 && newRows.every((r: any) => selectedRows.has(r.originalIdx)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="p-2 w-10 text-center"><input type="checkbox" onChange={() => {}} className="rounded" /></th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">Mã CH</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">Tên CH</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">Region</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">Customer</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">KA</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">SR</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase">Hạng mục</th>
                                        <th className="p-2 text-xs font-bold text-slate-500 uppercase text-center">+ File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newRows.length === 0 ? (
                                        <tr><td colSpan={9} className="p-4 text-center text-slate-400 italic text-xs">Không có cửa hàng mới nào.</td></tr>
                                    ) : (
                                        newRows.map((item: any) => renderChecklistItem(item, false))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Existing Rows */}
                    {existingRows.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <h4 className="text-xs font-bold uppercase text-amber-600 dark:text-amber-500 flex items-center gap-2">
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{existingRows.length}</span>
                                    Cửa hàng đã tồn tại trong Master
                                </h4>
                                <button 
                                    onClick={() => {
                                        const next = new Set(selectedRows);
                                        const allSelected = existingRows.every((r: any) => selectedRows.has(r.originalIdx));
                                        existingRows.forEach((r: any) => {
                                            if (allSelected) next.delete(r.originalIdx);
                                            else next.add(r.originalIdx);
                                        });
                                        setSelectedRows(next);
                                    }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-amber-600 cursor-pointer"
                                >
                                    {existingRows.every((r: any) => selectedRows.has(r.originalIdx)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả (Ghi đè)'}
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 opacity-80">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="p-2 w-10 text-center"><input type="checkbox" disabled className="rounded" /></th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">Mã CH</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">Tên CH</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">Region</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">Customer</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">KA</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">SR</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase">Hạng mục</th>
                                            <th className="p-2 text-xs font-bold text-slate-500 uppercase text-center">+ File</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingRows.map((item: any) => renderChecklistItem(item, true))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    {allValidRows.length === 0 && (
                        <div className="py-12 text-center text-slate-400 italic text-sm">Chưa có dữ liệu. Vui lòng kiểm tra file và cấu hình ánh xạ.</div>
                    )}
                </div>
            </div>

            {/* Bottom: Mapping Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-500" /> Cấu hình ánh xạ cột</h4>
                    </div>
                    <button onClick={() => setShowAdvancedMapping(!showAdvancedMapping)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded cursor-pointer">
                        {showAdvancedMapping ? 'Ẩn cấu hình' : 'Hiện cấu hình'}
                    </button>
                </div>
                {showAdvancedMapping && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                        {[
                            { key: 'store_code', label: 'Mã Cửa Hàng *' },
                            { key: 'store_name', label: 'Tên Cửa Hàng' },
                            { key: 'region', label: 'Region' },
                            { key: 'customer', label: 'Customer' },
                            { key: 'ka', label: 'KA' },
                            { key: 'sr', label: 'SR' },
                            { key: 'category', label: 'Hạng mục' },
                            { key: 'supplier_name', label: 'Nhà thầu' },
                            { key: 'notes', label: 'Ghi chú' }
                        ].map(f => (
                            <div key={f.key} className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-500">{f.label}</label>
                                <select
                                    value={mapping[f.key]}
                                    onChange={(e) => setMapping((prev: any) => ({...prev, [f.key]: Number(e.target.value)}))}
                                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                    <option value={-1}>-- Bỏ qua --</option>
                                    {headers.map((h: string, i: number) => <option key={i} value={i}>{h}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
