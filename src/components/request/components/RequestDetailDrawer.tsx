import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  X, ExternalLink, Image as ImageIcon, Save, CheckCircle2, Clock, 
  AlertCircle, FileText, Send, User, Building, Calendar, Layers, ShieldCheck, Eye, Table, Mail
} from 'lucide-react';
import type { RequestItem } from '@/services/requestSyncService';
import { DEFAULT_PLAN_OPTIONS, DEFAULT_PROGRESS_OPTIONS, DEFAULT_STATUS_OPTIONS } from '../hooks/useRequestFilters';
import { DataResponserModal, parseDataResponser } from './DataResponserModal';

interface RequestDetailDrawerProps {
  item: RequestItem | null;
  onClose: () => void;
  editForm: Partial<RequestItem>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<RequestItem>>>;
  isSyncingRow: boolean;
  onSaveAndSync: () => void;
}

export const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({
  item,
  onClose,
  editForm,
  setEditForm,
  isSyncingRow,
  onSaveAndSync
}) => {
  const [showResponserModal, setShowResponserModal] = useState(false);

  // FIX W5: Check if user modified form values compared to original item (isDirty)
  const isFormDirty = item ? Boolean(
    (editForm.emailTitle || '') !== (item.emailTitle || '') ||
    (editForm.status || '') !== (item.status || '') ||
    (editForm.planOption || '') !== (item.planOption || '') ||
    (editForm.projectProgress || '') !== (item.projectProgress || '') ||
    (editForm.supplier || '') !== (item.supplier || '') ||
    (editForm.projectCode || '') !== (item.projectCode || '') ||
    (editForm.requestId || '') !== (item.requestId || '') ||
    (editForm.deadline || '') !== (item.deadline || '') ||
    (editForm.quickFixDate || '') !== (item.quickFixDate || '') ||
    (editForm.sentMailSr || '') !== (item.sentMailSr || '') ||
    (editForm.merNote || '') !== (item.merNote || '')
  ) : false;

  const handleCloseAttempt = () => {
    if (isSyncingRow) return;
    if (isFormDirty) {
      if (window.confirm('Bạn có thay đổi chưa được lưu về Sheet. Bạn có chắc chắn muốn đóng không?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // FIX: ESC key to attempt close drawer (when not syncing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && item && !isSyncingRow) {
        handleCloseAttempt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, isSyncingRow, isFormDirty]);

  // FIX W2: Validation before triggering save & sync
  const handleValidatedSave = () => {
    // 1. Check Date Format helper (d/m/yyyy or yyyy-mm-dd)
    const isValidDate = (str?: string) => {
      if (!str || !str.trim()) return true;
      const trimmed = str.trim();
      return /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.test(trimmed) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed);
    };

    if (editForm.deadline && !isValidDate(editForm.deadline)) {
      toast.error('Định dạng Deadline không hợp lệ! Vui lòng nhập ngày dạng dd/mm/yyyy (Ví dụ: 25/12/2026)');
      return;
    }

    if (editForm.quickFixDate && !isValidDate(editForm.quickFixDate)) {
      toast.error('Định dạng Ngày Quick Fix không hợp lệ! Vui lòng nhập ngày dạng dd/mm/yyyy (Ví dụ: 25/12/2026)');
      return;
    }

    onSaveAndSync();
  };

  if (!item) return null;

  const images = [
    { label: 'Ảnh tổng thể', url: item.imgOverview },
    { label: 'Ảnh lỗi 01', url: item.imgDetail1 },
    { label: 'Ảnh lỗi 02', url: item.imgDetail2 },
    { label: 'Ảnh lỗi 03', url: item.imgDetail3 },
  ].filter(img => img.url && img.url.trim().length > 0);

  // Combine default options with existing item value if custom
  const currentPlan = editForm.planOption || '';
  const planOptions = Array.from(new Set([...DEFAULT_PLAN_OPTIONS, ...(currentPlan ? [currentPlan] : [])])).sort();

  const currentProgress = editForm.projectProgress || '';
  const progressOptions = Array.from(new Set([...DEFAULT_PROGRESS_OPTIONS, ...(currentProgress ? [currentProgress] : [])])).sort();

  const currentStatus = editForm.status || '';
  const statusOptions = Array.from(new Set([...DEFAULT_STATUS_OPTIONS, ...(currentStatus ? [currentStatus] : [])])).sort();

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
        {/* FIX W3: Guard backdrop click so drawer doesn't accidentally close during row sync */}
        <div 
          className="fixed inset-0"
          onClick={isSyncingRow ? undefined : handleCloseAttempt}
        />
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 z-10">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] rounded font-bold">
                  Dòng #{item.rowId}
                </span>
                {item.requestId && (
                  <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[11px] rounded font-mono font-semibold border border-sky-200 dark:border-sky-800">
                    Req ID: {item.requestId}
                  </span>
                )}
                {item.projectProgress && (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] rounded font-semibold border border-emerald-200 dark:border-emerald-800">
                    {item.projectProgress}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                {item.storeName || 'Cửa hàng không tên'} ({item.storeCode || 'N/A'})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Yêu cầu từ: <strong className="text-slate-700 dark:text-slate-300">{item.srName || item.email}</strong> • Ngày: {item.dateOfRq || 'N/A'} (Tuần {item.week || 'N/A'})
              </p>
            </div>

            <button
              onClick={handleCloseAttempt}
              disabled={isSyncingRow}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Đóng bảng thông tin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
            
            {/* THÔNG TIN REQUEST (GỐC CHỈ XEM) */}
            <div className="space-y-3">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block border-b border-slate-200 dark:border-slate-800 pb-1.5">
                Thông Tin Request
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Merchandiser</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.merName || 'Chưa gán'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Chuỗi / KA</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.customer} ({item.ka})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Loại Request</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{item.rqType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Loại POSM</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.posmType} (SL: {item.quantity || 1})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">CAT &amp; Brand</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.cat} - {item.brand}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Mã Dự Án (Gốc)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.projectCode || 'Chưa gán'}</span>
                </div>
              </div>
            </div>

            {/* GHI CHÚ SR */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-500" />
                Ghi Chú SR
              </h3>
              
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {item.srNote || 'Không có ghi chú từ SR.'}
              </div>
            </div>

            {/* THÔNG TIN PHẢN HỒI (READ-ONLY) */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">
                  Thông Tin Phản Hồi
                </span>
                {item.dataResponser && (
                  <button
                    type="button"
                    onClick={() => setShowResponserModal(true)}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem Bảng Data Responser</span>
                  </button>
                )}
              </h3>

              {/* Data Responser */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] block">
                  Data Responser:
                </span>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  {item.dataResponser || 'Chưa có dữ liệu phản hồi.'}
                </div>
              </div>

              {/* Vis Note */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] block">
                  Vis Note:
                </span>
                <div className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                  {item.visNote || 'Không có ghi chú kỹ thuật từ Visibility.'}
                </div>
              </div>
            </div>

            {/* HÌNH ẢNH ĐÍNH KÈM */}
            {images.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-500" />
                  Hình Ảnh Đính Kèm ({images.length})
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {images.map((img, idx) => (
                    <a
                      key={idx}
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{img.label}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {item.linkRq && (
              <div>
                <a
                  href={item.linkRq}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Mở thư mục Google Drive chứa hồ sơ Request</span>
                </a>
              </div>
            )}

            {/* XỬ LÝ REQUEST (CẬP NHẬT SHEET) */}
            <div className="space-y-4 pt-4 border-t-2 border-sky-500/30">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between bg-sky-50 dark:bg-sky-950/40 p-3 rounded-xl border border-sky-200/80 dark:border-sky-900/60">
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 text-xs">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Xử Lý Request
                </span>
                {isFormDirty && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-2 py-0.5 rounded">
                    Có thay đổi chưa lưu
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* 0. TITLE EMAIL REQUEST */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-sky-700 dark:text-sky-300 block mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-sky-600" />
                    Title Email Request
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.emailTitle || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, emailTitle: e.target.value }))}
                    placeholder="Nhập tiêu đề email request để tra cứu..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-sky-300 dark:border-sky-800 rounded-xl outline-none focus:border-sky-500 shadow-2xs font-medium text-xs custom-scrollbar"
                  />
                </div>
                
                {/* 1. Trạng Thái */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Trạng Thái
                  </label>
                  <select
                    value={editForm.status || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium cursor-pointer focus:border-sky-500 shadow-2xs"
                  >
                    <option value="">-- Chọn Trạng Thái --</option>
                    {statusOptions.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Tiến Độ Dự Án */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Tiến Độ Dự Án
                  </label>
                  <select
                    value={editForm.projectProgress || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, projectProgress: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium cursor-pointer focus:border-sky-500 shadow-2xs"
                  >
                    <option value="">-- Chọn Tiến Độ --</option>
                    {progressOptions.map(prg => (
                      <option key={prg} value={prg}>{prg}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Phương Án */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Phương Án
                  </label>
                  <select
                    value={editForm.planOption || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, planOption: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium cursor-pointer focus:border-sky-500 shadow-2xs"
                  >
                    <option value="">-- Chọn Phương Án --</option>
                    {planOptions.map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Supplier */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Supplier</label>
                  <input
                    type="text"
                    value={editForm.supplier || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, supplier: e.target.value }))}
                    placeholder="VD: Cát Thiên Minh, SDC, Infinity..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>

                {/* 5. Mã Dự Án */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mã Dự Án</label>
                  <input
                    type="text"
                    value={editForm.projectCode || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, projectCode: e.target.value }))}
                    placeholder="VD: 90970, 71170..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono focus:border-sky-500 shadow-2xs"
                  />
                </div>

                {/* 6. Request ID */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Request ID</label>
                  <input
                    type="text"
                    value={editForm.requestId || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, requestId: e.target.value }))}
                    placeholder="VD: VIS-1001, VIS-1002..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono focus:border-sky-500 shadow-2xs"
                  />
                </div>

                {/* 7. Deadline */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Deadline (dd/mm/yyyy)</label>
                  <input
                    type="text"
                    value={editForm.deadline || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
                    placeholder="25/12/2026"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>

                {/* 8. Ngày Quick Fix */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Ngày Quick Fix (dd/mm/yyyy)</label>
                  <input
                    type="text"
                    value={editForm.quickFixDate || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, quickFixDate: e.target.value }))}
                    placeholder="25/12/2026"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>

                {/* 9. Sent Mail SR */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Sent Mail SR</label>
                  <input
                    type="text"
                    value={editForm.sentMailSr || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, sentMailSr: e.target.value }))}
                    placeholder="VD: Yes / Done / Pending..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* 10. Ghi Chú Mer */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi Chú Mer
                </label>
                <textarea
                  rows={3}
                  value={editForm.merNote || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, merNote: e.target.value }))}
                  placeholder="Nhập ghi chú xử lý của Merchandiser..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 shadow-2xs custom-scrollbar"
                />
              </div>
            </div>

          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2">
            <button
              onClick={handleCloseAttempt}
              disabled={isSyncingRow}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              Đóng
            </button>
            <button
              onClick={handleValidatedSave}
              disabled={isSyncingRow}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-4 h-4 ${isSyncingRow ? 'animate-spin' : ''}`} />
              <span>{isSyncingRow ? 'Đang đồng bộ...' : 'Lưu & Đồng Bộ Về Sheet'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* FORMATTED DATA RESPONSER GREEN TABLE MODAL */}
      <DataResponserModal
        show={showResponserModal}
        onClose={() => setShowResponserModal(false)}
        rawJson={item.dataResponser}
        storeName={item.storeName}
      />
    </>
  );
};
