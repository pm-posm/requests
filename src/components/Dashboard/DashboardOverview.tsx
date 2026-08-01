import React, { useState } from 'react';
import { useRawRequests } from '@/hooks/useRawRequests';
import { SyncControlBar } from './SyncControlBar';
import { MerRequestsTable } from './MerRequestsTable';
import { KanbanBoardView } from './KanbanBoardView';
import { ManageStatusModal } from './ManageStatusModal';
import { Loader2 } from 'lucide-react';

import { TableSkeleton } from '@/components/ui/TableSkeleton';

export function DashboardOverview() {
    const { requests, isLoading, updateRequest, isUpdating, syncSheet, isSyncing } = useRawRequests();
    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
    const [isStatusConfigOpen, setIsStatusConfigOpen] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

    const handleSync = async () => {
        try {
            const res = await syncSheet();
            const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            setLastSyncedAt(now);
            alert(res.message || 'Đồng bộ dữ liệu thành công!');
        } catch (err: any) {
            alert('Lỗi khi đồng bộ dữ liệu: ' + err.message);
        }
    };

    if (isLoading) {
        return (
            <div className="absolute inset-0 p-4 md:p-6 bg-slate-50/50 dark:bg-slate-950 overflow-y-auto">
                <div className="max-w-[1600px] w-full mx-auto space-y-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border rounded-xl flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 animate-pulse flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                            Đang nạp dữ liệu Request POSM từ Google Sheet Source (`Mer View 2026`)...
                        </span>
                    </div>
                    <TableSkeleton rows={8} columns={7} />
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-slate-50/50 dark:bg-slate-950 p-2.5 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-[1920px] mx-auto space-y-4">
                {/* Sync Control Bar */}
                <SyncControlBar
                    totalRequests={requests.length}
                    isSyncing={isSyncing}
                    onSync={handleSync}
                    lastSyncedAt={lastSyncedAt}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    onOpenStatusConfig={() => setIsStatusConfigOpen(true)}
                />

                {/* Main Content View: Table vs Kanban */}
                {viewMode === 'table' ? (
                    <MerRequestsTable
                        requests={requests}
                        onUpdateRequest={updateRequest}
                        isUpdating={isUpdating}
                    />
                ) : (
                    <KanbanBoardView
                        requests={requests}
                        onUpdateRequest={updateRequest}
                    />
                )}

                {/* Manage Custom Statuses Modal */}
                <ManageStatusModal
                    isOpen={isStatusConfigOpen}
                    onClose={() => setIsStatusConfigOpen(false)}
                    requests={requests}
                />
            </div>
        </div>
    );
}
