import React from 'react';
import { 
  FolderKanban, Clock, CheckCircle2, AlertTriangle, AlertOctagon, ChevronDown, ChevronUp, Search, User, Phone, Edit3, Layers
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { InstallationItem } from '@/services/installationSyncService';
import type { MasterStoreContactInfo } from '@/services/sheetSyncService';
import { getStatusBadgeStyle } from '../utils/statusCalculators';

interface AnalystDashboardProps {
  analystSelectedMonth: string;
  setAnalystSelectedMonth: (m: string) => void;
  analystSelectedYear: string;
  setAnalystSelectedYear: (y: string) => void;
  availableYears: number[];
  overallStats: {
    total: number;
    totalProjects: number;
    newProjectsCount: number;
    newAssetsCount: number;
    noActualTimeTotalCount: number;
    activeExecutedTotalCount: number;
    completed: number;
    issueCount: number;
    overdueCount: number;
    noReportCount: number;
    cancelledCount: number;
    unupdatedCount: number;
    completionRate: string;
    supplierMap: any[];
    catMap: [string, number][];
    issueAuditList: InstallationItem[];
  };
  setSupplierDrawerConfig: (config: any) => void;
  expandedSupplierIssues: Record<string, boolean>;
  toggleSupplierIssueExpand: (name: string) => void;
  issueSearchTerm: string;
  setIssueSearchTerm: (term: string) => void;
  issueSelectedSupplier: string;
  setIssueSelectedSupplier: (supp: string) => void;
  filteredIssueList: InstallationItem[];
  filterOptionsSuppliers: string[];
  contactMap: Map<string, MasterStoreContactInfo>;
  handleOpenEdit: (item: InstallationItem) => void;
}

export const AnalystDashboard: React.FC<AnalystDashboardProps> = ({
  analystSelectedMonth,
  setAnalystSelectedMonth,
  analystSelectedYear,
  setAnalystSelectedYear,
  availableYears,
  overallStats,
  setSupplierDrawerConfig,
  expandedSupplierIssues,
  toggleSupplierIssueExpand,
  issueSearchTerm,
  setIssueSearchTerm,
  issueSelectedSupplier,
  setIssueSelectedSupplier,
  filteredIssueList,
  filterOptionsSuppliers,
  contactMap,
  handleOpenEdit
}) => {
  return (
    <div className="space-y-6">
      {/* TIME FILTER HEADER */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Trung Tâm Báo Cáo Tiến Độ &amp; Phân Tích Kỹ Thuật
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dữ liệu được cập nhật từ Google Sheet • Phân tích tỷ lệ hoàn thành &amp; lỗi theo thời gian
          </p>
        </div>

        <div className="flex items-center gap-2 font-medium text-xs">
          <span className="text-slate-500">Lọc theo thời gian:</span>
          <select
            value={analystSelectedMonth}
            onChange={(e) => setAnalystSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer font-semibold"
          >
            <option value="all">Tất cả các tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={String(m)}>Tháng {m}</option>
            ))}
          </select>

          <select
            value={analystSelectedYear}
            onChange={(e) => setAnalystSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer font-semibold"
          >
            <option value="all">Tất cả các năm</option>
            {availableYears.map(y => (
              <option key={y} value={String(y)}>Năm {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP KPI CARDS - 5 CLEAN METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* CARD 1: TỔNG SỐ MÃ DỰ ÁN */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng Mã Dự Án</p>
              <h3 className="text-2xl font-extrabold text-sky-700 dark:text-sky-400 mt-1">{overallStats.totalProjects} <span className="text-xs font-bold text-slate-500">Mã DA</span></h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {overallStats.total} vị trí
                {(analystSelectedMonth !== 'all' || analystSelectedYear !== 'all')
                  ? <span className="text-amber-600 font-semibold"> • Theo filter đang chọn</span>
                  : <span> • Tất cả thời gian</span>
                }
              </p>
            </div>
            <div className="p-3 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-xl">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: TỔNG VỊ TRÍ ASSET POSM */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng Vị Trí Asset POSM</p>
              <h3 className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 mt-1">{overallStats.total} <span className="text-xs font-bold text-slate-500">vị trí</span></h3>
              <p className="text-[10px] text-slate-400 font-medium">Tổng số dòng Asset trên Sheet</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: HOÀN THÀNH (PASS) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hoàn Thành (Pass)</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{overallStats.completed} <span className="text-xs font-bold text-slate-500">vị trí</span></h3>
              <p className="text-[10px] text-emerald-600 font-bold">Đạt {overallStats.completionRate}% tiến độ</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: LỖI / QC FAILED */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lỗi / QC Failed</p>
              <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{overallStats.issueCount} <span className="text-xs font-bold text-slate-500">ca</span></h3>
              <p className="text-[10px] text-rose-500 font-medium">{overallStats.overdueCount} ca quá hạn thi công</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: CHƯA BÁO CÁO / HỦY */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chưa Báo Cáo / Hủy</p>
              <h3 className="text-2xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">{overallStats.noReportCount + overallStats.cancelledCount} <span className="text-xs font-bold text-slate-500">vị trí</span></h3>
              <p className="text-[10px] text-slate-400 font-medium">{overallStats.noReportCount} chưa gửi report • {overallStats.cancelledCount} hủy</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SUPPLIER PERFORMANCE MATRIX */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Ma Trận Đánh Giá Năng Lực Nhà Cung Cấp (Suppliers)
            </h3>
            <p className="text-xs text-slate-500">
              Thống kê tổng số vị trí, số ca hoàn thành, số ca lỗi QC và tỷ lệ hoàn thành theo từng Supplier
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Nhà Cung Cấp (Supplier)</th>
                <th className="px-4 py-3 text-center">Tổng Vị Trí</th>
                <th className="px-4 py-3 text-center">Chưa Cập Nhật Lịch</th>
                <th className="px-4 py-3 text-center">Đang/Đã Thi Công</th>
                <th className="px-4 py-3 text-center">Thành Công (Pass)</th>
                <th className="px-4 py-3 text-center">Lỗi QC / Failed</th>
                <th className="px-4 py-3 text-center">Tỷ Lệ Hoàn Thành</th>
                <th className="px-4 py-3 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {overallStats.supplierMap.map((supp) => {
                const rate = supp.activeExecuted > 0 ? Math.round((supp.success / supp.activeExecuted) * 100) : 0;
                const isExpanded = expandedSupplierIssues[supp.displayName];

                return (
                  <React.Fragment key={supp.displayName}>
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {supp.displayName}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                        <button
                          onClick={() => setSupplierDrawerConfig({
                            isOpen: true,
                            supplierName: supp.displayName,
                            metricType: 'TOTAL',
                            metricTitle: 'Tất cả vị trí thi công',
                            colorTheme: 'sky',
                            items: supp.totalItems
                          })}
                          className="hover:underline cursor-pointer text-sky-600 font-extrabold"
                        >
                          {supp.total}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-center text-purple-600 font-semibold">
                        {supp.noActualTime}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {supp.activeExecuted}
                      </td>
                      <td className="px-4 py-3.5 text-center text-emerald-600 font-bold">
                        <button
                          onClick={() => setSupplierDrawerConfig({
                            isOpen: true,
                            supplierName: supp.displayName,
                            metricType: 'COMPLETED',
                            metricTitle: 'Vị trí hoàn thành (Pass)',
                            colorTheme: 'emerald',
                            items: supp.completedItems
                          })}
                          className="hover:underline cursor-pointer font-extrabold"
                        >
                          {supp.success}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-center text-rose-600 font-bold">
                        {supp.issue > 0 ? (
                          <button
                            onClick={() => toggleSupplierIssueExpand(supp.displayName)}
                            className="inline-flex items-center gap-1 text-rose-600 hover:underline font-extrabold cursor-pointer"
                          >
                            <span>{supp.issue}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span>0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600">
                        {rate}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSupplierDrawerConfig({
                            isOpen: true,
                            supplierName: supp.displayName,
                            metricType: 'TOTAL',
                            metricTitle: 'Xem tất cả dữ liệu',
                            colorTheme: 'slate',
                            items: supp.totalItems
                          })}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Xem danh sách
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDABLE SUPPLIER ISSUE CAUSES */}
                    {isExpanded && supp.issueItems.length > 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-3 bg-rose-50/40 dark:bg-rose-950/20 border-y border-rose-100 dark:border-rose-900/40">
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                              Danh sách ca lỗi QC / Tồn đọng của {supp.displayName} ({supp.issueItems.length} ca):
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {supp.issueItems.map((item: InstallationItem) => (
                                <div key={item.rowId} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-rose-200/60 dark:border-rose-900/60 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{item.storeCode}</span> - <span className="font-semibold">{item.storeName}</span>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Hạng mục: {item.item || 'Chưa rõ'} • QC: {item.technician || 'Chưa phân công'}</p>
                                    <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Ghi chú: {item.note || 'Không có ghi chú'}</p>
                                  </div>
                                  <button
                                    onClick={() => handleOpenEdit(item)}
                                    className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded cursor-pointer shrink-0"
                                  >
                                    Sửa
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ISSUE AUDIT TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Bảng Truy Vấn &amp; Kiểm Soát Ca Lỗi QC (Issue Audit List)
            </h3>
            <p className="text-xs text-slate-500">
              Danh sách chi tiết các cửa hàng bị QC Failed, Quá hạn thi công hoặc Chờ lắp đặt
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm ca lỗi theo mã, tên CH..."
                value={issueSearchTerm}
                onChange={(e) => setIssueSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={issueSelectedSupplier}
              onChange={(e) => setIssueSelectedSupplier(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none font-medium cursor-pointer"
            >
              <option value="all">Tất cả Supplier</option>
              {filterOptionsSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Mã Dự Án &amp; CH</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">QC Tech</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ghi Chú Lỗi</th>
                <th className="px-4 py-3 text-right">Xử Lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredIssueList.map((item) => (
                <tr key={item.rowId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-sky-700 dark:text-sky-400">{item.projectCode} • {item.storeCode}</div>
                    <div className="text-slate-600 dark:text-slate-400">{item.storeName}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {item.supplierName || '-'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {item.technician || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] border ${getStatusBadgeStyle(item.status)}`}>
                      {item.status || 'QC Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-rose-600 dark:text-rose-400 max-w-[250px] truncate">
                    {item.note || 'Không có ghi chú lỗi'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Chỉnh sửa</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredIssueList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Không có ca lỗi QC nào phù hợp với bộ lọc
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
