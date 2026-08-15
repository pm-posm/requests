import React, { useState } from 'react';
import { X, Link as LinkIcon, Save, Info, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestConfigModalProps {
  show: boolean;
  onClose: () => void;
  webAppUrl: string;
  onSave: (newUrl: string) => void;
}

export const RequestConfigModal: React.FC<RequestConfigModalProps> = ({
  show,
  onClose,
  webAppUrl,
  onSave
}) => {
  const [url, setUrl] = useState(webAppUrl);
  const [copied, setCopied] = useState(false);

  if (!show) return null;

  const sampleAppsScriptCode = `/**
 * POSM Dashboard 2-Way Sync Engine (Dành riêng cho Sheet MER VIEW 2026)
 */
function doPost(e) { return handleHttpRequest(e); }
function doGet(e) { return handleHttpRequest(e); }

function handleHttpRequest(e) {
  try {
    var params = e.parameter || {};
    if (e && e.postData && e.postData.contents) {
      try { params = Object.assign({}, params, JSON.parse(e.postData.contents)); } catch (err) {}
    }

    var rowId = parseInt(params.rowId || params.id, 10);
    if (!rowId || rowId < 2) return responseJSON({ status: 'error', message: 'Invalid rowId' });

    var ss = SpreadsheetApp.openById('1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU');
    var sheet = ss.getSheetByName('Mer View 2026');
    if (!sheet) return responseJSON({ status: 'error', message: 'Sheet Mer View 2026 not found' });

    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    for (var i = 0; i < headerRow.length; i++) {
      if (headerRow[i]) colMap[String(headerRow[i]).trim()] = i + 1;
    }

    var updates = [
      { f: 'status', k: 'Status', col: 24 },
      { f: 'planOption', k: 'Phương án', col: 21 },
      { f: 'projectProgress', k: 'Tiến độ dự án', col: 25 },
      { f: 'deadline', k: 'Deadline', col: 20 },
      { f: 'quickFixDate', k: 'Ngày Quick Fix (dự kiến)', col: 22 },
      { f: 'supplier', k: 'Supplier', col: 29 },
      { f: 'projectCode', k: 'Mã dự án', col: 28 },
      { f: 'requestId', k: 'Request_ID', col: 30 },
      { f: 'emailTitle', k: 'Title Email Request', col: 27 },
      { f: 'merNote', k: 'Mer_note', col: 33 },
      { f: 'sentMailSr', k: 'Sent Mail SR', col: 34 }
    ];

    var updatedCount = 0;
    updates.forEach(function(u) {
      if (params[u.f] !== undefined) {
        var c = colMap[u.k] || u.col;
        if (c > 0) {
          try {
            sheet.getRange(rowId, c).setValue(String(params[u.f]));
            updatedCount++;
          } catch (cellErr) {
            console.warn('Lỗi ghi cell ' + u.k + ': ' + cellErr);
          }
        }
      }
    });

    var lastCol = colMap['Last update'] || 26;
    if (lastCol > 0) {
      try {
        sheet.getRange(rowId, lastCol).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'));
      } catch (e) {}
    }

    SpreadsheetApp.flush();
    return responseJSON({ status: 'success', message: 'Updated row #' + rowId, rowId: rowId, updatedFieldsCount: updatedCount });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(sampleAppsScriptCode);
    setCopied(true);
    toast.success('Đã sao chép mã Google Apps Script!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Cấu hình Google Apps Script Web App (Đồng bộ 2 chiều)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Web App Endpoint URL (Google Apps Script)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-500" />
              Mã Google Apps Script mẫu cho tab MER VIEW 2026:
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Sao chép mã'}</span>
            </button>
          </div>

          <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[11px] font-mono max-h-48 custom-scrollbar leading-relaxed">
            {sampleAppsScriptCode}
          </pre>

          <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
            <li>Vào Google Sheet ➔ Mở menu <strong>Extensions (Tiện ích mở rộng)</strong> ➔ <strong>Apps Script</strong>.</li>
            <li>Dán đoạn mã trên vào file <code>Code.gs</code> ➔ Nhấn <strong>Deploy</strong> ➔ <strong>New deployment</strong>.</li>
            <li>Chọn Type = <strong>Web app</strong>, Who has access = <strong>Anyone (Tất cả mọi người)</strong> ➔ Nhấn <strong>Deploy</strong>.</li>
            <li>Copy URL Web App trả về và dán vào ô trên ➔ Nhấn <strong>Lưu cấu hình</strong>.</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={() => onSave(url)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu cấu hình</span>
          </button>
        </div>

      </div>
    </div>
  );
};
