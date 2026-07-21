import React from 'react';
import { Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import Analytics from '@/components/Analytics';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useDashboardData, STATUS_STEPS } from '@/hooks/useDashboardData';
import type { Project } from '@/hooks/useProjects';

export function DashboardOverview() {
  const { 
    planOptionFilter, setPlanOptionFilter, 
    kanbanFilter, setKanbanFilter,
    selectedOverviewStatus, setSelectedOverviewStatus,
    setSelectedProject
  } = useDashboardStore();
  
  const { filteredProjects, projectsByStep } = useDashboardData();

  const isCancelled = (p: Project) => {
    if (p.status === 'Cancelled' || p.status === 'Rejected') return true;
    const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
    return note.includes('cancel') || note.includes('hủy') || note.includes('từ chối') || note.includes('reject');
  };
  const isCompleted = (p: Project) => {
    const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
    return note.includes('hoàn thành') || note.includes('hoàn tất') || note.includes('xong');
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="border-b border-border bg-card shadow-sm z-10 shrink-0">
        <div className="px-4 md:px-6 pt-3 md:pt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setPlanOptionFilter('all')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap border ${planOptionFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setPlanOptionFilter('csp_ka')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap border ${planOptionFilter === 'csp_ka' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/30'}`}
          >
            Request CSP/KA
          </button>
          <button
            onClick={() => setPlanOptionFilter('mer_quick_fix')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap border ${planOptionFilter === 'mer_quick_fix' ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/30'}`}
          >
            Mer Quick Fix
          </button>
          <button
            onClick={() => setPlanOptionFilter('supplier_warranty')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap border ${planOptionFilter === 'supplier_warranty' ? 'bg-rose-500 text-white border-rose-500' : 'bg-transparent text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-900/30'}`}
          >
            Supplier bảo hành
          </button>
        </div>

        <div className="px-4 md:px-6 py-4">
          <Analytics 
            projects={filteredProjects} 
            activeFilter={kanbanFilter} 
            onFilterChange={setKanbanFilter} 
            viewMode="stats"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-secondary/30 relative overflow-hidden">
        {/* Overview Status List */}
        <div className="w-full md:w-[260px] h-[35vh] md:h-auto border-b md:border-b-0 md:border-r border-border flex flex-col bg-card shrink-0">
          <div className="p-3 border-b border-border">
            <h2 className="font-bold text-foreground text-xs uppercase tracking-wider">Phân loại Trạng thái</h2>
          </div>
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
            {STATUS_STEPS.map(step => {
              let colProjects = projectsByStep[step] || [];

              if (kanbanFilter === 'cancelled') colProjects = colProjects.filter(p => isCancelled(p));
              else if (kanbanFilter === 'completed_progress') colProjects = colProjects.filter(p => !isCancelled(p) && isCompleted(p));
              else if (kanbanFilter === 'in_progress') colProjects = colProjects.filter(p => !isCancelled(p) && !isCompleted(p));

              if (colProjects.length === 0 && step !== "New") return null;
              
              return (
                <button
                  key={step}
                  onClick={() => setSelectedOverviewStatus(step)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between group ${
                    selectedOverviewStatus === step 
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                  }`}
                >
                  <span className="truncate pr-2">{step}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedOverviewStatus === step 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-muted-foreground group-hover:bg-background group-hover:text-foreground border border-border'
                  }`}>{colProjects.length}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Overview Right Panel */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {selectedOverviewStatus ? (
            <>
              <div className="p-4 md:p-6 border-b border-border bg-card/50 backdrop-blur-sm shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedOverviewStatus}
                  </h2>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {(() => {
                    let projs = projectsByStep[selectedOverviewStatus] || [];

                    if (kanbanFilter === 'cancelled') projs = projs.filter(p => isCancelled(p));
                    else if (kanbanFilter === 'completed_progress') projs = projs.filter(p => !isCancelled(p) && isCompleted(p));
                    else if (kanbanFilter === 'in_progress') projs = projs.filter(p => !isCancelled(p) && !isCompleted(p));
                    
                    return projs.map((project: any) => (
                      <Card 
                        key={project.id}
                        className="group cursor-pointer transition-all duration-300 hover:border-primary hover:shadow-lg bg-card border-border overflow-hidden flex flex-col relative h-full min-h-[140px]"
                        onClick={() => setSelectedProject(project)}
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="p-4 flex flex-col h-full gap-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-wrap gap-1">
                              {project.project_code && project.project_code !== 'N/A' && (
                                <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-border uppercase whitespace-nowrap">
                                  {project.project_code}
                                </Badge>
                              )}
                              {project.request_id && project.request_id !== 'N/A' && (
                                <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-border uppercase whitespace-nowrap">
                                  RQ: {project.request_id}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium shrink-0 text-right">
                              {project.request_date && <div className="mb-0.5 whitespace-nowrap">{project.request_date.split(' ')[0]}</div>}
                              {project.sheet_row_index && <div className="whitespace-nowrap">Row {project.sheet_row_index}</div>}
                            </div>
                          </div>

                          <div className="font-semibold text-sm text-foreground leading-snug line-clamp-2" title={project.source_project_name || "Dự án Không Tên"}>
                            {project.source_project_name || "Dự án Không Tên"}
                          </div>

                          <div className="flex-1"></div>

                          <div className="pt-3 border-t border-border flex flex-col gap-2 mt-auto">
                            <div className="flex items-start gap-2">
                              <Store className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <span className="font-bold text-sm text-foreground line-clamp-2" title={project.store_name}>
                                {project.store_name || "Cửa hàng Không tên"}
                              </span>
                            </div>

                            {(project.progress_note_source || project.progress_note) && (
                              <div className="flex items-start gap-1.5 mt-0.5 inline-flex bg-secondary/50 px-2 py-1.5 rounded-md border border-border w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0"></span>
                                <span className="text-[11px] font-medium text-foreground line-clamp-2">
                                  {project.progress_note_source || project.progress_note}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ));
                  })()}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
