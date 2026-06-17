import React from 'react';
import { useProjects, useUpdateProjectProgress, type Project } from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanSquare, Loader2, Search, BarChart3, Settings, MapPin, Hash, User, Calendar, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';

const PROGRESS_STEPS = [
  "Chưa rõ",
  "Cấp PO",
  "Gửi lịch khảo sát",
  "Trả kết quả khảo sát",
  "Gửi thiết kế",
  "Gửi Brief",
  "Approve Brief",
  "Gửi lịch NTXX",
  "Trả kết quả NTXX",
  "Gửi lịch Thi công",
  "Trả kết quả Thi công",
  "Gửi lịch bảo hành/sửa chữa",
  "Trả kết quả bảo hành/sửa chữa",
  "Cancelled"
];

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  
  const queryClient = useQueryClient();
  const updateProgress = useUpdateProjectProgress();

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const newStep = destination.droppableId;
    
    // Optimistic update
    queryClient.setQueryData(['projects'], (old: Project[] | undefined) => {
      if (!old) return old;
      return old.map(p => p.id === draggableId ? { ...p, progress_note: newStep } : p);
    });

    // Mutate backend
    updateProgress.mutate({ id: draggableId, progress_note: newStep });
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

  const projectsByStep = PROGRESS_STEPS.reduce((acc, step) => {
    acc[step] = filteredProjects.filter(p => (p.progress_note || "Chưa rõ") === step);
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
        <main className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-50/50 dark:bg-slate-950 p-6">
          <div className="flex gap-6 h-full items-start w-max">
            {PROGRESS_STEPS.map(step => {
              const colProjects = projectsByStep[step];
              if (colProjects.length === 0 && step !== "Chưa rõ") return null; // Ẩn cột trống cho gọn
              
              return (
                <div key={step} className="flex flex-col w-80 max-h-full bg-slate-100 dark:bg-slate-900 rounded-xl border shadow-sm">
                  <div className="p-4 border-b flex items-center justify-between bg-white/50 dark:bg-slate-900/50 rounded-t-xl">
                    <h3 className="font-semibold text-sm">{step}</h3>
                    <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-800">{colProjects.length}</Badge>
                  </div>
                  
                  <Droppable droppableId={step}>
                    {(provided, snapshot) => (
                      <div 
                        className={`flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-200/50 dark:bg-slate-800/50' : ''}`}
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
                                      <CardTitle className="text-sm font-bold truncate pr-2" title={project.normalized_project_name || project.source_project_name}>
                                        {project.final_key || project.request_id || project.detected_key || "Unknown"}
                                      </CardTitle>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="p-4 pt-0 text-xs text-slate-500">
                                    <p className="truncate font-medium text-slate-700 dark:text-slate-300 mb-1">{project.store_name || "N/A"}</p>
                                    <p className="truncate">Store Code: {project.store_code || "N/A"}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {project.status && <Badge variant="secondary" className="text-[10px]">{project.status}</Badge>}
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
                  {selectedProject.normalized_project_name || "Dự án Không Tên"}
                </DialogTitle>
                <DialogDescription className="text-sm pt-2">
                  Chi tiết thông tin đồng bộ từ Sheet và luồng tiến độ
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                      <Tag className="h-4 w-4" /> Mã Định Danh
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Final Key:</span> <strong>{selectedProject.final_key || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Request ID:</span> <strong>{selectedProject.request_id || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Source Key:</span> <strong>{selectedProject.source_key || "N/A"}</strong></div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
                      <MapPin className="h-4 w-4" /> Điểm Bán & Phụ Trách
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Store Name:</span> <strong>{selectedProject.store_name || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Store Code:</span> <strong>{selectedProject.store_code || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">MER:</span> <strong>{selectedProject.mer || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">SR:</span> <strong>{selectedProject.sr || "N/A"}</strong></div>
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
                        <span className="text-slate-500 block mb-1">Progress Note:</span>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                          {selectedProject.progress_note || "Chưa rõ"}
                        </Badge>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-500">Timeline:</span> <strong>{selectedProject.timeline || "N/A"}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Plan Option:</span> <strong>{selectedProject.plan_option || "N/A"}</strong></div>
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
