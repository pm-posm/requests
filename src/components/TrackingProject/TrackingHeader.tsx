import React, { useState } from 'react';
import { X as XIcon, ChevronRight, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { clearAllTestData } from '@/services/dataCleanupService';
import toast from 'react-hot-toast';

interface TrackingHeaderProps {
    monthFilter: string;
    setMonthFilter: (val: string) => void;
    activeTab: 'tracking' | 'brief' | 'ntxx' | 'khao_sat' | 'lap_dat' | 'thu_hoi';
    setActiveTab: (val: 'tracking' | 'brief' | 'ntxx' | 'khao_sat' | 'lap_dat' | 'thu_hoi') => void;
}

export function TrackingHeader({ monthFilter, setMonthFilter, activeTab, setActiveTab }: TrackingHeaderProps) {
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isClearing, setIsClearing] = useState(false);

    const tabs = [
        { id: 'tracking', label: 'Timeline Tổng thể' },
        { id: 'brief', label: '1. Brief / Design' },
        { id: 'khao_sat', label: '2. Khảo Sát' },
        { id: 'ntxx', label: '3. Nghiệm Thu Xưởng' },
        { id: 'lap_dat', label: '4. Lắp Đặt' },
        { id: 'thu_hoi', label: '5. Thu Hồi' }
    ];

    const handleExecuteClearAllData = async () => {
        if (confirmText.trim().toUpperCase() !== 'CLEAR-ALL-DATA') {
            toast.error('Vui lòng gõ chính xác "CLEAR-ALL-DATA" để xác nhận!');
            return;
        }

        setIsClearing(true);
        const res = await clearAllTestData();
        setIsClearing(false);

        if (res.success) {
            toast.success(res.message);
            setIsConfirmingClear(false);
            setConfirmText('');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            toast.error(res.message);
        }
    };

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

                {/* CLEAR ALL TEST DATA BUTTON */}
                <button
                    onClick={() => setIsConfirmingClear(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-lg font-bold text-xs border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                    title="Xóa toàn bộ dữ liệu thử nghiệm để chuẩn bị Deploy Vercel Production"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Dọn Sạch Data (Reset)</span>
                </button>
            </div>

            {/* CLEAR DATA CONFIRMATION MODAL */}
            {isConfirmingClear && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl p-5 border border-rose-200 dark:border-rose-900 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 bg-rose-100 dark:bg-rose-950 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Xóa Sạch Dữ Liệu Thử Nghiệm?
                                </h3>
                                <p className="text-xs text-rose-600 font-medium">Hành động này không thể hoàn tất phục hồi!</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Thao tác này sẽ xóa <b>TOÀN BỘ dữ liệu dự án, mốc thời gian, requests và subtask thử nghiệm</b> trong CSDL Supabase để làm sạch 100% trước khi đưa ứng dụng lên Vercel.
                        </p>

                        <div className="space-y-1.5 bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-800">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                                Gõ cụm từ <span className="font-mono text-rose-600 font-extrabold select-all">CLEAR-ALL-DATA</span> để xác nhận:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="CLEAR-ALL-DATA"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-rose-600 outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                            <button
                                onClick={() => { setIsConfirmingClear(false); setConfirmText(''); }}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleExecuteClearAllData}
                                disabled={isClearing || confirmText.trim().toUpperCase() !== 'CLEAR-ALL-DATA'}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
                                <span>{isClearing ? 'Đang xóa...' : '🔥 Xóa Sạch Dữ Liệu'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
