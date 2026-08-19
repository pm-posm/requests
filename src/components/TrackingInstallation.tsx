import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, X, Search, Edit3, User, Check, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { exportInstallationExecutiveReport } from '@/services/installationExcelExporter';

import { useInstallationData } from './installation/hooks/useInstallationData';
import { useInstallationFilters } from './installation/hooks/useInstallationFilters';
import { InstallationHeader } from './installation/components/InstallationHeader';
import { ProjectTableView } from './installation/components/ProjectTableView';
import { ProjectDetailView } from './installation/components/ProjectDetailView';
import { AnalystDashboard } from './installation/components/AnalystDashboard';
import { EditSyncDrawer } from './installation/components/EditSyncDrawer';
import { InstallationInboxView } from './installation/components/InstallationInboxView';
import { getStatusBadgeStyle } from './installation/utils/statusCalculators';

export default function TrackingInstallation() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive activeModuleTab directly from URL pathname
  const activeModuleTab = useMemo<'DATA_LIST' | 'ANALYST' | 'INBOX' | 'EXCEL_EXPORT'>(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/tracking/installation/analytics') || path.includes('/tracking/installation/report')) {
      return 'ANALYST';
    }
    if (path.includes('/tracking/installation/inbox')) {
      return 'INBOX';
    }
    return 'DATA_LIST';
  }, [location.pathname]);

  const handleTabChange = (tab: 'DATA_LIST' | 'ANALYST' | 'INBOX' | 'EXCEL_EXPORT') => {
    if (tab === 'ANALYST') {
      navigate('/tracking/installation/analytics');
    } else if (tab === 'INBOX') {
      navigate('/tracking/installation/inbox');
    } else {
      navigate('/tracking/installation');
    }
  };

  // Custom Hook 1: Data & Sync Management
  const {
    rawData,
    contactMap,
    isLoading,
    error,
    isRefreshing,
    lastSyncedAt,
    baselineMaxRowId,
    webAppUrl,
    setWebAppUrl,
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
    handleBulkSaveAndSync,
    handleSaveConfig
  } = useInstallationData();

  // Custom Hook 2: Filters, Pagination & BI Analytics
  const {
    searchTerm, setSearchTerm,
    selectedRegion, setSelectedRegion,
    selectedBrand, setSelectedBrand,
    selectedSupplier, setSelectedSupplier,
    selectedStatus, setSelectedStatus,
    selectedTechnician, setSelectedTechnician,
    selectedCat, setSelectedCat,
    selectedResult, setSelectedResult,
    selectedScheduleState, setSelectedScheduleState,
    analystSelectedMonth, setAnalystSelectedMonth,
    analystSelectedYear, setAnalystSelectedYear,
    expandedSupplierIssues,
    issueSearchTerm, setIssueSearchTerm,
    issueSelectedSupplier, setIssueSelectedSupplier,
    supplierDrawerConfig, setSupplierDrawerConfig,
    drawerSearchTerm, setDrawerSearchTerm,
    activeProjectDetailCode, setActiveProjectDetailCode,
    detailStoreSearch, setDetailStoreSearch,
    detailSelectedQcTech, setDetailSelectedQcTech,
    detailSelectedStatus, setDetailSelectedStatus,
    detailSelectedSupplier, setDetailSelectedSupplier,
    detailSelectedResult, setDetailSelectedResult,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    filterOptions,
    modalStatusOptions,
    filteredFlatRows,
    groupedProjects,
    currentDetailProject,
    detailFilterOptions,
    filteredProjectDetailStores,
    totalPages,
    paginatedProjects,
    availableYears,
    filteredAnalystRows,
    overallStats,
    filteredDrawerItems,
    filteredIssueList,
    toggleSupplierIssueExpand,
    clearAllFilters
  } = useInstallationFilters(rawData, contactMap, baselineMaxRowId, editForm.status);

  // Trigger Excel Export theo đúng bộ lọc thời gian & danh sách đang chọn
  const handleExportExcel = () => {
    let exportItems = filteredFlatRows;
    let periodText = 'Tất Cả Thời Gian';

    // 1. Nếu đang chọn xem chi tiết 1 dự án cụ thể
    if (activeProjectDetailCode && currentDetailProject) {
      exportItems = filteredProjectDetailStores;
      periodText = `Chi Tiết Dự Án ${currentDetailProject.projectCode} (${currentDetailProject.projectName})`;
    } 
    // 2. Nếu đang ở Tab Phân Tích BI hoặc có chọn filter Thời gian (Tháng/Năm)
    else if (activeModuleTab === 'ANALYST' || analystSelectedMonth !== 'all' || analystSelectedYear !== 'all') {
      exportItems = filteredAnalystRows;

      if (analystSelectedMonth !== 'all' && analystSelectedYear !== 'all') {
        const m = parseInt(analystSelectedMonth, 10);
        const y = parseInt(analystSelectedYear, 10);
        const lastDay = new Date(y, m, 0).getDate();
        const mm = String(m).padStart(2, '0');
        periodText = `Tháng ${m}/${y} (Từ 01/${mm}/${y} đến ${lastDay}/${mm}/${y})`;
      } else if (analystSelectedMonth !== 'all') {
        const m = parseInt(analystSelectedMonth, 10);
        const mm = String(m).padStart(2, '0');
        periodText = `Tháng ${m} (Từ 01/${mm} đến cuối tháng ${mm})`;
      } else if (analystSelectedYear !== 'all') {
        const y = analystSelectedYear;
        periodText = `Năm ${y} (Từ 01/01/${y} đến 31/12/${y})`;
      }
    }

    const monthStr = analystSelectedMonth !== 'all' ? `Thang${analystSelectedMonth}` : 'TongHop';
    const yearStr = analystSelectedYear !== 'all' ? `_Nam${analystSelectedYear}` : '';

    exportInstallationExecutiveReport(exportItems, {
      periodText,
      filenamePrefix: `POSM_BaoCao_TienDo_${monthStr}${yearStr}`
    });

    toast.success(`Đã xuất Excel thành công! (${periodText})`);
  };

  // Loading UI State
  if (isLoading && !isRefreshing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600 dark:text-sky-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Đang tải dữ liệu từ Google Sheet...</p>
        <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  // Error UI State
  if (error && rawData.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 custom-scrollbar">
      {/* HEADER COMPONENT */}
      <InstallationHeader
        activeModuleTab={activeModuleTab}
        setActiveModuleTab={handleTabChange}
        lastSyncedAt={lastSyncedAt}
        autoRefreshEnabled={autoRefreshEnabled}
        countdownSeconds={countdownSeconds}
        newAssetsCount={overallStats.newAssetsCount}
        newProjectsCount={overallStats.newProjectsCount}
        acknowledgeNewSync={acknowledgeNewSync}
        totalProjects={overallStats.totalProjects}
        totalAssets={overallStats.total}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        handleExportExcel={handleExportExcel}
        setShowConfigModal={setShowConfigModal}
      />

      {/* MODULE TAB 1: DATA LIST TABLE (TIER 1 OR TIER 2) */}
      {activeModuleTab === 'DATA_LIST' && (
        <>
          {!activeProjectDetailCode ? (
            <ProjectTableView
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
              selectedBrand={selectedBrand}
              setSelectedBrand={setSelectedBrand}
              selectedSupplier={selectedSupplier}
              setSelectedSupplier={setSelectedSupplier}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              selectedTechnician={selectedTechnician}
              setSelectedTechnician={setSelectedTechnician}
              selectedCat={selectedCat}
              setSelectedCat={setSelectedCat}
              selectedResult={selectedResult}
              setSelectedResult={setSelectedResult}
              selectedScheduleState={selectedScheduleState}
              setSelectedScheduleState={setSelectedScheduleState}
              filterOptions={filterOptions}
              paginatedProjects={paginatedProjects}
              groupedProjectsCount={groupedProjects.length}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalPages={totalPages}
              baselineMaxRowId={baselineMaxRowId}
              setActiveProjectDetailCode={setActiveProjectDetailCode}
              clearAllFilters={clearAllFilters}
            />
          ) : currentDetailProject ? (
            <ProjectDetailView
              currentDetailProject={currentDetailProject}
              setActiveProjectDetailCode={setActiveProjectDetailCode}
              detailStoreSearch={detailStoreSearch}
              setDetailStoreSearch={setDetailStoreSearch}
              detailSelectedQcTech={detailSelectedQcTech}
              setDetailSelectedQcTech={setDetailSelectedQcTech}
              detailSelectedStatus={detailSelectedStatus}
              setDetailSelectedStatus={setDetailSelectedStatus}
              detailSelectedSupplier={detailSelectedSupplier}
              setDetailSelectedSupplier={setDetailSelectedSupplier}
              detailSelectedResult={detailSelectedResult}
              setDetailSelectedResult={setDetailSelectedResult}
              detailFilterOptions={detailFilterOptions}
              modalStatusOptions={modalStatusOptions}
              filteredProjectDetailStores={filteredProjectDetailStores}
              contactMap={contactMap}
              handleOpenEdit={handleOpenEdit}
              handleBulkSaveAndSync={handleBulkSaveAndSync}
              isSyncingRow={isSyncingRow}
              baselineMaxRowId={baselineMaxRowId}
            />
          ) : null}
        </>
      )}

      {/* MODULE TAB 2: ANALYST BI DASHBOARD */}
      {activeModuleTab === 'ANALYST' && (
        <AnalystDashboard
          analystSelectedMonth={analystSelectedMonth}
          setAnalystSelectedMonth={setAnalystSelectedMonth}
          analystSelectedYear={analystSelectedYear}
          setAnalystSelectedYear={setAnalystSelectedYear}
          availableYears={availableYears}
          overallStats={overallStats}
          setSupplierDrawerConfig={setSupplierDrawerConfig}
          expandedSupplierIssues={expandedSupplierIssues}
          toggleSupplierIssueExpand={toggleSupplierIssueExpand}
          issueSearchTerm={issueSearchTerm}
          setIssueSearchTerm={setIssueSearchTerm}
          issueSelectedSupplier={issueSelectedSupplier}
          setIssueSelectedSupplier={setIssueSelectedSupplier}
          filteredIssueList={filteredIssueList}
          filterOptionsSuppliers={filterOptions.suppliers}
          contactMap={contactMap}
          handleOpenEdit={handleOpenEdit}
        />
      )}

      {/* MODULE TAB 3: DEDICATED INSTALLATION GMAIL INBOX */}
      {activeModuleTab === 'INBOX' && (
        <div className="animate-in fade-in duration-150">
          <InstallationInboxView />
        </div>
      )}

      {/* EDIT DRAWER COMPONENT (2-WAY SYNC) */}
      <EditSyncDrawer
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        editForm={editForm}
        setEditForm={setEditForm}
        modalStatusOptions={modalStatusOptions}
        isSyncingRow={isSyncingRow}
        handleSaveAndSync={handleSaveAndSync}
      />

      {/* SUPPLIER MATRIX SLIDE-OVER DRAWER MODAL */}
      {supplierDrawerConfig && supplierDrawerConfig.isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{supplierDrawerConfig.supplierName}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {supplierDrawerConfig.metricTitle}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị tổng số {filteredDrawerItems.length} vị trí lắp đặt
                </p>
              </div>
              <button
                onClick={() => {
                  setSupplierDrawerConfig(null);
                  setDrawerSearchTerm('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tra cứu nhanh Mã DA, Tên cửa hàng, Mã cửa hàng, SR, QC Tech, Ghi chú..."
                  value={drawerSearchTerm}
                  onChange={(e) => setDrawerSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                      <th className="p-2.5 text-center w-8">STT</th>
                      <th className="p-2.5">Mã DA &amp; Ngành/Nhãn</th>
                      <th className="p-2.5">Cửa Hàng &amp; SR Contact</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Hạng Mục</th>
                      <th className="p-2.5">Thi Công &amp; QC Tech</th>
                      <th className="p-2.5">Lịch Hệ Thống</th>
                      <th className="p-2.5">Actual Time</th>
                      <th className="p-2.5">Trạng Thái &amp; Kết Quả</th>
                      <th className="p-2.5">Ghi Chú Vận Hành</th>
                      <th className="p-2.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredDrawerItems.map((item, idx) => {
                      const storeCodeKey = (item.storeCode || '').toUpperCase().trim();
                      const contactInfo = contactMap.get(storeCodeKey);
                      const srName = contactInfo?.sr_name || '';
                      const srPhone = contactInfo?.sr_phone || contactInfo?.sr_phone_2 || '';
                      const hasActualTime = !!(item.actualTime && item.actualTime.trim());

                      return (
                        <tr key={item.rowId} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors text-xs">
                          <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-sky-700 dark:text-sky-400 font-mono text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{item.projectCode}</span>
                              {item.categoryCode && (
                                <Badge variant="secondary" className="text-[9px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold">
                                  {item.categoryCode}
                                </Badge>
                              )}
                              {item.brandName && (
                                <Badge variant="outline" className="text-[9px] font-normal uppercase">
                                  {item.brandName}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 max-w-[160px] truncate">
                              {item.projectName}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{item.storeName}</div>
                            <div className="text-[11px] font-mono text-slate-500">{item.storeCode}{item.region ? ` • ${item.region}` : ''}</div>
                            {srName ? (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3 text-emerald-600" />
                                <span>{srName}</span>
                                {srPhone && <span>• {srPhone}</span>}
                              </div>
                            ) : null}
                          </td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="font-bold text-xs bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                              {item.customer || '-'}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{item.item || item.posmTypeCode}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{item.supplierName || 'Chưa gán thầu'}</div>
                            <div className="text-[11px] text-sky-700 dark:text-sky-400 font-semibold">{item.technician || 'Chưa gán QC Tech'}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.plannedStartDate || '-'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">➔ {item.plannedEndDate || '-'}</div>
                          </td>
                          <td className="p-2.5">
                            {hasActualTime ? (
                              <div className="font-mono text-xs font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-800 w-fit">
                                {item.actualTime}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/80 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 text-[10px]">
                                <span>⚠️ Chưa có Actual Time</span>
                              </div>
                            )}
                            {item.completionTime && item.completionTime.trim() && (
                              <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                Done: {item.completionTime}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border w-fit ${getStatusBadgeStyle(item.status)}`}>
                                {item.status || 'New'}
                              </span>
                              {item.resultSign === '✔' && (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Pass
                                </span>
                              )}
                              {item.resultSign === '❌' && (
                                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Issue
                                </span>
                              )}
                              {item.resultSign === 'OVERDUE_RED' && (
                                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> Quá hạn
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-xs text-slate-600 dark:text-slate-400 italic max-w-[200px]">
                              {item.note ? <span className="text-rose-600 dark:text-rose-400 font-medium">{item.note}</span> : <span className="text-slate-400">Không có ghi chú</span>}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSupplierDrawerConfig(null);
                                handleOpenEdit(item);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 hover:bg-sky-100 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-sky-200 dark:border-sky-800 shadow-2xs"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Sửa / Sync</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDrawerItems.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-500 font-medium">
                          Không tìm thấy vị trí nào khớp với từ khóa tìm kiếm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
              <span>Hiển thị <strong>{filteredDrawerItems.length}</strong> vị trí</span>
              <button
                onClick={() => {
                  setSupplierDrawerConfig(null);
                  setDrawerSearchTerm('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Đóng Sidebar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cấu Hình 2-Way Sync Web App Endpoint
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Google Apps Script Web App URL</label>
              <input
                type="text"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-slate-500">
                URL này được dùng để gửi dữ liệu cập nhật từ Dashboard ngược về Google Sheet.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-semibold hover:bg-sky-700"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
