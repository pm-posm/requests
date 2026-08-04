import React from 'react';
import { 
  ArrowLeft, Search, Edit3, User, Phone, CheckCircle2, AlertTriangle, Clock, AlertOctagon 
} from 'lucide-react';
import type { InstallationItem } from '@/services/installationSyncService';
import type { MasterStoreContactInfo } from '@/services/sheetSyncService';
import type { GroupedProject } from '../hooks/useInstallationFilters';
import { getStatusBadgeStyle, evaluateScheduleHighlight } from '../utils/statusCalculators';

interface ProjectDetailViewProps {
  currentDetailProject: GroupedProject;
  setActiveProjectDetailCode: (code: string | null) => void;
  detailStoreSearch: string;
  setDetailStoreSearch: (term: string) => void;
  detailSelectedQcTech: string;
  setDetailSelectedQcTech: (tech: string) => void;
  detailSelectedStatus: string;
  setDetailSelectedStatus: (status: string) => void;
  detailSelectedSupplier: string;
  setDetailSelectedSupplier: (supplier: string) => void;
  detailSelectedResult: string;
  setDetailSelectedResult: (result: string) => void;
  detailFilterOptions: {
    technicians: string[];
    statuses: string[];
    suppliers: string[];
  };
  filteredProjectDetailStores: InstallationItem[];
  contactMap: Map<string, MasterStoreContactInfo>;
  handleOpenEdit: (item: InstallationItem) => void;
  baselineMaxRowId: number;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  currentDetailProject,
  setActiveProjectDetailCode,
  detailStoreSearch,
  setDetailStoreSearch,
  detailSelectedQcTech,
  setDetailSelectedQcTech,
  detailSelectedStatus,
  setDetailSelectedStatus,
  detailSelectedSupplier,
  setDetailSelectedSupplier,
  detailSelectedResult,
  setDetailSelectedResult,
  detailFilterOptions,
  filteredProjectDetailStores,
  contactMap,
  handleOpenEdit,
  baselineMaxRowId
}) => {
  return (
    <div className="space-y-4">
      {/* HEADER DRILLDOWN BAR */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveProjectDetailCode(null)}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 rounded border border-sky-200/60 dark:border-sky-900/60">
                  {currentDetailProject.projectCode}
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {currentDetailProject.projectName}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-medium">
                <span>Customer: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.customerSummary}</strong></span>
                <span>•</span>
                <span>Hạng mục: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.itemSummary}</strong></span>
                <span>•</span>
                <span>Nhãn: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.brandName}</strong></span>
                <span>•</span>
                <span>Lịch hệ thống: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.plannedTimeRange}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Tiến Độ Dự Án</p>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {currentDetailProject.stats.completedRate}% <span className="text-xs font-normal text-slate-400">({currentDetailProject.stats.completed}/{currentDetailProject.stats.total} vị trí)</span>
              </p>
            </div>
          </div>
        </div>

        {/* DEDICATED STORE FILTERS BAR */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã CH, tên CH, hạng mục, ghi chú, thông tin SR..."
              value={detailStoreSearch}
              onChange={(e) => setDetailStoreSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto text-xs font-medium">
            <select
              value={detailSelectedSupplier}
              onChange={(e) => setDetailSelectedSupplier(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
            >
              <option value="all">Tất cả Supplier</option>
              {detailFilterOptions.suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={detailSelectedStatus}
              onChange={(e) => setDetailSelectedStatus(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
            >
              <option value="all">Tất cả Status</option>
              {detailFilterOptions.statuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>

            <select
              value={detailSelectedResult}
              onChange={(e) => setDetailSelectedResult(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer font-bold"
            >
              <option value="all">Kết quả &gt;&lt;</option>
              <option value="pass">✔ Pass</option>
              <option value="fail">❌ QC Fail</option>
              <option value="overdue">🚩 Quá hạn</option>
            </select>

            <select
              value={detailSelectedQcTech}
              onChange={(e) => setDetailSelectedQcTech(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer"
            >
              <option value="all">QC Tech</option>
              {detailFilterOptions.technicians.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* DEDICATED STORES TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3.5 w-10 text-center">#</th>
                <th className="px-4 py-3.5">Mã &amp; Tên Cửa Hàng</th>
                <th className="px-4 py-3.5">Liên Hệ SR / Cửa Hàng</th>
                <th className="px-4 py-3.5">Hạng Mục &amp; Size</th>
                <th className="px-4 py-3.5">Supplier</th>
                <th className="px-4 py-3.5">QC Tech</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">Kết Quả &gt;&lt;</th>
                <th className="px-4 py-3.5">Lịch Thi Công</th>
                <th className="px-4 py-3.5 text-right">Cập Nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredProjectDetailStores.map((store, sIdx) => {
                const isNewItem = store.rowId > baselineMaxRowId;
                const contactInfo = contactMap.get((store.storeCode || '').toUpperCase().trim());
                const schedEval = evaluateScheduleHighlight(store.actualTime, store.completionTime, store.status);

                return (
                  <tr key={store.rowId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                      {sIdx + 1}
                    </td>

                    {/* Cửa hàng */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span>{store.storeCode}</span>
                        {isNewItem && <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1 py-0.2 rounded">✨ Mới</span>}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 text-xs font-medium max-w-[200px] truncate">
                        {store.storeName}
                      </div>
                    </td>

                    {/* Contact SR */}
                    <td className="px-4 py-3.5 text-[11px]">
                      {contactInfo ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{contactInfo.sr_name || '-'}</span>
                          </div>
                          {(contactInfo.sr_phone || contactInfo.sr_phone_2) && (
                            <div className="text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{contactInfo.sr_phone || contactInfo.sr_phone_2}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Hạng mục */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{store.item || '-'}</div>
                      <div className="text-slate-400 text-[10px]">{store.size || '-'}</div>
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {store.supplierName || '-'}
                    </td>

                    {/* QC Tech */}
                    <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                      {store.technician || '-'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] border ${getStatusBadgeStyle(store.status)}`}>
                        {store.status || 'New'}
                      </span>
                    </td>

                    {/* Kết quả >< */}
                    <td className="px-4 py-3.5 text-center">
                      {store.resultSign === '✔' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                        </span>
                      )}
                      {store.resultSign === '❌' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                      {store.resultSign === 'OVERDUE_RED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 text-white rounded text-xs font-bold animate-pulse">
                          <AlertOctagon className="w-3.5 h-3.5" /> Quá Hạn
                        </span>
                      )}
                      {!store.resultSign && <span className="text-slate-300">—</span>}
                    </td>

                    {/* Lịch thi công */}
                    <td className="px-4 py-3.5 text-[11px] font-mono whitespace-nowrap">
                      <div>Actual: {store.actualTime || 'Chưa có'}</div>
                      {store.completionTime && <div className="text-emerald-600 font-semibold">Done: {store.completionTime}</div>}
                    </td>

                    {/* Action edit */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(store)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
