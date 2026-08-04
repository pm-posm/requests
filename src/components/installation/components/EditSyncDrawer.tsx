import React from 'react';
import { X, Save, Loader2, Calendar } from 'lucide-react';
import type { InstallationItem } from '@/services/installationSyncService';

interface EditSyncDrawerProps {
  selectedItem: InstallationItem | null;
  setSelectedItem: (item: InstallationItem | null) => void;
  editForm: Partial<InstallationItem>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<InstallationItem>>>;
  modalStatusOptions: string[];
  isSyncingRow: boolean;
  handleSaveAndSync: () => void;
}

// Helpers if isoToDDMMYYYY / ddmmyyyyToISO aren't exported from utils
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

export const EditSyncDrawer: React.FC<EditSyncDrawerProps> = ({
  selectedItem,
  setSelectedItem,
  editForm,
  setEditForm,
  modalStatusOptions,
  isSyncingRow,
  handleSaveAndSync
}) => {
  if (!selectedItem) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* DRAWER HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Cập Nhật Dòng #{selectedItem.rowId}</span>
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {selectedItem.projectCode} • {selectedItem.storeCode}
            </p>
          </div>
          <button
            onClick={() => setSelectedItem(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DRAWER BODY FORM */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs font-medium">
          {/* Readonly Project Info Summary */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedItem.projectName}</p>
            <p className="text-slate-500">Cửa hàng: <strong className="text-slate-700 dark:text-slate-300">{selectedItem.storeName}</strong></p>
            <p className="text-slate-500">Hạng mục: <strong className="text-slate-700 dark:text-slate-300">{selectedItem.item || 'Chưa phân loại'}</strong></p>
            <p className="text-slate-500">Supplier: <strong className="text-slate-700 dark:text-slate-300">{selectedItem.supplierName || 'Chưa rõ'}</strong></p>
          </div>

          {/* 1. Status Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Trạng Thái (Status) <span className="text-rose-500">*</span>
            </label>
            <select
              value={editForm.status || 'New'}
              onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-semibold text-slate-800 dark:text-slate-200 focus:border-sky-500"
            >
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
              placeholder="Tên nhân viên QC phụ trách"
              value={editForm.technician || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, technician: e.target.value }))}
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
              placeholder="Thời gian thi công thực tế"
              value={editForm.actualTime || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, actualTime: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-sky-500"
            />
          </div>

          {/* 4. Completion Time Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Completion Time (Ngày hoàn thành)</span>
              <span className="text-slate-400 font-mono text-[10px]">{editForm.completionTime || 'Chưa có'}</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={localDdmmyyyyToISO(editForm.completionTime || '')}
                onChange={(e) => setEditForm(prev => ({ ...prev, completionTime: localIsoToDDMMYYYY(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-sky-500"
              />
              <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 5. Planned Start & End Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Dự Kiến Từ Ngày</label>
              <input
                type="date"
                value={localDdmmyyyyToISO(editForm.plannedStartDate || '')}
                onChange={(e) => setEditForm(prev => ({ ...prev, plannedStartDate: localIsoToDDMMYYYY(e.target.value) }))}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Dự Kiến Đến Ngày</label>
              <input
                type="date"
                value={localDdmmyyyyToISO(editForm.plannedEndDate || '')}
                onChange={(e) => setEditForm(prev => ({ ...prev, plannedEndDate: localIsoToDDMMYYYY(e.target.value) }))}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-xs"
              />
            </div>
          </div>

          {/* 6. Warranty / Uninstall */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Warranty - Uninstall (Thông tin Bảo Hành)
            </label>
            <input
              type="text"
              placeholder="Thông tin bảo hành hoặc lý do tháo dỡ"
              value={editForm.warranty || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, warranty: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-200 focus:border-sky-500"
            />
          </div>

          {/* 7. Note / Ghi chú */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Note (Ghi Chú Chi Tiết)
            </label>
            <textarea
              rows={3}
              placeholder="Ghi chú thêm về ca lắp đặt..."
              value={editForm.note || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-200 focus:border-sky-500"
            />
          </div>
        </div>

        {/* DRAWER FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-end gap-2">
          <button
            onClick={() => setSelectedItem(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSaveAndSync}
            disabled={isSyncingRow}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs disabled:opacity-50"
          >
            {isSyncingRow ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu &amp; sync...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Lưu &amp; Đồng Bổ 2 Chiều</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
