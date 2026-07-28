import React, { useState, useMemo } from 'react';
import type { ActivityRow } from '@/types';
import { splitCurrentProjectService } from '@/services/projectActionService';
import { X, Scissors, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface InDetailSplitModalProps {
  currentProjectKey: string;
  activities: ActivityRow[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProjectKey: string) => void;
}

export function InDetailSplitModal({ currentProjectKey, activities, isOpen, onClose, onSuccess }: InDetailSplitModalProps) {
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group activities by thread_id / title
  const threadItems = useMemo(() => {
    if (!activities) return [];

    const map = new Map<string, {
      thread_id: string;
      title: string;
      sender: string;
      date: string;
      phase: string;
      count: number;
    }>();

    activities.forEach((act: ActivityRow) => {
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
  }, [activities]);

  if (!isOpen) return null;

  const toggleThreadSelection = (tid: string) => {
    setSelectedThreadIds(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  const isFormValid = newKey.trim() !== '' && newName.trim() !== '' && selectedThreadIds.size > 0;

  const handleSplit = async () => {
    if (!isFormValid) {
      toast.error('Vui lòng nhập đầy đủ Mã Dự Án Mới và Tên Dự Án Mới và chọn ít nhất 1 luồng mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      await splitCurrentProjectService({
        currentProjectKey,
        selectedThreadIds: Array.from(selectedThreadIds),
        newProjectKey: newKey.trim(),
        newProjectName: newName.trim()
      });

      toast.success(`Đã tách ${selectedThreadIds.size} luồng mail thành dự án mới "${newName.trim()}"!`);
      onSuccess(newKey.trim());
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
                Tách Luồng Mail Thành Dự Án Mới
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Từ dự án gốc: <span className="font-bold text-sky-600">{currentProjectKey}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Inputs: Require BOTH Code & Name */}
        <div className="space-y-3 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs">
          <span className="font-bold text-rose-800 dark:text-rose-300 block uppercase text-[10px]">
            * Bắt buộc nhập đầy đủ Mã và Tên cho Dự Án Mới:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Mã Dự Án Mới <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: PRJ-2026-COMFORT-02"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tên Dự Án Mới <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Dự Án Kệ Comfort WinMart"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Thread Selection List */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Chọn các Luồng Email (Thread ID) để tách ra:
            </span>
            <span className="text-[11px] text-rose-600 font-bold">
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
                      isSelected ? 'bg-rose-50 dark:bg-rose-950/60 font-semibold' : 'hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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

        {/* Info Note */}
        <div className="flex items-start gap-2 bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-200 dark:border-sky-800 text-[11px] text-sky-700 dark:text-sky-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Sau khi lưu, các luồng email đã chọn sẽ xuất hiện thành 1 dòng dự án mới trên Bảng Chính.</span>
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
            disabled={!isFormValid || isSubmitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Đang tách dự án...' : '✂️ Lưu & Tách Thành Dự Án Mới'}
          </button>
        </div>

      </div>
    </div>
  );
}
