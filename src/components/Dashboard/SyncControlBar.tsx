import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle2, AlertCircle, LayoutList, Kanban, CloudUpload } from 'lucide-react';
import { subscribeAutoPush } from '@/services/autoPushService';

interface SyncControlBarProps {
    totalRequests: number;
    isSyncing: boolean;
    onSync: () => void;
    lastSyncedAt: string | null;
    viewMode: 'table' | 'kanban';
    setViewMode: (mode: 'table' | 'kanban') => void;
    onOpenStatusConfig: () => void;
}

export function SyncControlBar({
    totalRequests,
    isSyncing,
    onSync,
    lastSyncedAt,
    viewMode,
    setViewMode,
    onOpenStatusConfig
}: SyncControlBarProps) {
    const [pushState, setPushState] = useState({
        status: 'idle',
        pendingCount: 0,
        lastPushedAt: null as string | null,
        lastError: null as string | null
    });

    useEffect(() => {
        return subscribeAutoPush((s: any) => setPushState(s));
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Database className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            Quản Lý Request POSM
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-bold">
                            {totalRequests} Requests
                        </span>
                        {pushState.status === 'pending' || pushState.status === 'pushing' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
                                ⚡ Auto-push ngầm...
                            </span>
                        ) : pushState.lastPushedAt ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Đã đẩy về Sheet {pushState.lastPushedAt}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                        Đồng bộ 2 chiều với Sheet Source
                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                            🛡️ Chống Lệch Dòng (Anchor Key)
                        </span>
                        {lastSyncedAt && <span className="text-slate-400 dark:text-slate-500">• Đã đồng bộ {lastSyncedAt}</span>}
                    </p>
                </div>
            </div>



            <div className="flex items-center gap-2.5">

                {/* Manage Custom Statuses */}
                <button
                    onClick={onOpenStatusConfig}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
                >
                    ⚙️ Cấu hình Status
                </button>

                {/* Manual Sync Button */}
                <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Sheet Source'}
                </button>
            </div>
        </div>
    );
}
