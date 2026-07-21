import React from 'react';
import { StoreSearchInput } from './StoreSearchInput';

interface ExtractManualPanelProps {
    manualStores: any[];
    setManualStores: React.Dispatch<React.SetStateAction<any[]>>;
    selectedRows: Set<number>;
    setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>;
    toggleRow: (idx: number) => void;
}

export function ExtractManualPanel({
    manualStores,
    setManualStores,
    selectedRows,
    setSelectedRows,
    toggleRow
}: ExtractManualPanelProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <StoreSearchInput onSelectStore={(store) => {
                    setManualStores(prev => {
                        if (!prev.find(s => s.store_code === store.store_code)) {
                            return [...prev, store];
                        }
                        return prev;
                    });
                    setSelectedRows(prev => new Set(prev).add(manualStores.length)); // We'll rely on the useEffect in the hook for safer sync but this is fine for direct adds
                }} />
            </div>

            {/* Toolbar */}
            <div className="p-3 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">
                    <span className="font-bold text-indigo-600">{selectedRows.size}</span>/{manualStores.length} đã chọn
                </span>
            </div>
            
            {/* Tables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                <section>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full">{manualStores.length}</span>
                            Danh sách Cửa hàng cần xử lý
                        </h4>
                        {manualStores.length > 0 && (
                            <button
                                onClick={() => {
                                    const allSelected = manualStores.every((_, i) => selectedRows.has(i));
                                    const next = new Set(selectedRows);
                                    manualStores.forEach((_, i) => allSelected ? next.delete(i) : next.add(i));
                                    setSelectedRows(next);
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                            >
                                {manualStores.every((_, i) => selectedRows.has(i)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
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
                                            checked={manualStores.length > 0 && manualStores.every((_, i) => selectedRows.has(i))}
                                            onChange={() => {
                                                const allSelected = manualStores.every((_, i) => selectedRows.has(i));
                                                const next = new Set(selectedRows);
                                                manualStores.forEach((_, i) => allSelected ? next.delete(i) : next.add(i));
                                                setSelectedRows(next);
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-2 font-bold">Mã CH</th>
                                    <th className="p-2 font-bold">Tên CH</th>
                                    <th className="p-2 font-bold">Region</th>
                                    <th className="p-2 font-bold">Customer</th>
                                    <th className="p-2 font-bold">Hạng mục</th>
                                    <th className="p-2 font-bold">Vis-Tech</th>
                                </tr>
                            </thead>
                            <tbody>
                                {manualStores.length === 0 ? (
                                    <tr><td colSpan={7} className="p-4 text-center text-slate-400 italic text-xs">Chưa có cửa hàng nào. Vui lòng tìm kiếm phía trên.</td></tr>
                                ) : manualStores.map((store, i) => (
                                    <tr key={i} onClick={() => toggleRow(i)} className={`border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer ${selectedRows.has(i) ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                        <td className="p-2 w-8 text-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                        </td>
                                        <td className="p-2 text-xs font-black font-mono text-slate-700 dark:text-slate-200">{store.store_code}</td>
                                        <td className="p-2 text-xs text-slate-600 dark:text-slate-300 max-w-[160px] truncate">{store.store_name}</td>
                                        <td className="p-2 text-xs text-slate-500">{store.province || store.region || '—'}</td>
                                        <td className="p-2 text-xs text-slate-500">{store.customer || '—'}</td>
                                        <td className="p-2 text-xs text-slate-500">{store.category || '—'}</td>
                                        <td className="p-2 text-xs text-slate-500">{store.vis_tech || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
