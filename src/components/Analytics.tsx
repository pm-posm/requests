import React, { useMemo } from 'react';
import { type Project } from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { KanbanSquare, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

export type FilterType = 'all' | 'approved' | 'in_progress' | 'cancelled' | 'completed_progress';

interface AnalyticsProps {
  projects: Project[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  viewMode?: 'stats' | 'charts' | 'all';
}

export default function Analytics({ projects, activeFilter, onFilterChange, viewMode = 'all' }: AnalyticsProps) {
  const [showCharts, setShowCharts] = React.useState(false);
  const [chartDetail, setChartDetail] = React.useState<{ title: string; data: Project[] } | null>(null);

  const stats = useMemo(() => {
    const total = projects.length;
    
    const isCompleted = (note: string) => note.includes('hoàn thành') || note.includes('hoàn tất') || note.includes('xong');
    const isCancelled = (p: Project) => {
      if (p.status === 'Cancelled' || p.status === 'Rejected') return true;
      const note = (p.progress_note_source || p.progress_note || '').toLowerCase();
      return note.includes('cancel') || note.includes('hủy') || note.includes('từ chối') || note.includes('reject');
    };

    const cancelled = projects.filter(p => isCancelled(p)).length;
    
    // Đã thi công xong (không tính Bị hủy)
    const completedProgressList = projects.filter(p => {
      if (isCancelled(p)) return false;
      const note = (p.progress_note_source || '').toLowerCase();
      return isCompleted(note);
    });
    const completedProgress = completedProgressList.length;

    // Đang xử lý (Không bị hủy và chưa xong)
    const inProgressList = projects.filter(p => {
      if (isCancelled(p)) return false;
      const note = (p.progress_note_source || '').toLowerCase();
      return !isCompleted(note);
    });
    const inProgress = inProgressList.length;

    // Status distribution
    const statusGroups: Record<string, Project[]> = {};
    projects.forEach(p => {
      const status = p.status || 'New';
      if (!statusGroups[status]) statusGroups[status] = [];
      statusGroups[status].push(p);
    });
    const statusData = Object.keys(statusGroups).map(key => ({
      name: key,
      value: statusGroups[key].length,
      projects: statusGroups[key]
    })).sort((a, b) => b.value - a.value);

    // Supplier distribution
    const supplierGroups: Record<string, Project[]> = {};
    projects.forEach(p => {
      const supplier = p.supplier?.trim();
      if (supplier && supplier !== '-' && supplier !== 'Chưa rõ') {
        if (!supplierGroups[supplier]) supplierGroups[supplier] = [];
        supplierGroups[supplier].push(p);
      }
    });
    const supplierData = Object.keys(supplierGroups).map(key => ({
      name: key,
      value: supplierGroups[key].length,
      projects: supplierGroups[key]
    })).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10

    // Progress distribution
    const progressGroups: Record<string, Project[]> = {};
    projects.forEach(p => {
      let prog = p.progress_note_source?.trim() || 'Chưa cập nhật';
      // Gom nhóm cơ bản để bớt rác
      if (prog.toLowerCase().includes('hoàn thành') || prog.toLowerCase().includes('xong')) prog = 'Đã hoàn thành';
      else if (prog.toLowerCase().includes('đang thi công') || prog.toLowerCase().includes('đang xử lý')) prog = 'Đang thi công';
      else if (prog.length > 30) prog = 'Khác (Chi tiết dài)';
      
      if (!progressGroups[prog]) progressGroups[prog] = [];
      progressGroups[prog].push(p);
    });
    const progressData = Object.keys(progressGroups).map(key => ({
      name: key,
      value: progressGroups[key].length,
      projects: progressGroups[key]
    })).sort((a, b) => b.value - a.value).slice(0, 6);

    return { total, cancelled, inProgress, completedProgress, statusData, supplierData, progressData };
  }, [projects]);

  return (
    <div className={viewMode === 'all' ? "p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/20" : ""}>
      {(viewMode === 'stats' || viewMode === 'all') && (
        <div className="flex flex-wrap gap-2">
        <button 
          className={`flex-1 min-w-[120px] p-2 rounded-lg border text-left transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${activeFilter === 'all' ? 'ring-2 ring-primary bg-primary/5 border-primary/20' : 'border-slate-200 dark:border-slate-800'}`}
          onClick={() => onFilterChange('all')}
        >
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><KanbanSquare className="w-3 h-3"/> Tổng dự án</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </button>
        <button 
          className={`flex-1 min-w-[120px] p-2 rounded-lg border text-left transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${activeFilter === 'in_progress' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200' : 'border-slate-200 dark:border-slate-800'}`}
          onClick={() => onFilterChange('in_progress')}
        >
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500"/> Đang xử lý</div>
          <div className="text-xl font-bold text-blue-600">{stats.inProgress}</div>
        </button>
        <button 
          className={`flex-1 min-w-[120px] p-2 rounded-lg border text-left transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${activeFilter === 'cancelled' ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20 border-red-200' : 'border-slate-200 dark:border-slate-800'}`}
          onClick={() => onFilterChange('cancelled')}
        >
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500"/> Bị hủy / Từ chối</div>
          <div className="text-xl font-bold text-red-600">{stats.cancelled}</div>
        </button>
        <button 
          className={`flex-1 min-w-[120px] p-2 rounded-lg border text-left transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${activeFilter === 'completed_progress' ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200' : 'border-slate-200 dark:border-slate-800'}`}
          onClick={() => onFilterChange('completed_progress')}
        >
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-purple-500"/> Thi công xong</div>
          <div className="text-xl font-bold text-purple-600">{stats.completedProgress}</div>
        </button>
      </div>
      )}

      {(viewMode === 'charts' || viewMode === 'all') && (
        <div className={`grid grid-cols-1 ${viewMode === 'charts' ? 'lg:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3'} gap-4 pt-2`}>
        <Card className="col-span-1 shadow-sm">
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-xs text-slate-500 uppercase font-bold tracking-wider">Phân bổ Trạng Thái</CardTitle>
          </CardHeader>
          <CardContent className="h-48 pb-2 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => (percent || 0) > 0.05 ? `${name} (${((percent || 0) * 100).toFixed(0)}%)` : ''}
                  outerRadius={55}
                  innerRadius={30}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                  onClick={(data) => {
                    setChartDetail({
                      title: `Trạng thái: ${data.name}`,
                      data: data.payload.projects || []
                    });
                  }}
                  className="cursor-pointer"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-xs text-slate-500 uppercase font-bold tracking-wider">Tiến độ thi công</CardTitle>
          </CardHeader>
          <CardContent className="h-48 pb-2 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.progressData} layout="vertical" margin={{ top: 0, right: 10, left: 100, bottom: 0 }} style={{ fontFamily: 'var(--font-sans)' }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontFamily: 'var(--font-sans)'}} />
                <Tooltip contentStyle={{ fontFamily: 'var(--font-sans)' }} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar 
                  dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16}
                  onClick={(data: any) => {
                    setChartDetail({
                      title: `Tiến độ: ${data.name}`,
                      data: data.payload.projects || data.projects || []
                    });
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-xs text-slate-500 uppercase font-bold tracking-wider">Top Nhà cung cấp</CardTitle>
          </CardHeader>
          <CardContent className="h-48 pb-2 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.supplierData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }} style={{ fontFamily: 'var(--font-sans)' }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fontFamily: 'var(--font-sans)'}} />
                <Tooltip contentStyle={{ fontFamily: 'var(--font-sans)' }} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar 
                  dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} 
                  onClick={(data: any) => {
                    setChartDetail({
                      title: `Nhà cung cấp: ${data.name}`,
                      data: data.payload.projects || data.projects || []
                    });
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Chart Detail Modal */}
      <Dialog open={!!chartDetail} onOpenChange={(open) => !open && setChartDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              {chartDetail?.title}
            </DialogTitle>
            <DialogDescription>
              Đang hiển thị {chartDetail?.data.length} dự án
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-3">
            {chartDetail?.data.map((project) => (
              <div key={project.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 hover:border-primary/40 transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm text-primary">{project.request_id || project.source_key || project.source_project_name || "Unknown"}</h4>
                  {project.sheet_row_index && <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium text-slate-600 dark:text-slate-300">Dòng {project.sheet_row_index}</span>}
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm mb-1">{project.store_name || "Cửa hàng không tên"}</p>
                {project.store_code && (
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {project.store_code}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {project.status && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
                      Trạng thái: {project.status}
                    </span>
                  )}
                  {project.supplier && project.supplier !== '-' && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      NCC: {project.supplier}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
