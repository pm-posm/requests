import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { mergeCurrentProjectIntoTarget } from '@/services/projectActionService';
import { X, Layers, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface InDetailMergeModalProps {
  currentProjectKey: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetKey: string) => void;
}

interface ExistingProjectItem {
  project_code: string;
  project_name: string;
}

export function InDetailMergeModal({ currentProjectKey, isOpen, onClose, onSuccess }: InDetailMergeModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [existingProjects, setExistingProjects] = useState<ExistingProjectItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ExistingProjectItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all existing projects to build autocomplete suggestions
  useEffect(() => {
    if (!isOpen) return;

    async function fetchProjects() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_activities')
          .select('final_project, name_project')
          .not('final_project', 'is', null);

        if (error) throw error;

        const map = new Map<string, string>();
        (data || []).forEach(r => {
          if (!r.final_project) return;
          const key = r.final_project.trim();
          if (!map.has(key)) {
            map.set(key, r.name_project || key);
          }
        });

        const list: ExistingProjectItem[] = Array.from(map.entries()).map(([code, name]) => ({
          project_code: code,
          project_name: name
        }));

        setExistingProjects(list);
      } catch (err) {
        console.error("Lỗi tải danh sách dự án:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, [isOpen]);

  // Autocomplete filtering: HIDE CURRENT PROJECT from suggestions!
  const filteredSuggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return existingProjects.filter(p => {
      // CRITICAL: HIDE CURRENT PROJECT to avoid self-merging confusion!
      if (p.project_code.toUpperCase() === currentProjectKey.toUpperCase()) return false;
      
      if (!term) return true;
      return (
        p.project_code.toLowerCase().includes(term) ||
        p.project_name.toLowerCase().includes(term)
      );
    });
  }, [existingProjects, searchTerm, currentProjectKey]);

  if (!isOpen) return null;

  const handleConfirmMerge = async () => {
    if (!selectedTarget) {
      toast.error('Vui lòng chọn 1 dự án đích từ danh sách gợi ý.');
      return;
    }

    setIsSubmitting(true);
    try {
      await mergeCurrentProjectIntoTarget({
        currentProjectKey,
        targetProjectKey: selectedTarget.project_code,
        targetProjectName: selectedTarget.project_name
      });

      toast.success(`Đã gộp thành công dự án "${currentProjectKey}" vào "${selectedTarget.project_name}"!`);
      onSuccess(selectedTarget.project_code);
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
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Gộp Dự Án Hiện Tại Vào Dự Án Khác
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Dự án đang mở: <span className="font-bold text-sky-600">{currentProjectKey}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Autocomplete Search & Select Target Project */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-slate-700 dark:text-slate-200 block">
            Nhập Mã hoặc Tên Dự Án cần gộp vào:
          </label>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nhập mã hoặc tên dự án đích..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedTarget(null);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Autocomplete Suggestions Box */}
          <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 mt-2">
            {isLoading ? (
              <div className="p-4 text-center text-slate-400">Đang tải danh sách dự án...</div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic">
                Không tìm thấy dự án phù hợp (Đã ẩn dự án hiện tại {currentProjectKey}).
              </div>
            ) : (
              filteredSuggestions.map(item => {
                const isSelected = selectedTarget?.project_code === item.project_code;
                return (
                  <div
                    key={item.project_code}
                    onClick={() => setSelectedTarget(item)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-sky-50 dark:bg-sky-950/60 font-bold border-l-4 border-sky-600' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-sky-600 dark:text-sky-400 font-bold text-xs">
                        {item.project_code}
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 font-medium text-xs truncate max-w-sm">
                        {item.project_name}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Target Preview */}
        {selectedTarget && (
          <div className="bg-sky-50 dark:bg-sky-950/50 p-3 rounded-xl border border-sky-200 dark:border-sky-800 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-sky-600 block">Dự án sẽ được gộp vào:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">{selectedTarget.project_code}</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium ml-2">({selectedTarget.project_name})</span>
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Sau khi gộp, toàn bộ dữ liệu 4 giai đoạn (Brief, Khảo sát, NTXX, Lắp đặt) của dự án hiện tại sẽ được chuyển sang dự án đích và được đánh dấu rõ nhãn: <b>[Đã gộp từ: {currentProjectKey}]</b>.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleConfirmMerge}
            disabled={!selectedTarget || isSubmitting}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gộp...' : '🔗 Xác Nhận Gộp Dự Án'}
          </button>
        </div>

      </div>
    </div>
  );
}
