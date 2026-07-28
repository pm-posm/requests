import React from 'react';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { useWorkflowEngine } from '@/hooks/useWorkflowEngine';
import { Building2, User, Clock, CheckCircle2, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';

interface KanbanBoardViewProps {
    requests: RawRequestRecord[];
    onUpdateRequest: (id: string, updates: Partial<RawRequestRecord>) => Promise<any>;
}

export function KanbanBoardView({ requests, onUpdateRequest }: KanbanBoardViewProps) {
    const { statuses, getProgressChoices } = useWorkflowEngine();

    const columns = [
        { id: 'to_do', title: 'TO DO (Chờ Tiếp Nhận)', color: 'bg-slate-100 border-slate-300 text-slate-700' },
        { id: 'in_progress', title: 'IN PROGRESS (Đang Sửa / Đợi Lịch)', color: 'bg-blue-50 border-blue-200 text-blue-800' },
        { id: 'review', title: 'CSP REVIEW (Chờ Phê Duyệt)', color: 'bg-amber-50 border-amber-200 text-amber-800' },
        { id: 'done', title: 'COMPLETED (Hoàn Thành)', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
    ];

    const getColumnForRequest = (r: RawRequestRecord) => {
        const tienDoVal = (r.tien_do || '').trim().toLowerCase();
        const statusVal = (r.status || '').trim().toLowerCase();

        // 1. Match from Supabase workflow_statuses
        const matched = statuses.find(s => 
            s.name.trim().toLowerCase() === tienDoVal || 
            s.name.trim().toLowerCase() === statusVal
        );

        if (matched) {
            return matched.category;
        }

        // 2. Fallbacks
        if (statusVal.includes('cancel') || statusVal.includes('reject') || tienDoVal.includes('cancel') || tienDoVal.includes('hoàn thành') || statusVal.includes('approve')) return 'done';
        if (tienDoVal.includes('vis') || tienDoVal.includes('supplier') || tienDoVal.includes('quick fix')) return 'in_progress';
        if (statusVal.includes('review') || r.phuong_an?.includes('RQ')) return 'review';
        return 'to_do';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {columns.map(col => {
                const columnRequests = requests.filter(r => getColumnForRequest(r) === col.id);

                return (
                    <div key={col.id} className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col min-h-[500px]">
                        {/* Column Header */}
                        <div className={`p-2.5 rounded-lg border font-bold text-xs flex items-center justify-between mb-3 ${col.color}`}>
                            <span>{col.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 text-[11px]">
                                {columnRequests.length}
                            </span>
                        </div>

                        {/* Cards List */}
                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1 custom-scrollbar">
                            {columnRequests.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                    Không có request nào
                                </div>
                            ) : (
                                columnRequests.map(r => {
                                    const allowedProgresses = getProgressChoices(r.phuong_an);

                                    return (
                                        <div
                                            key={r.id || r.request_key}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative group"
                                        >
                                            {/* Phuong An Badge */}
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate">
                                                    {r.phuong_an || 'Visibility Rquest'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {r.date_of_rq || '1/2025'}
                                                </span>
                                            </div>

                                            {/* Store & POSM */}
                                            <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate" title={r.store_name}>
                                                {r.store_name}
                                            </h4>
                                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium truncate mt-0.5" title={r.posm}>
                                                {r.posm} ({r.brand || '-'})
                                            </p>

                                            {/* Details */}
                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3 text-slate-400" />
                                                        SR: {r.sr || '-'}
                                                    </span>
                                                    <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900 px-1 rounded">
                                                        {r.ess_store_code}
                                                    </span>
                                                </div>
                                                {r.supplier && (
                                                    <div className="text-indigo-600 font-medium text-[10px]">
                                                        Supplier: {r.supplier}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Progress Changer */}
                                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                                                <select
                                                    value={r.tien_do || allowedProgresses[0]}
                                                    onChange={e => onUpdateRequest(r.id!, { tien_do: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                                                >
                                                    {allowedProgresses.map(prog => (
                                                        <option key={prog} value={prog}>{prog}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
