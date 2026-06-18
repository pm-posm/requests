import React from 'react';
import { useProjects, useUpdateProjectStatus, type Project } from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KanbanSquare, Loader2, Search, BarChart3, Settings, MapPin, User, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_STEPS = [
  "Chưa có Status",
  "Under CSP Review",
  "Sent to CSP",
  "Approved",
  "Mer quick fix",
  "Supplier Bảo Hành",
  "Rejected",
  "Cancelled"
];

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  
  const queryClient = useQueryClient();
  const updateStatus = useUpdateProjectStatus();

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStep = destination.droppableId;
    
    // Optimistic update
    queryClient.setQueryData(['projects'], (old: Project[] | undefined) => {
      if (!old) return old;
      return old.map(p => p.id === draggableId ? { ...p, status: newStep } : p);
    });

    // Mutate backend
    updateStatus.mutate({ id: draggableId, status: newStep === "Chưa có Status" ? "" : newStep });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredProjects = projects?.filter(p => 
    p.final_key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.request_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.detected_key?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const projectsByStep = STATUS_STEPS.reduce((acc, step) => {
    acc[step] = filteredProjects.filter(p => {
      if (step === "Chưa có Status") {
        return !p.status || p.status.trim() === "";
      }
      return p.status === step;
    });
    return acc;
  }, {} as Record<string, typeof projects>);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <KanbanSquare className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">POSM Tracker</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm mã dự án..." 
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary w-64 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </header>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 items-start w-full">
            {STATUS_STEPS.map(step => {
              const colProjects = projectsByStep[step] || [];
              if (colProjects.length === 0 && step !== "Chưa có Status") return null; // Ẩn cột trống cho gọn
              
              return (
                <div key={step} className="flex flex-col w-full h-[40vh] min-h-[300px] bg-slate-100 dark:bg-slate-900 rounded-xl border shadow-sm">
                  <div className="p-3 border-b flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-t-xl shrink-0">
                    <h3 className="font-semibold text-xs sm:text-sm truncate pr-2" title={step}>{step}</h3>
                    <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-800">{colProjects.length}</Badge>
                  </div>
                  
                  <Droppable droppableId={step}>
                    {(provided, snapshot) => (
                      <div 
                        className={`flex-1 overflow-y-auto p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-200/50 dark:bg-slate-800/50' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {colProjects.map((project, index) => (
                          <Draggable key={project.id} draggableId={project.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                }}
                              >
                                <Card 
                                  className={`cursor-pointer transition-all ${snapshot.isDragging ? 'shadow-lg border-primary ring-2 ring-primary/20' : 'hover:border-primary/50 hover:shadow-md'}`}
                                  onClick={() => setSelectedProject(project)}
                                >
                                  <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                      <CardTitle className="text-sm font-bold truncate pr-2" title={project.detected_name_project || project.normalized_project_name || project.source_project_name}>
                                        {project.final_key || project.request_id || project.detected_key || "Unknown"}
                                      </CardTitle>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="p-4 pt-0 text-xs text-slate-500">
                                    <p className="truncate font-medium text-slate-700 dark:text-slate-300 mb-1">{project.store_name || "N/A"}</p>
                                    <p className="truncate">Store Code: {project.store_code || "N/A"}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {(project.final_progress || project.progress_note || project.progress_note_source) && (
                                        <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-600/20">
                                          {project.final_progress || project.progress_note || project.progress_note_source}
                                        </span>
                                      )}
                                      {project.timeline && (
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">
                                          {project.timeline}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </main>
      </DragDropContext>

      {/* Project Details Modal */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <KanbanSquare className="h-5 w-5 text-primary" />
                  {selectedProject.detected_name_project || selectedProject.normalized_project_name || "Dự án Không Tên"}
                </DialogTitle>
                <DialogDescription className="hidden">
                  Chi tiết dự án
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                      <Tag className="h-4 w-4" /> Mã Dự Án
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-xl font-bold break-words leading-tight text-primary">{selectedProject.final_key || "N/A"}</div>
                      </div>
                      <div className="pb-1">
                        <div className="text-slate-500 text-xs mb-1">Request ID</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.request_id || "N/A"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                      <MapPin className="h-4 w-4" /> Điểm Bán & Phụ Trách
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Store Name</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.store_name || "N/A"}</div>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Store Code</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.store_code || "N/A"}</div>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Supplier</div> 
                        <div className="font-semibold break-words leading-tight text-blue-600 dark:text-blue-400">
                          {selectedProject.supplier || selectedProject.detected_supplier || "Chưa phát hiện"}
                        </div>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">MER</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.mer || "N/A"}</div>
                      </div>
                      <div className="pb-1">
                        <div className="text-slate-500 text-xs mb-1">SR</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.sr || "N/A"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                      <BarChart3 className="h-4 w-4" /> Trạng Thái & Tiến Độ
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-slate-500 block mb-1">Status:</span>
                        <Badge variant={selectedProject.status === 'Approved' ? 'default' : 'secondary'}>{selectedProject.status || "Chưa rõ"}</Badge>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1 text-xs">Tiến độ mới nhất:</span>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                          {selectedProject.final_progress || selectedProject.progress_note || "Chưa rõ"}
                        </Badge>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Timeline</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.timeline || "N/A"}</div>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Phương án</div> 
                        <div className="font-semibold break-words leading-tight">{selectedProject.plan_option || "N/A"}</div>
                      </div>
                      <div className="border-b border-slate-100 dark:border-slate-800/50 pb-2">
                        <div className="text-slate-500 text-xs mb-1">Vis Note</div> 
                        <div className="font-semibold break-words leading-tight whitespace-pre-wrap">{selectedProject.vis_note || "N/A"}</div>
                      </div>
                      <div className="pb-1">
                        <div className="text-slate-500 text-xs mb-1">SR Note</div> 
                        <div className="font-semibold break-words leading-tight whitespace-pre-wrap">{selectedProject.sr_note || "N/A"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedProject.data_responser && (
                <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                    <User className="h-4 w-4" /> Phản hồi & Trách nhiệm (Responser)
                  </h4>
                  <pre className="text-xs whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-3 rounded border">
                    {selectedProject.data_responser}
                  </pre>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
