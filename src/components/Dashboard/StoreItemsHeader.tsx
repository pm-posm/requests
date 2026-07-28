import React from 'react';
import { Layers, Clock, Settings } from 'lucide-react';

interface StoreItemsHeaderProps {
    activeTab: 'stores' | 'logs';
    setActiveTab: (tab: 'stores' | 'logs') => void;
    total: number;
    completed: number;
    errors: number;
    pending: number;
    setShowManageModal: (show: boolean) => void;
    setShowManageFieldsModal: (show: boolean) => void;
}

export function StoreItemsHeader({
    activeTab,
    setActiveTab,
    total,
    completed,
    errors,
    pending,
    setShowManageModal,
    setShowManageFieldsModal
}: StoreItemsHeaderProps) {
    return (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setActiveTab('stores')}
                    className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-all ${
                        activeTab === 'stores' 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-150' 
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Danh sách Store ({total})
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-all ${
                        activeTab === 'logs' 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-150' 
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Nhật ký hoạt động
                </button>
            </div>
            
            <div className="flex items-center gap-3.5">
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider border-r border-slate-150 dark:border-slate-800 pr-3">
                    <span className="text-slate-400">Chờ: {pending}</span>
                    <span className="text-emerald-500">Xong: {completed}</span>
                    {errors > 0 && <span className="text-rose-500">Lỗi: {errors}</span>}
                </div>
                <button
                    type="button"
                    onClick={() => setShowManageFieldsModal(true)}
                    className="text-[9px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 dark:bg-slate-950/20 dark:hover:bg-blue-950/20 transition-all border border-slate-150 dark:border-slate-850 cursor-pointer"
                    title="Cấu hình cột động cho bảng"
                >
                    <Settings className="w-3 h-3" />
                    Quản lý Cột
                </button>
                <button
                    type="button"
                    onClick={() => setShowManageModal(true)}
                    className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950/20 dark:hover:bg-indigo-950/20 transition-all border border-slate-150 dark:border-slate-850 cursor-pointer"
                    title="Quản lý danh sách nhà thầu & nhân sự"
                >
                    <Settings className="w-3 h-3" />
                    Cài đặt danh mục
                </button>
            </div>
        </div>
    );
}
