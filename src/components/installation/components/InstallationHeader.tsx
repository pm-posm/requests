import React from 'react';
import { 
  ClipboardList, RefreshCw, Table, BarChart3, Download, Settings, Link as LinkIcon, Mail 
} from 'lucide-react';

interface InstallationHeaderProps {
  activeModuleTab: 'DATA_LIST' | 'ANALYST' | 'INBOX' | 'EXCEL_EXPORT';
  setActiveModuleTab: (tab: 'DATA_LIST' | 'ANALYST' | 'INBOX' | 'EXCEL_EXPORT') => void;
  lastSyncedAt: string;
  autoRefreshEnabled: boolean;
  countdownSeconds: number;
  newAssetsCount: number;
  newProjectsCount: number;
  acknowledgeNewSync: (e?: React.MouseEvent) => void;
  totalProjects: number;
  totalAssets: number;
  isRefreshing: boolean;
  handleRefresh: () => void;
  handleExportExcel: () => void;
  setShowConfigModal: (show: boolean) => void;
}

export const InstallationHeader: React.FC<InstallationHeaderProps> = ({
  activeModuleTab,
  setActiveModuleTab,
  lastSyncedAt,
  autoRefreshEnabled,
  countdownSeconds,
  newAssetsCount,
  newProjectsCount,
  acknowledgeNewSync,
  totalProjects,
  totalAssets,
  isRefreshing,
  handleRefresh,
  handleExportExcel,
  setShowConfigModal
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Điều Hành &amp; Phân Tích Lắp Đặt POSM
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live Sync Active
            </span>

            {/* INTEGRATED SYNC TIMESTAMP & AUTO-REFRESH STATUS */}
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-xs flex items-center gap-1.5">
              <span>Sync: {lastSyncedAt}</span>
              {autoRefreshEnabled && (
                <span className="text-[10px] text-sky-600 dark:text-sky-400 border-l border-slate-300 dark:border-slate-700 pl-1.5 font-semibold">
                  🔄 {Math.floor(countdownSeconds / 60)}:{(countdownSeconds % 60).toString().padStart(2, '0')}
                </span>
              )}
            </span>

            {/* INTEGRATED NEW ITEMS AUDIT BADGE & ACKNOWLEDGE BUTTON */}
            {newAssetsCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/80 font-bold text-[10px] px-2 py-0.5 rounded">
                  ✨ +{newProjectsCount} DA mới (+{newAssetsCount} Asset)
                </span>
                <button
                  onClick={acknowledgeNewSync}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-semibold rounded transition-colors cursor-pointer"
                  title="Bấm để duyệt dữ liệu mới"
                >
                  ✓ Đã xem
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Google Sheet UPDATE TRACKING INSTALLATION • <strong className="text-slate-800 dark:text-slate-200 font-semibold">{totalProjects} Dự án</strong> ({totalAssets} Vị trí Asset)
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
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Danh Sách Dự Án</span>
          </button>
          <button
            onClick={() => setActiveModuleTab('ANALYST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeModuleTab === 'ANALYST'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Báo Cáo Tiến Độ &amp; Phân Tích</span>
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

        {/* EXCEL EXPORT BUTTON */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          title="Xuất Báo cáo Executive Excel 2-Tab"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất Báo Cáo Excel</span>
        </button>

        {/* MANUAL REFRESH BUTTON */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          title="Làm mới dữ liệu từ Google Sheet"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
        </button>

        {/* CONFIG SETTINGS MODAL TRIGGER */}
        <button
          onClick={() => setShowConfigModal(true)}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          title="Cấu hình Web App Endpoint 2-Chiều"
        >
          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};
