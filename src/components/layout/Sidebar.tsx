import React from 'react';
import { 
  BarChart3, Inbox, FolderOpen, PanelLeftClose, PanelLeftOpen, 
  ListTodo, KanbanSquare, ClipboardCheck, BookUser, 
  Briefcase, Search, Settings, ChevronRight, Menu, X, Rocket, Factory, ShieldCheck, Lock
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

interface SidebarProps {
  mainMenu: string;
  setMainMenu: (v: any) => void;
  requestMenu: string;
  setRequestMenu: (v: any) => void;
  setSelectedStore: (v: string | null) => void;
  setIsNewRequestOpen: (v: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
}

const ALLOWED_PATHS = ['/tracking/warranty', '/contacts'];

export function Sidebar({
  mainMenu, setMainMenu, requestMenu, setRequestMenu, setSelectedStore, setIsNewRequestOpen, isMobileOpen, setIsMobileOpen
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const handleRouteClick = (path: string, menuKey?: string) => {
    const isAllowed = ALLOWED_PATHS.some(allowed => path.startsWith(allowed));
    if (!isAllowed) {
      toast.error('🔒 Module đang phát triển - Tạm khóa phục vụ Báo cáo Sếp');
      return;
    }
    navigate(path);
    if (menuKey) setMainMenu(menuKey);
    if (window.innerWidth < 768) setIsMobileOpen(false);
  };

  const sidebarWidth = isCollapsed ? 'w-[68px]' : 'w-[260px]';
  const mobileTranslate = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 md:relative 
        shrink-0 border-r border-border bg-card flex flex-col 
        transition-all duration-300 ease-in-out
        ${sidebarWidth} ${mobileTranslate} md:translate-x-0
      `}>
        {/* Workspace Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0 bg-sky-600 text-white">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 font-bold tracking-tight text-white cursor-pointer" onClick={() => handleRouteClick('/tracking/warranty')}>
              <div className="bg-white/20 p-1.5 rounded-lg shadow-sm text-white">
                <Rocket className="w-4 h-4" />
              </div>
              <span className="truncate text-sm uppercase tracking-wide">POSM Management</span>
            </div>
          )}
          {isCollapsed && (
            <div className="bg-white/20 p-1.5 rounded-lg mx-auto shadow-sm text-white cursor-pointer" onClick={() => handleRouteClick('/tracking/warranty')}>
              <Rocket className="w-4 h-4" />
            </div>
          )}
          
          <button 
            onClick={() => {
               if (window.innerWidth >= 768) setIsCollapsed(!isCollapsed);
               else setIsMobileOpen(false);
            }}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title={isCollapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
          >
            {window.innerWidth < 768 ? <X className="w-4 h-4" /> : isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar text-sm">
          {/* OVERVIEW SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tổng quan</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<BarChart3 />} label="Dashboard Báo Cáo" 
                active={pathname.startsWith('/analytics')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/analytics', 'analytics')} 
              />
              <SidebarItem 
                icon={<Inbox />} label="Xử lý Request" 
                active={pathname.startsWith('/requests')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/requests', 'request')} 
              />
              {!isCollapsed && (
                <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-5 my-1">
                  <SubSidebarItem 
                    label="Tất cả Request (Overview)" 
                    active={pathname === '/requests' || pathname === '/requests/overview'} 
                    isLocked={true}
                    onClick={() => handleRouteClick('/requests', 'request')} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* PROJECTS SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dự án</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<FolderOpen />} label="Tổng hợp dự án" 
                active={pathname.startsWith('/projects') || pathname.startsWith('/project')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/projects', 'tong_du_an')} 
              />
              <SidebarItem 
                icon={<KanbanSquare />} label="Bảng kế hoạch" 
                active={pathname.startsWith('/store-plan')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/store-plan', 'store_plan')} 
              />
            </div>
          </div>

          {/* OPERATIONS SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vận hành & Giám sát</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<ShieldCheck />} label="Bảo Hành & Đổi Trả" 
                active={pathname.startsWith('/tracking/warranty')} 
                isCollapsed={isCollapsed}
                isLocked={false}
                onClick={() => handleRouteClick('/tracking/warranty', 'tracking_warranty')} 
              />
              <SidebarItem 
                icon={<Factory />} label="Nghiệm thu Xuất xưởng" 
                active={pathname.startsWith('/tracking/ntxx')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/tracking/ntxx', 'tracking_ntxx')} 
              />
              <SidebarItem 
                icon={<ClipboardCheck />} label="Theo dõi Lắp đặt" 
                active={pathname.startsWith('/tracking/installation')} 
                isCollapsed={isCollapsed}
                isLocked={true}
                onClick={() => handleRouteClick('/tracking/installation', 'tracking_installation')} 
              />
            </div>
          </div>

          {/* DATA SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dữ liệu</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<BookUser />} label="Danh bạ Cửa hàng" 
                active={pathname.startsWith('/contacts')} 
                isCollapsed={isCollapsed}
                isLocked={false}
                onClick={() => handleRouteClick('/contacts', 'master_stores')} 
              />
            </div>
          </div>
        </nav>

        {/* Footer Action */}
        <div className="p-3 border-t border-border shrink-0">
          <button 
            onClick={() => setIsNewRequestOpen(true)}
            className={`
              w-full flex items-center justify-center gap-2 
              bg-primary text-primary-foreground font-semibold 
              py-2.5 px-3 rounded-lg shadow-sm hover:opacity-90 transition-all text-xs
            `}
          >
            <span className="text-base font-bold">+</span>
            {!isCollapsed && <span>Tạo mới</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({ icon, label, active, isCollapsed, isLocked, onClick }: { icon: React.ReactNode, label: string, active?: boolean, isCollapsed?: boolean, isLocked?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? (isLocked ? `${label} (Tạm khóa)` : label) : undefined}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all text-left cursor-pointer
        ${active 
          ? 'bg-primary/10 text-primary font-semibold' 
          : isLocked 
            ? 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900/40' 
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        }
        ${isCollapsed ? 'justify-center px-0' : ''}
      `}
    >
      <span className={`shrink-0 ${active ? 'text-primary' : isLocked ? 'text-slate-400 dark:text-slate-600' : 'text-muted-foreground'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
      </span>
      {!isCollapsed && (
        <div className="flex items-center justify-between w-full min-w-0">
          <span className={`truncate ${isLocked ? 'text-slate-400 dark:text-slate-500' : ''}`}>{label}</span>
          {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0 ml-1.5" />}
        </div>
      )}
    </button>
  );
}

function SubSidebarItem({ label, active, isLocked, onClick }: { label: string, active?: boolean, isLocked?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors truncate flex items-center justify-between cursor-pointer
        ${active 
          ? 'text-primary font-bold bg-primary/5' 
          : isLocked
            ? 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-900/40'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        }
      `}
    >
      <span>• {label}</span>
      {isLocked && <Lock className="w-3 h-3 text-slate-400 dark:text-slate-600 shrink-0 ml-1" />}
    </button>
  );
}
