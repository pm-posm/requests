import React, { useMemo } from 'react';
import { Store, CheckCircle2, Clock, ShieldCheck, Filter } from 'lucide-react';

interface StorePlanCommandCenterHeaderProps {
    storesData: Array<{
        store_code: string;
        completionPercentage: number;
        totalRequests: number;
        completedRequests: number;
        inProgressRequests: number;
        toDoRequests: number;
    }>;
    activeQuickFilter: 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'BEHIND_SCHEDULE';
    onSelectQuickFilter: (filter: 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'BEHIND_SCHEDULE') => void;
}

export const StorePlanCommandCenterHeader: React.FC<StorePlanCommandCenterHeaderProps> = ({
    storesData,
    activeQuickFilter,
    onSelectQuickFilter
}) => {
    // Memoize KPI calculations
    const { totalStores, completedStores, inProgressStores, behindStores, overallSlaPct } = useMemo(() => {
        let completed = 0;
        let inProg = 0;
        let behind = 0;

        storesData.forEach(s => {
            if (s.completionPercentage === 100) {
                completed++;
            } else if (s.completionPercentage > 0) {
                inProg++;
            } else {
                behind++;
            }
        });

        const total = storesData.length;
        const sla = total > 0 ? Math.round(((completed + inProg) / total) * 100) : 100;

        return {
            totalStores: total,
            completedStores: completed,
            inProgressStores: inProg,
            behindStores: behind,
            overallSlaPct: sla
        };
    }, [storesData]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
            {/* Card 1: Tổng Siêu Thị */}
            <div
                onClick={() => onSelectQuickFilter('ALL')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'ALL'
                        ? 'bg-sky-600 text-white border-sky-700'
                        : 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-950 hover:border-sky-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-sky-100 dark:bg-sky-950 text-sky-600'}`}>
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'ALL' ? 'text-sky-100' : 'text-sky-600 dark:text-sky-400'}`}>
                                Tổng Siêu Thị Kế Hoạch
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'ALL' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {totalStores} <span className="text-xs font-normal opacity-75">Store</span>
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card 2: Siêu Thị Hoàn Thành (100%) */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'COMPLETED'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-950 hover:border-emerald-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'}`}>
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'COMPLETED' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                Siêu Thị Hoàn Thành
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'COMPLETED' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {completedStores} <span className="text-xs font-normal opacity-75">(100%)</span>
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'COMPLETED' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 3: Siêu Thị Đang Triển Khai */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'IN_PROGRESS'
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-950 hover:border-amber-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'IN_PROGRESS' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'IN_PROGRESS' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                                Siêu Thị Đang Triển Khai
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'IN_PROGRESS' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {inProgressStores}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'IN_PROGRESS' ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'IN_PROGRESS' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 4: Tỷ Lệ SLA Đúng Hạn Siêu Thị */}
            <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            Chỉ Số SLA Siêu Thị
                        </p>
                        <h3 className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                            {overallSlaPct}%
                        </h3>
                    </div>
                </div>
                <div className="text-[11px] font-semibold text-slate-400 text-right">
                    <span>{completedStores + inProgressStores} / {totalStores} Store</span>
                    <p className="text-[10px] text-purple-600 font-bold">Triển khai chuẩn</p>
                </div>
            </div>
        </div>
    );
};
