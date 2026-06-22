import React from 'react';
import { useProjects, useUpdateProjectStatus, type Project } from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KanbanSquare, Loader2, Search, BarChart3, Settings, MapPin, User, Tag, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Analytics, { type FilterType } from './Analytics';

const STATUS_STEPS = [
  "New",
  "Under CSP Review",
  "Sent to CSP",
  "Approved",
  "Mer quick fix",
  "Supplier Bảo Hành",
  "Rejected",
  "Cancelled"
];

const calculateAge = (dateStr?: string) => {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      d = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
    } else {
      return null;
    }
  }
  if (isNaN(d.getTime())) return null;
  const diffTime = Math.abs(new Date().getTime() - d.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(localStorage.getItem('isAdmin') === 'true');
  const [kanbanFilter, setKanbanFilter] = React.useState<FilterType>('all');
  
  // New States for 2-Tab structure and Plan Option Filter
  const [mainTab, setMainTab] = React.useState<'sr_view' | 'overview'>('overview');
  const [planOptionFilter, setPlanOptionFilter] = React.useState<'all' | 'csp_ka' | 'mer_quick_fix' | 'supplier_warranty'>('all');
  const [selectedStore, setSelectedStore] = React.useState<string | null>(null);
  const [selectedOverviewStatus, setSelectedOverviewStatus] = React.useState<string | null>('charts');
  
  const queryClient = useQueryClient();
  const updateStatus = useUpdateProjectStatus();



  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-mer-view');
      if (error) throw error;
      alert(data.message || 'Đồng bộ thành công!');
      // Refetch after sync
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      console.error('Lỗi đồng bộ:', error);
      alert('Lỗi đồng bộ: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdminToggle = () => {
    if (!isAdmin) {
      const pwd = prompt("Nhập mật khẩu Admin để hiển thị tính năng ẩn:");
      // Mật khẩu tạm thời là admin123
      if (pwd === "admin123") {
        localStorage.setItem('isAdmin', 'true');
        setIsAdmin(true);
      } else if (pwd !== null) {
        alert("Sai mật khẩu!");
      }
    } else {
      if (confirm("Bạn muốn thoát chế độ Admin?")) {
        localStorage.removeItem('isAdmin');
        setIsAdmin(false);
      }
    }
  };

  const uniqueStores = React.useMemo(() => {
    if (!projects) return [];
    const stores = new Set<string>();
    projects.forEach(p => {
      if (p.store_name?.trim()) stores.add(p.store_name.trim());
    });
    return Array.from(stores).sort();
  }, [projects]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredProjects = projects?.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.final_key?.toLowerCase().includes(term) ||
      p.request_id?.toLowerCase().includes(term) ||
      p.store_code?.toLowerCase().includes(term) ||
      p.store_name?.toLowerCase().includes(term) ||
      p.normalized_project_name?.toLowerCase().includes(term)
    );
  })?.filter(p => {
    // Filter by plan_option
    if (planOptionFilter === 'all') return true;
    const plan = p.plan_option?.trim() || "";
    if (planOptionFilter === 'csp_ka') {
      return ["Đưa vào RQ by Store", "Đã đưa vào RQ tuần", "Request CSP", "Visibility Rquest"].includes(plan);
    }
    if (planOptionFilter === 'mer_quick_fix') {
      return plan === "Mer Quick Fix";
    }
    if (planOptionFilter === 'supplier_warranty') {
      return plan === "Supplier bảo hành";
    }
    return true;
  }) || [];

  const filteredStores = uniqueStores.filter(store => 
    store.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const srViewProjects = projects?.filter(p => p.store_name === selectedStore) || [];

  const projectsByStep = STATUS_STEPS.reduce((acc, step) => {
    acc[step] = filteredProjects.filter(p => {
      if (step === "New") {
        return !p.status || p.status.trim() === "";
      }
      return p.status === step;
    });
    return acc;
  }, {} as Record<string, typeof projects>);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm z-10">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <KanbanSquare className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">POSM Tracker</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:hidden">
              <button onClick={handleAdminToggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Cài đặt (Bật chế độ Admin)">
                <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          {/* Main Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
            <button 
              onClick={() => setMainTab('sr_view')} 
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${mainTab === 'sr_view' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Giao diện Cửa hàng
            </button>
            <button 
              onClick={() => setMainTab('overview')} 
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${mainTab === 'overview' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Tổng quan
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder={mainTab === 'sr_view' ? "Tìm tên cửa hàng..." : "Tìm mã dự án, cửa hàng..."} 
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {isAdmin && (
            <button 
              onClick={handleSync} 
              disabled={isSyncing}
              className="flex shrink-0 items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              title="Đồng bộ dữ liệu"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              <span className="hidden sm:inline">Đồng bộ</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button onClick={handleAdminToggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Cài đặt (Bật chế độ Admin)">
              <Settings className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 dark:bg-slate-950 flex flex-col">
        
        {mainTab === 'overview' ? (
          <>
            {/* Analytics & Metrics Filter */}
            <div className="border-b bg-white dark:bg-slate-900 shadow-sm z-10 relative">
              <div className="px-4 sm:px-6 pt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setPlanOptionFilter('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${planOptionFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                >
                  Tất cả Phương án
                </button>
                <button
                  onClick={() => setPlanOptionFilter('csp_ka')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${planOptionFilter === 'csp_ka' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'}`}
                >
                  Request CSP/KA
                </button>
                <button
                  onClick={() => setPlanOptionFilter('mer_quick_fix')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${planOptionFilter === 'mer_quick_fix' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'}`}
                >
                  Mer Quick Fix
                </button>
                <button
                  onClick={() => setPlanOptionFilter('supplier_warranty')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${planOptionFilter === 'supplier_warranty' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50'}`}
                >
                  Supplier bảo hành
                </button>
              </div>

              <div className="p-4 sm:p-6 pb-2">
                <Analytics 
                  projects={filteredProjects} 
                  activeFilter={kanbanFilter} 
                  onFilterChange={setKanbanFilter} 
                  viewMode="stats"
                />
              </div>
        </div>

        <div className="flex flex-1 min-h-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
          {/* Left Column: Status List */}
          <div className={`w-full md:w-1/3 md:max-w-[350px] md:min-w-[250px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 overflow-y-auto absolute inset-0 md:static z-10 md:z-0 transition-transform ${selectedOverviewStatus ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <KanbanSquare className="h-4 w-4 text-primary" /> Phân loại Trạng thái
              </h2>
              <p className="text-xs text-slate-500">Bấm để xem danh sách</p>
            </div>
            <div className="flex-1 p-2 space-y-1">
              <button
                onClick={() => setSelectedOverviewStatus('charts')}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between mb-2 ${selectedOverviewStatus === 'charts' ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <span className="font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Biểu đồ Thống kê</span>
              </button>
              
              {STATUS_STEPS.map(step => {
                let colProjects = projectsByStep[step] || [];
                
                const isCancelled = (p: Project) => {
                  if (p.status === 'Cancelled' || p.status === 'Rejected') return true;
                  const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                  return note.includes('cancel') || note.includes('hủy') || note.includes('từ chối') || note.includes('reject');
                };

                const isCompleted = (p: Project) => {
                  const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                  return note.includes('hoàn thành') || note.includes('hoàn tất') || note.includes('xong');
                };

                if (kanbanFilter === 'cancelled') {
                  colProjects = colProjects.filter(p => isCancelled(p));
                } else if (kanbanFilter === 'completed_progress') {
                  colProjects = colProjects.filter(p => !isCancelled(p) && isCompleted(p));
                } else if (kanbanFilter === 'in_progress') {
                  colProjects = colProjects.filter(p => !isCancelled(p) && !isCompleted(p));
                }

                if (colProjects.length === 0 && step !== "New") return null;
                
                const isSelected = selectedOverviewStatus === step;

                // Map colors for status badges
                const getStatusStyle = (stepName: string) => {
                  if (stepName === 'Approved') return 'text-green-600 bg-green-50 ring-green-200';
                  if (stepName === 'Cancelled') return 'text-red-600 bg-red-50 ring-red-200';
                  if (stepName === 'New') return 'text-slate-600 bg-slate-100 ring-slate-200';
                  return 'text-blue-600 bg-blue-50 ring-blue-200';
                };

                return (
                  <button
                    key={step}
                    onClick={() => setSelectedOverviewStatus(step)}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${isSelected ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <span className="truncate pr-2 uppercase tracking-wider text-[11px] sm:text-xs font-bold">{step}</span>
                    <Badge variant="secondary" className={`${getStatusStyle(step)}`}>{colProjects.length}</Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Projects for Selected Status */}
          <div className={`flex-1 flex flex-col h-full bg-slate-50/30 dark:bg-slate-950/30 overflow-hidden absolute inset-0 md:static z-0 transition-transform ${!selectedOverviewStatus ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
            {!selectedOverviewStatus ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 hidden md:flex">
                <KanbanSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>Vui lòng chọn một Trạng thái ở cột bên trái</p>
                <p className="text-sm mt-1">để xem chi tiết dự án</p>
              </div>
            ) : selectedOverviewStatus === 'charts' ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="md:hidden p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-2">
                  <button 
                    className="p-1 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    onClick={() => setSelectedOverviewStatus(null)}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold">Biểu đồ Thống kê</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <Analytics 
                  projects={filteredProjects} 
                  activeFilter={kanbanFilter} 
                  onFilterChange={setKanbanFilter} 
                  viewMode="charts"
                />
              </div>
              </div>
            ) : (
              <>
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-3">
                  <button 
                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    onClick={() => setSelectedOverviewStatus(null)}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">{selectedOverviewStatus}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                    {(() => {
                      let projs = projectsByStep[selectedOverviewStatus] || [];
                      
                      const isCancelled = (p: Project) => {
                        if (p.status === 'Cancelled' || p.status === 'Rejected') return true;
                        const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                        return note.includes('cancel') || note.includes('hủy') || note.includes('từ chối') || note.includes('reject');
                      };

                      const isCompleted = (p: Project) => {
                        const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                        return note.includes('hoàn thành') || note.includes('hoàn tất') || note.includes('xong');
                      };

                      if (kanbanFilter === 'cancelled') {
                        projs = projs.filter(p => isCancelled(p));
                      } else if (kanbanFilter === 'completed_progress') {
                        projs = projs.filter(p => !isCancelled(p) && isCompleted(p));
                      } else if (kanbanFilter === 'in_progress') {
                        projs = projs.filter(p => !isCancelled(p) && !isCompleted(p));
                      }
                      
                      return `Đang hiển thị ${projs.length} dự án`;
                    })()}
                  </p>
                  </div>
                </div>
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(() => {
                      let projs = projectsByStep[selectedOverviewStatus] || [];
                      
                      const isCancelled = (p: Project) => {
                        if (p.status === 'Cancelled' || p.status === 'Rejected') return true;
                        const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                        return note.includes('cancel') || note.includes('hủy') || note.includes('từ chối') || note.includes('reject');
                      };

                      const isCompleted = (p: Project) => {
                        const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
                        return note.includes('hoàn thành') || note.includes('hoàn tất') || note.includes('xong');
                      };

                      if (kanbanFilter === 'cancelled') {
                        projs = projs.filter(p => isCancelled(p));
                      } else if (kanbanFilter === 'completed_progress') {
                        projs = projs.filter(p => !isCancelled(p) && isCompleted(p));
                      } else if (kanbanFilter === 'in_progress') {
                        projs = projs.filter(p => !isCancelled(p) && !isCompleted(p));
                      }
                      
                      return projs.map(project => (
                        <Card 
                          key={project.id}
                          className="cursor-pointer transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/60"
                          onClick={() => setSelectedProject(project)}
                        >
                          <CardHeader className="p-3 pb-1 border-b border-slate-50 dark:border-slate-800/30">
                            <div className="flex justify-between items-center gap-2">
                              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate flex-1" title={project.source_project_name || project.normalized_project_name || "Dự án Không Tên"}>
                                {project.request_id || project.source_key || project.source_project_name || "Unknown"}
                              </CardTitle>
                              <div className="flex shrink-0 gap-1 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                                {project.request_date && (
                                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    {project.request_date.split(' ')[0]}
                                    {(() => {
                                      const age = calculateAge(project.request_date);
                                      if (age !== null) {
                                        return <span className={`font-bold ${age > 14 ? 'text-red-500' : age > 7 ? 'text-amber-500' : 'text-green-500'}`}>({age} ngày)</span>;
                                      }
                                      return null;
                                    })()}
                                  </span>
                                )}
                                {project.sheet_row_index && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">#{project.sheet_row_index}</span>}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-2">
                            <p className="truncate font-bold text-sm text-slate-800 dark:text-slate-100 mb-2">{project.store_name || "Cửa hàng Không tên"}</p>
                            <div className="flex flex-wrap gap-1">
                              {(project.progress_note_source || project.progress_note) && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-600/10 max-w-full truncate">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                  {project.progress_note_source || project.progress_note}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </>
        ) : (
          /* SR View Tab - Master/Detail Layout */
          <div className="flex flex-1 h-full overflow-hidden bg-white dark:bg-slate-900 relative">
            {/* Left Column: Stores List */}
            <div className={`w-full md:w-1/3 md:max-w-[350px] md:min-w-[250px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 absolute inset-0 md:static z-10 md:z-0 transition-transform ${selectedStore ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Danh sách Cửa hàng
                </h2>
                <p className="text-xs text-slate-500">{filteredStores.length} cửa hàng</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredStores.map(store => (
                  <button
                    key={store}
                    onClick={() => setSelectedStore(store)}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-all ${selectedStore === store ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {store}
                  </button>
                ))}
                {filteredStores.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Không tìm thấy cửa hàng nào
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Requests for Selected Store */}
            <div className={`flex-1 flex flex-col h-full bg-slate-50/30 dark:bg-slate-950/30 absolute inset-0 md:static z-0 transition-transform ${!selectedStore ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
              {!selectedStore ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 hidden md:flex">
                  <MapPin className="h-12 w-12 mb-4 opacity-20" />
                  <p>Vui lòng chọn một cửa hàng ở cột bên trái</p>
                  <p className="text-sm mt-1">để xem danh sách dự án</p>
                </div>
              ) : (
                <>
                  <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-3">
                    <button 
                      className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                      onClick={() => setSelectedStore(null)}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">{selectedStore}</h2>
                      <p className="text-sm text-slate-500 mt-1">Đang có {srViewProjects.length} dự án</p>
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {srViewProjects.map((project) => (
                        <Card 
                          key={project.id} 
                          onClick={() => setSelectedProject(project)}
                          className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900"
                        >
                          <CardHeader className="p-4 pb-2 border-b border-slate-50 dark:border-slate-800/30">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex flex-col flex-1 min-w-0">
                                <CardTitle className="text-sm font-bold truncate text-primary" title={project.source_project_name || project.normalized_project_name || "Dự án Không Tên"}>
                                  {project.request_id || project.source_key || project.source_project_name || "Unknown"}
                                </CardTitle>
                                <div className="flex gap-1.5 text-[10px] mt-1 font-medium text-slate-500 dark:text-slate-400">
                                  {project.request_date && (
                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                      {project.request_date.split(' ')[0]}
                                      {(() => {
                                        const age = calculateAge(project.request_date);
                                        if (age !== null) {
                                          return <span className={`font-bold ${age > 14 ? 'text-red-500' : age > 7 ? 'text-amber-500' : 'text-green-500'}`}>({age} ngày)</span>;
                                        }
                                        return null;
                                      })()}
                                    </span>
                                  )}
                                  {project.sheet_row_index && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">Dòng {project.sheet_row_index}</span>}
                                </div>
                              </div>
                              <Badge variant="outline" className={`shrink-0 ${project.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' : project.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50' : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {project.status || 'Chưa có Status'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-3 space-y-3">
                            <div>
                              <p className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate" title={project.source_project_name || project.normalized_project_name}>
                                {project.source_project_name || project.normalized_project_name || "Dự án Không Tên"}
                              </p>
                              {project.store_code && (
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {project.store_code}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2 text-xs">
                              {project.plan_option && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-md font-medium border border-blue-100 dark:border-blue-800/50">
                                  <Tag className="w-3 h-3" /> {project.plan_option}
                                </span>
                              )}
                              {(project.progress_note_source || project.progress_note) && (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-md font-medium border border-purple-100 dark:border-purple-800/50">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                  {project.progress_note_source || project.progress_note}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Project Details Modal */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <KanbanSquare className="h-5 w-5 text-primary" />
                  {selectedProject.source_project_name || selectedProject.normalized_project_name || "Dự án Không Tên"}
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
                        <div className="text-xl font-bold break-words leading-tight text-primary">{selectedProject.source_key || selectedProject.request_id || "N/A"}</div>
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
                          {selectedProject.supplier || "Chưa phát hiện"}
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
                          {selectedProject.progress_note_source || selectedProject.progress_note || "Chưa rõ"}
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
