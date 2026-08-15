import React, { useState } from 'react';
import { Image as ImageIcon, ExternalLink, MessageSquare } from 'lucide-react';
import type { RequestItem } from '@/services/requestSyncService';
import { DataResponserModal, formatResponserSummary } from './DataResponserModal';

interface RequestTableRowsProps {
  paginatedItems: RequestItem[];
  baselineMaxRowId: number;
  columnWidths: Record<string, number>;
  onOpenEdit: (item: RequestItem) => void;
}

const getStatusBadgeClass = (status?: string): string => {
  if (!status || !status.trim()) {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
  const st = status.toLowerCase().trim();
  if (st.includes('hoàn thành') || st.includes('approved') || st.includes('done')) {
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/60';
  }
  if (st.includes('cancelled') || st.includes('rejected') || st.includes('lỗi')) {
    return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/60';
  }
  if (st.includes('mer quick fix') || st.includes('bảo hành') || st.includes('supplier')) {
    return 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-900/60';
  }
  return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60';
};

const getProgressBadgeClass = (progress?: string): string => {
  if (!progress || !progress.trim()) {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';
  }
  const prg = progress.toLowerCase().trim();
  if (prg.includes('hoàn thành') || prg.includes('done') || prg.includes('passed')) {
    return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold';
  }
  if (prg.includes('cancel') || prg.includes('hủy')) {
    return 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';
  }
  return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold';
};

/**
 * RequestTableRows — Tách từ RequestTableView.tsx (FIX U1 - code split)
 * Bao gồm: tbody rows, badge helpers, DataResponserModal inline click
 */
export const RequestTableRows: React.FC<RequestTableRowsProps> = ({
  paginatedItems,
  baselineMaxRowId,
  columnWidths,
  onOpenEdit,
}) => {
  const [selectedResponserItem, setSelectedResponserItem] = useState<RequestItem | null>(null);

  return (
    <>
      {paginatedItems.map((item) => {
        const isNew = baselineMaxRowId > 0 && item.rowId > baselineMaxRowId;
        const hasPhotos = Boolean(item.imgOverview || item.imgDetail1 || item.imgDetail2 || item.imgDetail3);
        const hasDrive = Boolean(item.linkRq && item.linkRq.trim());
        const responserText = formatResponserSummary(item.dataResponser);

        return (
          <tr
            key={item.rowId}
            onClick={() => onOpenEdit(item)}
            className={`transition-colors cursor-pointer group border-b border-slate-100 dark:border-slate-800/60 ${
              isNew 
                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 border-l-4 border-l-emerald-500' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            {/* 1. # & Badges */}
            <td
              style={{ width: `${columnWidths['id']}px`, minWidth: `${columnWidths['id']}px`, maxWidth: `${columnWidths['id']}px` }}
              className="py-3 px-3.5 text-center overflow-hidden"
            >
              {isNew ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-white shadow-2xs inline-block">
                    ✨ MỚI
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    #{item.rowId}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold text-xs block">
                  #{item.rowId}
                </span>
              )}
              <div className="flex items-center justify-center gap-1 mt-1">
                {hasPhotos && <span title="Có đính kèm hình ảnh"><ImageIcon className="w-3 h-3 text-indigo-500" /></span>}
                {hasDrive && <span title="Có link Google Drive"><ExternalLink className="w-3 h-3 text-sky-500" /></span>}
              </div>
            </td>

            {/* 2. Ngày / Tuần */}
            <td
              style={{ width: `${columnWidths['date']}px`, minWidth: `${columnWidths['date']}px`, maxWidth: `${columnWidths['date']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">{item.dateOfRq || 'N/A'}</span>
              <span className="text-[10px] text-slate-400 font-mono block truncate">Tuần {item.week || 'N/A'}</span>
            </td>

            {/* 3. Cửa Hàng / Mã */}
            <td
              style={{ width: `${columnWidths['store']}px`, minWidth: `${columnWidths['store']}px`, maxWidth: `${columnWidths['store']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100 block truncate" title={item.storeName}>
                {item.storeName || 'Cửa hàng không tên'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block truncate" title={`${item.storeCode} • ${item.customer} (${item.ka})`}>
                {item.storeCode} • {item.customer} ({item.ka})
              </span>
            </td>

            {/* 4. Phụ Trách (Mer / SR) */}
            <td
              style={{ width: `${columnWidths['pic']}px`, minWidth: `${columnWidths['pic']}px`, maxWidth: `${columnWidths['pic']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={`SR: ${item.srName || item.email}`}>
                SR: {item.srName || item.email}
              </span>
              <span className="text-[10px] text-slate-400 block truncate" title={`Mer: ${item.merName || 'Chưa có'}`}>
                Mer: {item.merName || 'Chưa có'}
              </span>
              {item.sentMailSr && (
                <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-mono inline-block truncate max-w-full">
                  Mail SR: {item.sentMailSr}
                </span>
              )}
            </td>

            {/* 5. Loại RQ & POSM */}
            <td
              style={{ width: `${columnWidths['posm']}px`, minWidth: `${columnWidths['posm']}px`, maxWidth: `${columnWidths['posm']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded text-[10px] mr-1 truncate">
                {item.rqType || 'Request'}
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 block mt-0.5 truncate" title={`${item.posmType} (SL: ${item.quantity || 1})`}>
                {item.posmType} {item.quantity ? `(SL: ${item.quantity})` : ''}
              </span>
              {item.srNote && (
                <span className="text-[10px] text-slate-400 truncate block italic mt-0.5" title={item.srNote}>
                  "{item.srNote}"
                </span>
              )}
            </td>

            {/* 6. CAT & BRAND */}
            <td
              style={{ width: `${columnWidths['catBrand']}px`, minWidth: `${columnWidths['catBrand']}px`, maxWidth: `${columnWidths['catBrand']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={item.cat}>
                {item.cat || 'Khác'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate" title={item.brand}>
                {item.brand || 'Khác'}
              </span>
            </td>

            {/* 7. Trạng Thái & Data Responser */}
            <td
              style={{ width: `${columnWidths['status']}px`, minWidth: `${columnWidths['status']}px`, maxWidth: `${columnWidths['status']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(item.status)}`}>
                {item.status || 'Pending'}
              </span>
              {responserText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedResponserItem(item);
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium block mt-1 hover:underline cursor-pointer flex items-center gap-1 max-w-full truncate"
                  title="Bấm để xem Bảng chi tiết phản hồi Data Responser"
                >
                  <MessageSquare className="w-2.5 h-2.5 shrink-0 text-indigo-500" />
                  <span className="truncate">{responserText}</span>
                </button>
              )}
            </td>

            {/* 8. Tiến Độ Dự Án */}
            <td
              style={{ width: `${columnWidths['progress']}px`, minWidth: `${columnWidths['progress']}px`, maxWidth: `${columnWidths['progress']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border truncate max-w-full ${getProgressBadgeClass(item.projectProgress)}`} title={item.projectProgress}>
                {item.projectProgress || 'Chưa cập nhật'}
              </span>
            </td>

            {/* 9. Phương Án / Deadline */}
            <td
              style={{ width: `${columnWidths['plan']}px`, minWidth: `${columnWidths['plan']}px`, maxWidth: `${columnWidths['plan']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px] truncate" title={item.planOption}>
                {item.planOption || 'Chưa lên phương án'}
              </span>
              {item.deadline && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono block truncate">
                  DL: {item.deadline}
                </span>
              )}
              {item.quickFixDate && (
                <span className="text-[9px] text-sky-600 dark:text-sky-400 font-mono block truncate">
                  QF: {item.quickFixDate}
                </span>
              )}
            </td>

            {/* 10. Supplier & Mã Dự Án */}
            <td
              style={{ width: `${columnWidths['supplier']}px`, minWidth: `${columnWidths['supplier']}px`, maxWidth: `${columnWidths['supplier']}px` }}
              className="py-3 px-3.5 overflow-hidden"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={item.supplier}>
                {item.supplier || 'Chưa gán'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block truncate" title={item.projectCode}>
                {item.projectCode ? `DA: ${item.projectCode}` : 'Chưa có mã DA'}
              </span>
              {item.requestId && (
                <span className="text-[9px] text-sky-600 dark:text-sky-400 font-mono block truncate">
                  Req ID: {item.requestId}
                </span>
              )}
            </td>

            {/* 11. Thao Tác */}
            <td
              style={{ width: `${columnWidths['actions']}px`, minWidth: `${columnWidths['actions']}px`, maxWidth: `${columnWidths['actions']}px` }}
              className="py-3 px-3.5 text-right overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEdit(item);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer text-[11px] shrink-0"
              >
                Xử lý / Sửa
              </button>
            </td>
          </tr>
        );
      })}

      {/* DataResponser modal — được quản lý ngay trong component này */}
      <DataResponserModal
        show={Boolean(selectedResponserItem)}
        onClose={() => setSelectedResponserItem(null)}
        rawJson={selectedResponserItem?.dataResponser}
        storeName={selectedResponserItem?.storeName}
      />
    </>
  );
};
