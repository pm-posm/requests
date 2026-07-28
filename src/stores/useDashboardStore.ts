import { create } from 'zustand';
import type { Project } from '@/hooks/useProjects';
import type { FilterType } from '@/components/Analytics';

type MainMenuType = 'request' | 'tong_du_an' | 'analytics' | 'personalization' | 'model_test' | 'tracking_installation' | 'store_contact' | 'tracking_ntxx' | 'store_plan' | 'master_stores' | 'tracking_warranty';
type RequestMenuType = 'overview' | 'store_list' | 'store_view';
type PlanOptionFilterType = 'all' | 'csp_ka' | 'mer_quick_fix' | 'supplier_warranty';

export interface PrefillRequestData {
  assetCode?: string;
  itemName?: string;
  storeCode?: string;
  storeName?: string;
  vendorName?: string;
  vendorHotline?: string;
  expiryDate?: string;
  note?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

interface DashboardState {
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;

  isNewRequestOpen: boolean;
  setIsNewRequestOpen: (open: boolean) => void;

  prefillRequestData: PrefillRequestData | null;
  setPrefillRequestData: (data: PrefillRequestData | null) => void;

  authUser: AuthUser | null;
  setAuthUser: (user: AuthUser | null) => void;

  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;

  kanbanFilter: FilterType;
  setKanbanFilter: (filter: FilterType) => void;

  mainMenu: MainMenuType;
  setMainMenu: (menu: MainMenuType) => void;

  requestMenu: RequestMenuType;
  setRequestMenu: (menu: RequestMenuType) => void;

  filterRegion: string;
  setFilterRegion: (region: string) => void;

  filterKA: string;
  setFilterKA: (ka: string) => void;

  filterCustomer: string;
  setFilterCustomer: (customer: string) => void;

  filterMer: string;
  setFilterMer: (mer: string) => void;

  selectedStore: string | null;
  setSelectedStore: (store: string | null) => void;

  planOptionFilter: PlanOptionFilterType;
  setPlanOptionFilter: (filter: PlanOptionFilterType) => void;

  selectedOverviewStatus: string | null;
  setSelectedOverviewStatus: (status: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),

  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),

  isNewRequestOpen: false,
  setIsNewRequestOpen: (open) => set({ isNewRequestOpen: open }),

  prefillRequestData: null,
  setPrefillRequestData: (data) => set({ prefillRequestData: data }),

  authUser: null,
  setAuthUser: (authUser) => set({ authUser, isAdmin: authUser?.role === 'admin' }),

  isAdmin: true,
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  kanbanFilter: 'all',
  setKanbanFilter: (filter) => set({ kanbanFilter: filter }),

  mainMenu: 'request',
  setMainMenu: (menu) => set({ mainMenu: menu }),

  requestMenu: 'overview',
  setRequestMenu: (menu) => set({ requestMenu: menu }),

  filterRegion: 'all',
  setFilterRegion: (region) => set({ filterRegion: region }),

  filterKA: 'all',
  setFilterKA: (ka) => set({ filterKA: ka }),

  filterCustomer: 'all',
  setFilterCustomer: (customer) => set({ filterCustomer: customer }),

  filterMer: 'all',
  setFilterMer: (mer) => set({ filterMer: mer }),

  selectedStore: null,
  setSelectedStore: (store) => set({ selectedStore: store }),

  planOptionFilter: 'all',
  setPlanOptionFilter: (filter) => set({ planOptionFilter: filter }),

  selectedOverviewStatus: 'New',
  setSelectedOverviewStatus: (status) => set({ selectedOverviewStatus: status }),
}));
