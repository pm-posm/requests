import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Building2, ShieldCheck, ArrowUpRight, Filter } from 'lucide-react';
import type { RawRequestRecord } from '@/services/sheetSyncService';

interface CommandCenterHeaderProps {
    requests: RawRequestRecord[];
    activeQuickFilter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER';
    onSelectQuickFilter: (filter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER') => void;
}

export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({
    requests,
    activeQuickFilter,
    onSelectQuickFilter
}) => {
    // Memoize metric calculations so date parsing runs ONLY when requests array updates
    const { overdueCount, dueTodayCount, noSupplierCount, slaPercentage } = useMemo(() => {
        const todayStr = '2026-07-26';
        const todayDate = new Date(todayStr);

        let overdue = 0;
        let dueToday = 0;
        let noSupplier = 0;

        requests.forEach(r => {
            const isDone = (r.status || '').toLowerCase().includes('done') || (r.tien_do || '').toLowerCase().includes('hoàn thành');
            const dl = (r.deadline || '').trim();
            const hasSupplier = Boolean((r.supplier || '').trim());

            if (!hasSupplier && !isDone) {
                noSupplier++;
            }

            if (dl && !isDone) {
                let dDate: Date | null = null;
                if (dl.includes('/')) {
                    const parts = dl.split('/');
                    if (parts.length === 3) {
                        dDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    }
                } else if (dl.includes('-')) {
                    dDate = new Date(dl);
                }

                if (dDate && !isNaN(dDate.getTime())) {
                    const dOnly = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
                    const tOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

                    if (dOnly < tOnly) {
                        overdue++;
                    } else if (dOnly.getTime() === tOnly.getTime()) {
                        dueToday++;
                    }
                }
            }
        });

        const sla = requests.length > 0 
            ? Math.round(((requests.length - overdue) / requests.length) * 100)
            : 100;

        return {
            overdueCount: overdue,
            dueTodayCount: dueToday,
            noSupplierCount: noSupplier,
            slaPercentage: sla
        };
    }, [requests]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
            {/* Card 1: Ca Quá Hạn */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'OVERDUE'
                        ? 'bg-red-500 text-white border-red-600'
                        : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-950 hover:border-red-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-950 text-red-600'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'OVERDUE' ? 'text-red-100' : 'text-red-600 dark:text-red-400'}`}>
                                Ca Trễ Deadline
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'OVERDUE' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {overdueCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-red-50 dark:bg-red-950/60 text-red-600 border border-red-200 dark:border-red-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'OVERDUE' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 2: Hạn Hôm Nay */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'DUE_TODAY' ? 'ALL' : 'DUE_TODAY')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'DUE_TODAY'
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-950 hover:border-amber-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'DUE_TODAY' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'DUE_TODAY' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                                Hạn Cần Xử Lý Hôm Nay
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'DUE_TODAY' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {dueTodayCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'DUE_TODAY' ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'DUE_TODAY' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 3: Chưa Gán Supplier */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'NO_SUPPLIER' ? 'ALL' : 'NO_SUPPLIER')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'NO_SUPPLIER'
                        ? 'bg-purple-600 text-white border-purple-700'
                        : 'bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-950 hover:border-purple-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'NO_SUPPLIER' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-600'}`}>
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'NO_SUPPLIER' ? 'text-purple-100' : 'text-purple-600 dark:text-purple-400'}`}>
                                Chưa Gán Nhà Thầu
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'NO_SUPPLIER' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {noSupplierCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'NO_SUPPLIER' ? 'bg-white/20 text-white' : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 border border-purple-200 dark:border-purple-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'NO_SUPPLIER' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 4: Chỉ Số SLA Đảm Bảo Đúng Hạn */}
            <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Chỉ Số SLA Đúng Hạn
                        </p>
                        <h3 className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {slaPercentage}%
                        </h3>
                    </div>
                </div>
                <div className="text-[11px] font-semibold text-slate-400 text-right">
                    <span>{requests.length - overdueCount} / {requests.length} Ca</span>
                    <p className="text-[10px] text-emerald-600 font-bold">Đạt Tiêu Chuẩn</p>
                </div>
            </div>
        </div>
    );
};
