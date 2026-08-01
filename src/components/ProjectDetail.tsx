import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StoreManagerModal } from './StoreManager/StoreManagerModal';
import { ArrowLeft, Loader2, Mail, FileSpreadsheet, X, History as HistoryIcon, FolderUp, Store, Trash2, Layers, Scissors, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivityRow, ProjectGroup } from '@/types';
import { ActivityDetailCard } from './Dashboard/ActivityDetailCard';
import { StoreItemsList } from './Dashboard/StoreItemsList';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InDetailMergeModal } from './ProjectList/InDetailMergeModal';
import { InDetailSplitModal } from './ProjectList/InDetailSplitModal';

import { useDashboardStore } from '@/stores/useDashboardStore';

type PhaseType = 'BRIEF' | 'NTXX' | 'SURVEY' | 'INSTALLATION';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projectCode = decodeURIComponent(id || '');
  const { isAdmin } = useDashboardStore();

  const handleAdminAction = (actionFn: () => void) => {
    if (!isAdmin) {
      toast.error('🔒 Quyền bị từ chối: Vui lòng đăng nhập tài khoản Admin để thao tác!');
      return;
    }
    actionFn();
  };

  const [activePhaseModal, setActivePhaseModal] = useState<PhaseType | null>(null);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [downloadFileId, setDownloadFileId] = useState<string | undefined>();
  const [extractDefaultPhase, setExtractDefaultPhase] = useState<string | undefined>();
  const [headerPhaseFilter, setHeaderPhaseFilter] = useState<string>('ALL');

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const queryClient = useQueryClient();

  const { data: projectGroups, isLoading: isGroupsLoading, refetch: refetchActivities } = useQuery({
      queryKey: ['project_groups', projectCode],
      queryFn: async () => {
          const { data } = await supabase.from('project_activities').select('*, activity_attachments(*)').eq('final_project', projectCode);
          return data || [];
      }
  });

  const activities = projectGroups || [];

  const latestSyncFormatted = React.useMemo(() => {
      if (!activities || activities.length === 0) return null;
      const timestamps = activities.map((a: any) => a.created_at).filter(Boolean);
      if (timestamps.length === 0) return null;
      const latest = new Date(Math.max(...timestamps.map((t: string) => new Date(t).getTime())));
      const hh = String(latest.getHours()).padStart(2, '0');
      const mm = String(latest.getMinutes()).padStart(2, '0');
      const dd = String(latest.getDate()).padStart(2, '0');
      const month = String(latest.getMonth() + 1).padStart(2, '0');
      return `${hh}:${mm} ${dd}/${month}`;
  }, [activities]);

  const handleManualSyncGmail = async () => {
      try {
          setIsSyncingGmail(true);
          const toastId = toast.loading('Đang đồng bộ Gmail...');
          const { error } = await supabase.functions.invoke('cron-sync-gmail');
          await refetchActivities();
          queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
          toast.dismiss(toastId);
          if (error) {
              toast.error('Đồng bộ Gmail gặp sự cố: ' + error.message);
          } else {
              toast.success('Đã cập nhật dữ liệu Gmail mới nhất!');
          }
      } catch (err: any) {
          toast.error('Lỗi đồng bộ: ' + err.message);
      } finally {
          setIsSyncingGmail(false);
      }
  };
  
  const hasSurvey = activities.some(a => (a.phase_type || '').toUpperCase() === 'SURVEY' || (a.phase_type || '').toUpperCase() === 'KHAO_SAT');
  const hasInstall = activities.some(a => (a.phase_type || '').toUpperCase() === 'INSTALLATION' || (a.phase_type || '').toUpperCase() === 'LAP_DAT');
  const hasAccept = activities.some(a => (a.phase_type || '').toUpperCase() === 'ACCEPTANCE' || (a.phase_type || '').toUpperCase() === 'NTXX');

  const getPhaseCount = (phase: PhaseType) => {
      return activities.filter(a => {
          const p = (a.phase_type || '').toUpperCase();
          if (phase === 'BRIEF') return p === 'BRIEF';
          if (phase === 'NTXX') return p === 'ACCEPTANCE' || p === 'NTXX';
          if (phase === 'SURVEY') return p === 'SURVEY' || p === 'KHAO_SAT';
          if (phase === 'INSTALLATION') return p === 'INSTALLATION' || p === 'LAP_DAT';
          return false;
      }).length;
  };

  const projectGroupForExtract: ProjectGroup = {
      final_project: projectCode,
      activities: activities as ActivityRow[],
  };

  if (isGroupsLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0 && !isGroupsLoading) {
    return (
      <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-2 max-w-4xl text-center mb-4">
          Không tìm thấy dự án nào khớp với: {projectCode}
        </h2>
        <button onClick={() => navigate('/projects')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Quay lại Tổng dự án</button>
      </div>
    );
  }

  const PhaseButton = ({ label, count, onClick, phaseName }: { label: string, count: number, onClick: () => void, phaseName: string }) => {
      const isActive = headerPhaseFilter === phaseName;
      return (
          <button 
              onClick={() => {
                  setHeaderPhaseFilter(prev => prev === phaseName ? 'ALL' : phaseName);
                  onClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 border rounded-full transition-colors shadow-sm group whitespace-nowrap cursor-pointer ${
                  isActive 
                      ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold ring-2 ring-indigo-500/20'
                      : 'bg-secondary border-border hover:border-primary hover:text-primary'
              }`}
              title={`Click để lọc danh sách Cửa hàng theo giai đoạn ${label}`}
          >
              <span className={`text-xs ${isActive ? 'font-black text-indigo-700 dark:text-indigo-300' : 'font-semibold text-muted-foreground group-hover:text-primary'}`}>{label}</span>
              {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive ? 'bg-indigo-600 text-white' : 'bg-primary/10 text-primary'}`}>{count}</span>
              )}
          </button>
      );
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 pt-3 px-4 md:px-6 border-b border-border bg-card/80 backdrop-blur-md relative z-20 flex flex-col gap-3">
        {/* Navigation & Gmail Sync Status Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-semibold text-xs w-fit cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại Tổng dự án
          </button>

          {/* Gmail Sync Indicator */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Gmail Sync đang hoạt động" />
              <span>Gmail Sync: {latestSyncFormatted ? `Lần cuối ${latestSyncFormatted}` : 'Sẵn sàng'}</span>
              <button
                  onClick={handleManualSyncGmail}
                  disabled={isSyncingGmail}
                  className="ml-1 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors cursor-pointer flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400"
                  title="Kích hoạt đồng bộ Gmail ngay lập tức"
              >
                  <RefreshCw className={`w-3 h-3 ${isSyncingGmail ? 'animate-spin' : ''}`} />
                  {isSyncingGmail ? 'Đang sync...' : 'Sync ngay'}
              </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h1 className="text-base sm:text-lg font-bold text-foreground line-clamp-1 max-w-2xl leading-tight" title={projectCode}>
            {projectCode}
          </h1>
          
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setIsMergeModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer"
                  title="Gộp dự án này vào dự án khác (Admin)"
                >
                  <Layers className="w-3.5 h-3.5" /> Gộp Dự Án
                </button>

                <button 
                  onClick={() => setIsSplitModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer"
                  title="Tách hoạt động email sang dự án mới (Admin)"
                >
                  <Scissors className="w-3.5 h-3.5" /> Tách Dự Án
                </button>
              </>
            )}

            <button 
              onClick={() => {
                  setExtractDefaultPhase(undefined);
                  setShowExtractModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-semibold text-xs shadow-sm transition-opacity cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Trung tâm Xử lý Dữ liệu
            </button>
          </div>
        </div>

        {/* Phase Action Buttons */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto custom-scrollbar">
           <PhaseButton label="Brief" phaseName="Brief" count={getPhaseCount('BRIEF')} onClick={() => setActivePhaseModal('BRIEF')} />
           <PhaseButton label="NTXX" phaseName="NTXX" count={getPhaseCount('NTXX')} onClick={() => setActivePhaseModal('NTXX')} />
           <PhaseButton label="Khảo sát" phaseName="Khảo sát" count={getPhaseCount('SURVEY')} onClick={() => setActivePhaseModal('SURVEY')} />
           <PhaseButton label="Lắp đặt" phaseName="Lắp đặt" count={getPhaseCount('INSTALLATION')} onClick={() => setActivePhaseModal('INSTALLATION')} />
        </div>
      </div>

      {/* Main Content: Store List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar relative z-10 bg-background">
        <div className="max-w-[1600px] mx-auto w-full">
            <StoreItemsList 
                finalProjectName={projectCode} 
                hasSurvey={hasSurvey} 
                hasInstall={hasInstall} 
                hasAccept={hasAccept} 
                activities={activities as ActivityRow[]} 
                onlyPublished={true} 
                externalPhaseFilter={headerPhaseFilter}
            />
        </div>
      </div>
      
      {showExtractModal && (
        <StoreManagerModal 
            projectGroup={projectGroupForExtract}
            downloadFileId={downloadFileId}
            setDownloadFileId={setDownloadFileId}
            defaultPhase={extractDefaultPhase}
            onClose={() => {
                setShowExtractModal(false);
                setDownloadFileId(undefined);
                setExtractDefaultPhase(undefined);
            }}
        />
      )}

      {/* Phase Modal Overlay */}
      {activePhaseModal && (
        <PhaseModal 
          phase={activePhaseModal} 
          group={projectGroupForExtract} 
          onClose={() => setActivePhaseModal(null)} 
          onProcessData={(fileId) => {
            const defaultP = activePhaseModal === 'SURVEY' ? 'Khảo sát' : 
                            activePhaseModal === 'INSTALLATION' ? 'Lắp đặt' : 
                            activePhaseModal === 'NTXX' ? 'NTXX' : 'Brief';
            setActivePhaseModal(null);
            setDownloadFileId(fileId);
            setExtractDefaultPhase(defaultP);
            setShowExtractModal(true);
          }}
        />
      )}

      <InDetailMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        currentProjectKey={projectCode}
        onSuccess={(targetKey) => {
          queryClient.invalidateQueries({ queryKey: ['project_groups'] });
          navigate(`/project/${encodeURIComponent(targetKey)}`);
        }}
      />

      <InDetailSplitModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        currentProjectKey={projectCode}
        activities={activities as ActivityRow[]}
        onSuccess={(newKey) => {
          queryClient.invalidateQueries({ queryKey: ['project_groups'] });
          navigate(`/project/${encodeURIComponent(newKey)}`);
        }}
      />
    </div>
  );
}


function PhaseModal({ phase, group, onClose, onProcessData }: { phase: PhaseType, group: ProjectGroup, onClose: () => void, onProcessData: (fileId: string) => void }) {
  const [activeTab, setActiveTab] = useState<'emails' | 'history' | 'manual'>('emails');
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<{groupData: any, linkToRemove: string} | null>(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { data: logs = [] } = useQuery({
      queryKey: ['project_store_logs_phase', group.final_project, phase],
      queryFn: async () => {
          let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'NTXX' ? 'NTXX' : 'Brief';
          
          // Step 1: get store IDs for this project
          const { data: stores } = await supabase.from('project_store_items')
              .select('id, store_name')
              .eq('final_project', group.final_project);
              
          if (!stores || stores.length === 0) return [];
          
          const storeIds = stores.map(s => s.id);
          const storeMap = stores.reduce((acc, s) => { acc[s.id] = s.store_name; return acc; }, {} as Record<string, string>);

          // Step 2: query logs for these stores
          const { data } = await supabase.from('project_store_logs')
            .select('*')
            .in('store_item_id', storeIds)
            .eq('action_type', 'PHASE_UPDATE')
            .eq('field_name', phaseStr)
            .order('created_at', { ascending: false });
            
          return (data || []).map(log => ({
              ...log,
              store_name: storeMap[log.store_item_id] || 'Unknown Store'
          }));
      }
  });

  const { data: manualPhases = [] } = useQuery({
      queryKey: ['project_manual_files_phase', group.final_project, phase],
      queryFn: async () => {
          let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'NTXX' ? 'NTXX' : 'Brief';
          
          const { data: stores } = await supabase.from('project_store_items')
              .select('id, store_name, store_code')
              .eq('final_project', group.final_project);
              
          if (!stores || stores.length === 0) return [];
          const storeMap = stores.reduce((acc, s) => { acc[s.id] = { name: s.store_name, code: s.store_code }; return acc; }, {} as Record<string, {name: string, code: string}>);
          
          const { data } = await supabase.from('project_store_phases')
              .select('*')
              .in('store_item_id', stores.map(s => s.id))
              .eq('phase', phaseStr);
              
          if (!data) return [];
          return data.filter(p => p.proof_links && p.proof_links.length > 0).map(p => ({
              ...p,
              store_name: storeMap[p.store_item_id]?.name || 'Unknown',
              store_code: storeMap[p.store_item_id]?.code || 'Unknown'
          }));
      }
  });

  const groupedManualFiles = React.useMemo(() => {
      const groups = new Map<string, { stores: any[], links: string[] }>();
      manualPhases.forEach(mp => {
          const key = JSON.stringify(mp.proof_links);
          if (!groups.has(key)) {
              groups.set(key, { stores: [], links: mp.proof_links });
          }
          groups.get(key)!.stores.push(mp);
      });
      return Array.from(groups.values());
  }, [manualPhases]);

  const allManualFilesCount = manualPhases.reduce((acc, p) => acc + (p.proof_links?.length || 0), 0);

  const executeDeleteFile = async () => {
      if (!confirmDeleteFile) return;
      const { groupData, linkToRemove } = confirmDeleteFile;
      
      try {
          const getFileId = (url: string) => {
              const match = url.match(/[-\w]{25,}/);
              return match ? match[0] : null;
          };
          
          const fileId = getFileId(linkToRemove);
          if (fileId) {
              try {
                  const { error: fnError } = await supabase.functions.invoke('delete-from-drive', {
                      body: { file_id: fileId }
                  });
                  if (fnError) {
                      console.warn("Lỗi gọi Edge Function (xóa Drive):", fnError);
                  }
              } catch (e) {
                  console.warn("Edge Function chưa hoạt động hoặc lỗi:", e);
              }
          }

          const updates = groupData.stores.map((s: any) => {
              const newLinks = s.proof_links.filter((l: string) => l !== linkToRemove);
              return {
                  store_item_id: s.store_item_id,
                  phase: s.phase,
                  proof_links: newLinks
              };
          });

          const { error } = await supabase.from('project_store_phases').upsert(
              updates.map((u: any) => {
                  const original = groupData.stores.find((s: any) => s.store_item_id === u.store_item_id);
                  const { store_name, store_code, ...rest } = original;
                  return { ...rest, proof_links: u.proof_links };
              }), 
              { onConflict: 'store_item_id,phase' }
          );

          if (error) throw error;
          
          queryClient.invalidateQueries({ queryKey: ['project_manual_files_phase'] });
          queryClient.invalidateQueries({ queryKey: ['project_store_logs_phase'] });
          toast.success("Gỡ file thành công!");
      } catch (err: any) {
          toast.error("Lỗi: " + err.message);
      } finally {
          setConfirmDeleteFile(null);
      }
  };

  const handleDeleteFile = (groupData: any, linkToRemove: string) => {
      setConfirmDeleteFile({ groupData, linkToRemove });
  };

  const filteredEvents = group.activities.filter(a => {
      const p = (a.phase_type || '').toUpperCase();
      if (phase === 'BRIEF') return p === 'BRIEF';
      if (phase === 'NTXX') return p === 'ACCEPTANCE' || p === 'NTXX';
      if (phase === 'SURVEY') return p === 'SURVEY' || p === 'KHAO_SAT';
      if (phase === 'INSTALLATION') return p === 'INSTALLATION' || p === 'LAP_DAT';
      return false;
  });

  const phaseLabels: Record<PhaseType, string> = {
      'BRIEF': 'Brief Nhãn Hàng',
      'NTXX': 'Nghiệm thu Xuất xưởng (NTXX)',
      'SURVEY': 'Khảo sát',
      'INSTALLATION': 'Lắp đặt'
  };

  return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 rounded-lg">
                          <Mail className="w-5 h-5" />
                      </div>
                      <div>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">
                              Chi tiết Giai đoạn: {phaseLabels[phase]}
                          </h2>
                      </div>
                  </div>
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                  </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 shrink-0">
                  <button 
                      onClick={() => setActiveTab('emails')}
                      className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'emails' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      <Mail className="w-4 h-4" /> Luồng Email ({filteredEvents.length})
                  </button>
                  <button 
                      onClick={() => setActiveTab('manual')}
                      className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'manual' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      <FolderUp className="w-4 h-4" /> File Thủ công ({allManualFilesCount})
                  </button>
                  <button 
                      onClick={() => setActiveTab('history')}
                      className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      <HistoryIcon className="w-4 h-4" /> Lịch sử Truy vấn ({logs.length})
                  </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                  {activeTab === 'emails' && (
                      filteredEvents.length === 0 ? (
                          <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                              <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <h3 className="text-base font-bold text-slate-500">Chưa có email nào</h3>
                              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                  Giai đoạn này chưa có luồng email hoặc tài liệu đính kèm.
                              </p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {filteredEvents.map((event) => (
                                  <ActivityDetailCard key={event.id} activity={event} projectGroup={group} onProcessData={onProcessData} />
                              ))}
                          </div>
                      )
                  )}

                  {activeTab === 'manual' && (
                      manualPhases.length === 0 ? (
                          <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                              <FolderUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <h3 className="text-base font-bold text-slate-500">Chưa có file thủ công</h3>
                              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                  Giai đoạn này chưa có file chứng minh nào được upload thủ công từ Xử lý công việc.
                              </p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {groupedManualFiles.map((groupData, idx) => (
                                  <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                                      <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2 flex-wrap">
                                              <Store className="w-5 h-5 text-indigo-500" />
                                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                                  {groupData.stores.length === 1 ? groupData.stores[0].store_code : `${groupData.stores.length} cửa hàng`}
                                              </span>
                                              {groupData.stores.length === 1 && (
                                                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">- {groupData.stores[0].store_name}</span>
                                              )}
                                              {groupData.stores.length > 1 && (
                                                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-sm ml-2">
                                                      ({groupData.stores.map(s => s.store_code).join(', ')})
                                                  </span>
                                              )}
                                          </div>
                                          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md whitespace-nowrap">{groupData.links?.length || 0} file</span>
                                      </div>
                                      <div className="space-y-2">
                                          {groupData.links?.map((link: string, i: number) => (
                                              <div key={i} className="flex items-center gap-2 group/link">
                                                  <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 block text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 p-2 rounded truncate transition-colors">
                                                      📎 {link}
                                                  </a>
                                                  <button 
                                                      onClick={() => handleDeleteFile(groupData, link)}
                                                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg opacity-0 group-hover/link:opacity-100 transition-all cursor-pointer"
                                                      title="Xóa file này"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )
                  )}

                  {activeTab === 'history' && (
                      logs.length === 0 ? (
                          <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                              <HistoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <h3 className="text-base font-bold text-slate-500">Chưa có lịch sử</h3>
                              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                  Giai đoạn này chưa có bất kỳ cập nhật tiến độ nào từ người dùng.
                              </p>
                          </div>
                      ) : (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                              <div className="overflow-y-auto custom-scrollbar p-0">
                                  <table className="w-full text-left border-collapse">
                                      <thead className="bg-slate-50 dark:bg-slate-950/50">
                                          <tr>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Thời gian</th>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Store</th>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Hành động</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {logs.map(log => (
                                              <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                  <td className="p-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                      {new Date(log.created_at).toLocaleString('vi-VN')}
                                                  </td>
                                                  <td className="p-3 text-xs">
                                                      <span className="font-bold text-indigo-600 dark:text-indigo-400 block">{log.store_code}</span>
                                                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">{log.store_name}</span>
                                                  </td>
                                                  <td className="p-3 text-xs text-slate-700 dark:text-slate-300">
                                                      <span className="font-semibold block mb-1">{log.field_name}</span>
                                                      <FormattedLogValue value={log.new_value} />
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )
                  )}
              </div>
          </div>
          <ConfirmDialog 
              isOpen={!!confirmDeleteFile}
              onClose={() => setConfirmDeleteFile(null)}
              onConfirm={executeDeleteFile}
              title="Xác nhận gỡ file"
              description="Bạn có chắc chắn muốn gỡ file này? Hệ thống sẽ gỡ liên kết và đồng thời xóa file gốc trên Google Drive. Dữ liệu không thể khôi phục."
              confirmText="Xóa file"
              isDestructive={true}
          />
      </div>
  );
}

function FormattedLogValue({ value }: { value: string }) {
    if (!value || typeof value !== 'string') return <span>{value}</span>;
    
    const isSystemUpdate = value.includes('Kế hoạch:') || value.includes('KQ:');
    if (!isSystemUpdate) {
        return <span>{value}</span>;
    }

    const parts = value.split(', ').reduce((acc, part) => {
        const [k, ...v] = part.split(': ');
        if (k && v.length) acc[k] = v.join(': ');
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {parts['Kế hoạch'] && parts['Kế hoạch'] !== '? - ?' && (
                <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                    Kế hoạch: {parts['Kế hoạch']}
                </span>
            )}
            {parts['Thực tế'] && parts['Thực tế'] !== '?' && (
                <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-medium border border-blue-200 dark:border-blue-800/50">
                    Thực tế: {parts['Thực tế']}
                </span>
            )}
            {parts['KQ'] && parts['KQ'] !== '?' && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    parts['KQ'] === 'pass' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800/50 dark:text-emerald-400' :
                    parts['KQ'] === 'fail' ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:border-rose-800/50 dark:text-rose-400' :
                    'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                    {parts['KQ'] === 'pass' ? 'Kết quả: Đạt' : parts['KQ'] === 'fail' ? 'Kết quả: Lỗi' : `Kết quả: ${parts['KQ']}`}
                </span>
            )}
            {parts['Files'] && (
                <span className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-medium border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-1 shadow-sm">
                    <FolderUp className="w-3 h-3" /> {parts['Files']} file
                </span>
            )}
        </div>
    );
}
