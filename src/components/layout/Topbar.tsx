import React, { useState } from 'react';
import { Search, Loader2, RefreshCw, Settings, Menu, Bell, User, MoreVertical, Link2, ShieldCheck } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import toast from 'react-hot-toast';

interface TopbarProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  isAdmin: boolean;
  isSyncing: boolean;
  handleSync: () => void;
  isSyncingGmail?: boolean;
  handleSyncGmail?: () => void;
  handleAdminToggle: () => void;
  setIsMobileOpen: (v: boolean) => void;
}

export function Topbar({
  searchTerm, setSearchTerm, isAdmin, isSyncing, handleSync, isSyncingGmail, handleSyncGmail, handleAdminToggle, setIsMobileOpen
}: TopbarProps) {
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const { mainMenu, requestMenu } = useDashboardStore();

  // Generate breadcrumb
  const getBreadcrumb = () => {
    let title = '';
    switch(mainMenu) {
      case 'analytics': title = 'Dashboard'; break;
      case 'request': 
        title = 'Xử lý Request';
        if (requestMenu === 'overview') title += ' / Tất cả request';
        if (requestMenu === 'store_list') title += ' / Cửa hàng liên quan';
        break;
      case 'tong_du_an': title = 'Tổng hợp dự án'; break;
      case 'model_test': title = 'Bảng kế hoạch'; break;
      case 'tracking_installation': title = 'Theo dõi Lắp đặt'; break;
      case 'personalization': title = 'Việc của tôi'; break;
      case 'store_contact': title = 'Danh bạ Cửa hàng'; break;
      default: title = 'Trang chủ';
    }
    return title;
  };

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4 flex items-center justify-between gap-4 z-10 sticky top-0">
      
      {/* Left side: Mobile menu & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button 
          className="p-1.5 md:hidden text-muted-foreground hover:text-foreground rounded-md"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:flex text-[13px] font-medium text-muted-foreground">
          {getBreadcrumb()}
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-lg">
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án, cửa hàng (⌘K)..." 
            className="w-full pl-8 pr-4 py-1.5 bg-secondary hover:bg-secondary/80 border border-transparent focus:bg-background focus:border-border focus:ring-2 focus:ring-primary/20 rounded-lg text-sm outline-none transition-all placeholder:text-muted-foreground"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Right side: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {isAdmin && (
          <div className="relative">
            <button 
              onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
            >
              {(isSyncing || isSyncingGmail) ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden lg:inline">Đồng bộ</span>
            </button>
            
            {isSyncMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSyncMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
                  <button 
                    onClick={() => { handleSync(); setIsSyncMenuOpen(false); }}
                    disabled={isSyncing}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Master Data (Sheets)
                  </button>
                  <button 
                    onClick={() => { handleSyncGmail?.(); setIsSyncMenuOpen(false); }}
                    disabled={isSyncingGmail}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSyncingGmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Cào Email (2 ngày)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success('📋 Đã sao chép đường dẫn chia sẻ!');
          }} 
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 rounded-lg text-xs font-bold transition-all border border-sky-200 dark:border-sky-800 cursor-pointer" 
          title="Sao chép đường dẫn trực tiếp màn hình này"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Copy Link</span>
        </button>

        {isAdmin ? (
          <button 
            onClick={handleAdminToggle} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer"
            title="Quyền Quản Trị Admin đang hoạt động. Bấm để đăng xuất."
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Admin Active</span>
          </button>
        ) : (
          <button 
            onClick={handleAdminToggle} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            title="Bấm để đăng nhập tài khoản Admin Quản Trị"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Đăng Nhập Admin</span>
          </button>
        )}

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        <button className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full border border-card" />
        </button>
        
        <button className="flex items-center gap-2 p-1 pl-2 hover:bg-secondary rounded-lg transition-colors">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
            A
          </div>
        </button>
      </div>
    </header>
  );
}
