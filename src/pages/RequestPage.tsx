// Request Page Component for POSM Dashboard
import React from 'react';
import { Loader2, Layers, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useRequestData } from '@/components/request/hooks/useRequestData';
import { useRequestFilters } from '@/components/request/hooks/useRequestFilters';
import { RequestHeader } from '@/components/request/components/RequestHeader';
import { RequestTableView } from '@/components/request/components/RequestTableView';
import { RequestDetailDrawer } from '@/components/request/components/RequestDetailDrawer';
import { RequestConfigModal } from '@/components/request/components/RequestConfigModal';

export function RequestPage() {
  const setIsNewRequestOpen = useDashboardStore(s => s.setIsNewRequestOpen);

  // Hook 1: Data & 2-Way Sync Management
  const {
    rawData,
    isLoading,
    error,
    isRefreshing,
    lastSyncedAt,
    baselineMaxRowId,
    webAppUrl,
    showConfigModal,
    setShowConfigModal,
    selectedItem,
    setSelectedItem,
    isSyncingRow,
    editForm,
    setEditForm,
    autoRefreshEnabled,
    countdownSeconds,
    handleRefresh,
    acknowledgeNewSync,
    handleOpenEdit,
    handleSaveAndSync,
    handleSaveConfig
  } = useRequestData();

  // Hook 2: Filters, Date/Month/Year Filters, Metrics & Pagination (MUST BE CALLED UNCONDITIONALLY BEFORE EARLY RETURNS)
  const {
    searchTerm, setSearchTerm,
    selectedPlanOptions, setSelectedPlanOptions,
    selectedStatuses, setSelectedStatuses,
    selectedProgresses, setSelectedProgresses,
    selectedMers, setSelectedMers,
    selectedSuppliers, setSelectedSuppliers,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    selectedWeek, setSelectedWeek,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sortOrder, setSortOrder,
    onlyNewFilter, setOnlyNewFilter,
    quickProgressFilter, setQuickProgressFilter,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    filterOptions,
    filteredItems,
    paginatedItems,
    totalPages,
    overallStats,
    clearAllFilters
  } = useRequestFilters(rawData, baselineMaxRowId);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <span className="text-xs font-mono">Đang tải dữ liệu từ Google Sheet MER VIEW 2026...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-5 gap-4 overflow-y-auto custom-scrollbar">
      
      {/* 1. HEADER CARD */}
      <RequestHeader
        lastSyncedAt={lastSyncedAt}
        autoRefreshEnabled={autoRefreshEnabled}
        countdownSeconds={countdownSeconds}
        newRequestsCount={overallStats.newRequestsCount}
        acknowledgeNewSync={acknowledgeNewSync}
        totalRequests={overallStats.total}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        setShowConfigModal={setShowConfigModal}
        setIsNewRequestOpen={setIsNewRequestOpen}
        onlyNewFilter={onlyNewFilter}
        setOnlyNewFilter={setOnlyNewFilter}
      />

      {/* 2. METRIC STATS CARDS (CLICKABLE 1-CLICK QUICK FILTERS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CARD 1: TỔNG REQUEST */}
        <div
          onClick={() => setQuickProgressFilter('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between group ${
            quickProgressFilter === 'ALL'
              ? 'bg-white dark:bg-slate-900 border-sky-400 dark:border-sky-600 ring-2 ring-sky-500/20'
              : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Bấm để xem tất cả Request"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Tổng Request (Đã lọc)</span>
              {quickProgressFilter === 'ALL' && <span className="text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded font-bold">Đang xem</span>}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{overallStats.total}</div>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200/60 dark:border-slate-700 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* CARD 2: ĐANG XỬ LÝ */}
        <div
          onClick={() => setQuickProgressFilter(quickProgressFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between group ${
            quickProgressFilter === 'IN_PROGRESS'
              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20'
              : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
          title="Bấm để lọc các ca Đang Xử Lý theo Tiến độ dự án"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Đang Xử Lý</span>
              {quickProgressFilter === 'IN_PROGRESS' && <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-1.5 py-0.2 rounded font-bold">Đang lọc</span>}
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{overallStats.inProgressCount}</div>
          </div>
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200/60 dark:border-amber-900/60 group-hover:scale-105 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* CARD 3: ĐÃ HOÀN TẤT */}
        <div
          onClick={() => setQuickProgressFilter(quickProgressFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between group ${
            quickProgressFilter === 'COMPLETED'
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20'
              : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
          }`}
          title="Bấm để lọc các ca Đã Hoàn Tất theo Tiến độ dự án"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Đã Hoàn Tất</span>
              {quickProgressFilter === 'COMPLETED' && <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.2 rounded font-bold">Đang lọc</span>}
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{overallStats.completedCount}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* CARD 4: HỦY / TỪ CHỐI */}
        <div
          onClick={() => setQuickProgressFilter(quickProgressFilter === 'CANCELLED_REJECTED' ? 'ALL' : 'CANCELLED_REJECTED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between group ${
            quickProgressFilter === 'CANCELLED_REJECTED'
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20'
              : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700'
          }`}
          title="Bấm để lọc các ca Hủy / Từ Chối theo Tiến độ dự án"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Hủy / Từ Chối</span>
              {quickProgressFilter === 'CANCELLED_REJECTED' && <span className="text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 px-1.5 py-0.2 rounded font-bold">Đang lọc</span>}
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{overallStats.cancelledRejectedCount}</div>
          </div>
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200/60 dark:border-rose-900/60 group-hover:scale-105 transition-transform">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. TABLE VIEW & FILTERS */}
      <RequestTableView
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedPlanOptions={selectedPlanOptions}
        setSelectedPlanOptions={setSelectedPlanOptions}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedProgresses={selectedProgresses}
        setSelectedProgresses={setSelectedProgresses}
        selectedMers={selectedMers}
        setSelectedMers={setSelectedMers}
        selectedSuppliers={selectedSuppliers}
        setSelectedSuppliers={setSelectedSuppliers}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedWeek={selectedWeek}
        setSelectedWeek={setSelectedWeek}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onlyNewFilter={onlyNewFilter}
        setOnlyNewFilter={setOnlyNewFilter}
        quickProgressFilter={quickProgressFilter}
        setQuickProgressFilter={setQuickProgressFilter}
        filterOptions={filterOptions}
        paginatedItems={paginatedItems}
        filteredItemsCount={filteredItems.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalPages={totalPages}
        baselineMaxRowId={baselineMaxRowId}
        onOpenEdit={handleOpenEdit}
        clearAllFilters={clearAllFilters}
      />

      {/* 4. DETAIL & 2-WAY WRITE-BACK DRAWER */}
      <RequestDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        isSyncingRow={isSyncingRow}
        onSaveAndSync={handleSaveAndSync}
      />

      {/* 5. APPS SCRIPT WEB APP CONFIG MODAL */}
      <RequestConfigModal
        show={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        webAppUrl={webAppUrl}
        onSave={handleSaveConfig}
      />

    </div>
  );
}

export default RequestPage;
