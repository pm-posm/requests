import React from 'react';
import { Store, MapPin, User, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import * as XLSX from 'xlsx';

export function DashboardStoreView() {
  const { selectedStore, setSelectedProject } = useDashboardStore();
  const { srViewProjects, getStoreData } = useDashboardData();

  const handleExportExcel = () => {
    if (!selectedStore || srViewProjects.length === 0) return;

    const exportData = srViewProjects.map((p, index) => ({
      "STT": index + 1,
      "Store Name": p.store_name || "",
      "Store Code": p.store_code || "",
      "Mã Dự Án": p.source_key || p.request_id || "",
      "Tên Dự Án": p.source_project_name || p.normalized_project_name || "",
      "Ngày Yêu Cầu": p.request_date || "",
      "Trạng Thái": p.status || "New",
      "Tiến Độ": p.progress_note_source || p.progress_note || "",
      "Supplier": p.supplier || "",
      "MER": p.mer || "",
      "SR": p.sr || "",
      "Timeline": p.timeline || "",
      "Phương Án": p.plan_option || "",
      "Ghi chú VIS": p.vis_note || "",
      "Ghi chú SR": p.sr_note || "",
      "Responser": p.data_responser || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Requests");
    
    const safeStoreName = selectedStore.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `BaoCao_${safeStoreName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!selectedStore) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-slate-900">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-start justify-between">
        <div>
          {(() => {
            const activeStoreData = getStoreData(selectedStore);
            return (
              <>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                  <Store className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">{activeStoreData?.["REGION"] || 'Chưa rõ Region'}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedStore}</h2>
                {activeStoreData && (
                  <div className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {activeStoreData["ADDRESS"] && (
                      <div className="flex items-start gap-2 max-w-2xl">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">
                          {activeStoreData["ADDRESS"]} 
                          {activeStoreData["WARD"] ? `, ${activeStoreData["WARD"]}` : ''} 
                          {activeStoreData["DISTRICT"] ? `, ${activeStoreData["DISTRICT"]}` : ''} 
                          {activeStoreData["PROVINCE"] ? `, ${activeStoreData["PROVINCE"]}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
                      {activeStoreData["MER NAME"] && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>MER: <strong className="text-slate-900 dark:text-slate-100">{activeStoreData["MER NAME"]}</strong></span>
                        </div>
                      )}
                      {activeStoreData["CUSTOMER"] && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0"></span>
                          <span>Customer: <strong className="text-slate-900 dark:text-slate-100">{activeStoreData["CUSTOMER"]}</strong></span>
                        </div>
                      )}
                      {activeStoreData["KA"] && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0"></span>
                          <span>KA: <strong className="text-slate-900 dark:text-slate-100">{activeStoreData["KA"]}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <button 
          onClick={handleExportExcel}
          className="flex shrink-0 items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-lg text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:shadow mt-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Tải Excel
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {srViewProjects.map((project) => (
            <Card 
              key={project.id} 
              onClick={() => setSelectedProject(project)}
              className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
            >
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug flex-1 mr-2" title={project.source_project_name || project.normalized_project_name || "Dự án Không Tên"}>
                    {project.source_project_name || project.normalized_project_name || "Dự án Không Tên"}
                  </CardTitle>
                  <Badge variant="outline" className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${project.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' : project.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent'}`}>
                    {project.status || 'New'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                    Mã DA: {project.source_key || (project as any)?.project_code || 'N/A'}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                    Req ID: {project.request_id || 'N/A'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3 flex-1 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  {project.plan_option && (
                    <span className="inline-flex items-start gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-md max-w-full">
                      <Tag className="w-3 h-3 mt-0.5 shrink-0" /> 
                      <span className="line-clamp-2 whitespace-normal break-words leading-tight">{project.plan_option}</span>
                    </span>
                  )}
                  {(project.progress_note_source || project.progress_note) && (
                    <span className="inline-flex items-start gap-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-md max-w-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1 shrink-0"></div>
                      <span className="line-clamp-2 whitespace-normal break-words leading-tight">{project.progress_note_source || project.progress_note}</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {srViewProjects.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              Không có request nào trong cửa hàng này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
