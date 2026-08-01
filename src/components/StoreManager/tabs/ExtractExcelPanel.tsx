import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Info, ChevronDown, ChevronUp, Layers, Search, Sparkles } from 'lucide-react';
import type { ColumnMapping } from '@/hooks/useExcelImport';
import { supabase } from '@/lib/supabase';

import { saveMappingMemory } from '@/hooks/useExcelImport';
import toast from 'react-hot-toast';

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

function MasterStoreRowSearch({ 
    value, 
    placeholder, 
    onSelectStore,
    onChangeText 
}: { 
    value: string; 
    placeholder: string; 
    onSelectStore: (store: any) => void;
    onChangeText?: (txt: string) => void;
}) {
    const [query, setQuery] = useState(value || '');
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        if (!query || query.length < 2 || !isOpen) {
            setResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const norm = encodeURIComponent(query.trim());
                const { data } = await supabase
                    .from('master_stores_directory')
                    .select('store_code, store_name, region, customer, ka, sr, mer_name')
                    .or(`store_code.ilike.%${norm}%,store_name.ilike.%${norm}%`)
                    .limit(8);
                setResults(data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [query, isOpen]);

    return (
        <div className="relative w-full">
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={query}
                    placeholder={placeholder}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    onChange={(e) => {
                        const txt = e.target.value;
                        setQuery(txt);
                        if (onChangeText) onChangeText(txt);
                        setIsOpen(true);
                    }}
                    className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-200 font-medium pr-5"
                />
                <Search className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
            </div>

            {isOpen && (results.length > 0 || loading) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {loading && <div className="p-2 text-[10px] text-slate-400 italic flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Đang tìm trong Danh Bạ Store...</div>}
                    {results.map((item) => (
                        <div
                            key={item.store_code}
                            onMouseDown={() => {
                                onSelectStore(item);
                                setQuery(item.store_name);
                                setIsOpen(false);
                            }}
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer border-b border-slate-100 dark:border-slate-800/60 text-xs flex flex-col gap-0.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.store_code}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{item.region || ''} • {item.customer || ''}</span>
                            </div>
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{item.store_name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    rowOverrides?: Record<number, any>;
    setRowOverrides?: React.Dispatch<React.SetStateAction<Record<number, any>>>;
    finalProject?: string;
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
    setMapping,
    rowOverrides = {},
    setRowOverrides,
    finalProject
}: ExtractExcelPanelProps) {
    if (downloading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-500">Đang tải và phân tích file Excel...</p>
            </div>
        );
    }

    const handleUpdateRowOverride = (originalIdx: number, patch: any) => {
        if (setRowOverrides) {
            setRowOverrides(prev => ({
                ...prev,
                [originalIdx]: { ...prev[originalIdx], ...patch }
            }));
        }
    };

    const renderRow = ({ row, originalIdx, enrichedData }: { row: any[]; originalIdx: number; enrichedData?: any }, isExisting: boolean) => {
        const isChecked = selectedRows.has(originalIdx);
        const override = rowOverrides[originalIdx] || {};

        const get = (key: keyof ColumnMapping) => {
            if (override[key] !== undefined) return { value: String(override[key]), auto: false };
            const idx = mapping[key];
            const rawVal = idx !== -1 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
            if (rawVal) return { value: rawVal, auto: false };
            if (enrichedData && enrichedData[key]) return { value: String(enrichedData[key]), auto: true };
            return { value: '', auto: false };
        };

        const storeCodeData = get('store_code');
        const storeNameData = get('store_name');
        const regionData = get('region');
        const customerData = get('customer');
        const kaData = get('ka');
        const srData = get('sr');
        const categoryData = get('category');
        const visTechData = get('vis_tech');

        const isAutoMapped = !!enrichedData || !!override.masterData;

        return (
            <tr
                key={originalIdx}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors
                    ${isExisting ? 'opacity-70 bg-amber-50/30' : isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
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

                {/* MÃ CH with Typeahead Auto-Search */}
                <td className="p-1.5 min-w-[140px]">
                    <div className="flex flex-col gap-1">
                        <MasterStoreRowSearch
                            value={storeCodeData.value}
                            placeholder="Mã CH (Gõ/Tìm)..."
                            onSelectStore={(st) => {
                                handleUpdateRowOverride(originalIdx, {
                                    store_code: st.store_code,
                                    store_name: st.store_name,
                                    region: st.region,
                                    customer: st.customer,
                                    ka: st.ka,
                                    sr: st.sr,
                                    vis_tech: st.mer_name || st.sr,
                                    masterData: st
                                });
                            }}
                            onChangeText={(txt) => handleUpdateRowOverride(originalIdx, { store_code: txt })}
                        />
                        {isAutoMapped && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded w-fit border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> ⚡ Đã map từ Danh bạ
                            </span>
                        )}
                    </div>
                </td>

                {/* TÊN CH with Typeahead Auto-Search */}
                <td className="p-1.5 min-w-[160px]">
                    <MasterStoreRowSearch
                        value={storeNameData.value}
                        placeholder="Tên CH (Gõ/Tìm)..."
                        onSelectStore={(st) => {
                            handleUpdateRowOverride(originalIdx, {
                                store_code: st.store_code,
                                store_name: st.store_name,
                                region: st.region,
                                customer: st.customer,
                                ka: st.ka,
                                sr: st.sr,
                                vis_tech: st.mer_name || st.sr,
                                masterData: st
                            });
                        }}
                        onChangeText={(txt) => handleUpdateRowOverride(originalIdx, { store_name: txt })}
                    />
                </td>

                {/* REGION Input */}
                <td className="p-1.5 min-w-[90px]">
                    <input
                        type="text"
                        value={regionData.value}
                        placeholder="Region..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { region: e.target.value })}
                        className={`w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium ${regionData.auto ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    />
                </td>

                {/* CUSTOMER Input */}
                <td className="p-1.5 min-w-[100px]">
                    <input
                        type="text"
                        value={customerData.value}
                        placeholder="Customer..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { customer: e.target.value })}
                        className={`w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium ${customerData.auto ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    />
                </td>

                {/* KA Input */}
                <td className="p-1.5 min-w-[80px]">
                    <input
                        type="text"
                        value={kaData.value}
                        placeholder="KA..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { ka: e.target.value })}
                        className={`w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium ${kaData.auto ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    />
                </td>

                {/* SR Input */}
                <td className="p-1.5 min-w-[120px]">
                    <input
                        type="text"
                        value={srData.value}
                        placeholder="SR..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { sr: e.target.value })}
                        className={`w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium ${srData.auto ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    />
                </td>

                {/* CATEGORY Input */}
                <td className="p-1.5 min-w-[110px]">
                    <input
                        type="text"
                        value={categoryData.value}
                        placeholder="Hạng mục..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { category: e.target.value })}
                        className="w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-300"
                    />
                </td>

                {/* VIS-TECH Input */}
                <td className="p-1.5 min-w-[110px]">
                    <input
                        type="text"
                        value={visTechData.value}
                        placeholder="Vis-Tech..."
                        onChange={(e) => handleUpdateRowOverride(originalIdx, { vis_tech: e.target.value })}
                        className={`w-full text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:border-indigo-500 outline-none font-medium ${visTechData.auto ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    />
                </td>

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
                    Đã chọn <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedRows.size}</span> / {allValidRows.length} cửa hàng
                </span>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                        className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                    >
                        <Layers className="w-3.5 h-3.5" />
                        {showAdvancedMapping ? 'Ẩn cấu hình ánh xạ' : 'Cấu hình ánh xạ cột Excel'}
                        {showAdvancedMapping ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const next = new Set(selectedRows);
                            const allSelected = newRows.every(r => selectedRows.has(r.originalIdx));
                            newRows.forEach(r => {
                                if (allSelected) next.delete(r.originalIdx); else next.add(r.originalIdx);
                            });
                            setSelectedRows(next);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                        {newRows.length > 0 && newRows.every(r => selectedRows.has(r.originalIdx)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả mới'}
                    </button>
                </div>
            </div>

            {/* Advanced Mapping Controls */}
            {showAdvancedMapping && (
                <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 md:grid-cols-5 gap-2 shrink-0 animate-in fade-in duration-150">
                    {MAPPING_FIELDS.map(f => (
                        <div key={f.key} className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{f.label}</label>
                            <select
                                value={mapping[f.key]}
                                onChange={e => {
                                    const val = Number(e.target.value);
                                    setMapping(prev => ({ ...prev, [f.key]: val }));
                                }}
                                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none font-medium cursor-pointer"
                            >
                                <option value={-1}>-- Bỏ qua --</option>
                                {headers.map((h, idx) => (
                                    <option key={idx} value={idx}>{h || `Cột ${idx + 1}`}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="col-span-full pt-1 flex justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                saveMappingMemory(finalProject || 'default', mapping);
                                toast.success('💾 Đã lưu cấu hình ánh xạ mẫu cho dự án này!');
                            }}
                            className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Lưu cấu hình mẫu cho các lần sau
                        </button>
                    </div>
                </div>
            )}

            {/* Checklist Table */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {newRows.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                Cửa hàng chờ thêm mới ({newRows.length})
                            </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                            <table className="w-full text-left border-collapse min-w-[950px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="p-2 w-8 text-center"><input type="checkbox" onChange={() => {}} className="rounded" /></th>
                                        <th className="p-2 min-w-[140px]">Mã CH (Gõ/Tìm)</th>
                                        <th className="p-2 min-w-[160px]">Tên CH (Gõ/Tìm)</th>
                                        <th className="p-2 min-w-[90px]">Region</th>
                                        <th className="p-2 min-w-[100px]">Customer</th>
                                        <th className="p-2 min-w-[80px]">KA</th>
                                        <th className="p-2 min-w-[120px]">SR</th>
                                        <th className="p-2 min-w-[110px]">Hạng mục</th>
                                        <th className="p-2 min-w-[110px]">Vis-Tech</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newRows.map(item => renderRow(item, false))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {existingRows.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                Cửa hàng đã tồn tại ({existingRows.length})
                            </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-80">
                            <table className="w-full text-left border-collapse min-w-[950px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-500 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="p-2 w-8 text-center"><input type="checkbox" disabled className="rounded" /></th>
                                        <th className="p-2 min-w-[140px]">Mã CH</th>
                                        <th className="p-2 min-w-[160px]">Tên CH</th>
                                        <th className="p-2 min-w-[90px]">Region</th>
                                        <th className="p-2 min-w-[100px]">Customer</th>
                                        <th className="p-2 min-w-[80px]">KA</th>
                                        <th className="p-2 min-w-[120px]">SR</th>
                                        <th className="p-2 min-w-[110px]">Hạng mục</th>
                                        <th className="p-2 min-w-[110px]">Vis-Tech</th>
                                        <th className="p-2">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existingRows.map(item => renderRow(item, true))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {allValidRows.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                        Chưa có dữ liệu trích xuất từ file Excel này.
                    </div>
                )}
            </div>
        </div>
    );
}
