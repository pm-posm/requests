import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const Analytics = React.lazy(() => import('./Analytics'));
const TrackingProject = React.lazy(() => import('./TrackingProject'));
import NewRequestForm from './NewRequestForm';
import StoreLookup from './StoreLookup';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';
const Personalization = React.lazy(() => import('./Personalization'));
const ProjectDetail = React.lazy(() => import('./ProjectDetail'));
const ModelTest = React.lazy(() => import('./ModelTest'));
const TrackingInstallation = React.lazy(() => import('./TrackingInstallation'));
const TrackingNtxx = React.lazy(() => import('./TrackingNtxx'));
import { StoreContactPage } from '../pages/StoreContactPage';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardStoreList } from './Dashboard/DashboardStoreList';
import { DashboardOverview } from './Dashboard/DashboardOverview';
import { DashboardStoreView } from './Dashboard/DashboardStoreView';
import { ProjectDetailModal } from './Dashboard/ProjectDetailModal';

export default function Dashboard() {
  const { 
    searchTerm, setSearchTerm, 
    isAdmin, setIsAdmin,
    isNewRequestOpen, setIsNewRequestOpen,
    mainMenu, setMainMenu,
    requestMenu, setRequestMenu,
    setSelectedStore, kanbanFilter, setKanbanFilter
  } = useDashboardStore();

  const { isLoading, filteredProjects } = useDashboardData();

  const [isStoreLookupOpen, setIsStoreLookupOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = React.useState(false);
  
  const queryClient = useQueryClient();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-mer-view');
      if (error) throw error;
      alert(data.message || 'Đồng bộ thành công!');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      console.error('Lỗi đồng bộ:', error);
      alert('Lỗi đồng bộ: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncGmail = async () => {
    try {
      setIsSyncingGmail(true);
      const { data, error } = await supabase.functions.invoke('cron-sync-gmail');
      if (error) throw error;
      alert(data.message + ` (Đã cào ${data.processed} email mới, Bỏ qua ${data.skipped} email cũ)`);
      queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
    } catch (error: any) {
      console.error('Lỗi đồng bộ Gmail:', error);
      alert('Lỗi đồng bộ Gmail: ' + error.message);
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      setShowAdminConfirm(true);
    } else {
      const pwd = prompt("Nhập mật khẩu Admin để hiển thị tính năng ẩn:");
      if (pwd === "admin123") {
        setIsAdmin(true);
      } else if (pwd !== null) {
        alert("Sai mật khẩu!");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-background font-sans text-foreground overflow-hidden selection:bg-primary/30">
      
      <Sidebar 
        mainMenu={mainMenu} setMainMenu={setMainMenu}
        requestMenu={requestMenu} setRequestMenu={setRequestMenu}
        setSelectedStore={setSelectedStore}
        setIsNewRequestOpen={setIsNewRequestOpen}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
        <Topbar 
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          isAdmin={isAdmin} isSyncing={isSyncing} isSyncingGmail={isSyncingGmail}
          handleSync={handleSync} handleSyncGmail={handleSyncGmail} handleAdminToggle={handleAdminToggle}
          setIsMobileOpen={setIsMobileOpen}
        />

        <div className="flex-1 overflow-hidden relative">
          <React.Suspense fallback={
            <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          }>
            <Routes>
              <Route path="/project/:id/*" element={<ProjectDetail />} />
              <Route path="/" element={
                <>
                  {mainMenu === 'analytics' ? (
                    <div className="absolute inset-0 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background">
                      <div className="max-w-7xl mx-auto">
                        <Analytics 
                          projects={filteredProjects || []} 
                          activeFilter={kanbanFilter} 
                          onFilterChange={setKanbanFilter} 
                          viewMode="charts"
                        />
                      </div>
                    </div>
                  ) : mainMenu === 'tong_du_an' ? (
                    <div className="absolute inset-0 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background">
                      <div className="max-w-7xl mx-auto">
                        <TrackingProject searchTerm={searchTerm} />
                      </div>
                    </div>
                  ) : mainMenu === 'personalization' ? (
                    <div className="absolute inset-0 p-0 overflow-y-auto custom-scrollbar bg-background">
                      <Personalization globalSearchTerm={searchTerm} />
                    </div>
                  ) : mainMenu === 'model_test' ? (
                    <div className="absolute inset-0 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background">
                      <div className="max-w-7xl mx-auto">
                        <ModelTest />
                      </div>
                    </div>
                  ) : mainMenu === 'tracking_installation' ? (
                    <div className="absolute inset-0 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background">
                      <div className="max-w-7xl mx-auto">
                        <TrackingInstallation />
                      </div>
                    </div>
                  ) : mainMenu === 'tracking_ntxx' ? (
                    <div className="absolute inset-0 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-background">
                      <div className="max-w-7xl mx-auto">
                        <TrackingNtxx />
                      </div>
                    </div>
                  ) : mainMenu === 'store_contact' ? (
                    <StoreContactPage />
                  ) : mainMenu === 'request' && requestMenu === 'store_list' ? (
                    <DashboardStoreList />
                  ) : mainMenu === 'request' && requestMenu === 'overview' ? (
                    <DashboardOverview />
                  ) : mainMenu === 'request' && requestMenu === 'store_view' ? (
                    <DashboardStoreView />
                  ) : null}
                </>
              } />
            </Routes>
          </React.Suspense>
        </div>
        <ConfirmDialog 
            isOpen={showAdminConfirm}
            onClose={() => setShowAdminConfirm(false)}
            onConfirm={() => setIsAdmin(false)}
            title="Thoát chế độ Admin"
            description="Bạn có chắc chắn muốn thoát chế độ Admin? Bạn sẽ cần nhập lại mật khẩu để vào lại."
            confirmText="Đồng ý thoát"
        />
      </main>

      <ProjectDetailModal />
      
      <StoreLookup open={isStoreLookupOpen} onOpenChange={setIsStoreLookupOpen} />
      <NewRequestForm open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen} />

    </div>
  );
}
