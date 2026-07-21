import React from 'react';
import { CheckCircle2, Users, Activity, Settings2, Calendar } from 'lucide-react';
import type { StoreItem, StorePhase } from '@/types';
import { MasterStoreTable } from '../table/MasterStoreTable';
import { computePhaseStatus } from '@/hooks/useStorePhases';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface MasterStoreTabProps {
    storeItems: StoreItem[];
    phases: StorePhase[];
    visTechs: any[];
    suppliers: any[];
    updateField: (id: string, field: string, value: any) => void;
    onDelete: (id: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onOpenPhaseModal: (items: StoreItem[]) => void;
    onBulkVisTech: (val: string, ids: Set<string>) => void;
    onBulkSupplier: (val: string, ids: Set<string>) => void;
    onBulkPhase: (val: string, ids: Set<string>) => void;
    onPublish: () => void;
    isPublishing: boolean;
    onUpdateExpectedDate: (id: string, field: 'start' | 'end', date: string) => void;
    onBulkExpectedDate: (field: 'start' | 'end', date: string, selectedIds: Set<string>) => void;
}

export function MasterStoreTab({
    storeItems, phases, visTechs, suppliers,
    updateField, onDelete, onBulkDelete, onOpenPhaseModal,
    onBulkVisTech, onBulkSupplier, onBulkPhase,
    onPublish, isPublishing,
    onUpdateExpectedDate, onBulkExpectedDate
}: MasterStoreTabProps) {
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = React.useState<{ type: 'publish' | 'delete', ids?: string[] } | null>(null);

    const totalCount = storeItems.length;
    const publishedCount = storeItems.filter(s => s.is_published).length;
    const draftCount = totalCount - publishedCount;

    // Compute stats
    const completedCount = React.useMemo(() => {
        return storeItems.filter(item => {
            const phaseData = phases.find(p => p.store_item_id === item.id && p.phase === item.current_phase);
            return computePhaseStatus(phaseData).status === 'completed';
        }).length;
    }, [storeItems, phases]);

    const lateCount = React.useMemo(() => {
        return storeItems.filter(item => {
            const phaseData = phases.find(p => p.store_item_id === item.id && p.phase === item.current_phase);
            return computePhaseStatus(phaseData).status === 'late';
        }).length;
    }, [storeItems, phases]);

    const handleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? new Set(storeItems.map(i => i.id)) : new Set());
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) next.add(id); else next.delete(id);
        setSelectedIds(next);
    };

    const handleBulkVisTech = async (val: string) => {
        const targets = selectedIds.size > 0 ? storeItems.filter(i => selectedIds.has(i.id)) : storeItems;
        await Promise.all(targets.map(i => updateField(i.id, 'vis_tech', val)));
    };

    // Removed handleBulkSupplier as it was replaced directly in the select onChange.

    const handleBulkPhase = async (val: string) => {
        const targets = selectedIds.size > 0 ? storeItems.filter(i => selectedIds.has(i.id)) : storeItems;
        await Promise.all(targets.map(i => updateField(i.id, 'current_phase', val)));
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header bar */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">Dữ liệu Master Store</h4>
                    <div className="flex items-center gap-3">
                        {/* Stats */}
                        <StatChip icon={<Users className="w-3 h-3" />} value={totalCount} label="Tổng" color="text-slate-600" />
                        {draftCount > 0 && <StatChip value={draftCount} label="Bản nháp" color="text-amber-600" />}
                        {completedCount > 0 && <StatChip value={completedCount} label="Hoàn tất" color="text-emerald-600" />}
                        {lateCount > 0 && <StatChip value={lateCount} label="Trễ" color="text-rose-600" />}
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                Đã chọn {selectedIds.size} store
                            </span>
                            <button
                                onClick={() => setConfirmAction({ type: 'delete', ids: Array.from(selectedIds) })}
                                className="bg-rose-100 hover:bg-rose-200 text-rose-600 text-xs font-bold py-1 px-3 rounded-lg transition-colors cursor-pointer"
                            >
                                Xóa đã chọn
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setConfirmAction({ type: 'publish' })}
                    disabled={isPublishing || draftCount === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title={draftCount === 0 ? 'Không có bản nháp nào' : `Công bố ${draftCount} bản nháp`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isPublishing ? 'Đang xử lý...' : `Lưu & Công bố${draftCount > 0 ? ` (${draftCount})` : ''}`}
                </button>
            </div>
            
            {/* Confirm Dialogs */}
            <ConfirmDialog 
                isOpen={confirmAction?.type === 'publish'}
                onClose={() => setConfirmAction(null)}
                onConfirm={onPublish}
                title="Xác nhận Lưu & Công bố"
                description={
                    <div>
                        <p className="mb-2">Bạn đang chuẩn bị công bố <strong>{draftCount} cửa hàng</strong> vào hệ thống chính thức.</p>
                        <p>Các dữ liệu này sẽ được đồng bộ và các bộ phận liên quan có thể bắt đầu theo dõi tiến độ công việc.</p>
                        <p className="mt-2 text-amber-600 dark:text-amber-500 font-semibold text-xs">Lưu ý: Không thể hoàn tác hành động này.</p>
                    </div>
                }
                confirmText="Công bố ngay"
            />

            <ConfirmDialog 
                isOpen={confirmAction?.type === 'delete'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (confirmAction?.ids) {
                        onBulkDelete(confirmAction.ids);
                        setSelectedIds(new Set());
                    }
                }}
                title="Xác nhận xóa hàng loạt"
                description={`Bạn có chắc chắn muốn xóa vĩnh viễn ${confirmAction?.ids?.length || 0} cửa hàng đã chọn khỏi hệ thống? Dữ liệu này sẽ không thể khôi phục lại.`}
                confirmText="Xóa vĩnh viễn"
                cancelText="Hủy bỏ"
                isDestructive={true}
            />
            
            <div className="px-4 pb-2 bg-white dark:bg-slate-900 flex justify-end">
                <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Mọi chỉnh sửa trực tiếp trên bảng đều được tự động lưu.
                </span>
            </div>

            {/* Info note */}
            {draftCount > 0 && (
                <div className="bg-amber-50/50 border-b border-amber-100/50 px-4 py-2.5 flex items-center justify-center">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                        <span className="text-amber-500">⚠️</span>
                        <span className="font-bold">{draftCount} cửa hàng bản nháp</span> — chưa hiển thị ra ngoài màn hình dự án. Bấm "Lưu & Công bố" để hoàn tất.
                    </p>
                </div>
            )}

            {/* Bulk Toolbar */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center gap-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Settings2 className="w-4 h-4 text-slate-400" />
                    Điều phối hàng loạt:
                </div>
                
                {/* Supplier */}
                <select 
                    className="text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 outline-none w-36 text-slate-700 dark:text-slate-300 cursor-pointer hover:border-indigo-400 transition-colors"
                    onChange={e => { 
                        if (e.target.value) { 
                            const targets = selectedIds.size > 0 ? selectedIds : new Set(storeItems.map(i => i.id));
                            onBulkSupplier(e.target.value, targets); 
                            e.target.value = ''; 
                        } 
                    }}
                >
                    <option value="">-- Gán Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>

                {/* Removed Vis-Tech and Phase dropdowns per PM's request */}

                {/* Phase Modal Trigger */}
                <div className="flex items-center gap-2 border-l border-slate-300 dark:border-slate-700 pl-4 ml-auto">
                    <button
                        onClick={() => {
                            if (selectedIds.size >= 1) {
                                const selectedItems = storeItems.filter(i => selectedIds.has(i.id));
                                if (selectedItems.length > 0) onOpenPhaseModal(selectedItems);
                            }
                        }}
                        disabled={selectedIds.size < 1}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors ${
                            selectedIds.size >= 1 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-sm'
                                : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                        }`}
                        title={selectedIds.size >= 1 ? 'Mở Xử lý công việc cho các cửa hàng đã chọn' : 'Vui lòng tick chọn ít nhất 1 cửa hàng để xử lý công việc'}
                    >
                        <Settings2 className="w-4 h-4" />
                        Xử lý công việc {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/20">
                <MasterStoreTable
                    storeItems={storeItems}
                    phases={phases}
                    visTechs={visTechs}
                    suppliers={suppliers}
                    updateField={updateField}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    onSelectOne={handleSelectOne}
                    onUpdateExpectedDate={onUpdateExpectedDate}
                    onBulkExpectedDate={(field, date) => onBulkExpectedDate(field, date, selectedIds)}
                    onStatusClick={(id) => {
                        const item = storeItems.find(i => i.id === id);
                        if (item) onOpenPhaseModal([item]);
                    }}
                />
            </div>
        </div>
    );
}

function StatChip({ icon, value, label, color }: { icon?: React.ReactNode; value: number; label: string; color: string }) {
    return (
        <div className={`flex items-center gap-1 text-xs font-bold ${color}`}>
            {icon}
            <span>{value}</span>
            <span className="text-slate-400 font-medium">{label}</span>
        </div>
    );
}
