import React, { useState } from 'react';
import type { ProjectGroup } from '@/types';
import { mergeProjectsService } from '@/services/projectActionService';
import { X, Layers, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MergeProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjects: ProjectGroup[];
  onSuccess: () => void;
}

export function MergeProjectsModal({ isOpen, onClose, selectedProjects, onSuccess }: MergeProjectsModalProps) {
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>(selectedProjects[0]?.final_project || '');
  const [customKey, setCustomKey] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || selectedProjects.length < 2) return null;

  const handleMerge = async () => {
    let finalKey = '';
    let finalName = '';

    if (targetMode === 'existing') {
      finalKey = selectedTargetKey;
      const targetObj = selectedProjects.find(p => p.final_project === selectedTargetKey);
      finalName = targetObj?.name_project || targetObj?.final_project || selectedTargetKey;
    } else {
      if (!customKey.trim() || !customName.trim()) {
        toast.error('Vui lòng nhập đầy đủ Mã và Tên Dự Án mới');
        return;
      }
      finalKey = customKey.trim();
      finalName = customName.trim();
    }

    setIsSubmitting(true);
    try {
      const keysToMerge = selectedProjects.map(p => p.final_project);
      await mergeProjectsService({
        sourceProjectKeys: keysToMerge,
        targetProjectKey: finalKey,
        targetProjectName: finalName
      });

      toast.success(`Đã gộp ${selectedProjects.length} dự án thành công vào "${finalName}"!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi gộp dự án: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Layers className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gộp {selectedProjects.length} Dự Án Master
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Projects Selected Preview */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[10px]">
            Danh sách dự án đã chọn gộp:
          </span>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {selectedProjects.map((p, idx) => (
              <div key={p.final_project} className="flex items-center justify-between font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sky-600">{p.final_project}</span>
                <span className="truncate max-w-[200px] text-slate-600 dark:text-slate-400">{p.name_project || p.final_project}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Options: Keep existing vs New Project */}
        <div className="space-y-3 text-xs">
          <label className="font-bold text-slate-700 dark:text-slate-200 block">
            Chọn cách gom nhóm dữ liệu:
          </label>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTargetMode('existing')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                targetMode === 'existing' 
                  ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold' 
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-bold">Giữ mã dự án hiện có</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Chọn 1 trong các mã dự án đã chọn</div>
            </button>

            <button
              onClick={() => setTargetMode('new')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                targetMode === 'new' 
                  ? 'border-sky-600 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold' 
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-bold">+ Đặt tên mã dự án mới</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Tạo mã & tên dự án hợp nhất mới</div>
            </button>
          </div>

          {targetMode === 'existing' ? (
            <div className="space-y-1 mt-3">
              <label className="text-[11px] text-slate-500 font-semibold">Chọn mã dự án làm chuẩn:</label>
              <select
                value={selectedTargetKey}
                onChange={e => setSelectedTargetKey(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {selectedProjects.map(p => (
                  <option key={p.final_project} value={p.final_project}>
                    {p.final_project} - {p.name_project || p.final_project}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2 mt-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="text-[11px] text-slate-500 font-semibold block">Mã Dự Án Mới:</label>
                <input
                  type="text"
                  placeholder="VD: PRJ-2026-COMBINED-01"
                  value={customKey}
                  onChange={e => setCustomKey(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-semibold block">Tên Dự Án Mới:</label>
                <input
                  type="text"
                  placeholder="VD: Dự Án Tổng Hợp POSM WinMart Q1"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Warning Note */}
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Khi gộp dự án, toàn bộ lịch sử email (`thread_id`), store request và 4 giai đoạn tiến độ (Brief ➔ Khảo sát ➔ NTXX ➔ Lắp đặt) sẽ được hợp nhất về cùng 1 mã duy nhất.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleMerge}
            disabled={isSubmitting}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gộp dự án...' : '🔗 Xác Nhận Gộp Dự Án'}
          </button>
        </div>

      </div>
    </div>
  );
}
