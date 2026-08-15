import React from 'react';
import { X, Save, Loader2, Calendar } from 'lucide-react';
import type { InstallationItem } from '@/services/installationSyncService';
import { StatusMultiSelectDropdown } from './StatusMultiSelectDropdown';

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

  // Helper for multi-select status tokens
  const selectedStatuses = React.useMemo(() => {
    const raw = editForm.status || 'New';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, [editForm.status]);

  const handleToggleStatus = (st: string) => {
    setEditForm(prev => {
      const currentRaw = prev.status || 'New';
      let currentList = currentRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (currentList.includes(st)) {
        currentList = currentList.filter(s => s !== st);
      } else {
        currentList.push(st);
      }
      return {
        ...prev,
        status: currentList.join(', ')
      };
    });
  };

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

          {/* 1. Status Multi-Select Dropdown (1:1 Multi-selection dropdown matching Google Sheet) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Trạng Thái Status (Cho phép chọn nhiều) <span className="text-rose-500">*</span></span>
            </label>
            <StatusMultiSelectDropdown
              options={modalStatusOptions}
              value={editForm.status || 'New'}
              onChange={(newValue) => setEditForm(prev => ({ ...prev, status: newValue }))}
              placeholder="Bấm để chọn 1 hoặc nhiều trạng thái..."
            />
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

          {/* 4. Completion Time Date Picker (Format dd/mm/yyyy) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Completion Time (Ngày hoàn thành)</span>
              <span className="text-sky-600 dark:text-sky-400 font-mono text-[10px] font-bold">
                {editForm.completionTime ? `Format: ${editForm.completionTime}` : 'Định dạng: dd/mm/yyyy'}
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="dd/mm/yyyy (VD: 06/08/2026)"
                value={editForm.completionTime || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, completionTime: e.target.value }))}
                className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-sky-500"
              />
              <input
                type="date"
                id="hidden-completion-date-picker"
                value={localDdmmyyyyToISO(editForm.completionTime || '')}
                onChange={(e) => {
                  if (e.target.value) {
                    setEditForm(prev => ({ ...prev, completionTime: localIsoToDDMMYYYY(e.target.value) }));
                  }
                }}
                className="opacity-0 absolute w-0 h-0 pointer-events-none"
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('hidden-completion-date-picker') as HTMLInputElement;
                  if (el) {
                    if ('showPicker' in el) {
                      (el as any).showPicker();
                    } else {
                      el.focus();
                      el.click();
                    }
                  }
                }}
                className="absolute right-2 p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Bấm để chọn ngày từ Lịch"
              >
                <Calendar className="w-4 h-4 text-sky-500" />
              </button>
            </div>
          </div>


          {/* 5. Planned Start & End Dates (Lịch Kế Hoạch Hệ Thống - Cố định 1:1 từ Sheet) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Thời Gian Dự Kiến (Lịch Kế Hoạch Hệ Thống)</span>
              <span className="text-[10px] text-slate-400 font-normal lowercase">(cố định 1:1 từ Sheet)</span>
            </label>
            <div className="p-2.5 bg-slate-100/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between font-mono text-xs text-slate-700 dark:text-slate-300 select-none">
              <div className="flex items-center gap-1.5 font-bold">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedItem.plannedStartDate || editForm.plannedStartDate || '—'}</span>
              </div>
              <span className="text-slate-400 font-bold px-2">➔</span>
              <div className="flex items-center gap-1.5 font-bold">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedItem.plannedEndDate || editForm.plannedEndDate || '—'}</span>
              </div>
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
