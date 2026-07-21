import React from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { computePhaseStatus } from '@/utils';
import type { StoreItem } from '@/types';

interface ExcelImportedListProps {
    phaseType: string;
    storeItems: StoreItem[];
    localExpectedDate: string;
    isConfirmed: boolean;
    deleteItemMutation: any;
    setSelectedNtxxItem: (item: StoreItem | null) => void;
    setShowNtxxModal: (v: boolean) => void;
    activeDragCol: string | null;
}

const ntxxColumns = [
    { status: 'Cần hành động', label: 'Cần hành động', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    { status: 'Chờ làm', label: 'Chờ làm', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30' },
    { status: 'Đang làm', label: 'Đang làm', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30' },
    { status: 'Quá hạn', label: 'Quá hạn', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30' },
    { status: 'Hoàn thành', label: 'Hoàn thành', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
    { status: 'Lỗi', label: 'Lỗi', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' }
];

const standardColumns = [
    { status: 'Chờ làm', label: 'Chờ làm', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    { status: 'Đang làm', label: 'Đang làm', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/30' },
    { status: 'Hoàn tất', label: 'Hoàn tất', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
    { status: 'Lỗi', label: 'Lỗi', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' }
];

export function ExcelImportedList({
    phaseType,
    storeItems,
    localExpectedDate,
    isConfirmed,
    deleteItemMutation,
    setSelectedNtxxItem,
    setShowNtxxModal,
    activeDragCol
}: ExcelImportedListProps) {
    const kanbanColumns = phaseType === 'NTXX' ? ntxxColumns : standardColumns;

    return (
        <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
            {(!localExpectedDate || !isConfirmed) && (
                <div className="absolute inset-0 z-10 bg-slate-50/60 dark:bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 rounded-2xl">
                    <Lock className="w-8 h-8 text-indigo-500 mb-2 opacity-80" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Kéo Thả Kanban Bị Khóa</p>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1">Vui lòng chọn Ngày dự kiến triển khai và tick Xác nhận cam kết ở cột bên trái để mở khóa.</p>
                </div>
            )}
            <div className="shrink-0">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    💡 Bảng Kanban Tiến độ Dự Án (Kéo thả thẻ Excel vào đây để lưu):
                </label>
                <p className="text-[10px] text-slate-400 mt-1">
                    * Anh hãy kéo thả các thẻ cửa hàng từ bên trái vào 4 cột bên dưới để nhập danh sách và cập nhật trạng thái lập tức.
                </p>
            </div>

            {/* Kanban Columns Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
                {kanbanColumns.map(col => {
                    const colItems = storeItems?.map(s => {
                        if (phaseType === 'NTXX') {
                            const computed = computePhaseStatus(s.ntxx_data);
                            return { ...s, _display_status: computed.status, _display_detail: computed.detail };
                        }
                        return { ...s, _display_status: (s as any)[phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALL' ? 'installation_status' : 'acceptance_status'] || 'Chờ làm' };
                    }).filter(s => (s as any)._display_status === col.status) || [];
                    const isHovered = activeDragCol === col.status;

                    return (
                        <div
                            key={col.status}
                            className={`flex flex-col p-3 rounded-2xl border transition-all min-h-[300px] max-h-[500px] ${
                                isHovered 
                                    ? 'bg-indigo-50/40 border-indigo-400 dark:bg-indigo-950/10 dark:border-indigo-900/50 scale-[1.02] shadow-md shadow-indigo-100/10' 
                                    : 'bg-slate-50/40 border-slate-200/50 dark:bg-slate-950/10 dark:border-slate-850'
                            }`}
                        >
                            {/* Col Header */}
                            <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className={`text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-md border ${col.badgeColor}`}>
                                    {col.label} ({colItems.length})
                                </span>
                            </div>

                            {/* Col Cards list */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[400px]">
                                {colItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200/40 dark:border-slate-800/40 rounded-xl">
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 italic">Trống</span>
                                    </div>
                                ) : (
                                    colItems.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (phaseType === 'NTXX') {
                                                    setSelectedNtxxItem(item);
                                                    setShowNtxxModal(true);
                                                }
                                            }}
                                            className={`bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2.5 rounded-xl shadow-2xs space-y-1 relative group hover:border-slate-350 dark:hover:border-slate-700 transition-all select-none ${phaseType === 'NTXX' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
                                        >
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteItemMutation.mutate(item.id); }}
                                                className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                                                title="Xóa cửa hàng này khỏi DB"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{item.store_code}</div>
                                            {item.store_name && <div className="text-[9px] text-slate-400 font-medium">{item.store_name}</div>}
                                            {item.category && <span className="inline-block text-[8px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 px-1 py-0 rounded">{item.category}</span>}
                                            {item.supplier_name && <div className="text-[8px] text-slate-500 font-medium">{item.supplier_name}</div>}
                                            {(item as any)._display_detail && <div className="mt-1 text-[8px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 p-0.5 rounded px-1 w-fit">{(item as any)._display_detail}</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
