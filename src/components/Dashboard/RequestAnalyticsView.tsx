import React, { useMemo } from 'react';
import { 
    AlertTriangle, Clock, Building2, ShieldCheck, Zap, 
    BarChart3, PieChart, TrendingUp, CheckCircle2, XCircle, Clock4, 
    Layers, Users, Tag, Award, ArrowUpRight, ChevronRight, Activity, HardHat, Package, Filter, ExternalLink, Download
} from 'lucide-react';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { exportAnalystExecutiveReport } from '@/services/excelReportService';
import { CommandCenterHeader } from './CommandCenterHeader';

export interface FilterNavigationParams {
    category?: 'ALL' | 'to_do' | 'in_progress' | 'review' | 'done';
    quickFilter?: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE';
    tienDo?: string;
    phuongAn?: string;
    mer?: string;
    supplier?: string;
    searchTerm?: string;
}

interface RequestAnalyticsViewProps {
    requests: RawRequestRecord[];
    activeQuickFilter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE';
    onSelectQuickFilter: (filter: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE') => void;
    getRequestCategory: (r: RawRequestRecord) => 'to_do' | 'in_progress' | 'review' | 'done';
    onFilterAndNavigate?: (params: FilterNavigationParams) => void;
}

export const RequestAnalyticsView: React.FC<RequestAnalyticsViewProps> = ({
    requests,
    activeQuickFilter,
    onSelectQuickFilter,
    getRequestCategory,
    onFilterAndNavigate
}) => {
    // 0. Calculations for Total Overview Cards Across ALL Requests
    const overviewStats = useMemo(() => {
        const total = requests.length;
        let active = 0;
        let done = 0;
        let totalPosmQuantity = 0;

        requests.forEach(r => {
            const cat = getRequestCategory(r);
            if (cat === 'done') {
                done++;
            } else {
                active++;
            }
            const qty = parseInt(r.so_luong || '1', 10) || 1;
            totalPosmQuantity += qty;
        });

        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
            total,
            active,
            done,
            totalPosmQuantity,
            completionRate
        };
    }, [requests, getRequestCategory]);

    // 1. Calculations for Status Categories Funnel
    const categoryStats = useMemo(() => {
        let toDo = 0, inProgress = 0, review = 0, done = 0;
        requests.forEach(r => {
            const cat = getRequestCategory(r);
            if (cat === 'to_do') toDo++;
            else if (cat === 'in_progress') inProgress++;
            else if (cat === 'review') review++;
            else if (cat === 'done') done++;
        });

        const total = requests.length || 1;
        return {
            toDo,
            inProgress,
            review,
            done,
            toDoPct: Math.round((toDo / total) * 100),
            inProgressPct: Math.round((inProgress / total) * 100),
            reviewPct: Math.round((review / total) * 100),
            donePct: Math.round((done / total) * 100),
            total: requests.length
        };
    }, [requests, getRequestCategory]);

    // 2. Bottleneck Analysis: Top Pending Tiến Độ Statuses (excluding done/complete)
    const bottleneckStats = useMemo(() => {
        const counts: Record<string, number> = {};
        requests.forEach(r => {
            const cat = getRequestCategory(r);
            if (cat !== 'done') {
                const statusName = (r.tien_do || r.status || 'Chưa phân loại').trim();
                counts[statusName] = (counts[statusName] || 0) + 1;
            }
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const activeTotal = requests.filter(r => getRequestCategory(r) !== 'done').length || 1;

        return sorted.map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / activeTotal) * 100)
        }));
    }, [requests, getRequestCategory]);

    // 3. Solution Method Breakdown (Phương án DỘNG 100% không gộp nhầm)
    const phuongAnStats = useMemo(() => {
        const map: Record<string, number> = {};
        let unassignedCount = 0;

        requests.forEach(r => {
            const pa = (r.phuong_an || '').trim();
            if (!pa) {
                unassignedCount++;
            } else {
                map[pa] = (map[pa] || 0) + 1;
            }
        });

        const total = requests.length || 1;
        const items = Object.entries(map).map(([name, count]) => {
            const nameLower = name.toLowerCase();
            let color = 'bg-indigo-500';
            let text = 'text-indigo-600 dark:text-indigo-400';

            if (nameLower.includes('visibility') || nameLower.includes('sản xuất')) {
                color = 'bg-sky-500';
                text = 'text-sky-600 dark:text-sky-400';
            } else if (nameLower.includes('bảo hành') || nameLower.includes('khắc phục')) {
                color = 'bg-amber-500';
                text = 'text-amber-600 dark:text-amber-400';
            } else if (nameLower.includes('quick fix') || nameLower.includes('tự xử lý')) {
                color = 'bg-purple-500';
                text = 'text-purple-600 dark:text-purple-400';
            }

            return {
                name,
                rawKey: name,
                count,
                pct: Math.round((count / total) * 100),
                color,
                text
            };
        });

        if (unassignedCount > 0) {
            items.push({
                name: 'Chưa phân loại phương án',
                rawKey: 'UNASSIGNED',
                count: unassignedCount,
                pct: Math.round((unassignedCount / total) * 100),
                color: 'bg-slate-400',
                text: 'text-slate-500 dark:text-slate-400'
            });
        }

        return items.sort((a, b) => b.count - a.count);
    }, [requests]);

    // 4. Supplier Workload & Performance Breakdown
    const supplierStats = useMemo(() => {
        const todayDate = new Date();
        const map: Record<string, { total: number; active: number; done: number; overdue: number }> = {};

        requests.forEach(r => {
            const supp = (r.supplier || '').trim() || 'Chưa gán Supplier';
            if (!map[supp]) {
                map[supp] = { total: 0, active: 0, done: 0, overdue: 0 };
            }

            map[supp].total++;
            const cat = getRequestCategory(r);

            if (cat === 'done') {
                map[supp].done++;
            } else {
                map[supp].active++;

                const dl = (r.deadline || '').trim();
                if (dl) {
                    let dDate: Date | null = null;
                    if (dl.includes('/')) {
                        const parts = dl.split('/');
                        if (parts.length === 3) dDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    } else if (dl.includes('-')) {
                        dDate = new Date(dl);
                    }
                    if (dDate && !isNaN(dDate.getTime())) {
                        const dOnly = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
                        const tOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                        if (dOnly < tOnly) {
                            map[supp].overdue++;
                        }
                    }
                }
            }
        });

        return Object.entries(map)
            .map(([name, data]) => {
                const sla = data.total > 0 ? Math.round(((data.total - data.overdue) / data.total) * 100) : 100;
                return { name, ...data, sla };
            })
            .sort((a, b) => b.total - a.total);
    }, [requests, getRequestCategory]);

    // 5. Mer Workload Leaderboard
    const merStats = useMemo(() => {
        const map: Record<string, { total: number; active: number; done: number; overdue: number }> = {};
        const todayDate = new Date();

        requests.forEach(r => {
            const merName = (r.mer || '').trim() || 'Chưa phân công';
            if (!map[merName]) {
                map[merName] = { total: 0, active: 0, done: 0, overdue: 0 };
            }

            map[merName].total++;
            const cat = getRequestCategory(r);
            if (cat === 'done') {
                map[merName].done++;
            } else {
                map[merName].active++;

                const dl = (r.deadline || '').trim();
                if (dl) {
                    let dDate: Date | null = null;
                    if (dl.includes('/')) {
                        const parts = dl.split('/');
                        if (parts.length === 3) dDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    } else if (dl.includes('-')) {
                        dDate = new Date(dl);
                    }
                    if (dDate && !isNaN(dDate.getTime())) {
                        const dOnly = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
                        const tOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                        if (dOnly < tOnly) {
                            map[merName].overdue++;
                        }
                    }
                }
            }
        });

        return Object.entries(map)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.active - a.active)
            .slice(0, 8);
    }, [requests, getRequestCategory]);

    // 6. Top Brand Demand
    const brandStats = useMemo(() => {
        const map: Record<string, { count: number; totalQuantity: number }> = {};
        requests.forEach(r => {
            const brand = (r.brand || '').trim() || 'Khác';
            const qty = parseInt(r.so_luong || '1', 10) || 1;
            if (!map[brand]) {
                map[brand] = { count: 0, totalQuantity: 0 };
            }
            map[brand].count++;
            map[brand].totalQuantity += qty;
        });

        return Object.entries(map)
            .map(([brand, data]) => ({ brand, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [requests]);

    const handleNavigate = (params: FilterNavigationParams) => {
        if (onFilterAndNavigate) {
            onFilterAndNavigate(params);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* 🌐 0. OVERVIEW OF ALL REQUESTS SUMMARY SECTION */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                📊 Báo Cáo Tổng Quan Toàn Bộ Request POSM
                            </h2>
                            <p className="text-xs text-slate-300">
                                Bóc tách toàn bộ dữ liệu request hiện có • Nhấp vào từng chỉ số để mở trực tiếp danh sách dữ liệu
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => exportAnalystExecutiveReport(requests, [], 'POSM_Request_Executive_Report')}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer border border-emerald-400/40"
                            title="Tải về file Excel BI Analytics 3 Sheet (.xlsx)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>📥 Xuất Analyst Excel (.xlsx)</span>
                        </button>
                        <button
                            onClick={() => handleNavigate({ category: 'ALL', quickFilter: 'ALL', tienDo: 'ALL', phuongAn: 'ALL', mer: 'ALL', supplier: 'ALL', searchTerm: '' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                            title="Xem toàn bộ danh sách dữ liệu không lọc"
                        >
                            <span>Xem Tất Cả Data</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Card 1: Total Requests */}
                    <div 
                        onClick={() => handleNavigate({ category: 'ALL', quickFilter: 'ALL', tienDo: 'ALL', phuongAn: 'ALL', mer: 'ALL', supplier: 'ALL', searchTerm: '' })}
                        className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-1">
                            <span>TỔNG CỘNG REQUEST</span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div className="text-2xl font-black font-mono text-white">
                            {overviewStats.total} <span className="text-xs text-slate-300 font-normal">Ca</span>
                        </div>
                        <p className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
                            👉 Nhấp để xem chi tiết
                        </p>
                    </div>

                    {/* Card 2: Active Requests */}
                    <div 
                        onClick={() => handleNavigate({ category: 'in_progress' })}
                        className="bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 rounded-xl p-3.5 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between text-sky-200 text-xs font-semibold mb-1">
                            <span>ĐANG XỬ LÝ (ACTIVE)</span>
                            <ChevronRight className="w-4 h-4 text-sky-300 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div className="text-2xl font-black font-mono text-sky-200">
                            {overviewStats.active} <span className="text-xs font-normal">Ca</span>
                        </div>
                        <p className="text-[10px] text-sky-300 mt-1 flex items-center gap-1">
                            👉 Lọc các ca đang triển khai
                        </p>
                    </div>

                    {/* Card 3: Done Requests */}
                    <div 
                        onClick={() => handleNavigate({ category: 'done' })}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-xl p-3.5 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between text-emerald-200 text-xs font-semibold mb-1">
                            <span>ĐÃ HOÀN THÀNH (DONE)</span>
                            <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-200">
                            {overviewStats.done} <span className="text-xs font-normal">Ca</span>
                        </div>
                        <p className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
                            👉 Lọc các ca đã xong
                        </p>
                    </div>

                    {/* Card 4: Total POSM Items & Completion Rate */}
                    <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl p-3.5">
                        <div className="text-purple-200 text-xs font-semibold mb-1 flex justify-between">
                            <span>TỔNG SẢN LƯỢNG POSM</span>
                            <span className="font-bold text-purple-300">{overviewStats.completionRate}% Done</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-purple-100">
                            {overviewStats.totalPosmQuantity.toLocaleString('vi-VN')} <span className="text-xs font-normal">Cái/Bộ</span>
                        </div>
                        <div className="w-full bg-purple-950/60 h-1.5 rounded-full overflow-hidden mt-2">
                            <div style={{ width: `${overviewStats.completionRate}%` }} className="h-full bg-purple-400 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. Operational Command Center KPIs */}
            <CommandCenterHeader
                requests={requests}
                activeQuickFilter={activeQuickFilter}
                onSelectQuickFilter={(qFilter) => {
                    onSelectQuickFilter(qFilter);
                    if (onFilterAndNavigate) {
                        if (qFilter === 'NO_SUPPLIER') {
                            onFilterAndNavigate({ supplier: 'NO_SUPPLIER', quickFilter: 'NO_SUPPLIER' });
                        } else {
                            onFilterAndNavigate({ quickFilter: qFilter });
                        }
                    }
                }}
            />

            {/* 2. SECTION 1: Status Category Funnel & Bottleneck Detection */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Card: 4 Major Status Categories Overview */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                                <PieChart className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    Phân Bổ Tiến Độ Request POSM
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Nhấp vào từng nhóm trạng thái để xem bảng dữ liệu trực tiếp
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                            100% Total
                        </span>
                    </div>

                    {/* Progress Bar Funnel */}
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex mb-5 shadow-inner p-0.5 cursor-pointer">
                        <div 
                            onClick={() => handleNavigate({ category: 'to_do' })}
                            style={{ width: `${categoryStats.toDoPct}%` }} 
                            className="h-full bg-slate-400 hover:opacity-80 transition-all duration-300 rounded-l-full" 
                            title={`TO DO: ${categoryStats.toDo} ca (${categoryStats.toDoPct}%) - Nhấp để xem`}
                        />
                        <div 
                            onClick={() => handleNavigate({ category: 'in_progress' })}
                            style={{ width: `${categoryStats.inProgressPct}%` }} 
                            className="h-full bg-sky-500 hover:opacity-80 transition-all duration-300" 
                            title={`IN PROGRESS: ${categoryStats.inProgress} ca (${categoryStats.inProgressPct}%) - Nhấp để xem`}
                        />
                        <div 
                            onClick={() => handleNavigate({ category: 'review' })}
                            style={{ width: `${categoryStats.reviewPct}%` }} 
                            className="h-full bg-amber-500 hover:opacity-80 transition-all duration-300" 
                            title={`REVIEW: ${categoryStats.review} ca (${categoryStats.reviewPct}%) - Nhấp để xem`}
                        />
                        <div 
                            onClick={() => handleNavigate({ category: 'done' })}
                            style={{ width: `${categoryStats.donePct}%` }} 
                            className="h-full bg-emerald-500 hover:opacity-80 transition-all duration-300 rounded-r-full" 
                            title={`DONE: ${categoryStats.done} ca (${categoryStats.donePct}%) - Nhấp để xem`}
                        />
                    </div>

                    {/* Category Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div 
                            onClick={() => handleNavigate({ category: 'to_do' })}
                            className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                    1. TO DO
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black font-mono text-slate-800 dark:text-white">
                                    {categoryStats.toDo}
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                    {categoryStats.toDoPct}%
                                </span>
                            </div>
                        </div>

                        <div 
                            onClick={() => handleNavigate({ category: 'in_progress' })}
                            className="p-3 bg-sky-50/60 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-950/70 border border-sky-200 dark:border-sky-900/60 rounded-xl transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-400 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                                    2. IN PROGRESS
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black font-mono text-sky-900 dark:text-sky-100">
                                    {categoryStats.inProgress}
                                </span>
                                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                                    {categoryStats.inProgressPct}%
                                </span>
                            </div>
                        </div>

                        <div 
                            onClick={() => handleNavigate({ category: 'review' })}
                            className="p-3 bg-amber-50/60 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-200 dark:border-amber-900/60 rounded-xl transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                    3. REVIEW
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black font-mono text-amber-900 dark:text-amber-100">
                                    {categoryStats.review}
                                </span>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                    {categoryStats.reviewPct}%
                                </span>
                            </div>
                        </div>

                        <div 
                            onClick={() => handleNavigate({ category: 'done' })}
                            className="p-3 bg-emerald-50/60 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900/60 rounded-xl transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    4. DONE / CLOSE
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-100">
                                    {categoryStats.done}
                                </span>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {categoryStats.donePct}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Card: Bottleneck Detection - Top Pending Statuses */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-xl">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    Top Bước Tồn Đọng Công Việc
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Nhấp vào bước tiến độ để lọc danh sách ca bị dồn cục
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {bottleneckStats.length === 0 ? (
                                <p className="text-xs text-slate-400 py-6 text-center">Không có công việc nào đang tồn đọng</p>
                            ) : (
                                bottleneckStats.map((item, idx) => (
                                    <div 
                                        key={item.name} 
                                        onClick={() => handleNavigate({ tienDo: item.name })}
                                        className="space-y-1 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer group"
                                        title={`Nhấp để lọc danh sách ca ở bước: ${item.name}`}
                                    >
                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            <span className="truncate max-w-[210px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                                                <span>{idx + 1}. {item.name}</span>
                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                {item.count} ca <span className="text-[10px] text-slate-400 font-normal">({item.percentage}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${Math.max(item.percentage, 4)}%` }} 
                                                className={`h-full rounded-full ${
                                                    idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-amber-500' : 'bg-indigo-500'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. SECTION 2: Solution Breakdown & Brand Demand */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Solution Methods Breakdown */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Cơ Cấu Phương Án POSM (`phuong_an`)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Nhấp vào phương án cụ thể để lọc đúng các bản ghi đó
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {phuongAnStats.map(item => (
                            <div 
                                key={item.name} 
                                onClick={() => handleNavigate({ phuongAn: item.rawKey })}
                                className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                                title={`Nhấp để lọc danh sách phương án: ${item.name}`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[130px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                            {item.name}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-mono">
                                        {item.count} Yêu cầu
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className={`text-base font-black font-mono ${item.text}`}>
                                        {item.pct}%
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Top Brand Demand */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-sky-50 dark:bg-sky-950/60 text-sky-600 rounded-xl">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Nhu Cầu Theo Thương Hiệu (Top Brands)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Nhấp vào thương hiệu để xem toàn bộ Request của nhãn hàng
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {brandStats.map((item, idx) => (
                            <div 
                                key={item.brand} 
                                onClick={() => handleNavigate({ searchTerm: item.brand })}
                                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 transition-all cursor-pointer group"
                                title={`Nhấp để lọc danh sách theo thương hiệu: ${item.brand}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs flex items-center justify-center">
                                        #{idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                        {item.brand}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-500">
                                        {item.count} Request
                                    </span>
                                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                                        {item.totalQuantity} POSM
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. SECTION 3: Supplier Workload & SLA Performance */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                            <HardHat className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Báo Cáo Khối Lượng & SLA Nhà Thầu (Suppliers)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Nhấp vào bất kỳ hàng nhà thầu nào để xem các request do đơn vị đó thi công
                            </p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-3">Nhà Thầu / Supplier</th>
                                <th className="p-3 text-center">Tổng Số Ca</th>
                                <th className="p-3 text-center">Đang Làm</th>
                                <th className="p-3 text-center">Đã Xong</th>
                                <th className="p-3 text-center">Trễ Deadline</th>
                                <th className="p-3 min-w-[160px]">Tỷ Lệ SLA Đúng Hạn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {supplierStats.map(sup => {
                                const targetSupplierKey = sup.name === 'Chưa gán Supplier' ? 'NO_SUPPLIER' : sup.name;

                                return (
                                    <tr 
                                        key={sup.name} 
                                        onClick={() => handleNavigate({ supplier: targetSupplierKey })}
                                        className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer group"
                                        title={`Nhấp để lọc toàn bộ request của nhà thầu: ${sup.name}`}
                                    >
                                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                            <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1.5">
                                                {sup.name === 'Chưa gán Supplier' ? (
                                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">⚠️ Chưa gán nhà thầu</span>
                                                ) : (
                                                    sup.name
                                                )}
                                            </span>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                                        </td>
                                        <td className="p-3 text-center font-mono font-bold">
                                            {sup.total}
                                        </td>
                                        <td className="p-3 text-center font-mono text-sky-600 dark:text-sky-400 font-semibold">
                                            {sup.active}
                                        </td>
                                        <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                            {sup.done}
                                        </td>
                                        <td className="p-3 text-center font-mono">
                                            {sup.overdue > 0 ? (
                                                <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                                                    {sup.overdue}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">0</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        style={{ width: `${sup.sla}%` }} 
                                                        className={`h-full rounded-full ${
                                                            sup.sla >= 90 ? 'bg-emerald-500' : sup.sla >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                                        }`}
                                                    />
                                                </div>
                                                <span className="font-mono font-bold text-xs min-w-[36px]">
                                                    {sup.sla}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. SECTION 4: Mer Workload Leaderboard */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Bảng Tải Công Việc Nhân Sự Mer / VIS-Tech
                        </h3>
                        <p className="text-xs text-slate-400">
                            Nhấp vào nhân sự Mer để xem danh sách Request mà Mer đó phụ trách
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {merStats.map(mer => (
                        <div 
                            key={mer.name} 
                            onClick={() => handleNavigate({ mer: mer.name })}
                            className="p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2 transition-all cursor-pointer group"
                            title={`Nhấp để lọc danh sách Request do ${mer.name} phụ trách`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[130px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1" title={mer.name}>
                                    <span>👤 {mer.name}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                        {mer.total} Ca
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-slate-500">
                                    Đang làm: <strong className="text-sky-600 dark:text-sky-400">{mer.active}</strong>
                                </span>
                                <span className="text-slate-500">
                                    Xong: <strong className="text-emerald-600 dark:text-emerald-400">{mer.done}</strong>
                                </span>
                            </div>

                            {mer.overdue > 0 && (
                                <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded border border-rose-200 dark:border-rose-900 flex items-center justify-between">
                                    <span>⚠️ Có ca trễ deadline</span>
                                    <span className="font-mono">{mer.overdue} ca</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
