import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { fetchInstallationItems, type InstallationItem } from '@/services/installationSyncService';
import { normalizeDataResponser } from '@/services/sheetSyncService';
import { useRawRequests } from '@/hooks/useRawRequests';
import { 
  Search, Store, ArrowLeft, Building2, User, Layers, FileText, CheckCircle2, 
  Clock, AlertTriangle, Eye, X, MessageSquare, Calendar, Tag, ShieldCheck, 
  Wrench, RefreshCw, Filter, ExternalLink
} from 'lucide-react';

interface ProjectGroupInStore {
  projectCode: string;
  projectName: string;
  installationItems: InstallationItem[];
  completedCount: number;
  failedCount: number;
}

interface StoreGroupData {
  store_key: string;
  store_code: string;
  store_name: string;
  customer: string;
  region: string;
  sr_name: string;
  mer_name: string;

  // 1. Data Tab Request (MER VIEW 2026)
  requests: RawRequestRecord[];
  requestCount: number;
  completedRequestsCount: number;
  inProgressRequestsCount: number;

  // 2. Data Tab Theo Dõi Lắp Đặt (UPDATE TRACKING INSTALLATION)
  installationItems: InstallationItem[];
  installationCount: number;
  projects: ProjectGroupInStore[];
  projectCount: number;
  completedInstallationsCount: number;
  failedInstallationsCount: number;

  // Combined Progress
  totalItemsCount: number;
  totalCompletedCount: number;
  completionPercentage: number;
}

export function StorePlanBoardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'HAS_REQUESTS' | 'HAS_INSTALLATIONS' | 'COMPLETED'>('ALL');
  
  // Selected Store state for drill-down view
  const [selectedStoreKey, setSelectedStoreKey] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'INSTALLATIONS' | 'REQUESTS'>('INSTALLATIONS');
  
  // Modals for Request details
  const [selectedNotesRecord, setSelectedNotesRecord] = useState<RawRequestRecord | null>(null);
  const [selectedDataResponserRecord, setSelectedDataResponserRecord] = useState<RawRequestRecord | null>(null);

  const { updateRequest } = useRawRequests();

  // 1. Fetch data from Tab Request (raw_requests table in Supabase)
  const { data: requests = [], isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery<RawRequestRecord[]>({
    queryKey: ['raw_requests_store_plan_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_requests')
        .select('*')
        .eq('is_deleted_in_sheet', false)
        .order('sheet_row_index', { ascending: true });

      if (error) throw error;
      return (data || []) as RawRequestRecord[];
    }
  });

  // 2. Fetch data from Tab Theo Dõi Lắp Đặt (UPDATE TRACKING INSTALLATION sheet CSV)
  const { data: installationItems = [], isLoading: isLoadingInstallations, refetch: refetchInstallations } = useQuery<InstallationItem[]>({
    queryKey: ['installation_items_store_plan_v2'],
    queryFn: fetchInstallationItems,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Master Stores Directory for Store metadata fallback
  const { data: masterStores = [] } = useQuery({
    queryKey: ['master_stores_metadata_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_stores_directory')
        .select('store_code, store_name, customer, ka, region, mer_name, sr_name');
      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  const masterStoresMap = useMemo(() => {
    const map = new Map<string, any>();
    masterStores.forEach(s => {
      if (s.store_code) map.set(s.store_code.toUpperCase().trim(), s);
    });
    return map;
  }, [masterStores]);

  // 4. Group all data primarily by STORE
  const storeGroups = useMemo<StoreGroupData[]>(() => {
    const map = new Map<string, StoreGroupData>();

    const getOrCreateStore = (storeCodeRaw?: string, storeNameRaw?: string) => {
      const storeCode = (storeCodeRaw || '').toUpperCase().trim();
      const storeName = (storeNameRaw || '').trim() || 'Cửa hàng chưa đặt tên';
      
      const isCodeValid = storeCode !== '' && storeCode !== '-' && storeCode !== 'N/A';
      const storeKey = isCodeValid ? storeCode : `NAME_${storeName.toUpperCase()}`;

      const masterInfo = isCodeValid ? masterStoresMap.get(storeCode) : null;

      if (!map.has(storeKey)) {
        map.set(storeKey, {
          store_key: storeKey,
          store_code: isCodeValid ? storeCode : '-',
          store_name: masterInfo?.store_name || storeName,
          customer: masterInfo?.customer || '-',
          region: masterInfo?.region || '-',
          sr_name: masterInfo?.sr_name || '-',
          mer_name: masterInfo?.mer_name || '-',
          requests: [],
          requestCount: 0,
          completedRequestsCount: 0,
          inProgressRequestsCount: 0,
          installationItems: [],
          installationCount: 0,
          projects: [],
          projectCount: 0,
          completedInstallationsCount: 0,
          failedInstallationsCount: 0,
          totalItemsCount: 0,
          totalCompletedCount: 0,
          completionPercentage: 0,
        });
      }

      return map.get(storeKey)!;
    };

    // Group 1: Populate from Tab Request (raw_requests)
    requests.forEach(req => {
      const group = getOrCreateStore(req.ess_store_code, req.store_name);
      group.requests.push(req);
      group.requestCount++;

      if (req.customer && group.customer === '-') group.customer = req.customer;
      if (req.sr && group.sr_name === '-') group.sr_name = req.sr;
      if (req.mer && group.mer_name === '-') group.mer_name = req.mer;

      const tienDo = (req.tien_do || '').toLowerCase();
      const status = (req.status || '').toLowerCase();
      if (tienDo.includes('hoàn thành') || status.includes('completed') || status.includes('approve') || status.includes('done')) {
        group.completedRequestsCount++;
      } else {
        group.inProgressRequestsCount++;
      }
    });

    // Group 2: Populate from Tab Theo Dõi Lắp Đặt (installationItems)
    installationItems.forEach(item => {
      const group = getOrCreateStore(item.storeCode, item.storeName);
      group.installationItems.push(item);
      group.installationCount++;

      if (item.customer && group.customer === '-') group.customer = item.customer;
      if (item.region && group.region === '-') group.region = item.region;
      if (item.technician && group.mer_name === '-') group.mer_name = item.technician;

      const resultSign = (item.resultSign || '').trim();
      const isCompleted = resultSign === '✔' || resultSign.toLowerCase().includes('pass') || (item.completionTime && item.completionTime.trim() !== '');
      const isFailed = resultSign === '❌' || resultSign.toLowerCase().includes('fail');

      if (isCompleted) group.completedInstallationsCount++;
      if (isFailed) group.failedInstallationsCount++;

      // Group projects within this store
      const prjCode = item.projectCode?.trim() || item.projectName?.trim() || 'Dự án khác';
      let prjGroup = group.projects.find(p => p.projectCode === prjCode);
      if (!prjGroup) {
        prjGroup = {
          projectCode: prjCode,
          projectName: item.projectName || prjCode,
          installationItems: [],
          completedCount: 0,
          failedCount: 0,
        };
        group.projects.push(prjGroup);
      }
      prjGroup.installationItems.push(item);
      if (isCompleted) prjGroup.completedCount++;
      if (isFailed) prjGroup.failedCount++;
    });

    // Finalize counts and percentage
    return Array.from(map.values()).map(group => {
      group.projectCount = group.projects.length;
      group.totalItemsCount = group.requestCount + group.installationCount;
      group.totalCompletedCount = group.completedRequestsCount + group.completedInstallationsCount;
      group.completionPercentage = group.totalItemsCount > 0
        ? Math.round((group.totalCompletedCount / group.totalItemsCount) * 100)
        : 0;
      return group;
    });
  }, [requests, installationItems, masterStoresMap]);

  // Unique Region and Customer Lists for Filters
  const regionsList = useMemo(() => {
    const set = new Set<string>();
    storeGroups.forEach(g => { if (g.region && g.region !== '-') set.add(g.region); });
    return Array.from(set).sort();
  }, [storeGroups]);

  const customersList = useMemo(() => {
    const set = new Set<string>();
    storeGroups.forEach(g => { if (g.customer && g.customer !== '-') set.add(g.customer); });
    return Array.from(set).sort();
  }, [storeGroups]);

  // Filtered Store Groups
  const filteredStores = useMemo(() => {
    return storeGroups.filter(g => {
      const matchesSearch = !searchTerm.trim() ||
        g.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.store_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.sr_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.mer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.projects.some(p => p.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) || p.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        g.requests.some(r => (r.request_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.posm || '').toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRegion = regionFilter === 'ALL' || g.region === regionFilter;
      const matchesCustomer = customerFilter === 'ALL' || g.customer === customerFilter;

      let matchesQuick = true;
      if (quickFilter === 'HAS_REQUESTS') matchesQuick = g.requestCount > 0;
      else if (quickFilter === 'HAS_INSTALLATIONS') matchesQuick = g.installationCount > 0;
      else if (quickFilter === 'COMPLETED') matchesQuick = g.completionPercentage === 100;

      return matchesSearch && matchesRegion && matchesCustomer && matchesQuick;
    });
  }, [storeGroups, searchTerm, regionFilter, customerFilter, quickFilter]);

  // Selected Store Object
  const selectedStore = useMemo(() => {
    if (!selectedStoreKey) return null;
    return storeGroups.find(g => g.store_key === selectedStoreKey) || null;
  }, [selectedStoreKey, storeGroups]);

  // Aggregate Metrics Summary
  const aggregateMetrics = useMemo(() => {
    let totalReq = 0;
    let totalInstall = 0;
    let totalPrj = 0;
    const allProjectsSet = new Set<string>();

    storeGroups.forEach(g => {
      totalReq += g.requestCount;
      totalInstall += g.installationCount;
      g.projects.forEach(p => allProjectsSet.add(p.projectCode));
    });

    totalPrj = allProjectsSet.size;

    return {
      totalStores: storeGroups.length,
      totalRequests: totalReq,
      totalInstallations: totalInstall,
      totalProjects: totalPrj,
    };
  }, [storeGroups]);

  const isLoading = isLoadingRequests || isLoadingInstallations;

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 dark:bg-slate-950 custom-scrollbar space-y-5">
      
      {/* SECTION 1: HEADER COMMAND CENTER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700">
            <Store className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Bảng Kế Hoạch Siêu Thị (Store Plan Board)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-900/60">
                Store-Centric View
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quản lý tổng hợp theo từng Store • Bao gồm dữ liệu từ <strong className="text-slate-800 dark:text-slate-200">Tab Request</strong> &amp; <strong className="text-slate-800 dark:text-slate-200">Tab Theo Dõi Lắp Đặt</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchRequests(); refetchInstallations(); }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới Dữ Liệu</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: TOP METRIC STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Số Siêu Thị</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{aggregateMetrics.totalStores}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">cửa hàng trên toàn hệ thống</p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Yêu Cầu (Tab Request)</p>
            <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{aggregateMetrics.totalRequests}</h3>
            <p className="text-[11px] text-sky-600/70 mt-0.5">mã request từ MER VIEW 2026</p>
          </div>
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/60 text-sky-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Hạng Mục Lắp Đặt</p>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{aggregateMetrics.totalInstallations}</h3>
            <p className="text-[11px] text-indigo-600/70 mt-0.5">dòng POSM theo dõi lắp đặt</p>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Tổng Số Dự Án Lắp Đặt</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{aggregateMetrics.totalProjects}</h3>
            <p className="text-[11px] text-emerald-600/70 mt-0.5">mã dự án thi công thực tế</p>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* RENDER VIEW 1: DRILL-DOWN DETAILED STORE VIEW */}
      {selectedStore ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedStoreKey(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-sky-600" />
              Quay lại danh sách Siêu thị
            </button>
          </div>

          {/* Store Information Card Header */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                  Mã Store: {selectedStore.store_code}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Hệ thống: {selectedStore.customer} • Vùng: {selectedStore.region}
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                {selectedStore.store_name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-4 h-4 text-sky-500" />
                  SR Phụ trách: <strong className="text-slate-800 dark:text-slate-200">{selectedStore.sr_name}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Wrench className="w-4 h-4 text-indigo-500" />
                  QC Technician / Mer: <strong className="text-slate-800 dark:text-slate-200">{selectedStore.mer_name}</strong>
                </span>
              </div>
            </div>

            {/* Combined Store Metric Badges */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-50 dark:bg-sky-950/60 rounded-xl border border-sky-200 dark:border-sky-900 text-center min-w-[110px]">
                <span className="text-[10px] font-bold text-sky-600 uppercase block">Tab Request</span>
                <span className="text-xl font-black text-sky-700 dark:text-sky-300 font-mono">{selectedStore.requestCount}</span>
                <span className="text-[10px] text-sky-600/70 block">Yêu cầu POSM</span>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-900 text-center min-w-[110px]">
                <span className="text-[10px] font-bold text-indigo-600 uppercase block">Tab Lắp Đặt</span>
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono">{selectedStore.installationCount}</span>
                <span className="text-[10px] text-indigo-600/70 block">{selectedStore.projectCount} Dự Án</span>
              </div>
            </div>
          </div>

          {/* 2 MAIN DRILL-DOWN TABS */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <button
              onClick={() => setActiveDetailTab('INSTALLATIONS')}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                activeDetailTab === 'INSTALLATIONS'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>🛠️ TAB 1: DỰ ÁN &amp; HẠNG MỤC LẮP ĐẶT ({selectedStore.installationCount} POSM / {selectedStore.projectCount} Dự án)</span>
            </button>

            <button
              onClick={() => setActiveDetailTab('REQUESTS')}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                activeDetailTab === 'REQUESTS'
                  ? 'border-sky-600 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📋 TAB 2: REQUEST POSM ({selectedStore.requestCount} Yêu cầu)</span>
            </button>
          </div>

          {/* TAB 1 CONTENT: THEO DÕI LẮP ĐẶT DATA */}
          {activeDetailTab === 'INSTALLATIONS' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-slate-200/80 dark:border-slate-800 overflow-hidden p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-500" />
                  Danh Sách Dự Án &amp; Hạng Mục Theo Dõi Lắp Đặt tại {selectedStore.store_name}
                </h3>
              </div>

              {selectedStore.installationItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Chưa có dòng dữ liệu nào từ tab Theo Dõi Lắp Đặt cho Siêu thị này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Mã Dự Án</th>
                        <th className="p-3">Tên Dự Án</th>
                        <th className="p-3">Hạng Mục POSM</th>
                        <th className="p-3">Ngành Hàng / Brand</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3">Dự Kiến Thực Hiện</th>
                        <th className="p-3">Ngày Hoàn Thành</th>
                        <th className="p-3 text-center">Kết Quả (&gt;&lt;)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedStore.installationItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.projectCode || '-'}
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.projectName || '-'}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {item.item || item.posmTypeCode || 'POSM'}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {item.brandName || item.catName || '-'}
                          </td>
                          <td className="p-3 font-bold text-sky-700 dark:text-sky-300">
                            {item.supplierName || '-'}
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {item.plannedStartDate ? `${item.plannedStartDate} ➔ ${item.plannedEndDate || ''}` : '-'}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.completionTime || item.actualTime || 'Chưa xong'}
                          </td>
                          <td className="p-3 text-center">
                            {item.resultSign === '✔' ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold text-xs">
                                ✔ Pass
                              </span>
                            ) : item.resultSign === '❌' ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded font-bold text-xs">
                                ❌ QC Fail
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded text-xs">
                                ⏳ Đang triển khai
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2 CONTENT: REQUEST POSM DATA */}
          {activeDetailTab === 'REQUESTS' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xs border border-slate-200/80 dark:border-slate-800 overflow-hidden p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-500" />
                  Danh Sách Request POSM tại {selectedStore.store_name}
                </h3>
              </div>

              {selectedStore.requests.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Chưa có Request nào gửi từ Tab Request cho Siêu thị này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Request ID</th>
                        <th className="p-3">Mã &amp; Tên Dự Án</th>
                        <th className="p-3">Hạng Mục POSM</th>
                        <th className="p-3">SR Yêu Cầu</th>
                        <th className="p-3">Phương Án</th>
                        <th className="p-3">Trạng Thái</th>
                        <th className="p-3">Ngày RQ</th>
                        <th className="p-3 text-center">Ghi Chú (Notes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedStore.requests.map((r, rIdx) => (
                        <tr key={r.id || rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3">
                            <span className="font-mono font-black text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                              {r.request_id || `REQ-${rIdx + 1}`}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            <div className="font-mono text-sky-600 font-bold">{r.ma_du_an || 'FIELD FORCE REQUEST'}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{r.title_email_request || '-'}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {r.posm} {r.brand ? `(${r.brand})` : ''}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{r.sr || '-'}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{r.phuong_an || 'Visibility Request'}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                              {r.tien_do || r.status || 'To Do'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">{r.date_of_rq || '-'}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedNotesRecord(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-200 font-bold text-[11px] rounded-lg border border-sky-300 dark:border-sky-700 hover:border-sky-500 cursor-pointer transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                              <span>Xem Ghi Chú</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        /* RENDER VIEW 2: STORE DIRECTORY MAIN GRID & TABLE */
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên cửa hàng, mã store (STR-...), mã dự án, request ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 font-medium text-slate-800 dark:text-slate-200"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Region Filter */}
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-sky-500"
              >
                <option value="ALL">🌐 Tất cả Vùng ({regionsList.length})</option>
                {regionsList.map(r => (
                  <option key={r} value={r}>Vùng: {r}</option>
                ))}
              </select>

              {/* Customer Filter */}
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-sky-500"
              >
                <option value="ALL">🛒 Tất cả Hệ Thống ({customersList.length})</option>
                {customersList.map(c => (
                  <option key={c} value={c}>Customer: {c}</option>
                ))}
              </select>

              {/* Quick Filter Pill Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setQuickFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    quickFilter === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({storeGroups.length})
                </button>
                <button
                  onClick={() => setQuickFilter('HAS_REQUESTS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    quickFilter === 'HAS_REQUESTS' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Có Request
                </button>
                <button
                  onClick={() => setQuickFilter('HAS_INSTALLATIONS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    quickFilter === 'HAS_INSTALLATIONS' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Có Dự Án Lắp Đặt
                </button>
              </div>
            </div>
          </div>

          {/* MAIN STORES TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Mã Store</th>
                    <th className="p-3.5 min-w-[220px]">Tên Siêu Thị (Store Name)</th>
                    <th className="p-3.5">Hệ Thống / Customer</th>
                    <th className="p-3.5">Vùng</th>
                    <th className="p-3.5 text-center">Tab Request (MER VIEW)</th>
                    <th className="p-3.5 text-center">Tab Theo Dõi Lắp Đặt</th>
                    <th className="p-3.5 text-center">Tiến Độ Tổng</th>
                    <th className="p-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs italic">
                        Không tìm thấy Siêu thị nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((store) => (
                      <tr 
                        key={store.store_key}
                        onClick={() => setSelectedStoreKey(store.store_key)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        {/* Mã Store */}
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 px-2 py-1 rounded border border-sky-200 dark:border-sky-800">
                            {store.store_code}
                          </span>
                        </td>

                        {/* Tên Store */}
                        <td className="p-3.5 font-extrabold text-slate-900 dark:text-slate-100">
                          {store.store_name}
                          {(store.sr_name !== '-' || store.mer_name !== '-') && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                              SR: {store.sr_name} • Mer: {store.mer_name}
                            </div>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {store.customer}
                        </td>

                        {/* Region */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {store.region}
                        </td>

                        {/* Badge Tab Request */}
                        <td className="p-3.5 text-center">
                          {store.requestCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded-lg border border-sky-200/80 dark:border-sky-800 font-bold text-xs">
                              <FileText className="w-3.5 h-3.5 text-sky-500" />
                              {store.requestCount} Request
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">-</span>
                          )}
                        </td>

                        {/* Badge Tab Lắp Đặt */}
                        <td className="p-3.5 text-center">
                          {store.installationCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200/80 dark:border-indigo-800 font-bold text-xs">
                              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                              {store.projectCount} Dự Án ({store.installationCount} POSM)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">-</span>
                          )}
                        </td>

                        {/* Tiến Độ Tổng */}
                        <td className="p-3.5 text-center font-mono font-bold">
                          <span className={`px-2.5 py-1 rounded-lg text-xs border ${
                            store.completionPercentage === 100 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : store.completionPercentage > 0 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {store.completionPercentage}% Xong
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStoreKey(store.store_key);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Xem Store</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Hiển thị {filteredStores.length} trên tổng số {storeGroups.length} Siêu thị</span>
              <span>Google Sheet Connected • MER VIEW 2026 &amp; UPDATE TRACKING INSTALLATION</span>
            </div>
          </div>
        </div>
      )}

      {/* NOTES VIEWER MODAL */}
      {selectedNotesRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Chi Tiết Ghi Chú Request
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Store: {selectedNotesRecord.store_name} ({selectedNotesRecord.ess_store_code})
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedNotesRecord(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                  📌 SR Note:
                </span>
                <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {selectedNotesRecord.sr_note || <span className="text-slate-400 italic">Chưa có ghi chú lỗi chi tiết từ SR</span>}
                </div>
              </div>

              <div className="p-3 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                <span className="font-bold text-sky-900 dark:text-sky-200 block text-[11px]">
                  🏢 Vis Note:
                </span>
                <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {selectedNotesRecord.vis_note || <span className="text-slate-400 italic">Chưa có phản hồi từ Team Vis văn phòng</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                    🛠️ Mer Note:
                  </span>
                </div>
                <textarea
                  defaultValue={selectedNotesRecord.mer_note || ''}
                  placeholder="Nhập ghi chú xử lý của Mer tại đây..."
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (val !== (selectedNotesRecord.mer_note || '')) {
                      updateRequest(selectedNotesRecord.id!, { mer_note: val });
                      setSelectedNotesRecord({ ...selectedNotesRecord, mer_note: val });
                    }
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500 outline-none resize-y min-h-[80px]"
                />
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setSelectedNotesRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
