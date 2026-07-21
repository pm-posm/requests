import React from 'react';
import { X as XIcon, ChevronRight } from 'lucide-react';

interface TrackingHeaderProps {
    monthFilter: string;
    setMonthFilter: (val: string) => void;
    activeTab: 'tracking' | 'brief' | 'ntxx' | 'khao_sat' | 'lap_dat' | 'thu_hoi';
    setActiveTab: (val: 'tracking' | 'brief' | 'ntxx' | 'khao_sat' | 'lap_dat' | 'thu_hoi') => void;
}

export function TrackingHeader({ monthFilter, setMonthFilter, activeTab, setActiveTab }: TrackingHeaderProps) {
    const tabs = [
        { id: 'tracking', label: 'Timeline Tổng thể' },
        { id: 'brief', label: '1. Brief / Design' },
        { id: 'khao_sat', label: '2. Khảo Sát' },
        { id: 'ntxx', label: '3. Nghiệm Thu Xưởng' },
        { id: 'lap_dat', label: '4. Lắp Đặt' },
        { id: 'thu_hoi', label: '5. Thu Hồi' }
    ];

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
            <div className="flex flex-wrap items-center gap-1.5">
                {tabs.map((tab, idx) => (
                    <React.Fragment key={tab.id}>
                        <button
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                                activeTab === tab.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 border border-transparent'
                            }`}
                        >
                            {tab.label}
                        </button>
                        {idx < tabs.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                    </React.Fragment>
                ))}
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="month"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500"
                />
                {monthFilter && (
                    <button 
                        onClick={() => setMonthFilter('')}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Bỏ lọc theo tháng"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
