import React from 'react';
import { Lock } from 'lucide-react';
import type { StoreItem } from '@/types';
import { computePhaseStatus } from '@/utils';

interface StoreItemsTableProps {
    storeItems: StoreItem[];
    phases: any[];
    visTechs: any[];
    suppliers: any[];
    customFields?: any[];
}

export function StoreItemsTable({
    storeItems,
    phases,
    visTechs,
    suppliers,
    customFields = [],
}: StoreItemsTableProps) {
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
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return new Date(dateStr).toLocaleDateString('en-GB');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm mt-4 custom-scrollbar">
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    ⚠️ Bảng dữ liệu này chỉ dùng để xem. Để chỉnh sửa chi tiết, vui lòng mở "Trung tâm Quản lý & Trích xuất".
                </p>
            </div>
            <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                    <tr className="bg-secondary text-[11px] text-muted-foreground uppercase tracking-wider">
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
                        
                        return (
                            <tr key={item.id} className={`group hover:bg-secondary/50 transition-colors ${item.is_locked ? "opacity-70" : ""}`}>
                                <td className="p-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                    <div className="flex items-center gap-1.5">
                                        {item.is_locked && <Lock className="w-3 h-3 text-indigo-500 shrink-0" />}
                                        {item.store_code}
                                    </div>
                                </td>
                                <td className="p-3 text-xs font-semibold text-slate-900 dark:text-white line-clamp-2" title={item.store_name}>
                                    {item.store_name || "(Trống)"}
                                </td>
                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.region || "—"}</td>
                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.customer || "—"}</td>
                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.ka || "—"}</td>
                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.sr || "—"}</td>
                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.category || "—"}</td>
                                <td className="p-3 text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.vis_tech || "—"}</td>
                                <td className="p-3 text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.supplier_name || "—"}</td>
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
    );
}
