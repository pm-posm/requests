import React from 'react';
import { Layers, Clock, Settings, Search, Filter, CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react';

interface StoreItemsHeaderProps {
    activeTab: 'stores' | 'logs';
    setActiveTab: (tab: 'stores' | 'logs') => void;
    total: number;
    completed: number;
    errors: number;
    late: number;
    pending: number;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    phaseFilter: string;
    setPhaseFilter: (phase: string) => void;
    supplierFilter: string;
    setSupplierFilter: (supplier: string) => void;
    suppliers: any[];
    setShowManageModal: (show: boolean) => void;
    setShowManageFieldsModal: (show: boolean) => void;
    onExportExcel?: () => void;
}

export function StoreItemsHeader({
    activeTab,
    setActiveTab,
    total,
    completed,
    errors,
    late,
    pending,
    searchTerm,
    setSearchTerm,
    phaseFilter,
    setPhaseFilter,
    supplierFilter,
    setSupplierFilter,
    suppliers = [],
    setShowManageModal,
    setShowManageFieldsModal,
    onExportExcel
}: StoreItemsHeaderProps) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            {/* Top Bar: Tabs & KPI Progress Summary */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setActiveTab('stores')}
                        className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === 'stores' 
                                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        Danh sách Store ({total})
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === 'logs' 
                                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Nhật ký hoạt động
                    </button>
                </div>

                {/* Progress KPI Bar */}
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-150 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">Tiến độ:</span>
                        <div className="w-24 sm:w-32 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                            <div style={{ width: `${percent}%` }} className="bg-emerald-500 h-full transition-all" title={`Hoàn thành ${percent}%`} />
                        </div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{percent}%</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-[11px] font-bold border-l border-slate-200 dark:border-slate-800 pl-3">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title="Đã hoàn tất">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {completed}
                        </span>
                        {late > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Trễ hạn">
                                <AlertTriangle className="w-3.5 h-3.5" /> {late} Trễ
                            </span>
                        )}
                        {errors > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1" title="Có lỗi">
                                <XCircle className="w-3.5 h-3.5" /> {errors} Lỗi
                            </span>
                        )}
                        <span className="text-slate-400">Chờ: {pending}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {onExportExcel && (
                        <button
                            type="button"
                            onClick={onExportExcel}
                            className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer shadow-xs"
                            title="Xuất danh sách cửa hàng ra file Excel"
                        >
                            <Download className="w-3 h-3 text-emerald-600" />
                            Xuất Báo Cáo Excel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowManageFieldsModal(true)}
                        className="text-[10px] font-bold text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
                        title="Cấu hình cột động cho bảng"
                    >
                        <Settings className="w-3 h-3" />
                        Quản lý Cột
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowManageModal(true)}
                        className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
                        title="Quản lý danh sách nhà thầu & nhân sự"
                    >
                        <Settings className="w-3 h-3" />
                        Cài đặt danh mục
                    </button>
                </div>
            </div>

            {/* Bottom Bar: Search & Filtering (Only visible in 'stores' tab) */}
            {activeTab === 'stores' && (
                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm theo mã CH hoặc tên cửa hàng..."
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 font-medium text-slate-800 dark:text-slate-200"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <Filter className="w-3 h-3 text-indigo-500" /> Giai đoạn:
                        </div>
                        <select
                            value={phaseFilter}
                            onChange={e => setPhaseFilter(e.target.value)}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                            <option value="ALL">Tất cả giai đoạn</option>
                            <option value="Brief">Brief</option>
                            <option value="Khảo sát">Khảo sát</option>
                            <option value="NTXX">NTXX</option>
                            <option value="Lắp đặt">Lắp đặt</option>
                        </select>

                        {suppliers.length > 0 && (
                            <select
                                value={supplierFilter}
                                onChange={e => setSupplierFilter(e.target.value)}
                                className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                            >
                                <option value="ALL">Tất cả nhà thầu</option>
                                {suppliers.map((s: any) => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
