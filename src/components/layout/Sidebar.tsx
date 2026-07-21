import React from 'react';
import { 
  BarChart3, Inbox, FolderOpen, PanelLeftClose, PanelLeftOpen, 
  ListTodo, KanbanSquare, ClipboardCheck, BookUser, 
  Briefcase, Search, Settings, ChevronRight, Menu, X, Rocket, Factory
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export function Sidebar({
  mainMenu, setMainMenu, requestMenu, setRequestMenu, setSelectedStore, setIsNewRequestOpen, isMobileOpen, setIsMobileOpen
}: SidebarProps) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const handleMenuClick = (menu: string) => {
    navigate('/');
    setMainMenu(menu);
    if (menu !== 'request') setRequestMenu('overview');
    setSelectedStore(null);
    if (window.innerWidth < 768) setIsMobileOpen(false); // Close on mobile after click
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
        <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 font-bold text-foreground tracking-tight">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                <Rocket className="w-4 h-4" />
              </div>
              <span className="truncate">Workspace</span>
            </div>
          )}
          {isCollapsed && (
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg mx-auto shadow-sm">
              <Rocket className="w-4 h-4" />
            </div>
          )}
          
          <button 
            onClick={() => {
               if (window.innerWidth >= 768) setIsCollapsed(!isCollapsed);
               else setIsMobileOpen(false);
            }}
            className={`p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors ${isCollapsed ? 'hidden' : ''}`}
          >
            {window.innerWidth < 768 ? <X className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar text-sm">
          {/* OVERVIEW SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tổng quan</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<BarChart3 />} label="Dashboard" 
                active={mainMenu === 'analytics'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('analytics')} 
              />
              <SidebarItem 
                icon={<Inbox />} label="Xử lý Request" 
                active={mainMenu === 'request'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('request')} 
              />
              {!isCollapsed && mainMenu === 'request' && (
                <div className="pl-9 pr-2 py-1 space-y-0.5">
                  <SubSidebarItem 
                    label="Tất cả request" 
                    active={requestMenu === 'overview'} 
                    onClick={() => { setRequestMenu('overview'); setSelectedStore(null); }} 
                  />
                  <SubSidebarItem 
                    label="Cửa hàng liên quan" 
                    active={requestMenu === 'store_list' || requestMenu === 'store_view'} 
                    onClick={() => { setRequestMenu('store_list'); setSelectedStore(null); }} 
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
                active={mainMenu === 'tong_du_an'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('tong_du_an')} 
              />
              <SidebarItem 
                icon={<KanbanSquare />} label="Bảng kế hoạch" 
                active={mainMenu === 'model_test'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('model_test')} 
              />
            </div>
          </div>

          {/* OPERATIONS SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vận hành & Giám sát</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<Factory />} label="Nghiệm thu Xuất xưởng" 
                active={mainMenu === 'tracking_ntxx'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('tracking_ntxx')} 
              />
              <SidebarItem 
                icon={<ClipboardCheck />} label="Theo dõi Lắp đặt" 
                active={mainMenu === 'tracking_installation'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('tracking_installation')} 
              />
            </div>
          </div>

          {/* DATA SECTION */}
          <div>
            {!isCollapsed && <h4 className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dữ liệu</h4>}
            <div className="space-y-0.5">
              <SidebarItem 
                icon={<ListTodo />} label="Việc của tôi" 
                active={mainMenu === 'personalization'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('personalization')} 
              />
              <SidebarItem 
                icon={<BookUser />} label="Danh bạ Cửa hàng" 
                active={mainMenu === 'store_contact'} 
                isCollapsed={isCollapsed}
                onClick={() => handleMenuClick('store_contact')} 
              />
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-border shrink-0 bg-card">
          {isCollapsed ? (
            <button 
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center p-2 text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={() => {
                 setIsNewRequestOpen(true);
                 if (window.innerWidth < 768) setIsMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              + Tạo mới
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarItem({ icon, label, active, isCollapsed, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group ${
        active 
          ? 'bg-primary/10 text-primary font-semibold' 
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-medium'
      } ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className={`w-[18px] h-[18px] shrink-0 [&>svg]:w-full [&>svg]:h-full transition-colors ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
        {icon}
      </span>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SubSidebarItem({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 ${
        active 
          ? 'text-primary font-semibold bg-primary/5' 
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      <span className={`w-1 h-1 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} />
      {label}
    </button>
  );
}
