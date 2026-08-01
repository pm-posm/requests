import React, { useMemo, useState } from 'react';
import { useRawRequests } from '@/hooks/useRawRequests';
import { useProjects, type Project } from '@/hooks/useProjects';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { 
  BarChart3, CheckCircle2, Clock, AlertTriangle, Building2, Store, 
  Download, Filter, Factory, Rocket, FolderKanban, ShieldCheck, RefreshCw, AlertCircle, Calendar, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';

const UNILEVER_BLUE_PALETTE = [
  '#0072CE', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', 
  '#6366F1', '#4F46E5', '#818CF8', '#A5B4FC', '#0369A1'
];

export type FilterType = 'all' | 'approved' | 'in_progress' | 'cancelled' | 'completed_progress';

export interface AnalyticsProps {
  projects?: any[];
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  viewMode?: 'stats' | 'charts' | 'all';
}

export default function Analytics({ projects: propsProjects, activeFilter, onFilterChange, viewMode }: AnalyticsProps = {}) {
  const navigate = useNavigate();
  const { setSearchTerm } = useDashboardStore();
  const { requests = [], isLoading: isLoadingRequests } = useRawRequests();
  const { data: fetchedMasterProjects = [], isLoading: isLoadingMasterProjects } = useProjects();
  
  const isLoading = isLoadingRequests || isLoadingMasterProjects;

  const [dataScope, setDataScope] = useState<'requests' | 'projects'>('requests');
  const [activeTab, setActiveTab] = useState<'overview' | 'supplier' | 'heatmap' | 'recurrent_warranty'>('overview');
  
  // Filters
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

  // 1. Group Raw Requests into Master Projects
  const masterProjectGroups = useMemo(() => {
    const map = new Map<string, {
      project_code: string;
      project_name: string;
      store_name: string;
      customer: string;
      brand: string;
      supplier: string;
      subtaskCount: number;
      completedCount: number;
      overdueCount: number;
      inProgressCount: number;
      toDoCount: number;
      reviewCount: number;
      status: string;
      requests: RawRequestRecord[];
    }>();

    const todayStr = new Date().toISOString().split('T')[0];

    requests.forEach((r: RawRequestRecord) => {
      if (r.is_deleted_in_sheet) return;
      
      // Key is Request ID (VIS-...) or Store + Brand
      const key = (r.request_id && r.request_id.trim() !== '-') 
        ? r.request_id.trim() 
        : (r.ess_store_code ? `${r.ess_store_code}_${r.brand || 'POSM'}` : (r.store_name || 'POSM_PROJECT'));
      
      const projectName = (r.request_id && r.request_id.trim() !== '-')
        ? `Dự Án ${r.request_id} (${r.store_name || 'Cửa hàng'})`
        : `Dự Án ${r.posm || 'POSM'} - ${r.store_name || 'Cửa hàng'}`;

      if (!map.has(key)) {
        map.set(key, {
          project_code: key,
          project_name: projectName,
          store_name: r.store_name || '-',
          customer: r.customer || '-',
          brand: r.brand || '-',
          supplier: r.supplier || 'Chưa gán',
          subtaskCount: 0,
          completedCount: 0,
          overdueCount: 0,
          inProgressCount: 0,
          toDoCount: 0,
          reviewCount: 0,
          status: 'To Do',
          requests: []
        });
      }

      const grp = map.get(key)!;
      grp.subtaskCount += 1;
      grp.requests.push(r);

      const st = (r.status || '').toLowerCase();
      const pr = (r.tien_do || '').toLowerCase();
      const isDone = st.includes('complete') || st.includes('done') || pr.includes('hoàn thành');
      const isReview = st.includes('review') || pr.includes('duyệt');
      const isInProg = st.includes('in progress') || pr.includes('đang');

      if (isDone) {
        grp.completedCount += 1;
      } else if (isReview) {
        grp.reviewCount += 1;
      } else if (isInProg) {
        grp.inProgressCount += 1;
      } else {
        grp.toDoCount += 1;
      }

      const deadline = r.ngay_quick_fix || r.deadline;
      if (deadline && !isDone) {
        const parts = deadline.split('/');
        if (parts.length === 3) {
          const formattedDeadline = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          if (formattedDeadline < todayStr) grp.overdueCount += 1;
        }
      }
    });

    return Array.from(map.values()).map(g => {
      const isFullyDone = g.subtaskCount > 0 && g.completedCount === g.subtaskCount;
      const isPartial = g.completedCount > 0 || g.inProgressCount > 0;
      return {
        ...g,
        status: isFullyDone ? 'Completed' : isPartial ? 'In Progress' : 'To Do'
      };
    });
  }, [requests]);

  // Filtered dataset based on dataScope and dropdown filters
  const filteredRequests = useMemo(() => {
    return requests.filter((r: RawRequestRecord) => {
      if (r.is_deleted_in_sheet) return false;
      if (selectedBrand !== 'ALL' && (r.brand || '').toUpperCase() !== selectedBrand.toUpperCase()) return false;
      if (selectedCustomer !== 'ALL' && (r.customer || '').toUpperCase() !== selectedCustomer.toUpperCase()) return false;
      if (selectedSupplier !== 'ALL' && (r.supplier || '').toUpperCase() !== selectedSupplier.toUpperCase()) return false;
      return true;
    });
  }, [requests, selectedBrand, selectedCustomer, selectedSupplier]);

  const filteredProjects = useMemo(() => {
    return masterProjectGroups.filter(p => {
      if (selectedBrand !== 'ALL' && (p.brand || '').toUpperCase() !== selectedBrand.toUpperCase()) return false;
      if (selectedCustomer !== 'ALL' && (p.customer || '').toUpperCase() !== selectedCustomer.toUpperCase()) return false;
      if (selectedSupplier !== 'ALL' && (p.supplier || '').toUpperCase() !== selectedSupplier.toUpperCase()) return false;
      return true;
    });
  }, [masterProjectGroups, selectedBrand, selectedCustomer, selectedSupplier]);

  // Dynamic Filter Lists
  const brandList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r: RawRequestRecord) => { if (r.brand && r.brand.trim() !== '-') set.add(r.brand.trim()); });
    return Array.from(set).sort();
  }, [requests]);

  const customerList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r: RawRequestRecord) => { if (r.customer && r.customer.trim() !== '-') set.add(r.customer.trim()); });
    return Array.from(set).sort();
  }, [requests]);

  const supplierList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r: RawRequestRecord) => { if (r.supplier && r.supplier.trim() !== '-') set.add(r.supplier.trim()); });
    return Array.from(set).sort();
  }, [requests]);

  // Dynamic KPI Metrics based on dataScope
  const metrics = useMemo(() => {
    if (dataScope === 'projects') {
      const total = filteredProjects.length;
      let completedCount = 0;
      let overdueCount = 0;
      let inProgressCount = 0;
      let toDoCount = 0;
      let reviewCount = 0;

      filteredProjects.forEach(p => {
        if (p.status === 'Completed') completedCount++;
        else if (p.status === 'In Progress') inProgressCount++;
        else toDoCount++;

        if (p.overdueCount > 0) overdueCount++;
        if (p.reviewCount > 0) reviewCount++;
      });

      const completionRate = total > 0 ? ((completedCount / total) * 100).toFixed(1) : '0';
      const overdueRate = total > 0 ? ((overdueCount / total) * 100).toFixed(1) : '0';

      return { total, completedCount, completionRate, overdueCount, overdueRate, inProgressCount, toDoCount, reviewCount };
    } else {
      const total = filteredRequests.length;
      let completedCount = 0;
      let overdueCount = 0;
      let inProgressCount = 0;
      let toDoCount = 0;
      let reviewCount = 0;

      const todayStr = new Date().toISOString().split('T')[0];

      filteredRequests.forEach((r: RawRequestRecord) => {
        const status = (r.status || '').toLowerCase();
        const progress = (r.tien_do || '').toLowerCase();
        
        const isDone = status.includes('complete') || status.includes('done') || progress.includes('hoàn thành');
        const isReview = status.includes('review') || progress.includes('duyệt');
        const isInProg = status.includes('in progress') || progress.includes('đang');
        
        if (isDone) completedCount++;
        else if (isReview) reviewCount++;
        else if (isInProg) inProgressCount++;
        else toDoCount++;

        const deadline = r.ngay_quick_fix || r.deadline;
        if (deadline && !isDone) {
          const parts = deadline.split('/');
          if (parts.length === 3) {
            const formattedDeadline = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (formattedDeadline < todayStr) overdueCount++;
          }
        }
      });

      const completionRate = total > 0 ? ((completedCount / total) * 100).toFixed(1) : '0';
      const overdueRate = total > 0 ? ((overdueCount / total) * 100).toFixed(1) : '0';

      return { total, completedCount, completionRate, overdueCount, overdueRate, inProgressCount, toDoCount, reviewCount };
    }
  }, [dataScope, filteredRequests, filteredProjects]);

  // Dynamic Funnel Data
  const funnelData = useMemo(() => [
    { name: '1. To Do (Cần xử lý)', count: metrics.toDoCount, fill: '#64748B' },
    { name: '2. In Progress (Đang xử lý)', count: metrics.inProgressCount, fill: '#0284C7' },
    { name: '3. Under Review (Chờ duyệt)', count: metrics.reviewCount, fill: '#F59E0B' },
    { name: '4. Completed (Hoàn thành)', count: metrics.completedCount, fill: '#10B981' }
  ], [metrics]);

  // Brand Distribution
  const brandChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (dataScope === 'projects') {
      filteredProjects.forEach(p => {
        const b = p.brand || 'Khác';
        counts[b] = (counts[b] || 0) + 1;
      });
    } else {
      filteredRequests.forEach((r: RawRequestRecord) => {
        const b = r.brand || 'Khác';
        counts[b] = (counts[b] || 0) + 1;
      });
    }
    return Object.keys(counts)
      .map(b => ({ name: b, count: counts[b] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [dataScope, filteredRequests, filteredProjects]);

  // Customer KA Distribution
  const customerChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (dataScope === 'projects') {
      filteredProjects.forEach(p => {
        const c = p.customer || 'Khác';
        counts[c] = (counts[c] || 0) + 1;
      });
    } else {
      filteredRequests.forEach((r: RawRequestRecord) => {
        const c = r.customer || 'Khác';
        counts[c] = (counts[c] || 0) + 1;
      });
    }
    return Object.keys(counts)
      .map(c => ({ name: c, count: counts[c] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [dataScope, filteredRequests, filteredProjects]);

  // Supplier Matrix Performance
  const supplierMatrixData = useMemo(() => {
    const map: Record<string, { total: number; done: number; overdue: number }> = {};
    const todayStr = new Date().toISOString().split('T')[0];

    if (dataScope === 'projects') {
      filteredProjects.forEach(p => {
        const s = p.supplier?.trim() || 'Chưa gán';
        if (!map[s]) map[s] = { total: 0, done: 0, overdue: 0 };
        map[s].total += 1;
        if (p.status === 'Completed') map[s].done += 1;
        if (p.overdueCount > 0) map[s].overdue += 1;
      });
    } else {
      filteredRequests.forEach((r: RawRequestRecord) => {
        const s = r.supplier?.trim() || 'Chưa gán';
        if (!map[s]) map[s] = { total: 0, done: 0, overdue: 0 };
        map[s].total += 1;

        const status = (r.status || '').toLowerCase();
        const progress = (r.tien_do || '').toLowerCase();
        const isDone = status.includes('complete') || status.includes('done') || progress.includes('hoàn thành');
        
        if (isDone) map[s].done += 1;

        const deadline = r.ngay_quick_fix || r.deadline;
        if (deadline && !isDone) {
          const parts = deadline.split('/');
          if (parts.length === 3) {
            const formattedDeadline = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (formattedDeadline < todayStr) map[s].overdue += 1;
          }
        }
      });
    }

    return Object.keys(map).map(s => {
      const item = map[s];
      const rate = item.total > 0 ? ((item.done / item.total) * 100).toFixed(0) : '0';
      return {
        supplier: s,
        total: item.total,
        done: item.done,
        overdue: item.overdue,
        rate: Number(rate)
      };
    }).sort((a, b) => b.total - a.total);
  }, [dataScope, filteredRequests, filteredProjects]);

  // Top 10 High Issue Stores
  const topStoresData = useMemo(() => {
    const storeMap: Record<string, { store_name: string; code: string; count: number; customer: string }> = {};
    
    if (dataScope === 'projects') {
      filteredProjects.forEach(p => {
        const code = p.project_code || p.store_name;
        storeMap[code] = {
          store_name: p.project_name,
          code: p.project_code,
          count: p.subtaskCount,
          customer: p.customer
        };
      });
    } else {
      filteredRequests.forEach((r: RawRequestRecord) => {
        const code = r.ess_store_code || r.store_name || 'UNKNOWN';
        if (!storeMap[code]) {
          storeMap[code] = {
            store_name: r.store_name || 'Chưa rõ',
            code: r.ess_store_code || '-',
            count: 0,
            customer: r.customer || '-'
          };
        }
        storeMap[code].count += 1;
      });
    }

    return Object.values(storeMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [dataScope, filteredRequests, filteredProjects]);

  // Recurrent Warranty Data Engine (Phân tích Bảo hành Lặp lại N Lần)
  const recurrentWarrantyData = useMemo(() => {
    const warrantyRequests = requests.filter(r => {
      if (r.is_deleted_in_sheet) return false;
      const pa = (r.phuong_an || '').toLowerCase();
      const lrq = (r.loai_rq || '').toLowerCase();
      const posm = (r.posm || '').toLowerCase();
      const title = (r.title_email_request || '').toLowerCase();
      return pa.includes('bảo hành') || lrq.includes('bảo hành') || lrq.includes('sửa chữa') || posm.includes('bảo hành') || title.includes('bảo hành');
    });

    const groupMap = new Map<string, {
      key: string;
      storeName: string;
      storeCode: string;
      posm: string;
      brand: string;
      customer: string;
      supplier: string;
      incidents: Array<{
        sequence: number;
        id: string;
        requestId?: string;
        dateOfRq: string;
        parsedDate: Date | null;
        status: string;
        tienDo: string;
        visNote?: string;
      }>;
    }>();

    // Map parent preceding_request_id links
    const parentChildMap = new Map<string, string>();
    warrantyRequests.forEach(r => {
      const precId = (r.preceding_request_id || '').trim();
      const currentReqId = (r.request_id || `BH-${r.sheet_row_index}`).trim();
      if (precId && currentReqId && precId !== currentReqId) {
        parentChildMap.set(currentReqId, precId);
      }
    });

    warrantyRequests.forEach(r => {
      const currentReqId = (r.request_id || `BH-${r.sheet_row_index}`).trim();
      const storeKey = r.ess_store_code?.trim() || r.store_name?.trim() || 'STORE_UNKNOWN';
      const posmKey = r.posm?.trim() || 'POSM_UNKNOWN';
      const brandKey = r.brand?.trim() || r.cat?.trim() || 'BRAND_UNKNOWN';
      const projectKey = r.ma_du_an?.trim() || '';

      // Priority grouping key logic
      let compositeKey = '';
      if (parentChildMap.has(currentReqId)) {
        const parentId = parentChildMap.get(currentReqId)!;
        compositeKey = `PREC_PARENT__${parentId}`;
      } else if (Array.from(parentChildMap.values()).includes(currentReqId)) {
        compositeKey = `PREC_PARENT__${currentReqId}`;
      } else if (projectKey) {
        compositeKey = `${storeKey}__PROJ__${projectKey}`;
      } else {
        compositeKey = `${storeKey}__${posmKey}__${brandKey}`;
      }

      if (!groupMap.has(compositeKey)) {
        groupMap.set(compositeKey, {
          key: compositeKey,
          storeName: r.store_name || '-',
          storeCode: r.ess_store_code || '-',
          posm: r.posm || '-',
          brand: r.brand || r.cat || '-',
          customer: r.customer || '-',
          supplier: r.supplier || 'Chưa gán',
          incidents: []
        });
      }

      let parsedDate: Date | null = null;
      if (r.date_of_rq) {
        const parts = r.date_of_rq.trim().split('/');
        if (parts.length === 3) {
          parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          parsedDate = new Date(r.date_of_rq);
        }
      }

      const grp = groupMap.get(compositeKey)!;
      grp.incidents.push({
        sequence: 0,
        id: r.id!,
        requestId: currentReqId,
        dateOfRq: r.date_of_rq || '-',
        parsedDate,
        status: r.status || 'To Do',
        tienDo: r.tien_do || 'New',
        visNote: r.vis_note
      });
    });

    const groups = Array.from(groupMap.values());
    let totalRecurrentCount = 0;
    let totalWarrantyItems = groups.length;
    let repeat2Count = 0;
    let repeat3PlusCount = 0;
    let totalDaysBetween = 0;
    let daysBetweenCount = 0;

    const supplierDefectMap = new Map<string, number>();

    groups.forEach(grp => {
      grp.incidents.sort((a, b) => {
        if (a.parsedDate && b.parsedDate) return a.parsedDate.getTime() - b.parsedDate.getTime();
        return 0;
      });

      grp.incidents.forEach((inc, idx) => {
        inc.sequence = idx + 1;
      });

      if (grp.incidents.length > 1) {
        totalRecurrentCount++;
        if (grp.incidents.length === 2) repeat2Count++;
        else if (grp.incidents.length >= 3) repeat3PlusCount++;

        if (grp.supplier && grp.supplier !== 'Chưa gán') {
          supplierDefectMap.set(grp.supplier, (supplierDefectMap.get(grp.supplier) || 0) + (grp.incidents.length - 1));
        }

        for (let i = 1; i < grp.incidents.length; i++) {
          const prev = grp.incidents[i - 1].parsedDate;
          const curr = grp.incidents[i].parsedDate;
          if (prev && curr && !isNaN(prev.getTime()) && !isNaN(curr.getTime())) {
            const diffDays = Math.max(1, Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24)));
            totalDaysBetween += diffDays;
            daysBetweenCount++;
          }
        }
      }
    });

    const recurrentList = groups
      .filter(g => g.incidents.length > 1)
      .sort((a, b) => b.incidents.length - a.incidents.length);

    const repeatRate = totalWarrantyItems > 0 ? ((totalRecurrentCount / totalWarrantyItems) * 100).toFixed(1) : '0';
    const avgMTBF = daysBetweenCount > 0 ? Math.round(totalDaysBetween / daysBetweenCount) : 0;

    let worstSupplier = '-';
    let worstSupplierDefects = 0;
    supplierDefectMap.forEach((count, supp) => {
      if (count > worstSupplierDefects) {
        worstSupplierDefects = count;
        worstSupplier = supp;
      }
    });

    const chartData = [
      { name: 'Bảo hành 1 lần', count: totalWarrantyItems - totalRecurrentCount, fill: '#10B981' },
      { name: 'Bảo hành 2 lần', count: repeat2Count, fill: '#F59E0B' },
      { name: 'Bảo hành ≥3 lần', count: repeat3PlusCount, fill: '#EF4444' }
    ];

    return {
      totalWarrantyItems,
      totalRecurrentCount,
      repeatRate,
      avgMTBF,
      worstSupplier,
      worstSupplierDefects,
      recurrentList,
      chartData,
      allWarrantyGroups: groups
    };
  }, [requests]);

  // Handle Export Excel Báo Cáo
  const handleExportExcel = () => {
    let exportRows: any[] = [];

    if (dataScope === 'projects') {
      exportRows = filteredProjects.map((p, i) => ({
        'STT': i + 1,
        'Mã Dự Án / Request ID': p.project_code,
        'Tên Dự Án Master': p.project_name,
        'Cửa Hàng': p.store_name,
        'Hệ Thống (KA)': p.customer,
        'Brand': p.brand,
        'Supplier': p.supplier,
        'Tổng Subtask Con': p.subtaskCount,
        'Đã Hoàn Thành': p.completedCount,
        'Trạng Thái Dự Án': p.status
      }));
    } else {
      exportRows = filteredRequests.map((r: RawRequestRecord, i: number) => ({
        'STT': i + 1,
        'Dòng Sheet': r.sheet_row_index || i + 2,
        'Request ID': r.request_id || '-',
        'Mã CH': r.ess_store_code || '-',
        'Tên Cửa Hàng': r.store_name || '-',
        'Hệ Thống (KA)': r.customer || '-',
        'POSM Item': r.posm || '-',
        'Số Lượng': r.so_luong || 1,
        'Brand': r.brand || '-',
        'Ngày Gửi Request': r.date_of_rq || '-',
        'Tên SR': r.sr || '-',
        'Phương Án': r.phuong_an || '-',
        'Trạng Thái': r.status || '-',
        'Tiến Độ': r.tien_do || '-',
        'Supplier': r.supplier || '-',
        'Ngày Cần Hoàn Thành': r.ngay_quick_fix || r.deadline || '-',
        'SR Note': r.sr_note || '-',
        'Vis Note': r.vis_note || '-',
        'Mer Note': r.mer_note || '-'
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    const sheetName = dataScope === 'projects' ? 'Bao_Cao_Master_Projects' : 'Bao_Cao_POSM_Requests';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header & Data Scope Switcher Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Báo Cáo Phân Tích Điều Hành (PM Executive Analytics)
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Phân tích hiệu suất toàn chuỗi POSM, đo lường tỷ lệ hoàn thành SLA & kiểm soát đơn vị thi công
            </p>
          </div>

          {/* Data Scope Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setDataScope('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dataScope === 'requests'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>POSM Request ({requests.length})</span>
              </button>

              <button
                onClick={() => setDataScope('projects')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dataScope === 'projects'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Tổng Hợp Dự Án ({masterProjectGroups.length})</span>
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Xuất Excel Báo Cáo
            </button>
          </div>
        </div>

        {/* Global Multi-dimensional Filters */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            Bộ lọc:
          </div>

          {/* Filter Brand */}
          <select
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="ALL">Tất cả Nhãn hàng (Brand)</option>
            {brandList.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Filter Customer KA */}
          <select
            value={selectedCustomer}
            onChange={e => setSelectedCustomer(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="ALL">Tất cả Hệ thống CH (KA)</option>
            {customerList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Filter Supplier */}
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="ALL">Tất cả Nhà Cung Cấp (Supplier)</option>
            {supplierList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(selectedBrand !== 'ALL' || selectedCustomer !== 'ALL' || selectedSupplier !== 'ALL') && (
            <button
              onClick={() => { setSelectedBrand('ALL'); setSelectedCustomer('ALL'); setSelectedSupplier('ALL'); }}
              className="text-[11px] text-sky-600 hover:underline font-bold px-2 py-1"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Executive KPI Scorecard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              {dataScope === 'projects' ? 'Tổng Số Dự Án' : 'Tổng Request'}
            </span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-lg">
              {dataScope === 'projects' ? <Rocket className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {metrics.total}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {dataScope === 'projects' ? 'dự án Master' : 'yêu cầu POSM'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {dataScope === 'projects' ? 'Gom nhóm theo mã Subtask / Store' : 'Đã lọc theo điều kiện hệ thống'}
          </p>
        </div>

        {/* Card 2: Completion Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Tỷ Lệ Hoàn Thành</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {metrics.completionRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {metrics.completedCount} đã hoàn thành
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">SLA đạt chuẩn tiến độ thi công</p>
        </div>

        {/* Card 3: Overdue Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              {dataScope === 'projects' ? 'Dự Án Trễ Hạn' : 'Request Trễ Hạn'}
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
              {metrics.overdueCount}
            </span>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
              {metrics.overdueRate}% trễ SLA
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cần thúc giục nhà cung cấp thi công</p>
        </div>

        {/* Card 4: In Progress Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Đang Thi Công</span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 tracking-tight">
              {metrics.inProgressCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">đang xử lý</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bao gồm {metrics.reviewCount} chờ duyệt</p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-sky-600 text-sky-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📊 Tổng Quan Điều Hành
        </button>

        <button
          onClick={() => setActiveTab('supplier')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'supplier'
              ? 'border-sky-600 text-sky-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🏭 Hiệu Suất Nhà Cung Cấp
        </button>

        <button
          onClick={() => setActiveTab('heatmap')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'heatmap'
              ? 'border-sky-600 text-sky-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {dataScope === 'projects' ? '🚀 Top Dự Án Master Quy Mô Lớn' : '🏪 Phân Bổ Theo Siêu Thị & Brand'}
        </button>

        <button
          onClick={() => setActiveTab('recurrent_warranty')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'recurrent_warranty'
              ? 'border-amber-600 text-amber-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>🔄 Báo Cáo Bảo Hành Lặp Lại N Lần</span>
          {recurrentWarrantyData.totalRecurrentCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
              {recurrentWarrantyData.totalRecurrentCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Funnel Progress Chart */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {dataScope === 'projects' ? 'Phễu Chuyển Đổi Tiến Độ Dự Án Master' : 'Phễu Chuyển Đổi Tiến Độ Request POSM'}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 11, fontWeight: 600 }} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Brand Distribution Chart */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Nhu Cầu POSM Theo Nhãn Hàng (Brand)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={brandChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {brandChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={UNILEVER_BLUE_PALETTE[index % UNILEVER_BLUE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      )}

      {/* TAB 2: SUPPLIER & BOTTLENECK ANALYTICS */}
      {activeTab === 'supplier' && (
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Ma Trận Đánh Giá Hiệu Suất Nhà Cung Cấp ({dataScope === 'projects' ? 'Cấp Dự Án' : 'Cấp Request'})</span>
                <span className="text-[11px] text-slate-400 font-normal uppercase">Xếp hạng theo sản lượng</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3">STT</th>
                      <th className="p-3">Nhà Cung Cấp (Supplier)</th>
                      <th className="p-3 text-center">Tổng Phân Công</th>
                      <th className="p-3 text-center">Đã Hoàn Thành</th>
                      <th className="p-3 text-center">Trễ Hạn SLA</th>
                      <th className="p-3 text-right">Tỷ Lệ Hoàn Thành</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {supplierMatrixData.map((s, idx) => (
                      <tr key={s.supplier} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Factory className="w-4 h-4 text-sky-600" />
                          {s.supplier}
                        </td>
                        <td className="p-3 text-center font-bold">{s.total}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{s.done}</td>
                        <td className="p-3 text-center font-bold">
                          {s.overdue > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                              {s.overdue} trễ
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${s.rate >= 80 ? 'text-emerald-600' : s.rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {s.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: SUPERMARKET & REGION HEATMAP */}
      {activeTab === 'heatmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KA Breakdown */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Nhu Cầu Theo Hệ Thống Siêu Thị (KA / Customer)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerChartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0072CE" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top High Request Items/Stores */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {dataScope === 'projects' ? 'Top 10 Dự Án Master Có Nhiều Subtask Nhất' : 'Top 10 Siêu Thị Phát Sinh Request POSM Nhiều Nhất'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {topStoresData.map((st, i) => (
                  <div key={st.code} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-sky-50 text-sky-700 font-mono text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{st.store_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{st.code} • {st.customer}</div>
                      </div>
                    </div>
                    <span className="font-extrabold text-sky-600 bg-sky-50 dark:bg-sky-950 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                      {st.count} {dataScope === 'projects' ? 'Subtasks' : 'Requests'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: RECURRENT WARRANTY ANALYTICS */}
      {activeTab === 'recurrent_warranty' && (
        <div className="space-y-6">
          {/* Recurrent KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">POSM Bảo Hành Lặp (&gt;1 Lần)</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                  {recurrentWarrantyData.totalRecurrentCount}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  / {recurrentWarrantyData.totalWarrantyItems} mã POSM
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Các sản phẩm từng phát sinh từ 2 lần BH trở lên</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Tỷ Lệ Bảo Hành Lặp</span>
                <div className="p-2 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                  {recurrentWarrantyData.repeatRate}%
                </span>
                <span className="text-xs font-semibold text-slate-400">tỷ lệ tái hỏng</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Tỷ lệ POSM bị sự cố lặp lại sau lần BH đầu</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Thời Gian Giữa Lần Hỏng (MTBF)</span>
                <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 tracking-tight">
                  {recurrentWarrantyData.avgMTBF}
                </span>
                <span className="text-xs font-semibold text-slate-400">ngày / lần hỏng</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Khoảng thời gian trung bình giữa 2 lần báo lỗi</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Supplier Cần Kiểm Soát Chất Lượng</span>
                <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
                  <Factory className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-purple-700 dark:text-purple-300 tracking-tight truncate max-w-[180px]" title={recurrentWarrantyData.worstSupplier}>
                  {recurrentWarrantyData.worstSupplier}
                </span>
              </div>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
                Phát sinh {recurrentWarrantyData.worstSupplierDefects} lượt hỏng lặp
              </p>
            </div>
          </div>

          {/* Detailed Recurrent Warranty Table & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Recurrent Breakdown */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 lg:col-span-1">
              <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Phân Bổ Tần Suất Bảo Hành POSM
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={recurrentWarrantyData.chartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {recurrentWarrantyData.chartData.map((entry, index) => (
                        <Cell key={`cell-rec-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} mẫu POSM`, 'Số lượng']} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Table: Top Recurrent Warranty Items */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 lg:col-span-2">
              <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Danh Sách Siêu Thị & POSM Bị Bảo Hành Lặp Nhất ({recurrentWarrantyData.recurrentList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 text-center">STT</th>
                      <th className="p-3">Siêu Thị / Mã Store</th>
                      <th className="p-3">Loại POSM & Brand</th>
                      <th className="p-3 text-center">Số Lần BH</th>
                      <th className="p-3">Chuỗi Thời Gian Bảo Hành</th>
                      <th className="p-3">Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {recurrentWarrantyData.recurrentList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          Chưa ghi nhận sản phẩm POSM nào bị hỏng lặp lại từ 2 lần trở lên.
                        </td>
                      </tr>
                    ) : (
                      recurrentWarrantyData.recurrentList.map((item, idx) => (
                        <tr key={item.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{item.storeName}</div>
                            <div className="text-[11px] font-mono text-slate-400">{item.storeCode} • {item.customer}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400">{item.posm}</div>
                            <div className="text-[11px] text-slate-500 font-mono">🏷️ {item.brand}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold ${
                              item.incidents.length >= 3 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              🔄 BH Lần #{item.incidents.length}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.incidents.map((inc) => (
                                <span
                                  key={inc.id}
                                  className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                                  title={`BH #${inc.sequence}: Request ${inc.requestId || inc.id} (${inc.status})`}
                                >
                                  <span>Lần #{inc.sequence}: {inc.dateOfRq}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{item.supplier}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}
