import React, { useState } from 'react';
import { Lock, Edit2, Check, X, Trash2, CheckSquare, Square, RefreshCw, ChevronDown } from 'lucide-react';
import type { StoreItem } from '@/types';
import { computePhaseStatus } from '@/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface StoreItemsTableProps {
    storeItems: StoreItem[];
    phases: any[];
    visTechs: any[];
    suppliers: any[];
    customFields?: any[];
    finalProjectName: string;
}

export function StoreItemsTable({
    storeItems,
    phases,
    visTechs,
    suppliers,
    customFields = [],
    finalProjectName
}: StoreItemsTableProps) {
    const queryClient = useQueryClient();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: any } | null>(null);
    const [bulkField, setBulkField] = useState<string>('');
    const [bulkValue, setBulkValue] = useState<string>('');
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

    const phaseMap = React.useMemo(() => {
        const m = new Map<string, any>();
        phases.forEach(p => {
            const item = storeItems.find(s => s.id === p.store_item_id);
            if (item && p.phase === item.current_phase) m.set(p.store_item_id, p);
        });
        return m;
    }, [phases, storeItems]);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '(Chưa chốt)';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return new Date(dateStr).toLocaleDateString('en-GB');
        } catch {
            return dateStr;
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.size === storeItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(storeItems.map(s => s.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSaveInline = async (id: string, field: string, value: any) => {
        try {
            const { error } = await supabase
                .from('project_store_items')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            toast.success('Đã cập nhật thành công!');
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProjectName] });
        } catch (err: any) {
            toast.error('Lỗi cập nhật: ' + err.message);
        } finally {
            setEditingCell(null);
        }
    };

    const handleApplyBulkEdit = async () => {
        if (!bulkField || selectedIds.size === 0) return;
        setIsSubmittingBulk(true);
        try {
            const ids = Array.from(selectedIds);
            const updatePayload: any = { updated_at: new Date().toISOString() };
            updatePayload[bulkField] = bulkValue || null;

            const { error } = await supabase
                .from('project_store_items')
                .update(updatePayload)
                .in('id', ids);

            if (error) throw error;
            toast.success(`Đã cập nhật cột ${bulkField} cho ${selectedIds.size} cửa hàng!`);
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProjectName] });
            setSelectedIds(new Set());
            setBulkField('');
            setBulkValue('');
        } catch (err: any) {
            toast.error('Lỗi cập nhật hàng loạt: ' + err.message);
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Bạn có chắc chắn muốn XÓA ${selectedIds.size} cửa hàng đã chọn khỏi dự án?`)) return;
        setIsSubmittingBulk(true);
        try {
            const ids = Array.from(selectedIds);
            const { error } = await supabase
                .from('project_store_items')
                .delete()
                .in('id', ids);

            if (error) throw error;
            toast.success(`Đã xóa ${selectedIds.size} cửa hàng!`);
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProjectName] });
            setSelectedIds(new Set());
        } catch (err: any) {
            toast.error('Lỗi xóa hàng loạt: ' + err.message);
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    const renderEditableCell = (item: StoreItem, field: string, defaultValue: string, options?: string[]) => {
        const isEditing = editingCell?.id === item.id && editingCell?.field === field;
        
        if (isEditing) {
            if (options && options.length > 0) {
                return (
                    <select
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => handleSaveInline(item.id, field, editingCell.value)}
                        className="text-xs p-1 rounded border border-indigo-500 bg-white dark:bg-slate-900 outline-none w-full"
                    >
                        <option value="">-- Chọn --</option>
                        {options.map((opt: any) => (
                            <option key={opt.id || opt.name || opt} value={opt.name || opt}>
                                {opt.name || opt}
                            </option>
                        ))}
                    </select>
                );
            }
            return (
                <div className="flex items-center gap-1">
                    <input
                        autoFocus
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInline(item.id, field, editingCell.value);
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                        className="text-xs p-1 rounded border border-indigo-500 bg-white dark:bg-slate-900 outline-none w-full"
                    />
                    <button onClick={() => handleSaveInline(item.id, field, editingCell.value)} className="text-emerald-600 hover:text-emerald-700 p-0.5">
                        <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingCell(null)} className="text-rose-500 hover:text-rose-600 p-0.5">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            );
        }

        return (
            <div 
                onClick={() => setEditingCell({ id: item.id, field, value: defaultValue || '' })}
                className="cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 p-1 rounded transition-colors group/cell flex items-center justify-between gap-1 min-h-[26px]"
                title="Bấm để chỉnh sửa inline"
            >
                <span className={`text-xs ${!defaultValue ? 'text-slate-300 italic' : 'text-slate-700 dark:text-slate-300 font-medium'}`}>
                    {defaultValue || '—'}
                </span>
                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
            </div>
        );
    };

    return (
        <div className="space-y-3">
            {/* BULK EDIT TOOLBAR */}
            {selectedIds.size > 0 && (
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-300" />
                        <span className="text-xs font-bold">Đã chọn {selectedIds.size}/{storeItems.length} cửa hàng</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-indigo-100 font-semibold">Chỉnh sửa hàng loạt:</span>
                        <select
                            value={bulkField}
                            onChange={(e) => {
                                setBulkField(e.target.value);
                                setBulkValue('');
                            }}
                            className="text-xs p-1.5 rounded-lg bg-indigo-700 text-white font-bold border border-indigo-500 outline-none"
                        >
                            <option value="">-- Chọn cột cần cập nhật --</option>
                            <option value="store_name">Tên Cửa Hàng (Store Name)</option>
                            <option value="region">Vùng (Region)</option>
                            <option value="customer">Khách Hàng (Customer)</option>
                            <option value="ka">KA</option>
                            <option value="sr">SR</option>
                            <option value="category">Hạng Mục (Category)</option>
                            <option value="vis_tech">Kỹ Thuật Viên (Vis-Tech)</option>
                            <option value="supplier_name">Nhà Thầu (Supplier)</option>
                        </select>

                        {bulkField === 'vis_tech' ? (
                            <select
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                className="text-xs p-1.5 rounded-lg bg-white text-slate-800 font-medium outline-none"
                            >
                                <option value="">-- Chọn Kỹ thuật viên --</option>
                                {visTechs.map((v: any) => (
                                    <option key={v.id} value={v.name}>{v.name}</option>
                                ))}
                            </select>
                        ) : bulkField === 'supplier_name' ? (
                            <select
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                className="text-xs p-1.5 rounded-lg bg-white text-slate-800 font-medium outline-none"
                            >
                                <option value="">-- Chọn Nhà thầu --</option>
                                {suppliers.map((s: any) => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        ) : bulkField ? (
                            <input
                                type="text"
                                placeholder={`Nhập giá trị mới cho ${bulkField}...`}
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                className="text-xs p-1.5 rounded-lg bg-white text-slate-800 font-medium outline-none min-w-[180px]"
                            />
                        ) : null}

                        {bulkField && (
                            <button
                                onClick={handleApplyBulkEdit}
                                disabled={isSubmittingBulk}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                                Áp dụng hàng loạt
                            </button>
                        )}

                        <button
                            onClick={handleBulkDelete}
                            disabled={isSubmittingBulk}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ml-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa các mục chọn
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm custom-scrollbar">
                <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1.5">
                        💡 Mẹo: Bấm trực tiếp vào từng ô để chỉnh sửa nhanh (Inline Edit) hoặc tích chọn các cửa hàng để cập nhật hàng loạt.
                    </p>
                </div>
                <table className="w-full text-left border-collapse min-w-[1300px]">
                    <thead>
                        <tr className="bg-secondary text-[11px] text-muted-foreground uppercase tracking-wider">
                            <th className="p-3 font-semibold border-b border-border w-[40px] text-center">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.size === storeItems.length && storeItems.length > 0} 
                                    onChange={handleSelectAll} 
                                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                            </th>
                            <th className="p-3 font-semibold border-b border-border w-[120px]">Store Code</th>
                            <th className="p-3 font-semibold border-b border-border w-[180px]">Store Name</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[100px]">Region</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[100px]">Customer</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[80px]">KA</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[80px]">SR</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[120px]">Hạng mục</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[100px]">Vis-tech</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[120px]">Supplier</th>
                            {customFields.map(f => (
                                <th key={f.field_key} className="p-3 font-semibold border-b border-border min-w-[120px]">
                                    {f.field_name}
                                </th>
                            ))}
                            <th className="p-3 font-semibold border-b border-border min-w-[100px]">Tiến độ hiện tại</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[140px]">Ngày dự kiến</th>
                            <th className="p-3 font-semibold border-b border-border min-w-[120px]">Ngày thực tế</th>
                            <th className="p-3 font-semibold border-b border-border w-[120px]">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {storeItems.map((item) => {
                            const currentPhase = item.current_phase || "Khảo sát";
                            const phaseData = phaseMap.get(item.id) || null;
                            const { status: currentStatus, isLate } = computePhaseStatus(phaseData);
                            const isSelected = selectedIds.has(item.id);
                            
                            return (
                                <tr key={item.id} className={`group hover:bg-secondary/50 transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/30' : ''} ${item.is_locked ? "opacity-70" : ""}`}>
                                    <td className="p-3 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleSelect(item.id)} 
                                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-1.5">
                                            {item.is_locked && <Lock className="w-3 h-3 text-indigo-500 shrink-0" />}
                                            {item.store_code}
                                        </div>
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'store_name', item.store_name || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'region', item.region || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'customer', item.customer || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'ka', item.ka || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'sr', item.sr || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'category', item.category || '')}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'vis_tech', item.vis_tech || '', visTechs)}
                                    </td>
                                    <td className="p-3 text-xs">
                                        {renderEditableCell(item, 'supplier_name', item.supplier_name || '', suppliers)}
                                    </td>
                                    {customFields.map(f => {
                                        const val = item.custom_properties?.[f.field_key];
                                        return (
                                            <td key={f.field_key} className="p-3 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                                {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
                                            </td>
                                        );
                                    })}
                                    <td className="p-3 text-[11px] font-bold text-slate-700 dark:text-slate-300">{currentPhase || "—"}</td>
                                    <td className="p-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {phaseData?.expected_start ? (
                                            <div className="flex flex-col gap-0.5 whitespace-nowrap">
                                                <span>{formatDate(phaseData.expected_start)} -</span>
                                                <span>{formatDate(phaseData.expected_end)}</span>
                                            </div>
                                        ) : <span className="italic">Chưa có</span>}
                                    </td>
                                    <td className="p-3 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                        {phaseData?.actual_date ? formatDate(phaseData.actual_date) : <span className="italic">Chưa có</span>}
                                    </td>
                                    <td className="p-2 text-xs">
                                        <div className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-center ${currentStatus === "Hoàn tất" ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : currentStatus === "Đang làm" && isLate ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : currentStatus === "Đang làm" ? "bg-primary/10 text-primary" : currentStatus.startsWith("Lỗi") ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                                            {currentStatus}{currentStatus === "Đang làm" && isLate ? " (Trễ)" : ""}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
