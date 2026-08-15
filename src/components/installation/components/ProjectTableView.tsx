import React from 'react';
import { Search, Filter, ArrowRight } from 'lucide-react';
import type { GroupedProject } from '../hooks/useInstallationFilters';
import { evaluateScheduleHighlight, getActualTimeAlert } from '../utils/statusCalculators';

interface ProjectTableViewProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedRegion: string;
  setSelectedRegion: (val: string) => void;
  selectedBrand: string;
  setSelectedBrand: (val: string) => void;
  selectedSupplier: string;
  setSelectedSupplier: (val: string) => void;
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  selectedTechnician: string;
  setSelectedTechnician: (val: string) => void;
  selectedCat: string;
  setSelectedCat: (val: string) => void;
  selectedResult: string;
  setSelectedResult: (val: string) => void;
  selectedScheduleState: string;
  setSelectedScheduleState: (val: string) => void;
  filterOptions: {
    regions: string[];
    brands: string[];
    suppliers: string[];
    statuses: string[];
    technicians: string[];
    cats: string[];
  };
  paginatedProjects: GroupedProject[];
  groupedProjectsCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  baselineMaxRowId: number;
  setActiveProjectDetailCode: (code: string | null) => void;
  clearAllFilters: () => void;
}

export const ProjectTableView: React.FC<ProjectTableViewProps> = ({
  searchTerm,
  setSearchTerm,
  selectedRegion,
  setSelectedRegion,
  selectedBrand,
  setSelectedBrand,
  selectedSupplier,
  setSelectedSupplier,
  selectedStatus,
  setSelectedStatus,
  selectedTechnician,
  setSelectedTechnician,
  selectedCat,
  setSelectedCat,
  selectedResult,
  setSelectedResult,
  selectedScheduleState,
  setSelectedScheduleState,
  filterOptions,
  paginatedProjects,
  groupedProjectsCount,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  baselineMaxRowId,
  setActiveProjectDetailCode,
  clearAllFilters
}) => {
  return (
    <div className="space-y-4">
      {/* FILTER BAR - MINIMALIST ENTERPRISE DESIGN */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* SEARCH BOX */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã dự án, tên dự án, tên cửa hàng, hạng mục, ghi chú, SR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* QUICK CLEAR FILTERS BUTTON */}
          {(searchTerm || selectedRegion !== 'all' || selectedBrand !== 'all' || selectedSupplier !== 'all' || selectedStatus !== 'all' || selectedTechnician !== 'all' || selectedCat !== 'all' || selectedResult !== 'all' || selectedScheduleState !== 'all') && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* MULTI-SELECT DROPDOWNS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs font-medium">
          {/* 1. Ngành Hàng */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">Tất cả Ngành</option>
            {filterOptions.cats.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 2. Nhãn Hàng */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">Tất cả Nhãn</option>
            {filterOptions.brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* 3. Vùng */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">Tất cả Vùng</option>
            {filterOptions.regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* 4. Nhà Cung Cấp */}
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">Tất cả Supplier</option>
            {filterOptions.suppliers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* 5. Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">Tất cả Status</option>
            {filterOptions.statuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* 6. Kết quả >< */}
          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer font-bold"
          >
            <option value="all">Tất cả Kết quả</option>
            <option value="pass">✔ Pass</option>
            <option value="fail">❌ Fail</option>
          </select>

          {/* 7. Bộ Lọc Lịch Thi Công (Actual Time Alert States) */}
          <select
            value={selectedScheduleState}
            onChange={(e) => setSelectedScheduleState(e.target.value)}
            className="w-full px-2.5 py-2 bg-sky-50/80 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 rounded-xl outline-none cursor-pointer font-semibold"
          >
            <option value="all">Tất cả Lịch Thi Công</option>
            <option value="NO_ACTUAL_TIME">⏳ Chưa có Actual Time</option>
            <option value="UPCOMING">📅 Đã lên lịch</option>
            <option value="IN_PROGRESS">🔄 Đang thực hiện</option>
            <option value="DUE_SOON">⚠️ Sắp tới hạn (còn 1 ngày)</option>
            <option value="OVERDUE">🚨 Quá hạn</option>
          </select>

          {/* 8. POSM QC Tech */}
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
          >
            <option value="all">POSM QC Tech</option>
            {filterOptions.technicians.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TIER 1: CLEAN PROJECT LIST TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3.5 w-12 text-center">STT</th>
                <th className="px-4 py-3.5">Mã Dự Án &amp; Ngành/Nhãn</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5 text-center">Vị Trí Asset</th>
                <th className="px-4 py-3.5">Hạng Mục</th>
                <th className="px-4 py-3.5">Lịch Hệ Thống</th>
                <th className="px-4 py-3.5">Actual Time</th>
                <th className="px-4 py-3.5">Tiến Độ Hoàn Thành</th>
                <th className="px-4 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {paginatedProjects.map((prj, idx) => {
                const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                const isNewProject = prj.stores.some(s => s.rowId > baselineMaxRowId);

                return (
                  <tr
                    key={prj.projectCode}
                    onClick={() => setActiveProjectDetailCode(prj.projectCode)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-xs ${
                      isNewProject ? 'bg-emerald-50/20 dark:bg-emerald-950/20' : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                      {globalIndex}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 flex-wrap">
                        <span>{prj.projectCode}</span>
                        {isNewProject && (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[9px] px-1.5 py-0.5 rounded">
                            ✨ Mới
                          </span>
                        )}
                        {prj.categoryCode && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] px-1.5 py-0.5 rounded">
                            {prj.categoryCode}
                          </span>
                        )}
                        {prj.brandName && (
                          <span className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium text-[10px] px-1.5 py-0.5 rounded uppercase">
                            {prj.brandName} {prj.brandCode ? `(${prj.brandCode})` : ''}
                          </span>
                        )}
                        {prj.posmTypeCode && (
                          <span className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 font-mono text-[10px] px-1.5 py-0.5 rounded uppercase border border-sky-200/60 dark:border-sky-900/60">
                            {prj.posmTypeCode}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 text-xs font-normal mt-0.5 max-w-[220px] truncate">
                        {prj.projectName}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {prj.customerSummary}
                    </td>

                    {/* Vị Trí Asset */}
                    <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                      {prj.stats.total}
                    </td>

                    {/* Hạng Mục */}
                    <td className="px-4 py-3.5 font-medium text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {prj.itemSummary}
                    </td>

                    {/* Lịch Hệ Thống */}
                    <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap">
                      {prj.plannedTimeRange}
                    </td>

                    {/* Actual Time Supplier & Alert Badges */}
                    <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap">
                      {prj.actualTimeRange && prj.actualTimeRange !== 'Xem từng vị trí'
                        ? <span className="font-medium text-slate-700 dark:text-slate-300">{prj.actualTimeRange}</span>
                        : <span className="text-slate-300 dark:text-slate-600" title="Xem từng vị trí cụ thể trong chi tiết dự án">—</span>
                      }

                      {(() => {
                        const isProjectProcessedOrStarted = prj.stats.processed > 0;
                        const alert = getActualTimeAlert(prj.actualTimeRange, undefined, undefined, isProjectProcessedOrStarted);
                        if (!alert.label || alert.state === 'COMPLETED') return null;

                        // Option 1: If project has started / is in progress (>0% and <100%), show "Đang thực hiện" instead of "Quá hạn"
                        if (prj.stats.processedRate > 0 && prj.stats.processedRate < 100) {
                          return (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900 font-medium">
                                <span>🔄</span>
                                <span>Đang thực hiện</span>
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div className="mt-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${alert.badgeClass}`}>
                              <span>{alert.icon}</span>
                              <span>{alert.label}</span>
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Tiến Độ Hoàn Thành */}
                    <td className="px-4 py-3.5">
                      <div className="w-44 space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">{prj.stats.completedRate}%</span>
                          <span className="text-slate-400">{prj.stats.processed}/{prj.stats.total}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${prj.stats.completedRate}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          {prj.stats.failed > 0 && (
                            <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Fail: {prj.stats.failed} ca</span>
                            </div>
                          )}
                          {prj.stats.cancelled > 0 && (
                            <div className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Cancel: {prj.stats.cancelled} ca</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Thao Tác */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProjectDetailCode(prj.projectCode);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Xem chi tiết ({prj.stats.total})</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paginatedProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-600">
                      <Search className="w-8 h-8" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Không tìm thấy dự án nào</p>
                      <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                      <button
                        onClick={clearAllFilters}
                        className="mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        Xóa tất cả bộ lọc
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded cursor-pointer"
            >
              {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} dự án</option>)}
            </select>
            <span>trên tổng số <strong>{groupedProjectsCount}</strong> dự án</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40 cursor-pointer"
            >
              Trước
            </button>
            <span>Trang {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
