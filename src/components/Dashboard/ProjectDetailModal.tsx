import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type { Project } from '@/hooks/useProjects';
import { useDashboardStore } from '@/stores/useDashboardStore';

export function ProjectDetailModal() {
  const queryClient = useQueryClient();
  const { selectedProject, setSelectedProject } = useDashboardStore();
  
  const [isEditingProject, setIsEditingProject] = React.useState(false);
  const [editProjectData, setEditProjectData] = React.useState<Partial<Project>>({});
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  React.useEffect(() => {
    if (selectedProject) {
      setEditProjectData({});
      setIsEditingProject(false);
    }
  }, [selectedProject]);

  const handleSaveEdit = async () => {
    if (!selectedProject || !selectedProject.id) return;
    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('posm_projects')
        .update(editProjectData)
        .eq('id', selectedProject.id);
        
      if (error) throw error;
      
      const updatedProject = { ...selectedProject, ...editProjectData };
      setSelectedProject(updatedProject as Project);
      setIsEditingProject(false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      console.error('Lỗi khi lưu:', error);
      alert('Lỗi khi lưu: ' + error.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-950 p-0 border-0 shadow-2xl rounded-2xl">
        {selectedProject && (
          <>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 pr-12 text-white rounded-t-2xl relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[200px] max-w-full">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-2 backdrop-blur-sm">
                    {selectedProject.status || "New"}
                  </Badge>
                  <DialogTitle className="text-lg sm:text-xl font-bold mb-1 leading-snug break-words whitespace-normal">
                    {selectedProject.source_project_name || selectedProject.normalized_project_name || "Dự Án Không Tên"}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-4 mt-1">
                    <p className="text-indigo-100 font-medium opacity-90 text-sm">
                      Mã dự án: <strong className="font-semibold text-white">{selectedProject.source_key || (selectedProject as any)?.project_code || 'N/A'}</strong>
                    </p>
                    <p className="text-indigo-100 font-medium opacity-90 text-sm">
                      Request ID: <strong className="font-semibold text-white">{selectedProject.request_id || 'N/A'}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditingProject ? (
                    <>
                      <button 
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-bold text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} <span className="hidden sm:inline">Lưu</span>
                      </button>
                      <button 
                        onClick={() => setIsEditingProject(false)}
                        disabled={isSavingEdit}
                        className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4" /> <span className="hidden sm:inline">Hủy</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setIsEditingProject(true)}
                      className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-bold text-indigo-700 bg-white hover:bg-indigo-50 rounded-lg transition-colors shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      <span className="hidden sm:inline">Chỉnh sửa</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Điểm Bán & Phụ Trách</h4>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Store</div> 
                        <div className="font-semibold text-slate-900 dark:text-white">{selectedProject.store_name || "Chưa rõ"}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{selectedProject.store_code || "Chưa rõ"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Supplier</div> 
                        {isEditingProject ? (
                          <input 
                            type="text"
                            value={editProjectData.supplier ?? selectedProject.supplier ?? ''}
                            onChange={(e) => setEditProjectData({ ...editProjectData, supplier: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm font-bold text-indigo-700 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-950 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                            placeholder="Supplier"
                          />
                        ) : (
                          <div className="font-bold text-indigo-600 dark:text-indigo-400">
                            {selectedProject.supplier || "Chưa phát hiện"}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 mb-1">MER</div> 
                          {isEditingProject ? (
                            <input 
                              type="text"
                              value={editProjectData.mer ?? selectedProject.mer ?? ''}
                              onChange={(e) => setEditProjectData({ ...editProjectData, mer: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                              placeholder="MER"
                            />
                          ) : (
                            <div className="font-medium text-slate-900 dark:text-white break-words">{selectedProject.mer || "Chưa rõ"}</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 mb-1">SR</div> 
                          {isEditingProject ? (
                            <input 
                              type="text"
                              value={editProjectData.sr ?? selectedProject.sr ?? ''}
                              onChange={(e) => setEditProjectData({ ...editProjectData, sr: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                              placeholder="SR"
                            />
                          ) : (
                            <div className="font-medium text-slate-900 dark:text-white break-words">{selectedProject.sr || "Chưa rõ"}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Trạng Thái & Tiến Độ</h4>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="text-xs text-slate-500 mb-1.5">Tiến độ mới nhất</div>
                        {isEditingProject ? (
                          <input 
                            type="text"
                            value={editProjectData.progress_note_source ?? editProjectData.progress_note ?? selectedProject.progress_note_source ?? selectedProject.progress_note ?? ''}
                            onChange={(e) => setEditProjectData({ ...editProjectData, progress_note_source: e.target.value })}
                            className="w-full px-2 py-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 dark:border-purple-900/50 dark:bg-slate-950 dark:text-purple-300 rounded-md outline-none focus:ring-2 focus:ring-purple-500 min-w-0"
                            placeholder="Tiến độ"
                          />
                        ) : (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 font-semibold px-2.5 py-1">
                            {selectedProject.progress_note_source || selectedProject.progress_note || "Chưa cập nhật"}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Timeline</div> 
                          {isEditingProject ? (
                            <input 
                              type="text"
                              value={editProjectData.timeline ?? selectedProject.timeline ?? ''}
                              onChange={(e) => setEditProjectData({ ...editProjectData, timeline: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                              placeholder="Timeline"
                            />
                          ) : (
                            <div className="font-medium text-slate-900 dark:text-white">{selectedProject.timeline || "Chưa có"}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Phương án</div> 
                          {isEditingProject ? (
                            <input 
                              type="text"
                              value={editProjectData.plan_option ?? selectedProject.plan_option ?? ''}
                              onChange={(e) => setEditProjectData({ ...editProjectData, plan_option: e.target.value })}
                              className="w-full px-2 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                              placeholder="Phương án"
                            />
                          ) : (
                            <div className="font-medium text-slate-900 dark:text-white">{selectedProject.plan_option || "Chưa có"}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(isEditingProject || selectedProject.vis_note || selectedProject.sr_note) && (
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ghi chú</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(isEditingProject || selectedProject.vis_note) && (
                      <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20">
                        <div className="text-xs font-bold text-amber-700 dark:text-amber-500 mb-1">VIS Note</div>
                        {isEditingProject ? (
                          <textarea 
                            value={editProjectData.vis_note ?? selectedProject.vis_note ?? ''}
                            onChange={(e) => setEditProjectData({ ...editProjectData, vis_note: e.target.value })}
                            className="w-full p-2 text-sm text-amber-900 bg-white border border-amber-200 dark:border-amber-700/50 dark:bg-slate-950 dark:text-amber-200 rounded-md outline-none focus:ring-2 focus:ring-amber-500 resize-y min-h-[80px]"
                            placeholder="Nhập VIS Note..."
                          />
                        ) : (
                          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{selectedProject.vis_note}</p>
                        )}
                      </div>
                    )}
                    {(isEditingProject || selectedProject.sr_note) && (
                      <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-500 mb-1">SR Note</div>
                        {isEditingProject ? (
                          <textarea 
                            value={editProjectData.sr_note ?? selectedProject.sr_note ?? ''}
                            onChange={(e) => setEditProjectData({ ...editProjectData, sr_note: e.target.value })}
                            className="w-full p-2 text-sm text-blue-900 bg-white border border-blue-200 dark:border-blue-700/50 dark:bg-slate-950 dark:text-blue-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                            placeholder="Nhập SR Note..."
                          />
                        ) : (
                          <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">{selectedProject.sr_note}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
