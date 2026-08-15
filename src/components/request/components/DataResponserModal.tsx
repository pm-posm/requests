import React from 'react';
import { X, FileSpreadsheet } from 'lucide-react';

export interface DataResponserEntry {
  Email?: string;
  Title?: string;
  Response?: string;
  Comment?: string;
  Time_response?: string;
  [key: string]: any;
}

export const parseDataResponser = (jsonStr?: string): DataResponserEntry[] => {
  if (!jsonStr || !jsonStr.trim()) return [];
  let trimmed = jsonStr.trim();
  if (trimmed === '[]' || trimmed === '[ ]' || trimmed === '""') return [];
  
  // Unescape outer quotes if double-encoded string from sheet
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1);
  }
  trimmed = trimmed.replace(/\\"/g, '"');

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item === 'object' && Object.keys(item).length > 0);
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return [parsed];
    }
  } catch {
    // If not JSON, wrap in single entry if string isn't empty brackets
    if (trimmed !== '[]' && trimmed !== '[ ]') {
      return [{ Comment: jsonStr }];
    }
  }
  return [];
};

export const formatResponserSummary = (jsonStr?: string): string => {
  if (!jsonStr || !jsonStr.trim()) return '';
  const trimmed = jsonStr.trim();
  if (trimmed === '[]' || trimmed === '[ ]' || trimmed === '""') return '';

  const entries = parseDataResponser(jsonStr);
  if (entries.length === 0) return '';

  const first = entries[0];
  if (!first.Response && !first.Email && !first.Comment) return '';

  const parts: string[] = [];
  if (first.Response) parts.push(first.Response);
  if (first.Email) {
    const emailPrefix = first.Email.split('@')[0];
    parts.push(emailPrefix);
  }
  if (first.Time_response) parts.push(first.Time_response);

  return parts.length > 0 ? parts.join(' • ') : (first.Comment || '');
};

interface DataResponserModalProps {
  show: boolean;
  onClose: () => void;
  rawJson?: string;
  storeName?: string;
}

export const DataResponserModal: React.FC<DataResponserModalProps> = ({
  show,
  onClose,
  rawJson,
  storeName
}) => {
  if (!show) return null;

  const entries = parseDataResponser(rawJson);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Chi Tiết Phản Hồi Data Responser (Chuẩn Hóa)
              </h3>
              {storeName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Cửa hàng: {storeName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GREEN HEADER FORMATTED TABLE MATCHING USER DESIGN */}
        <div className="overflow-x-auto border border-emerald-600/30 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-emerald-600 text-white font-bold border-b border-emerald-700">
                <th className="py-3 px-4 w-1/4">Email</th>
                <th className="py-3 px-4 w-1/3">Title</th>
                <th className="py-3 px-4">Response</th>
                <th className="py-3 px-4">Comment</th>
                <th className="py-3 px-4 whitespace-nowrap">Time_response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Chưa có dữ liệu phản hồi từ bộ phận Data Responser.
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-sky-600 dark:text-sky-400 underline break-all">
                      {entry.Email ? (
                        <a href={`mailto:${entry.Email}`} target="_blank" rel="noreferrer">
                          {entry.Email}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 font-normal text-slate-700 dark:text-slate-300">
                      {entry.Title || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                        (entry.Response || '').toLowerCase().includes('approve') 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold'
                          : (entry.Response || '').toLowerCase().includes('reject')
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {entry.Response || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {entry.Comment || '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500">
                      {entry.Time_response || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* RAW JSON FOOTER INSPECTOR */}
        {rawJson && rawJson.trim() !== '[]' && (
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chuỗi JSON gốc từ Sheet:</span>
            <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-24 custom-scrollbar">
              {rawJson}
            </pre>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
