import React, { useState } from 'react';
import { 
  ArrowLeft, Search, Edit3, User, Phone, CheckCircle2, AlertTriangle, Clock, AlertOctagon, 
  ChevronDown, ChevronUp, CheckSquare, Square, Save, Loader2, Calendar, Layers, X 
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
  modalStatusOptions: string[];
  filteredProjectDetailStores: InstallationItem[];
  contactMap: Map<string, MasterStoreContactInfo>;
  handleOpenEdit: (item: InstallationItem) => void;
  handleBulkSaveAndSync: (targetRowIds: number[], bulkForm: Partial<InstallationItem>) => Promise<void>;
  isSyncingRow: boolean;
  baselineMaxRowId: number;
}

const localIsoToDDMMYYYY = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
};

const localDdmmyyyyToISO = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return '';
  const parts = ddmmyyyy.trim().split('/');
  if (parts.length === 3) {
    let d = parts[0].padStart(2, '0');
    let m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  return '';
};

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
  modalStatusOptions,
  filteredProjectDetailStores,
  contactMap,
  handleOpenEdit,
  handleBulkSaveAndSync,
  isSyncingRow,
  baselineMaxRowId
}) => {
  // Collapsible size state per row
  const [expandedSizeRows, setExpandedSizeRows] = useState<Record<number, boolean>>({});

  // Checkbox selection state for batch bulk editing
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

  // Bulk Edit Drawer state
  const [isBulkDrawerOpen, setIsBulkDrawerOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<Partial<InstallationItem>>({
    status: '',
    technician: '',
    actualTime: '',
    completionTime: '',
    note: ''
  });

  const isAllSelected = filteredProjectDetailStores.length > 0 && 
    filteredProjectDetailStores.every(s => selectedRowIds.has(s.rowId));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredProjectDetailStores.map(s => s.rowId)));
    }
  };

  const toggleSelectRow = (rowId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleApplyBulkEdit = async () => {
    const targetIds = Array.from(selectedRowIds);
    if (targetIds.length === 0) return;

    await handleBulkSaveAndSync(targetIds, bulkForm);
    setSelectedRowIds(new Set());
    setIsBulkDrawerOpen(false);
  };

  return (
    <div className="space-y-4 relative">
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
              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap font-medium">
                <span>Customer: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.customerSummary}</strong></span>
                <span>•</span>
                <span>Ngành: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.categoryCode}</strong> {currentDetailProject.catName && currentDetailProject.catName !== currentDetailProject.categoryCode ? `(${currentDetailProject.catName})` : ''}</span>
                <span>•</span>
                <span>Nhãn: <strong className="text-slate-700 dark:text-slate-300">{currentDetailProject.brandName}</strong> {currentDetailProject.brandCode ? `(${currentDetailProject.brandCode})` : ''}</span>
                {currentDetailProject.posmTypeCode && (
                  <>
                    <span>•</span>
                    <span>Mã Loại POSM: <strong className="text-sky-700 dark:text-sky-400 font-mono">{currentDetailProject.posmTypeCode}</strong></span>
                  </>
                )}
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                {/* SELECT ALL CHECKBOX COLUMN */}
                <th className="px-3 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    title="Chọn tất cả cửa hàng trong danh sách"
                  />
                </th>
                <th className="px-3 py-3.5 w-10 text-center">#</th>
                <th className="px-4 py-3.5">Mã &amp; Tên Cửa Hàng</th>
                <th className="px-4 py-3.5">Liên Hệ SR / Cửa Hàng</th>
                <th className="px-4 py-3.5">Loại POSM • Hạng Mục &amp; Size</th>
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
                const isSelected = selectedRowIds.has(store.rowId);
                const contactInfo = contactMap.get((store.storeCode || '').toUpperCase().trim());
                const isExpandedSize = expandedSizeRows[store.rowId];
                const hasLongSize = store.size && (store.size.trim().length > 20 || store.size.includes('\n'));

                return (
                  <tr 
                    key={store.rowId} 
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-sky-50/50 dark:bg-sky-950/30' : ''
                    }`}
                  >
                    {/* CHECKBOX CELL */}
                    <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectRow(store.rowId, e)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </td>

                    <td className="px-3 py-3.5 text-center text-slate-400 font-mono text-[11px]">
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

                    {/* Hạng mục & Size (COLLAPSIBLE SIZE FEATURE) */}
                    <td className="px-4 py-3.5 max-w-[320px]">
                      {(() => {
                        const rawItem = (store.item || '').trim();
                        const rawSize = (store.size || '').trim();

                        const itemLines = rawItem.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        const mainTitle = itemLines[0] || rawItem || '-';
                        
                        // Remaining details from item lines 2+ plus size string
                        const extraDetails = [
                          ...itemLines.slice(1),
                          ...(rawSize ? [rawSize] : [])
                        ].join('\n');

                        const hasExtraDetails = extraDetails.length > 0;
                        const isExpanded = expandedSizeRows[store.rowId];

                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {store.posmTypeCode && (
                                <span className="font-mono text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200/50 dark:border-sky-900/50">
                                  {store.posmTypeCode}
                                </span>
                              )}
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{mainTitle}</span>
                            </div>

                            {hasExtraDetails && (
                              <div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSizeRows(prev => ({ ...prev, [store.rowId]: !prev[store.rowId] }));
                                  }}
                                  className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 hover:underline inline-flex items-center gap-1 cursor-pointer bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-200/60 dark:border-sky-900/60 mt-0.5"
                                >
                                  <span>📐 {isExpanded ? 'Thu gọn kích thước' : 'Xem kích thước chi tiết'}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                {isExpanded && (
                                  <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line shadow-2xs">
                                    {extraDetails}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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

      {/* FLOATING BULK BATCH ACTIONS BAR */}
      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 dark:bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-sky-500 text-white px-2 py-0.5 rounded-full font-mono text-xs shadow-xs">
              {selectedRowIds.size}
            </span>
            <span>cửa hàng được chọn</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <button
            onClick={() => {
              setBulkForm({ status: '', technician: '', actualTime: '', completionTime: '', note: '' });
              setIsBulkDrawerOpen(true);
            }}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>⚡ Chỉnh Sửa Hàng Loạt</span>
          </button>

          <button
            onClick={() => setSelectedRowIds(new Set())}
            className="px-2 py-1 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* BULK EDIT DRAWER MODAL */}
      {isBulkDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>⚡ Cập Nhật Hàng Loạt</span>
                  <span className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 text-xs font-mono px-2 py-0.5 rounded">
                    {selectedRowIds.size} cửa hàng
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điền dữ liệu cần thay đổi đồng loạt (các trường để trống sẽ giữ nguyên)
                </p>
              </div>
              <button
                onClick={() => setIsBulkDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs font-medium">
              {/* 1. Status Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Trạng Thái (Status)
                </label>
                <select
                  value={bulkForm.status || ''}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold text-slate-800 dark:text-slate-200 focus:border-sky-500"
                >
                  <option value="">-- Giữ nguyên trạng thái cũ --</option>
                  {modalStatusOptions.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* 2. POSM QC Technician */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  POSM QC Technician
                </label>
                <input
                  type="text"
                  placeholder="Gán chung tên nhân viên QC (để trống nếu giữ nguyên)"
                  value={bulkForm.technician || ''}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, technician: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-200 focus:border-sky-500"
                />
              </div>

              {/* 3. Actual Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Actual Time (VD: 02/07 – 14/07/2026)
                </label>
                <input
                  type="text"
                  placeholder="Thời gian thi công thực tế (để trống nếu giữ nguyên)"
                  value={bulkForm.actualTime || ''}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, actualTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-sky-500"
                />
              </div>

              {/* 4. Completion Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center justify-between">
                  <span>Completion Time (Ngày hoàn thành)</span>
                  <span className="text-slate-400 font-mono text-[10px]">{bulkForm.completionTime || 'Giữ nguyên'}</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={localDdmmyyyyToISO(bulkForm.completionTime || '')}
                    onChange={(e) => setBulkForm(prev => ({ ...prev, completionTime: localIsoToDDMMYYYY(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-sky-500"
                  />
                  <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* 5. Note / Ghi chú */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Note (Ghi Chú Chi Tiết)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú cập nhật hàng loạt cho tất cả các ca được chọn..."
                  value={bulkForm.note || ''}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-200 focus:border-sky-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsBulkDrawerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleApplyBulkEdit}
                disabled={isSyncingRow}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              >
                {isSyncingRow ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang sync hàng loạt...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu &amp; Đồng Bổ {selectedRowIds.size} Ca</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
