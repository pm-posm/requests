import React, { useMemo } from 'react';
import { FolderOpen, Store, Clock, ShieldCheck, Filter } from 'lucide-react';
import type { ProjectGroup } from '@/types';

interface ProjectCommandCenterHeaderProps {
    groups: ProjectGroup[];
    activeQuickFilter: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'HIGH_STORE_COUNT';
    onSelectQuickFilter: (filter: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'HIGH_STORE_COUNT') => void;
}

export const ProjectCommandCenterHeader: React.FC<ProjectCommandCenterHeaderProps> = ({
    groups,
    activeQuickFilter,
    onSelectQuickFilter
}) => {
    // Memoize metric calculations so date/store parsing runs ONLY when groups array updates
    const { totalProjects, totalStores, activeProjects, completedProjects, completionPercentage } = useMemo(() => {
        let stores = 0;
        let active = 0;
        let completed = 0;

        groups.forEach(g => {
            // Count total stores across activities or project info
            const storeSet = new Set<string>();
            g.activities?.forEach(a => {
                const storeCode = (a as any).ess_store_code || (a as any).store_code;
                if (storeCode?.trim()) storeSet.add(storeCode.trim());
            });
            stores += Math.max(storeSet.size, 1);

            // Determine active vs completed status
            const isFinished = g.activities?.every(a => {
                const st = (a.status || '').toLowerCase();
                const prog = ((a as any).tien_do || '').toLowerCase();
                return st.includes('done') || st.includes('hoàn thành') || prog.includes('done') || prog.includes('hoàn thành');
            });

            if (isFinished && g.activities && g.activities.length > 0) {
                completed++;
            } else {
                active++;
            }
        });

        const pct = groups.length > 0 ? Math.round((completed / groups.length) * 100) : 100;

        return {
            totalProjects: groups.length,
            totalStores: stores,
            activeProjects: active,
            completedProjects: completed,
            completionPercentage: pct
        };
    }, [groups]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
            {/* Card 1: Ca Đang Triển Khai */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'ACTIVE'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-950 hover:border-indigo-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600'}`}>
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'ACTIVE' ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                Dự Án Đang Triển Khai
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'ACTIVE' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {activeProjects} <span className="text-xs font-normal opacity-75">/ {totalProjects}</span>
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'ACTIVE' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 2: Tổng Siêu Thị Triển Khai */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'HIGH_STORE_COUNT' ? 'ALL' : 'HIGH_STORE_COUNT')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'HIGH_STORE_COUNT'
                        ? 'bg-sky-600 text-white border-sky-700'
                        : 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-950 hover:border-sky-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'HIGH_STORE_COUNT' ? 'bg-white/20 text-white' : 'bg-sky-100 dark:bg-sky-950 text-sky-600'}`}>
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'HIGH_STORE_COUNT' ? 'text-sky-100' : 'text-sky-600 dark:text-sky-400'}`}>
                                Tổng Siêu Thị Phủ Sóng
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'HIGH_STORE_COUNT' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {totalStores} <span className="text-xs font-normal opacity-75">Store</span>
                            </h3>
                        </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'HIGH_STORE_COUNT' ? 'bg-white/20 text-white' : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 border border-sky-200 dark:border-sky-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'HIGH_STORE_COUNT' ? 'Đang lọc' : 'Lọc ngay'}
                    </div>
                </div>
            </div>

            {/* Card 3: Dự Án Đã Hoàn Thành */}
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
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-[11px] font-bold uppercase tracking-wider ${activeQuickFilter === 'COMPLETED' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                Dự Án Đã Hoàn Thành
                            </p>
                            <h3 className={`text-2xl font-black font-mono ${activeQuickFilter === 'COMPLETED' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {completedProjects}
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

            {/* Card 4: Tỷ Lệ Đảm Bảo Tiến Độ */}
            <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            Chỉ Số Tiến Độ Dự Án
                        </p>
                        <h3 className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                            {completionPercentage}%
                        </h3>
                    </div>
                </div>
                <div className="text-[11px] font-semibold text-slate-400 text-right">
                    <span>{completedProjects} / {totalProjects} Dự Án</span>
                    <p className="text-[10px] text-purple-600 font-bold">Nghiệm thu</p>
                </div>
            </div>
        </div>
    );
};
