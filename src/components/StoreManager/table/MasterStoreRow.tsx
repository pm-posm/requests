import React from 'react';
import { Edit3, Trash2, Lock } from 'lucide-react';
import type { StoreItem, StorePhase } from '@/types';
import { computePhaseStatus } from '@/hooks/useStorePhases';

const STATUS_STYLES: Record<string, string> = {
    unscheduled: 'bg-secondary text-muted-foreground',
    scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    in_progress: 'bg-primary/10 text-primary',
    late: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    completed: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    error: 'bg-destructive/10 text-destructive',
};

const DRAFT_BADGE = 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400';

interface MasterStoreRowProps {
    item: StoreItem;
    phaseData?: StorePhase | null;
    visTechs: any[];
    suppliers: any[];
    customFields?: any[];
    updateField: (id: string, field: string, value: any) => void;
    checked: boolean;
    onCheck: (id: string, checked: boolean) => void;
    onUpdateExpectedDate: (id: string, field: 'start' | 'end', date: string) => void;
    onStatusClick?: (id: string) => void;
}

function formatDateRange(phase?: StorePhase | null) {
    if (!phase?.expected_start) return null;
    const fmt = (d: string) => {
        const [y, m, dd] = d.split('-');
        return `${dd}/${m}`;
    };
    return phase.expected_end
        ? `${fmt(phase.expected_start)} → ${fmt(phase.expected_end)}`
        : fmt(phase.expected_start);
}

export function MasterStoreRow({
    item, phaseData, visTechs, suppliers, customFields = [],
    updateField,
    checked, onCheck, onUpdateExpectedDate,
    onStatusClick
}: MasterStoreRowProps) {
    const { status, label } = computePhaseStatus(phaseData);
    const dateRange = formatDateRange(phaseData);
    const isDraft = !item.is_published;

    const [supplierText, setSupplierText] = React.useState(item.supplier_name || '');

    React.useEffect(() => {
        setSupplierText(item.supplier_name || '');
    }, [item.supplier_name]);

    return (
        <tr className={`group transition-colors ${item.is_locked ? 'opacity-60' : ''} hover:bg-secondary/50`}>
            {/* Checkbox */}
            <td className="p-2 w-8 bg-card group-hover:bg-secondary/50 border-r border-border">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => onCheck(item.id, e.target.checked)}
                    className="rounded text-primary focus:ring-primary cursor-pointer"
                />
            </td>

            {/* Store Code */}
            <td className="p-2.5 bg-white dark:bg-slate-900 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 border-r border-slate-100 dark:border-slate-800 min-w-[110px]">
                <div className="flex items-center gap-1">
                    {item.is_locked && <Lock className="w-3 h-3 text-indigo-400 shrink-0" />}
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 font-mono">{item.store_code}</span>
                </div>
                {isDraft && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${DRAFT_BADGE}`}>Bản nháp</span>}
            </td>

            {/* Store Name */}
            <td className="p-2.5 bg-white dark:bg-slate-900 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 border-r border-slate-100 dark:border-slate-800 min-w-[160px]">
                <span className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-2">{item.store_name || '—'}</span>
            </td>

            {/* Region */}
            <td className="p-2 min-w-[90px]">
                <EditableCell value={item.region} onSave={v => updateField(item.id, 'region', v)} placeholder="Region..." />
            </td>

            {/* Customer */}
            <td className="p-2 min-w-[90px]">
                <EditableCell value={item.customer} onSave={v => updateField(item.id, 'customer', v)} placeholder="Customer..." />
            </td>

            {/* KA */}
            <td className="p-2 min-w-[80px]">
                <EditableCell value={item.ka} onSave={v => updateField(item.id, 'ka', v)} placeholder="KA..." />
            </td>

            {/* SR */}
            <td className="p-2 min-w-[80px]">
                <EditableCell value={item.sr} onSave={v => updateField(item.id, 'sr', v)} placeholder="SR..." />
            </td>

            {/* Hạng mục */}
            <td className="p-2 min-w-[100px]">
                <EditableCell value={item.category} onSave={v => updateField(item.id, 'category', v)} placeholder="Hạng mục..." />
            </td>

            {/* Custom Fields */}
            {customFields.map(f => (
                <td key={f.field_key} className="p-2 min-w-[120px]">
                    <EditableCell 
                        value={item.custom_properties?.[f.field_key]?.toString() || ''} 
                        onSave={v => updateField(item.id, 'custom_properties', { ...(item.custom_properties || {}), [f.field_key]: v })} 
                        placeholder={`${f.field_name}...`} 
                    />
                </td>
            ))}

            {/* Vis-Tech */}
            <td className="p-2 min-w-[120px]">
                <select
                    value={item.vis_tech || ''}
                    onChange={e => updateField(item.id, 'vis_tech', e.target.value)}
                    className="w-full text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-transparent outline-none cursor-pointer rounded py-1 px-1 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent focus:border-slate-300 transition-colors"
                >
                    <option value="">-- Trống --</option>
                    {visTechs.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
            </td>

            {/* Supplier - Combined Dropdown & Free Text Input */}
            <td className="p-2 min-w-[130px]">
                <div className="relative w-full">
                    <input
                        type="text"
                        list={`supplier-datalist-${item.id}`}
                        value={supplierText}
                        placeholder="-- Gán / gõ Supplier --"
                        onChange={e => {
                            const val = e.target.value;
                            setSupplierText(val);
                            const options = suppliers ? suppliers.map((s: any) => typeof s === 'string' ? s : s.name) : [];
                            if (options.includes(val)) {
                                updateField(item.id, 'supplier_name', val);
                            }
                        }}
                        onBlur={e => {
                            const val = e.target.value.trim();
                            if (val !== (item.supplier_name || '')) {
                                updateField(item.id, 'supplier_name', val);
                            }
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        className="w-full text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none rounded py-1 px-2 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 transition-colors shadow-2xs"
                    />
                    <datalist id={`supplier-datalist-${item.id}`}>
                        {suppliers && suppliers.map((s, idx) => (
                            <option key={idx} value={typeof s === 'string' ? s : s.name} />
                        ))}
                    </datalist>
                </div>
            </td>

            {/* Tiến độ */}
            <td className="p-2 min-w-[110px]">
                <div className="flex items-center gap-1.5 min-w-max">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">{item.current_phase || '—'}</span>
                </div>
            </td>

            {/* Ngày dự kiến (Hiển thị tĩnh, chỉnh sửa qua Modal Xử lý công việc) */}
            <td className="p-2 min-w-[140px] text-[10px] font-medium text-slate-600 dark:text-slate-400">
                {phaseData?.expected_start ? (
                    <div className="flex flex-col gap-0.5 whitespace-nowrap" title="Cập nhật Ngày dự kiến qua Modal Xử lý công việc">
                        <span>{phaseData.expected_start.split('-').reverse().join('/')} -</span>
                        <span>{phaseData.expected_end ? phaseData.expected_end.split('-').reverse().join('/') : '(Chưa chốt)'}</span>
                    </div>
                ) : <span className="italic text-slate-400">Chưa có</span>}
            </td>

            {/* Ngày thực tế */}
            <td className="p-2 min-w-[100px] text-[11px] font-medium text-slate-600 dark:text-slate-400">
                {phaseData?.actual_date ? phaseData.actual_date.split('-').reverse().join('/') : <span className="italic">Chưa có</span>}
            </td>




            {/* Trạng thái */}
            <td className="p-2 min-w-[120px]">
                <button 
                    onClick={() => onStatusClick?.(item.id)}
                    title="Click để mở bảng Cập nhật chi tiết"
                    className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap transition-all hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer ${STATUS_STYLES[status]}`}
                >
                    {label}
                </button>
            </td>
        </tr>
    );
}

// Inline editable cell
function EditableCell({ value, onSave, placeholder }: { value?: string; onSave: (v: string) => void; placeholder: string }) {
    const [editing, setEditing] = React.useState(false);
    const [val, setVal] = React.useState(value || '');
    React.useEffect(() => { setVal(value || ''); }, [value]);

    if (editing) {
        return (
            <input
                autoFocus
                value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={() => { onSave(val); setEditing(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-indigo-300 rounded px-1.5 py-1 outline-none"
                placeholder={placeholder}
            />
        );
    }
    return (
        <span
            onClick={() => setEditing(true)}
            className="text-xs text-slate-600 dark:text-slate-300 cursor-text hover:bg-slate-100 dark:hover:bg-slate-800 px-1 py-0.5 rounded block truncate"
        >
            {val || <span className="text-slate-300 italic">{placeholder}</span>}
        </span>
    );
}
