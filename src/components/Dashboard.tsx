import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, checkIsAdminUser } from '@/lib/supabase';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import toast from 'react-hot-toast';

import Analytics from './Analytics';
import ModelTest from './ModelTest';
const TrackingProject = React.lazy(() => import('./TrackingProject'));
import NewRequestForm from './NewRequestForm';
import StoreLookup from './StoreLookup';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';
const Personalization = React.lazy(() => import('./Personalization'));
const ProjectDetail = React.lazy(() => import('./ProjectDetail'));
const TrackingInstallation = React.lazy(() => import('./TrackingInstallation'));
const TrackingNtxx = React.lazy(() => import('./TrackingNtxx'));
const TrackingWarranty = React.lazy(() => import('./TrackingWarranty'));
import { StoreContactPage } from '../pages/StoreContactPage';
import { StorePlanBoardPage } from '../pages/StorePlanBoardPage';
import { UnderDevelopment } from './UnderDevelopment';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardStoreList } from './Dashboard/DashboardStoreList';
import { DashboardOverview } from './Dashboard/DashboardOverview';
import { DashboardStoreView } from './Dashboard/DashboardStoreView';
import { ProjectDetailModal } from './Dashboard/ProjectDetailModal';
import { AuthModal } from '@/components/AuthModal';

function DashboardStoreViewRouteWrapper() {
  const { storeCode } = useParams<{ storeCode: string }>();
  const setSelectedStore = useDashboardStore(state => state.setSelectedStore);
  const setRequestMenu = useDashboardStore(state => state.setRequestMenu);

  React.useEffect(() => {
    if (storeCode) {
      setSelectedStore(decodeURIComponent(storeCode));
      setRequestMenu('store_view');
    }
  }, [storeCode, setSelectedStore, setRequestMenu]);

  return <DashboardStoreView />;
}

export default function Dashboard() {
  const searchTerm = useDashboardStore(s => s.searchTerm);
  const setSearchTerm = useDashboardStore(s => s.setSearchTerm);
  const isAdmin = useDashboardStore(s => s.isAdmin);
  const setIsAdmin = useDashboardStore(s => s.setIsAdmin);
  const setAuthUser = useDashboardStore(s => s.setAuthUser);
  const isNewRequestOpen = useDashboardStore(s => s.isNewRequestOpen);
  const setIsNewRequestOpen = useDashboardStore(s => s.setIsNewRequestOpen);
  const mainMenu = useDashboardStore(s => s.mainMenu);
  const setMainMenu = useDashboardStore(s => s.setMainMenu);
  const requestMenu = useDashboardStore(s => s.requestMenu);
  const setRequestMenu = useDashboardStore(s => s.setRequestMenu);
  const setSelectedStore = useDashboardStore(s => s.setSelectedStore);
  const kanbanFilter = useDashboardStore(s => s.kanbanFilter);
  const setKanbanFilter = useDashboardStore(s => s.setKanbanFilter);

  const { isLoading, filteredProjects } = useDashboardData();

  const [isStoreLookupOpen, setIsStoreLookupOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  
  const queryClient = useQueryClient();

  // Listen to Supabase Auth State Changes for secure session & role management
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || '';
        const isAdminUser = checkIsAdminUser(session.user);
        setAuthUser({ id: session.user.id, email, role: isAdminUser ? 'admin' : 'user' });
        setIsAdmin(isAdminUser);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || '';
        const isAdminUser = checkIsAdminUser(session.user);
        setAuthUser({ id: session.user.id, email, role: isAdminUser ? 'admin' : 'user' });
        setIsAdmin(isAdminUser);
      } else {
        setAuthUser(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setAuthUser, setIsAdmin]);

  const handleSync = React.useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-mer-view');
      if (error) throw error;
      toast.success(data.message || 'Đồng bộ thành công!');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      console.error('Lỗi đồng bộ:', error);
      toast.error('Lỗi đồng bộ: ' + (error.message || 'Đồng bộ thất bại'));
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  const handleSyncGmail = React.useCallback(async () => {
    try {
      setIsSyncingGmail(true);
      const { data, error } = await supabase.functions.invoke('cron-sync-gmail');
      if (error) throw error;
      toast.success(data.message + ` (Đã cào ${data.processed} email mới, Bỏ qua ${data.skipped} email cũ)`);
      queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
    } catch (error: any) {
      console.error('Lỗi đồng bộ Gmail:', error);
      toast.error('Lỗi đồng bộ Gmail: ' + (error.message || 'Thất bại'));
    } finally {
      setIsSyncingGmail(false);
    }
  }, [queryClient]);

  const handleAdminToggle = React.useCallback(() => {
    if (isAdmin) {
      setShowAdminConfirm(true);
    } else {
      setIsAuthModalOpen(true);
    }
  }, [isAdmin]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <span className="text-xs font-mono text-slate-400">Đang tải dữ liệu Dashboard...</span>
        </div>
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
              {/* Active Operations & Tracking Routes */}
              <Route path="/tracking/warranty" element={
                <div className="absolute inset-0 p-2.5 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar bg-background">
                  <div className="w-full max-w-[1920px] mx-auto">
                    <TrackingWarranty />
                  </div>
                </div>
              } />

              <Route path="/tracking/installation" element={
                <div className="absolute inset-0 p-2.5 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar bg-background">
                  <div className="w-full max-w-[1920px] mx-auto">
                    <TrackingInstallation />
                  </div>
                </div>
              } />

              {/* Active Contacts / Master Stores Route */}
              <Route path="/contacts" element={<StoreContactPage />} />

              {/* Locked / Features Under Development */}
              <Route path="/tracking/ntxx" element={<UnderDevelopment title="Nghiệm thu Xuất xưởng" description="Tính năng Nghiệm thu Xuất xưởng đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/analytics" element={<UnderDevelopment title="Dashboard Báo Cáo" description="Tính năng Báo cáo & Thống kê tổng quan đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/requests" element={<UnderDevelopment title="Xử lý Request" description="Tính năng Xử lý Request đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/requests/*" element={<UnderDevelopment title="Xử lý Request" description="Tính năng Xử lý Request đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/projects" element={<UnderDevelopment title="Tổng hợp dự án" description="Tính năng Tổng hợp dự án đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/project/*" element={<UnderDevelopment title="Chi tiết dự án" description="Tính năng Chi tiết dự án đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />
              <Route path="/store-plan" element={<UnderDevelopment title="Bảng kế hoạch" description="Tính năng Bảng kế hoạch đang trong quá trình phát triển và sẽ hoạt động trong tương lai." />} />

              {/* Default Fallback Redirects */}
              <Route path="/" element={<Navigate to="/tracking/warranty" replace />} />
              <Route path="*" element={<Navigate to="/tracking/warranty" replace />} />
            </Routes>
          </React.Suspense>
        </div>
      </main>

      <ProjectDetailModal />

      <NewRequestForm 
        open={isNewRequestOpen}
        onOpenChange={setIsNewRequestOpen}
      />

      <StoreLookup 
        open={isStoreLookupOpen}
        onOpenChange={setIsStoreLookupOpen}
      />

      <ConfirmDialog 
        isOpen={showAdminConfirm}
        onClose={() => setShowAdminConfirm(false)}
        onConfirm={async () => {
          await supabase.auth.signOut();
          setIsAdmin(false);
          setAuthUser(null);
          setShowAdminConfirm(false);
        }}
        title="Đăng xuất chế độ Admin?"
        description="Phiên làm việc của Admin sẽ được đăng xuất an toàn khỏi Supabase."
        confirmText="Đăng xuất Admin"
      />

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </div>
  );
}
