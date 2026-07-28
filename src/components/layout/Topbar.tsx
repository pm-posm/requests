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

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors relative" title="Thông báo">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full border border-card" />
        </button>
        
        {/* User Avatar Circle - Bấm để đăng nhập/đăng xuất Admin */}
        <button 
          onClick={handleAdminToggle}
          className="relative flex items-center gap-2 p-1 hover:bg-secondary rounded-full transition-colors cursor-pointer"
          title={isAdmin ? "Tài khoản Admin Quản Trị đang hoạt động. Bấm để đăng xuất." : "Bấm để đăng nhập tài khoản Admin Quản Trị"}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
            isAdmin 
              ? 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400/30' 
              : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
          }`}>
            {isAdmin ? <ShieldCheck className="w-4 h-4 text-white" /> : 'A'}
          </div>
          {isAdmin && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          )}
        </button>
      </div>
    </header>
  );
}
