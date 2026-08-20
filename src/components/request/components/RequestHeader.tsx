import React from 'react';
import { 
  Inbox, RefreshCw, Table, BarChart3, Settings, Mail 
} from 'lucide-react';

interface RequestHeaderProps {
  activeModuleTab: 'DATA_LIST' | 'ANALYST' | 'INBOX';
  setActiveModuleTab: (tab: 'DATA_LIST' | 'ANALYST' | 'INBOX') => void;
  lastSyncedAt: string;
  autoRefreshEnabled: boolean;
  countdownSeconds: number;
  newRequestsCount: number;
  acknowledgeNewSync: (e?: React.MouseEvent) => void;
  totalRequests: number;
  isRefreshing: boolean;
  handleRefresh: () => void;
  setShowConfigModal: (show: boolean) => void;
  setIsNewRequestOpen: (open: boolean) => void;
  onlyNewFilter: boolean;
  setOnlyNewFilter: (val: boolean) => void;
}

export const RequestHeader: React.FC<RequestHeaderProps> = ({
  activeModuleTab,
  setActiveModuleTab,
  lastSyncedAt,
  autoRefreshEnabled,
  countdownSeconds,
  newRequestsCount,
  acknowledgeNewSync,
  totalRequests,
  isRefreshing,
  handleRefresh,
  setShowConfigModal,
  setIsNewRequestOpen,
  onlyNewFilter,
  setOnlyNewFilter
}) => {
  const min = Math.floor(countdownSeconds / 60);
  const sec = (countdownSeconds % 60).toString().padStart(2, '0');

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700">
          <Inbox className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Quản Lý &amp; Xử Lý Request (Yêu Cầu POSM)
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live Sheet Sync Active
            </span>

            {/* INTEGRATED SYNC TIMESTAMP & AUTO-REFRESH STATUS */}
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-xs flex items-center gap-1.5">
              <span>Sync: {lastSyncedAt}</span>
              {autoRefreshEnabled && (
                <span 
                  className="text-[10px] text-sky-600 dark:text-sky-400 border-l border-slate-300 dark:border-slate-700 pl-1.5 font-semibold cursor-help"
                  title={`Tự động làm mới dữ liệu sau ${min} phút ${sec} giây`}
                >
                  🔄 {min}:{sec}
                </span>
              )}
            </span>

            {/* INTERACTIVE NEW ITEMS AUDIT BADGE & FILTER */}
            {newRequestsCount > 0 && (
              <div className="flex items-center gap-1.5">
                {onlyNewFilter ? (
                  <button
                    onClick={() => setOnlyNewFilter(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="Bấm để quay lại xem tất cả"
                  >
                    <span>✨ Đang lọc {newRequestsCount} Request mới</span>
                    <span className="text-[10px] bg-emerald-800/90 px-1.5 py-0.5 rounded">Xem tất cả ✕</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setOnlyNewFilter(true)}
                    className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Bấm để lọc và xem ngay các request mới này"
                  >
                    <span>✨ +{newRequestsCount} Request mới</span>
                    <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800 px-1.5 py-0.5 rounded font-mono font-semibold">Bấm xem ngay ➔</span>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    acknowledgeNewSync(e);
                    setOnlyNewFilter(false);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Bấm để đánh dấu đã xem và tắt thông báo"
                >
                  ✓ Đã xem
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Google Sheet MER VIEW 2026 • <strong className="text-slate-800 dark:text-slate-200 font-semibold">{totalRequests} Request</strong>
          </p>
        </div>
      </div>

      {/* TOP MODULE TABS & QUICK CONTROLS */}
      <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
        <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-700">
          <button
            onClick={() => setActiveModuleTab('DATA_LIST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeModuleTab === 'DATA_LIST'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Danh Sách Request</span>
          </button>
          <button
            onClick={() => setActiveModuleTab('INBOX')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeModuleTab === 'INBOX'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Hộp Thư Gmail</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase tracking-wider animate-pulse">
              Live
            </span>
          </button>
        </div>

        <button
          onClick={() => setIsNewRequestOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <span>+ Tạo Request Mới</span>
        </button>

        {/* MANUAL REFRESH BUTTON */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          title="Làm mới dữ liệu từ Google Sheet MER VIEW 2026"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
        </button>

        {/* CONFIG SETTINGS MODAL TRIGGER */}
        <button
          onClick={() => setShowConfigModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          title="Cấu hình Google Apps Script Web App URL 2-Chiều"
        >
          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span>Cấu Hình Sync</span>
        </button>
      </div>
    </div>
  );
};
