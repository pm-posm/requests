import React from 'react';
import type { StoreItem, StorePhase } from '@/types';
import { MasterStoreRow } from './MasterStoreRow';
import { ChevronDown } from 'lucide-react';

interface MasterStoreTableProps {
    storeItems: StoreItem[];
    phases: StorePhase[];           // all phases for this project
    visTechs: any[];
    suppliers: any[];
    customFields?: any[];
    updateField: (id: string, field: string, value: any) => void;
    selectedIds: Set<string>;
    onSelectAll: (checked: boolean) => void;
    onSelectOne: (id: string, checked: boolean) => void;
    onUpdateExpectedDate: (id: string, field: 'start' | 'end', date: string) => void;
    onBulkExpectedDate: (field: 'start' | 'end', date: string) => void;
    onStatusClick?: (id: string) => void;
}

export function MasterStoreTable({
    storeItems, phases,
    visTechs, suppliers, customFields = [],
    updateField,
    selectedIds, onSelectAll, onSelectOne,
    onUpdateExpectedDate, onBulkExpectedDate,
    onStatusClick
}: MasterStoreTableProps) {
    const allSelected = storeItems.length > 0 && storeItems.every(i => selectedIds.has(i.id));

    // Build a lookup: storeItemId -> phase (using current_phase)
    const phaseMap = React.useMemo(() => {
        const m = new Map<string, StorePhase>();
        phases.forEach(p => {
            const item = storeItems.find(s => s.id === p.store_item_id);
            if (item && p.phase === item.current_phase) m.set(p.store_item_id, p);
        });
        return m;
    }, [phases, storeItems]);

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm custom-scrollbar">
            <table className="w-full text-left border-collapse" style={{ minWidth: '1500px' }}>
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        {/* Checkbox */}
                        <th className="p-2 w-8 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={e => onSelectAll(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </th>

                        {/* Store Code */}
                        <th className="p-2.5 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 font-bold w-[110px]">
                            Mã CH
                        </th>

                        {/* Store Name */}
                        <th className="p-2.5 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 font-bold w-[160px]">
                            Tên CH
                        </th>

                        {/* Regular columns */}
                        <th className="p-2.5 font-bold min-w-[90px]">Region</th>
                        <th className="p-2.5 font-bold min-w-[90px]">Customer</th>
                        <th className="p-2.5 font-bold min-w-[80px]">KA</th>
                        <th className="p-2.5 font-bold min-w-[80px]">SR</th>
                        <th className="p-2.5 font-bold min-w-[100px]">Hạng mục</th>
                        {customFields.map(f => (
                            <th key={f.field_key} className="p-2.5 font-bold min-w-[120px]">
                                {f.field_name}
                            </th>
                        ))}

                        {/* Vis-Tech with bulk dropdown */}
                        <th className="p-2.5 font-bold min-w-[120px]">
                            <span>Vis-Tech</span>
                        </th>

                        {/* Supplier with bulk dropdown */}
                        <th className="p-2.5 font-bold min-w-[110px]">
                            <span>Supplier</span>
                        </th>

                        {/* Tiến độ with bulk dropdown */}
                        <th className="p-2.5 font-bold min-w-[110px]">
                            <span>Tiến độ</span>
                        </th>

                        {/* Ngày dự kiến with bulk date picker */}
                        <th className="p-2.5 font-bold min-w-[180px]">
                            <span>Ngày dự kiến</span>
                        </th>
                        
                        {/* Ngày thực tế */}
                        <th className="p-2.5 font-bold min-w-[100px]">
                            <span>Ngày thực tế</span>
                        </th>

                        <th className="p-2.5 font-bold min-w-[120px]">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {storeItems.length === 0 ? (
                        <tr>
                            <td colSpan={14} className="p-8 text-center text-slate-400 text-sm italic">
                                Chưa có cửa hàng nào. Hãy trích xuất từ file Excel hoặc thêm thủ công.
                            </td>
                        </tr>
                    ) : (
                        storeItems.map(item => (
                            <MasterStoreRow
                                key={item.id}
                                item={item}
                                phaseData={phaseMap.get(item.id) ?? null}
                                visTechs={visTechs}
                                suppliers={suppliers}
                                customFields={customFields}
                                updateField={updateField}
                                checked={selectedIds.has(item.id)}
                                onCheck={onSelectOne}
                                onUpdateExpectedDate={onUpdateExpectedDate}
                                onStatusClick={onStatusClick}
                            />
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function BulkSelect({ options, placeholder, onChange }: { options: any[]; placeholder: string; onChange: (val: string) => void }) {
    return (
        <div className="relative">
            <select
                onChange={e => { if (e.target.value) { onChange(e.target.value); e.target.value = ''; } }}
                className="appearance-none text-[9px] font-semibold border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 outline-none w-full pr-4 text-indigo-600 dark:text-indigo-400 cursor-pointer hover:border-indigo-400 transition-colors"
            >
                <option value="">-- {placeholder} --</option>
                {options.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>
    );
}
