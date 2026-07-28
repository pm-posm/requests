import React, { useState, useMemo } from 'react';
import type { ProjectGroup, ActivityRow } from '@/types';
import { splitProjectService } from '@/services/projectActionService';
import { X, Scissors, Mail, Store, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SplitProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectGroup: ProjectGroup | null;
  onSuccess: () => void;
}

export function SplitProjectModal({ isOpen, onClose, projectGroup, onSuccess }: SplitProjectModalProps) {
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group activities by thread_id / email title
  const threadItems = useMemo(() => {
    if (!projectGroup?.activities) return [];

    const map = new Map<string, {
      thread_id: string;
      title: string;
      sender: string;
      date: string;
      phase: string;
      count: number;
    }>();

    projectGroup.activities.forEach((act: ActivityRow) => {
      const tid = act.thread_id || act.id || act.title_mail || 'NO_THREAD';
      if (!map.has(tid)) {
        map.set(tid, {
          thread_id: tid,
          title: act.title_mail || 'Email Activity',
          sender: act.nguoi_gui || '-',
          date: act.created_at || '-',
          phase: act.phase_type || act.status || 'brief',
          count: 0
        });
      }
      map.get(tid)!.count += 1;
    });

    return Array.from(map.values());
  }, [projectGroup]);

  if (!isOpen || !projectGroup) return null;

  const toggleThreadSelection = (tid: string) => {
    setSelectedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  const handleSplit = async () => {
    if (selectedThreadIds.size === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 luồng email để tách dự án');
      return;
    }
    if (!newKey.trim() || !newName.trim()) {
      toast.error('Vui lòng nhập Mã và Tên Dự Án mới');
      return;
    }

    setIsSubmitting(true);
    try {
      await splitProjectService({
        originalProjectKey: projectGroup.final_project,
        selectedThreadIds: Array.from(selectedThreadIds),
        newProjectKey: newKey.trim(),
        newProjectName: newName.trim()
      });

      toast.success(`Đã tách ${selectedThreadIds.size} luồng mail thành dự án mới "${newName.trim()}"!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi tách dự án: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Scissors className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tách Dự Án Từng Phần
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Từ dự án gốc: <span className="font-bold text-sky-600">{projectGroup.final_project}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thread Selection List */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Chọn các Luồng Email (Thread ID) cần tách:
            </span>
            <span className="text-[11px] text-sky-600 font-bold">
              Đã chọn: {selectedThreadIds.size} / {threadItems.length} luồng
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-800/40">
            {threadItems.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic">
                Không tìm thấy thông tin luồng email (Thread ID) nào trong dự án này.
              </div>
            ) : (
              threadItems.map((item) => {
                const isSelected = selectedThreadIds.has(item.thread_id);
                return (
                  <div
                    key={item.thread_id}
                    onClick={() => toggleThreadSelection(item.thread_id)}
                    className={`p-2.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/80 dark:bg-sky-950/60 font-semibold' : 'hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by parent div onClick
                      className="mt-1 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          {item.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                          {item.phase}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                        <span>Thread ID: {item.thread_id.slice(0, 20)}...</span>
                        <span>{item.count} sự kiện</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Input New Project Details */}
        <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-200 block uppercase text-[10px]">
            Thông Tin Dự Án Mới Sau Khi Tách:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 font-semibold block">Mã Dự Án Mới:</label>
              <input
                type="text"
                placeholder="VD: PRJ-2026-NEW-02"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold block">Tên Dự Án Mới:</label>
              <input
                type="text"
                placeholder="VD: Dự Án Kệ Comfort WinMart Q2"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="flex items-start gap-2 bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-200 dark:border-sky-800 text-[11px] text-sky-700 dark:text-sky-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Các luồng email đã chọn sẽ được chuyển sang mã dự án mới. Tiến độ 4 giai đoạn (Brief, Khảo sát, NTXX, Lắp đặt) của cả dự án gốc và dự án mới sẽ được tính toán lại ngay lập tức.</span>
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
            onClick={handleSplit}
            disabled={isSubmitting || selectedThreadIds.size === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Đang tách dự án...' : '✂️ Xác Nhận Tách Dự Án'}
          </button>
        </div>

      </div>
    </div>
  );
}
