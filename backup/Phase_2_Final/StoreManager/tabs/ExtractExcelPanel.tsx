import React from 'react';
import { Loader2, CheckCircle2, Info, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { ColumnMapping } from '@/hooks/useExcelImport';

export const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
    { key: 'store_code', label: 'Mã Cửa Hàng *' },
    { key: 'store_name', label: 'Tên Cửa Hàng' },
    { key: 'region', label: 'Region' },
    { key: 'customer', label: 'Customer' },
    { key: 'ka', label: 'KA' },
    { key: 'sr', label: 'SR' },
    { key: 'category', label: 'Hạng mục' },
    { key: 'supplier_name', label: 'Nhà thầu' },
    { key: 'vis_tech', label: 'Vis-Tech' },
];

interface ExtractExcelPanelProps {
    downloading: boolean;
    loading: boolean;
    success: boolean;
    selectedRows: Set<number>;
    setSelectedRows: (s: Set<number>) => void;
    allValidRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    newRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    existingRows: { row: any[]; originalIdx: number; enrichedData?: any }[];
    toggleRow: (idx: number) => void;
    headers: string[];
    showAdvancedMapping: boolean;
    setShowAdvancedMapping: (v: boolean) => void;
    mapping: ColumnMapping;
    setMapping: (m: ColumnMapping | ((prev: ColumnMapping) => ColumnMapping)) => void;
}

export function ExtractExcelPanel({
    downloading,
    loading,
    success,
    selectedRows,
    setSelectedRows,
    allValidRows,
    newRows,
    existingRows,
    toggleRow,
    headers,
    showAdvancedMapping,
    setShowAdvancedMapping,
    mapping,
    setMapping
}: ExtractExcelPanelProps) {
    if (downloading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-500">Đang tải và phân tích file Excel...</p>
            </div>
        );
    }

    const renderRow = ({ row, originalIdx, enrichedData }: { row: any[]; originalIdx: number; enrichedData?: any }, isExisting: boolean) => {
        const isChecked = selectedRows.has(originalIdx);
        const get = (key: keyof ColumnMapping) => {
            const idx = mapping[key];
            const rawVal = idx !== -1 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
            if (rawVal) return { value: rawVal, auto: false };
            if (enrichedData && enrichedData[key]) return { value: String(enrichedData[key]), auto: true };
            return { value: '—', auto: false };
        };
        const renderCell = (data: { value: string; auto: boolean }) => (
            <span className={data.auto ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                {data.value}
            </span>
        );
        return (
            <tr
                key={originalIdx}
                onClick={() => { if (!isExisting) toggleRow(originalIdx); }}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer
                    ${isExisting ? 'opacity-50 bg-amber-50/30' : isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
            >
                <td className="p-2 w-8 text-center" onClick={e => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExisting}
                        onChange={() => { if (!isExisting) toggleRow(originalIdx); }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </td>
                <td className="p-2 text-xs font-black font-mono text-slate-700 dark:text-slate-200">{get('store_code').value}</td>
                <td className="p-2 text-xs text-slate-600 dark:text-slate-300 max-w-[160px] truncate">{renderCell(get('store_name'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('region'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('customer'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('ka'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('sr'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('category'))}</td>
                <td className="p-2 text-xs text-slate-500">{renderCell(get('vis_tech'))}</td>
                {isExisting && (
                    <td className="p-2">
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Đã có</span>
                    </td>
                )}
            </tr>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
            {/* Toolbar */}
            <div className="p-3 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">
                    <span className="font-bold text-indigo-600">{selectedRows.size}</span>/{allValidRows.length} đã chọn
                </span>
            </div>
            
            {success && (
                <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold text-emerald-700">Đã lưu thành công!</span>
                </div>
            )}

            {/* Tables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                {/* New rows */}
                <section>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full">{newRows.length}</span>
                            Cửa hàng chờ thêm mới
                        </h4>
                        {newRows.length > 0 && (
                            <button
                                onClick={() => {
                                    const allSelected = newRows.every(r => selectedRows.has(r.originalIdx));
                                    const next = new Set(selectedRows);
                                    newRows.forEach(r => allSelected ? next.delete(r.originalIdx) : next.add(r.originalIdx));
                                    setSelectedRows(next);
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                            >
                                {newRows.every(r => selectedRows.has(r.originalIdx)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-2 w-8">
                                        <input
                                            type="checkbox"
                                            checked={newRows.length > 0 && newRows.every(r => selectedRows.has(r.originalIdx))}
                                            onChange={(e) => {
                                                const allSelected = newRows.every(r => selectedRows.has(r.originalIdx));
                                                const next = new Set(selectedRows);
                                                newRows.forEach(r => allSelected ? next.delete(r.originalIdx) : next.add(r.originalIdx));
                                                setSelectedRows(next);
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-2 font-bold">Mã CH</th>
                                    <th className="p-2 font-bold">Tên CH</th>
                                    <th className="p-2 font-bold">Region</th>
                                    <th className="p-2 font-bold">Customer</th>
                                    <th className="p-2 font-bold">KA</th>
                                    <th className="p-2 font-bold">SR</th>
                                    <th className="p-2 font-bold">Hạng mục</th>
                                    <th className="p-2 font-bold">Vis-Tech</th>
                                </tr>
                            </thead>
                            <tbody>
                                {newRows.length === 0 ? (
                                    <tr><td colSpan={9} className="p-4 text-center text-slate-400 italic text-xs">Không có cửa hàng mới</td></tr>
                                ) : newRows.map(item => renderRow(item, false))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Existing rows */}
                {existingRows.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <h4 className="text-xs font-black text-amber-600 flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{existingRows.length}</span>
                                Đã tồn tại trong Master
                            </h4>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-amber-200 dark:border-amber-900/40 opacity-75 bg-white dark:bg-slate-900 shadow-sm">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead className="bg-amber-50 dark:bg-amber-950/30 text-[10px] text-slate-500 uppercase tracking-wider border-b border-amber-200 dark:border-amber-900/40">
                                    <tr>
                                        <th className="p-2 w-8">
                                            <input
                                                type="checkbox"
                                                checked={existingRows.length > 0 && existingRows.every(r => selectedRows.has(r.originalIdx))}
                                                onChange={(e) => {
                                                    const allSelected = existingRows.every(r => selectedRows.has(r.originalIdx));
                                                    const next = new Set(selectedRows);
                                                    existingRows.forEach(r => allSelected ? next.delete(r.originalIdx) : next.add(r.originalIdx));
                                                    setSelectedRows(next);
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-2 font-bold">Mã CH</th>
                                        <th className="p-2 font-bold">Tên CH</th>
                                        <th className="p-2 font-bold">Region</th>
                                        <th className="p-2 font-bold">Customer</th>
                                        <th className="p-2 font-bold">KA</th>
                                        <th className="p-2 font-bold">SR</th>
                                        <th className="p-2 font-bold">Hạng mục</th>
                                        <th className="p-2 font-bold">Vis-Tech</th>
                                        <th className="p-2 font-bold">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existingRows.map(item => renderRow(item, true))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {allValidRows.length === 0 && !downloading && (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                        Không đọc được dữ liệu. Kiểm tra lại file hoặc điều chỉnh cấu hình ánh xạ cột.
                    </div>
                )}
            </div>

            {/* Mapping config panel */}
            <div className="border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-10">
                <button
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                    <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        Cấu hình Ánh xạ Cột Excel
                    </span>
                    {showAdvancedMapping ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
                {showAdvancedMapping && (
                    <div className="px-4 pb-4 max-h-[300px] overflow-y-auto">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                            {MAPPING_FIELDS.map(f => (
                                <div key={f.key} className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase">{f.label}</label>
                                    <select
                                        value={mapping[f.key]}
                                        onChange={e => setMapping(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                                        className="w-full text-[10px] p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                        <option value={-1}>-- Bỏ qua --</option>
                                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
