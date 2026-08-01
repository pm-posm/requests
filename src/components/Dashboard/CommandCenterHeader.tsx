import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Building2, ShieldCheck, Filter, Zap } from 'lucide-react';
import type { RawRequestRecord } from '@/services/sheetSyncService';

interface CommandCenterHeaderProps {
    requests: RawRequestRecord[];
    activeQuickFilter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE';
    onSelectQuickFilter: (filter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE') => void;
}

export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({
    requests,
    activeQuickFilter,
    onSelectQuickFilter
}) => {
    // Memoize metric calculations so date parsing runs ONLY when requests array updates
    const { overdueCount, dueTodayCount, noSupplierCount, newPhaseCount, slaPercentage } = useMemo(() => {
        // Fix hardcoded date bug: use dynamic current date
        const todayDate = new Date();

        let overdue = 0;
        let dueToday = 0;
        let noSupplier = 0;
        let newPhase = 0;

        requests.forEach(r => {
            const statusLower = (r.status || '').toLowerCase();
            const tienDoLower = (r.tien_do || '').toLowerCase();
            const titleLower = (r.title_email_request || '').toLowerCase();
            const isDone = statusLower.includes('done') || tienDoLower.includes('hoàn thành');
            const dl = (r.deadline || '').trim();
            const hasSupplier = Boolean((r.supplier || '').trim());

            // Check if request has a newly detected phase email
            const isNewPhaseDetected = !isDone && (
                tienDoLower.includes('lắp đặt') || 
                tienDoLower.includes('gửi lịch') || 
                tienDoLower.includes('ntxx') || 
                titleLower.includes('lắp đặt') || 
                titleLower.includes('nghiệm thu')
            );
            if (isNewPhaseDetected) {
                newPhase++;
            }

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
            newPhaseCount: newPhase,
            slaPercentage: sla
        };
    }, [requests]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {/* Card 1: Ca Trễ Deadline */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'OVERDUE'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-md scale-[1.01]'
                        : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-950 hover:border-rose-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-600'}`}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickFilter === 'OVERDUE' ? 'text-rose-100' : 'text-rose-600 dark:text-rose-400'}`}>
                                Ca Trễ Deadline
                            </p>
                            <h3 className={`text-xl font-black font-mono ${activeQuickFilter === 'OVERDUE' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {overdueCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'OVERDUE' ? 'Đang lọc' : 'Lọc'}
                    </div>
                </div>
            </div>

            {/* Card 2: Hạn Cần Xử Lý Hôm Nay */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'DUE_TODAY' ? 'ALL' : 'DUE_TODAY')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'DUE_TODAY'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-[1.01]'
                        : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-950 hover:border-amber-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'DUE_TODAY' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickFilter === 'DUE_TODAY' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                                Hạn Cần Xử Lý Hôm Nay
                            </p>
                            <h3 className={`text-xl font-black font-mono ${activeQuickFilter === 'DUE_TODAY' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {dueTodayCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'DUE_TODAY' ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'DUE_TODAY' ? 'Đang lọc' : 'Lọc'}
                    </div>
                </div>
            </div>

            {/* Card 3: Phase Mới Cần Xử Lý (Phase Transition Alert) */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'NEW_PHASE' ? 'ALL' : 'NEW_PHASE')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'NEW_PHASE'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md scale-[1.01]'
                        : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-950 hover:border-indigo-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'NEW_PHASE' ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600'}`}>
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickFilter === 'NEW_PHASE' ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                ⚡ Phase Mới Cần Xử Lý
                            </p>
                            <h3 className={`text-xl font-black font-mono ${activeQuickFilter === 'NEW_PHASE' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {newPhaseCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'NEW_PHASE' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'NEW_PHASE' ? 'Đang lọc' : 'Lọc'}
                    </div>
                </div>
            </div>

            {/* Card 4: Chưa Gán Nhà Thầu */}
            <div
                onClick={() => onSelectQuickFilter(activeQuickFilter === 'NO_SUPPLIER' ? 'ALL' : 'NO_SUPPLIER')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    activeQuickFilter === 'NO_SUPPLIER'
                        ? 'bg-purple-600 text-white border-purple-700 shadow-md scale-[1.01]'
                        : 'bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-950 hover:border-purple-400'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${activeQuickFilter === 'NO_SUPPLIER' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-600'}`}>
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickFilter === 'NO_SUPPLIER' ? 'text-purple-100' : 'text-purple-600 dark:text-purple-400'}`}>
                                Chưa Gán Nhà Thầu
                            </p>
                            <h3 className={`text-xl font-black font-mono ${activeQuickFilter === 'NO_SUPPLIER' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {noSupplierCount}
                            </h3>
                        </div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        activeQuickFilter === 'NO_SUPPLIER' ? 'bg-white/20 text-white' : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 border border-purple-200 dark:border-purple-900'
                    }`}>
                        <Filter className="w-3 h-3" />
                        {activeQuickFilter === 'NO_SUPPLIER' ? 'Đang lọc' : 'Lọc'}
                    </div>
                </div>
            </div>

            {/* Card 5: SLA Đúng Hạn */}
            <div className="p-3 rounded-2xl border bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            SLA Đúng Hạn
                        </p>
                        <h3 className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {slaPercentage}%
                        </h3>
                    </div>
                </div>
                <div className="text-[10px] font-semibold text-slate-400 text-right">
                    <span>{requests.length - overdueCount} / {requests.length} Ca</span>
                    <p className="text-[9px] text-emerald-600 font-bold">Đạt Tiêu Chuẩn</p>
                </div>
            </div>
        </div>
    );
};
