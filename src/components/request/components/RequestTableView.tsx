import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RequestItem } from '@/services/requestSyncService';
import { useColumnResize } from '../hooks/useColumnResize';
import { RequestFilterBar } from './RequestFilterBar';
import { RequestTableRows } from './RequestTableRows';

import type { ProgressCategory } from '../hooks/useRequestFilters';

/**
 * Số cột cố định — dùng cho colSpan khi bảng rỗng
 */
const COLUMN_COUNT = 11;

interface RequestTableViewProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedPlanOptions: string[];
  setSelectedPlanOptions: (v: string[]) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (v: string[]) => void;
  selectedProgresses: string[];
  setSelectedProgresses: (v: string[]) => void;
  selectedMers: string[];
  setSelectedMers: (v: string[]) => void;
  selectedSuppliers: string[];
  setSelectedSuppliers: (v: string[]) => void;
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedWeek: string;
  setSelectedWeek: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  sortOrder: 'NEWEST_FIRST' | 'SHEET_ORDER';
  setSortOrder: (order: 'NEWEST_FIRST' | 'SHEET_ORDER') => void;
  onlyNewFilter: boolean;
  setOnlyNewFilter: (val: boolean) => void;
  quickProgressFilter: ProgressCategory;
  setQuickProgressFilter: (cat: ProgressCategory) => void;
  filterOptions: {
    planOptions: string[];
    statuses: string[];
    progressOptions: string[];
    mers: string[];
    suppliers: string[];
    years: string[];
    weeks: string[];
  };
  paginatedItems: RequestItem[];
  filteredItemsCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  baselineMaxRowId: number;
  onOpenEdit: (item: RequestItem) => void;
  clearAllFilters: () => void;
}

/**
 * RequestTableView — Orchestrator component (FIX U1 - code split)
 * 
 * Logic đã được tách ra:
 * - RequestFilterBar    → Filter/Search UI
 * - RequestTableRows    → tbody rows + badge helpers
 * - useColumnResize     → Resize cột + localStorage persistence
 */
export const RequestTableView: React.FC<RequestTableViewProps> = ({
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
  filterOptions,
  paginatedItems,
  filteredItemsCount,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  baselineMaxRowId,
  onOpenEdit,
  clearAllFilters,
}) => {
  const { columnWidths, handleResizeStart, resetColumnWidths } = useColumnResize();

  const hasActiveFilters = Boolean(
    searchTerm ||
    selectedPlanOptions.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedProgresses.length > 0 ||
    selectedMers.length > 0 ||
    selectedSuppliers.length > 0 ||
    selectedYear !== 'all' ||
    selectedMonth !== 'all' ||
    selectedWeek !== 'all' ||
    dateFrom ||
    dateTo ||
    onlyNewFilter ||
    quickProgressFilter !== 'ALL'
  );

  const renderTh = (colKey: string, title: string, align: 'left' | 'center' | 'right' = 'left') => {
    const width = columnWidths[colKey] || 150;
    return (
      <th
        key={colKey}
        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
        className={`py-3 px-3.5 relative select-none group text-${align}`}
      >
        <span className="truncate block font-bold">{title}</span>
        {/* RESIZE HANDLE */}
        <div
          onMouseDown={(e) => handleResizeStart(colKey, e)}
          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center hover:bg-sky-500/30 group-hover:bg-slate-200 dark:group-hover:bg-slate-700/60 transition-colors z-10"
          title="Kéo sang trái/phải để điều chỉnh độ rộng cột"
        >
          <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-sky-500" />
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {/* FILTER BAR */}
      <RequestFilterBar
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
        filterOptions={filterOptions}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
        onResetColumns={resetColumnWidths}
      />

      {/* ACTIVE NEW REQUESTS FILTER BANNER */}
      {onlyNewFilter && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <div>
              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                Đang lọc hiển thị riêng {filteredItemsCount} Request mới được thêm vào Sheet
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Toàn bộ các ca mới được ưu tiên hiển thị ngay trên đầu bảng để bạn xử lý.
              </p>
            </div>
          </div>
          <button
            onClick={() => setOnlyNewFilter(false)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Quay lại xem tất cả ✕
          </button>
        </div>
      )}

      {/* ACTIVE PROGRESS METRIC FILTER BANNER */}
      {quickProgressFilter !== 'ALL' && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in ${
          quickProgressFilter === 'IN_PROGRESS' 
            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            : quickProgressFilter === 'COMPLETED'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">
              {quickProgressFilter === 'IN_PROGRESS' ? '⏳' : quickProgressFilter === 'COMPLETED' ? '✅' : '🚫'}
            </span>
            <div>
              <span className="font-bold">
                Đang lọc theo Tiến Độ Dự Án: {
                  quickProgressFilter === 'IN_PROGRESS' ? 'Đang Xử Lý' :
                  quickProgressFilter === 'COMPLETED' ? 'Đã Hoàn Tất' : 'Hủy / Từ Chối'
                } ({filteredItemsCount} Request)
              </span>
              <p className="text-[11px] opacity-80">
                Bấm nút bên phải hoặc bấm lại vào thẻ số liệu trên để xem tất cả Request.
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuickProgressFilter('ALL')}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Xem tất cả ✕
          </button>
        </div>
      )}

      {/* REQUEST TABLE CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th
                  key="id"
                  style={{ width: `${columnWidths['id'] || 100}px`, minWidth: `${columnWidths['id'] || 100}px`, maxWidth: `${columnWidths['id'] || 100}px` }}
                  className="py-2.5 px-2 select-none text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                  onClick={() => setSortOrder(sortOrder === 'NEWEST_FIRST' ? 'SHEET_ORDER' : 'NEWEST_FIRST')}
                  title={`Đang sắp xếp: ${sortOrder === 'NEWEST_FIRST' ? 'Mới nhất lên đầu' : 'Theo thứ tự dòng Sheet'}. Bấm để đổi thứ tự!`}
                >
                  <div className="flex items-center justify-center gap-1 font-bold text-[11px] text-slate-800 dark:text-slate-200">
                    <span># Dòng</span>
                    <span className="text-[10px] text-sky-600 font-black">{sortOrder === 'NEWEST_FIRST' ? '🔽' : '🔼'}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-normal block font-sans">
                    {sortOrder === 'NEWEST_FIRST' ? 'Mới nhất' : 'Thứ tự Sheet'}
                  </span>
                </th>
                {renderTh('date', 'Ngày / Tuần')}
                {renderTh('store', 'Cửa Hàng / Mã')}
                {renderTh('pic', 'Phụ Trách (Mer / SR)')}
                {renderTh('posm', 'Loại RQ & POSM')}
                {renderTh('catBrand', 'CAT & Brand')}
                {renderTh('status', 'Trạng Thái')}
                {renderTh('progress', 'Tiến Độ Dự Án')}
                {renderTh('plan', 'Phương Án / Deadline')}
                {renderTh('supplier', 'Supplier & Mã Dự Án')}
                {renderTh('actions', 'Thao Tác', 'right')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-12 text-center text-slate-400">
                    Không tìm thấy Request nào phù hợp với bộ lọc thời gian &amp; tiêu chí đã chọn.
                  </td>
                </tr>
              ) : (
                <RequestTableRows
                  paginatedItems={paginatedItems}
                  baselineMaxRowId={baselineMaxRowId}
                  columnWidths={columnWidths}
                  onOpenEdit={onOpenEdit}
                />
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Hiển thị <strong className="text-slate-800 dark:text-slate-200">{paginatedItems.length}</strong> / <strong>{filteredItemsCount}</strong> Request
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Kích thước:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none cursor-pointer"
              >
                <option value={15}>15 dòng</option>
                <option value={25}>25 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
