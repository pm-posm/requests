import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { 
  Search, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp, ChevronRight,
  CheckCircle2, AlertTriangle, ClipboardList, Filter, FileSpreadsheet, 
  FileText, Image, Play, ShieldAlert, Award, Package, ShieldCheck, Table, BarChart3, Factory,
  X, ExternalLink, Calendar, UserCheck, MapPin, Eye, ArrowLeft, Store, Phone, User, Mail
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getLiveMasterContactMap, type MasterStoreContactInfo } from '@/services/sheetSyncService';
import { NtxxInboxView } from './ntxx/NtxxInboxView';

// Define the interface for the raw NTXX spreadsheet row mapped to clean camelCase fields
interface NtxxRow {
  timestamp: string;      // Dấu thời gian
  email: string;          // Địa chỉ email
  technician: string;     // POSM QC Technician
  scheduleDate: string;   // Ngày gửi lịch NTXX  
  actualDate: string;     // Ngày NTXX  
  projectCode: string;    // Mã dự án  (gồm 6 số)
  supplierName: string;   // Supplier 
  category: string;       // Chọn CAT
  brand: string;          // Brand
  item: string;           // Hạng mục  
  qty: string;            // Số lượng POSM NTXX
  unit: string;           // Đơn vị POSM
  result: string;         // Kết Quả NTXX
  customer: string;       // Customer
  bbntLink: string;       // Ảnh BBNT
  overviewLink: string;   // Ảnh Tổng Quan
  detailLink1: string;    // Ảnh chi tiết 1
  detailLink2: string;    // Ảnh chi tiết 2
  videoLink: string;      // Video chi tiết
  storesPass: string;     // Tên Store (Đ)
  storesFail: string;     // Tên Store (KĐ)
  note: string;           // Ghi chú
}

// Grouped NTXX Project interface
interface GroupedNtxxProject {
  projectCode: string;
  category: string;
  brand: string;
  customer: string;
  item: string;
  batches: NtxxRow[];
  stats: {
    totalBatches: number;
    totalQty: number;
    passedBatches: number;
    failedBatches: number;
    passRate: number;
    isFailed: boolean;
  };
}

// Mapped columns from Vietnamese sheet header (with spaces trimmed) to English fields
const COLUMN_MAPPING: Record<string, keyof NtxxRow> = {
  'Dấu thời gian': 'timestamp',
  'Địa chỉ email': 'email',
  'POSM QC Technician': 'technician',
  'Ngày gửi lịch NTXX': 'scheduleDate',
  'Ngày NTXX': 'actualDate',
  'Mã dự án (gồm 6 số)': 'projectCode',
  'Supplier': 'supplierName',
  'Chọn CAT': 'category',
  'Brand': 'brand',
  'Hạng mục': 'item',
  'Số lượng POSM NTXX': 'qty',
  'Đơn vị POSM': 'unit',
  'Kết Quả NTXX': 'result',
  'Customer': 'customer',
  'Ảnh BBNT': 'bbntLink',
  'Ảnh Tổng Quan': 'overviewLink',
  'Ảnh chi tiết 1': 'detailLink1',
  'Ảnh chi tiết 2': 'detailLink2',
  'Video chi tiết': 'videoLink',
  'Tên Store (Đ)': 'storesPass',
  'Tên Store (KĐ)': 'storesFail',
  'Ghi chú': 'note',
};

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/110dpKX0WPZ76LHImzqrZwt58wG6Kq3rkCJ-ilpRpsbg/export?format=csv&gid=2095387878';
const DEFAULT_NTXX_WEB_APP_URL = (import.meta.env.VITE_REQUEST_WEB_APP_URL || '').trim() || 'https://script.google.com/macros/s/AKfycbxztDMOhd6lO6QY_AmF4jMyXUWCP69jlb8XY7f9zIAQVGhXukaa0I_kd_uwqrTce8Y4iA/exec';

export default function TrackingNtxx() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive activeModuleTab directly from URL pathname
  const activeModuleTab = useMemo<'DATA_LIST' | 'ANALYST' | 'INBOX'>(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/tracking/ntxx/analytics') || path.includes('/tracking/ntxx/report')) {
      return 'ANALYST';
    }
    if (path.includes('/tracking/ntxx/inbox')) {
      return 'INBOX';
    }
    return 'DATA_LIST';
  }, [location.pathname]);

  const handleTabChange = (tab: 'DATA_LIST' | 'ANALYST' | 'INBOX') => {
    if (tab === 'ANALYST') {
      navigate('/tracking/ntxx/analytics');
    } else if (tab === 'INBOX') {
      navigate('/tracking/ntxx/inbox');
    } else {
      navigate('/tracking/ntxx');
    }
  };

  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('ntxx_web_app_url') || DEFAULT_NTXX_WEB_APP_URL;
  });

  const handleSaveWebAppUrl = (newUrl: string) => {
    setWebAppUrl(newUrl);
    localStorage.setItem('ntxx_web_app_url', newUrl);
  };

  const [rawData, setRawData] = useState<NtxxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString('vi-VN'));
  const [countdownSeconds, setCountdownSeconds] = useState(30);

  // Selected Project Detail Drawer State
  const [selectedDetailProject, setSelectedDetailProject] = useState<GroupedNtxxProject | null>(null);

  // Master Store Contact Directory Map State
  const [contactMap, setContactMap] = useState<Map<string, MasterStoreContactInfo>>(new Map());

  // Store List Right Sidebar Drawer State
  const [storeDrawerConfig, setStoreDrawerConfig] = useState<{
    isOpen: boolean;
    type: 'PASS' | 'FAIL';
    storesList: string[];
    batchIndex: number;
    projectCode: string;
    supplierName: string;
  }>({
    isOpen: false,
    type: 'PASS',
    storesList: [],
    batchIndex: 0,
    projectCode: '',
    supplierName: ''
  });

  // Pre-load Master Store Contact Map
  useEffect(() => {
    getLiveMasterContactMap().then(map => {
      setContactMap(map);
    }).catch(err => {
      console.warn('Could not load master contact map:', err);
    });
  }, []);

  // Expanded projects state (tầng 1)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  // Expanded batches state (tầng 2)
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedResult, setSelectedResult] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState('all');

  // Pagination State for Projects
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async (showToast = false) => {
    setIsRefreshing(true);
    setError(null);
    try {
      const targetUrl = `${SHEET_CSV_URL}&_cachebust=${Date.now()}`;
      let csvText = '';
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        csvText = await res.text();
      } catch {
        // Fallback to gviz endpoint if export endpoint fails
        const gvizUrl = `https://docs.google.com/spreadsheets/d/110dpKX0WPZ76LHImzqrZwt58wG6Kq3rkCJ-ilpRpsbg/gviz/tq?tqx=out:csv&gid=2095387878&_cachebust=${Date.now()}`;
        const res2 = await fetch(gvizUrl);
        if (!res2.ok) throw new Error(`Fallback HTTP ${res2.status}`);
        csvText = await res2.text();
      }

      const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      // Map raw row fields with flexible spaces cleaning
      const formattedData = (results.data as any[]).map((row) => {
        const mappedRow: Partial<NtxxRow> = {};
        Object.entries(row).forEach(([key, val]) => {
          const cleaned = key.replace(/\s+/g, ' ').trim();
          const mappedField = COLUMN_MAPPING[cleaned];
          if (mappedField) {
            mappedRow[mappedField] = (val as string || '').trim();
          }
        });
        return mappedRow as NtxxRow;
      }).filter(item => item.projectCode || item.item || item.supplierName);

      setRawData(formattedData);
      setIsLoading(false);
      setIsRefreshing(false);
      setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
      setCountdownSeconds(30);
      if (showToast) {
        toast.success('Đã kéo dữ liệu mới nhất từ Sheet Form_Responses2!');
      }
    } catch (err: any) {
      console.error('Error fetching NTXX sheet data:', err);
      setError('Không thể lấy dữ liệu Nghiệm thu xuất xưởng từ Google Sheet. Vui lòng kiểm tra quyền truy cập hoặc kết nối.');
      setIsLoading(false);
      setIsRefreshing(false);
      if (showToast) {
        toast.error('Lỗi khi tải dữ liệu NTXX từ Google Sheet');
      }
    }
  };

  // Real-time Auto-polling Interval (mỗi 30s tự động kéo dữ liệu mới từ Sheet)
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          loadData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  // Get unique options for filters based on raw data
  const filterOptions = useMemo(() => {
    const suppliers = new Set<string>();
    const brands = new Set<string>();
    const resultsSet = new Set<string>();
    const technicians = new Set<string>();

    rawData.forEach(row => {
      if (row.supplierName) suppliers.add(row.supplierName);
      if (row.brand) brands.add(row.brand);
      if (row.result) resultsSet.add(row.result);
      if (row.technician) technicians.add(row.technician);
    });

    return {
      suppliers: Array.from(suppliers).sort(),
      brands: Array.from(brands).sort(),
      results: Array.from(resultsSet).sort(),
      technicians: Array.from(technicians).sort()
    };
  }, [rawData]);

  // Step 1: Filter Flat Rows based on UI filters
  const filteredFlatRows = useMemo(() => {
    return rawData.filter(row => {
      // Search term matches: Mã dự án, Customer, Supplier, CAT, Brand, Hạng mục, Ghi chú, Cửa hàng
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ? true : (
        (row.projectCode || '').toLowerCase().includes(term) ||
        (row.customer || '').toLowerCase().includes(term) ||
        (row.supplierName || '').toLowerCase().includes(term) ||
        (row.category || '').toLowerCase().includes(term) ||
        (row.brand || '').toLowerCase().includes(term) ||
        (row.item || '').toLowerCase().includes(term) ||
        (row.note || '').toLowerCase().includes(term) ||
        (row.storesPass || '').toLowerCase().includes(term) ||
        (row.storesFail || '').toLowerCase().includes(term)
      );

      const matchesSupplier = selectedSupplier === 'all' || row.supplierName === selectedSupplier;
      const matchesBrand = selectedBrand === 'all' || row.brand === selectedBrand;
      const matchesResult = selectedResult === 'all' || row.result === selectedResult;
      const matchesTechnician = selectedTechnician === 'all' || row.technician === selectedTechnician;

      return matchesSearch && matchesSupplier && matchesBrand && matchesResult && matchesTechnician;
    });
  }, [rawData, searchTerm, selectedSupplier, selectedBrand, selectedResult, selectedTechnician]);

  // Step 2: Group the filtered flat rows into Grouped Projects
  const groupedProjects = useMemo(() => {
    const groups: Record<string, GroupedNtxxProject> = {};

    filteredFlatRows.forEach(row => {
      const code = row.projectCode || 'NO_CODE';
      if (!groups[code]) {
        groups[code] = {
          projectCode: code,
          category: row.category || 'N/A',
          brand: row.brand || 'N/A',
          customer: row.customer || 'Chưa phân loại',
          item: row.item || 'N/A',
          batches: [],
          stats: {
            totalBatches: 0,
            totalQty: 0,
            passedBatches: 0,
            failedBatches: 0,
            passRate: 0,
            isFailed: false
          }
        };
      }
      groups[code].batches.push(row);
    });

    // Compute stats for each project group
    const projectList = Object.values(groups).map(project => {
      const totalBatches = project.batches.length;
      let totalQty = 0;
      let passedBatches = 0;
      let failedBatches = 0;

      project.batches.forEach(batch => {
        // Accumulate quantity
        const qtyNum = parseInt(batch.qty) || 0;
        totalQty += qtyNum;

        // Count status
        const res = (batch.result || '').trim().toLowerCase();
        if (res === 'đạt' || res === 'pass') {
          passedBatches++;
        } else if (res === 'không đạt' || res === 'fail') {
          failedBatches++;
        }
      });

      const passRate = totalBatches > 0 ? Math.round((passedBatches / totalBatches) * 100) : 0;
      const isFailed = failedBatches > 0;

      project.stats = {
        totalBatches,
        totalQty,
        passedBatches,
        failedBatches,
        passRate,
        isFailed
      };

      return project;
    });

    // Sort projects alphabetically by project code
    return projectList.sort((a, b) => a.projectCode.localeCompare(b.projectCode));
  }, [filteredFlatRows]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSupplier, selectedBrand, selectedResult, selectedTechnician]);

  // Pagination Logic for Projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return groupedProjects.slice(startIndex, startIndex + pageSize);
  }, [groupedProjects, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(groupedProjects.length / pageSize));

  // Global KPIs (based on filtered flat inspections)
  const stats = useMemo(() => {
    const totalInspections = filteredFlatRows.length;
    const totalProjects = groupedProjects.length;
    let totalQty = 0;
    let passed = 0;
    let failed = 0;

    filteredFlatRows.forEach(row => {
      const qtyNum = parseInt(row.qty) || 0;
      totalQty += qtyNum;

      const res = (row.result || '').toLowerCase().trim();
      if (res === 'đạt' || res === 'pass') {
        passed++;
      } else if (res === 'không đạt' || res === 'fail') {
        failed++;
      }
    });

    const passRate = totalInspections > 0 ? Math.round((passed / totalInspections) * 100) : 0;

    return {
      totalInspections,
      totalProjects,
      totalQty,
      passed,
      failed,
      passRate
    };
  }, [filteredFlatRows, groupedProjects]);

  // Toggle Project Expand/Collapse
  const toggleProject = (projectCode: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectCode]: !prev[projectCode]
    }));
  };

  // Toggle Batch Expand/Collapse
  const toggleBatch = (batchKey: string) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchKey]: !prev[batchKey]
    }));
  };

  // Helper to determine result badge styling
  const getResultBadgeStyle = (resultStr: string) => {
    const r = (resultStr || '').toLowerCase().trim();
    if (r === 'đạt' || r === 'pass') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (r === 'không đạt' || r === 'fail') {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  // Render link button to Google Drive
  const renderDriveLink = (url: string, label: string, icon: React.ReactNode) => {
    if (!url || url.trim() === '') return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-xs"
      >
        {icon}
        {label}
      </a>
    );
  };

  // If a specific project is selected, render ONLY the dedicated Project Detail View Component
  if (selectedDetailProject) {
    return (
      <div className="space-y-6">
        <NtxxProjectDetailView 
          project={selectedDetailProject} 
          onBack={() => setSelectedDetailProject(null)} 
          onOpenStoreDrawer={(config) => setStoreDrawerConfig({ ...config, isOpen: true })}
          onViewInbox={() => {
            setSelectedDetailProject(null);
            navigate('/tracking/ntxx/inbox');
          }}
        />

        <NtxxStoreListDrawer 
          isOpen={storeDrawerConfig.isOpen}
          onClose={() => setStoreDrawerConfig(prev => ({ ...prev, isOpen: false }))}
          type={storeDrawerConfig.type}
          storesList={storeDrawerConfig.storesList}
          batchIndex={storeDrawerConfig.batchIndex}
          projectCode={storeDrawerConfig.projectCode}
          supplierName={storeDrawerConfig.supplierName}
          contactMap={contactMap}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* TOP HEADER SECTION - UNIFIED REAL-TIME SYNC HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700">
            <Factory className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Điều Hành &amp; Phân Tích Nghiệm Thu Xuất Xưởng (NTXX)
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Sync Active
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-xs flex items-center gap-1.5">
                <span>Sync: {lastSyncedAt}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 border-l border-slate-300 dark:border-slate-700 pl-1.5 font-semibold">
                  🔄 0:{(countdownSeconds % 60).toString().padStart(2, '0')}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Google Sheet Form_Responses2 • <strong className="text-slate-800 dark:text-slate-200 font-semibold">{groupedProjects.length} Mã Dự Án</strong> ({rawData.length} Đợt nghiệm thu tại xưởng)
            </p>
          </div>
        </div>

        {/* TOP MODULE CONTROLS */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Đồng Bổ Sheet'}</span>
          </button>
        </div>
      </div>

      {/* MODULE INTERNAL NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit flex-wrap">
        <button
          onClick={() => handleTabChange('DATA_LIST')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeModuleTab === 'DATA_LIST'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Danh Sách Dữ Liệu</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
            {groupedProjects.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('ANALYST')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeModuleTab === 'ANALYST'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Báo Cáo Phân Tích</span>
        </button>

        <button
          onClick={() => handleTabChange('INBOX')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeModuleTab === 'INBOX'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Hộp Thư Gmail</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase tracking-wider animate-pulse">
            Live
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải và đồng hóa dữ liệu từ Google Sheets...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm text-center px-4">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Lỗi tải dữ liệu</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">{error}</p>
          <button onClick={loadData} className="mt-6 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium">Thử lại</button>
        </div>
      ) : (
        <>
          {/* TAB 1: DEDICATED ANALYST / REPORTS WORKSPACE */}
          {activeModuleTab === 'ANALYST' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* KPI Dashboard Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng dự án</span>
                      <div className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-500">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.totalProjects}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">({stats.totalInspections} Đợt NTXX)</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tỷ Lệ Đạt (FAT)</span>
                      <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.passRate}%</span>
                      <span className="block text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">{stats.passed} Đợt Đạt</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-rose-500">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đợt Không Đạt</span>
                      <div className="p-1 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.failed}</span>
                      <span className="block text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">Cần sửa lỗi / sản xuất lại</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-indigo-500">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng POSM NTXX</span>
                      <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                        <Package className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.totalQty}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Sản phẩm hoàn thiện</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">QC Đánh Giá</span>
                      <div className="p-1 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                        <Award className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{filterOptions.technicians.length}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Kỹ thuật viên tại xưởng</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: CLEAN OPERATIONAL DATA LIST & FILTERS WORKSPACE */}
          {activeModuleTab === 'DATA_LIST' && (
            <div className="space-y-6 animate-in fade-in duration-200">

          {/* Filtering Area */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Filter className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">BỘ LỌC TÌM KIẾM NÂNG CAO</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              
              {/* Text search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm dự án, hạng mục, supplier..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
                />
              </div>

              {/* Supplier Filter */}
              <div>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium cursor-pointer"
                >
                  <option value="all">Nhà thầu (Tất cả)</option>
                  {filterOptions.suppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Brand Filter */}
              <div>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium cursor-pointer"
                >
                  <option value="all">Nhãn hàng (Tất cả)</option>
                  {filterOptions.brands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* QC Filter */}
              <div>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium cursor-pointer"
                >
                  <option value="all">QC Technician (Tất cả)</option>
                  {filterOptions.technicians.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Kết quả xuất xưởng:</span>
                <div className="flex flex-wrap gap-1">
                  <button 
                    onClick={() => setSelectedResult('all')}
                    className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${selectedResult === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Tất cả ({rawData.length})
                  </button>
                  {filterOptions.results.map(res => {
                    const count = rawData.filter(r => r.result === res).length;
                    return (
                      <button
                        key={res}
                        onClick={() => setSelectedResult(res)}
                        className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${selectedResult === res ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {res} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {(searchTerm || selectedSupplier !== 'all' || selectedBrand !== 'all' || selectedResult !== 'all' || selectedTechnician !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSupplier('all');
                    setSelectedBrand('all');
                    setSelectedResult('all');
                    setSelectedTechnician('all');
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

          </div>

          {/* Grouped Projects Table (Tier 1 - Clean Summary Rows) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800 text-left text-sm text-slate-800 dark:text-slate-200">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4 w-[14%]">Mã Dự Án</th>
                    <th scope="col" className="px-6 py-4 w-[14%]">Customer</th>
                    <th scope="col" className="px-6 py-4">Nhãn hàng &amp; CAT</th>
                    <th scope="col" className="px-6 py-4">Hạng mục tiêu biểu</th>
                    <th scope="col" className="px-6 py-4 w-[14%]">Đợt Nghiệm Thu</th>
                    <th scope="col" className="px-6 py-4 w-[22%]">Tỷ lệ Đạt Xuất Xưởng</th>
                    <th scope="col" className="px-6 py-4 w-[12%] text-right">Chi Tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {paginatedProjects.map((project) => {
                    const { totalBatches, totalQty, passedBatches, failedBatches, passRate, isFailed } = project.stats;

                    return (
                      <tr 
                        key={project.projectCode}
                        onClick={() => setSelectedDetailProject(project)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors font-medium border-l-2 border-l-transparent hover:border-l-indigo-500 cursor-pointer"
                      >
                        {/* Project Code Clickable Link */}
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailProject(project);
                            }}
                            className="inline-flex items-center gap-1.5 font-extrabold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline cursor-pointer group"
                          >
                            <span className="text-sm">#{project.projectCode}</span>
                            <Eye className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-extrabold text-xs">
                            {project.customer}
                          </Badge>
                        </td>

                        {/* Brand & Category */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900 font-semibold">
                              {project.brand}
                            </Badge>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">({project.category})</span>
                          </div>
                        </td>

                        {/* Typical Item */}
                        <td className="px-6 py-4 max-w-xs md:max-w-sm">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={project.item}>
                            {project.item}
                          </div>
                        </td>

                        {/* Batches count & Total Qty */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{totalBatches} đợt</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Số lượng: {totalQty} cái</div>
                        </td>

                        {/* Pass rate & visual progress bar */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            <span className="flex items-center gap-1">
                              {isFailed ? (
                                <span className="text-rose-500 font-bold">{failedBatches} đợt LỖI</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{passedBatches}/{totalBatches} Đạt</span>
                              )}
                            </span>
                            <span className={`font-bold ${passRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{passRate}% đạt</span>
                          </div>
                          {/* Visual Progress Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/20 shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${passRate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              style={{ width: `${passRate}%` }}
                            />
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailProject(project);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {groupedProjects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                        Không có đợt nghiệm thu nào khớp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {groupedProjects.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>
                  <select 
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-xs"
                  >
                    {[10, 25, 50, 100].map(size => (
                      <option key={size} value={size}>{size} dự án</option>
                    ))}
                  </select>
                  <span>trên tổng số <strong>{groupedProjects.length}</strong> dự án ({filteredFlatRows.length} đợt nghiệm thu)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs"
                  >
                    Đầu
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs"
                  >
                    Trước
                  </button>
                  
                  <span className="px-3 text-slate-700 dark:text-slate-300">
                    Trang <strong>{currentPage}</strong> / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs"
                  >
                    Sau
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs"
                  >
                    Cuối
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

          {/* TAB 3: DEDICATED NTXX GMAIL INBOX WORKSPACE */}
          {activeModuleTab === 'INBOX' && (
            <div className="animate-in fade-in duration-150">
              <NtxxInboxView />
            </div>
          )}
        </>
      )}
    </div>
  );
}

{/* DEDICATED FULL-PAGE PROJECT DETAIL COMPONENT */}
function NtxxProjectDetailView({ 
  project, 
  onBack,
  onOpenStoreDrawer,
  onViewInbox
}: { 
  project: GroupedNtxxProject; 
  onBack: () => void; 
  onOpenStoreDrawer: (config: {
    type: 'PASS' | 'FAIL';
    storesList: string[];
    batchIndex: number;
    projectCode: string;
    supplierName: string;
  }) => void;
  onViewInbox?: (projectCode: string) => void;
}) {
  // Track open/collapsed state for each batch card inside this project view
  // Default open all batch cards so user sees details right away, but can click to collapse/expand
  const [openBatches, setOpenBatches] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    project.batches.forEach((_, idx) => {
      initial[idx] = true; // Default expanded
    });
    return initial;
  });

  const toggleBatchCard = (idx: number) => {
    setOpenBatches(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border border-slate-200/80 dark:border-slate-700"
          >
            <ArrowLeft className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Quay lại Danh Sách Dự Án</span>
          </button>
          
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline-block">
            Nghiệm Thu Xuất Xưởng / <strong className="text-slate-900 dark:text-slate-100 font-extrabold">Chi Tiết Dự Án #{project.projectCode}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onViewInbox && (
            <button
              type="button"
              onClick={() => onViewInbox(project.projectCode)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Xem hòm thư trao đổi và BBNT dự án này"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Hộp Thư NTXX</span>
            </button>
          )}

          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs px-3 py-1">
            {project.brand} ({project.category})
          </Badge>
        </div>
      </div>

      {/* Project Executive Summary Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Chi Tiết Dự Án #{project.projectCode}
              </h2>
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs">
                {project.batches.length} đợt NTXX tại xưởng
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hạng mục tiêu biểu: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{project.item}</strong>
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Tổng số lượng POSM</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block">{project.stats.totalQty} cái</span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Tỷ Lệ Đạt Xuất Xưởng</span>
              <span className={`text-xl font-extrabold mt-0.5 block ${project.stats.passRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {project.stats.passRate}% ({project.stats.passedBatches}/{project.stats.totalBatches} Đạt)
              </span>
            </div>
          </div>
        </div>

        {/* Executive Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Tiến Độ Đạt Chuẩn Nghiệm Thu</span>
            <span>{project.stats.passedBatches} / {project.stats.totalBatches} đợt Đạt</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200/40">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${project.stats.passRate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${project.stats.passRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* LIST OF INSPECTION BATCHES (CARDS WITH CLICK TO EXPAND/COLLAPSE - XỔ XUỐNG) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Factory className="w-4 h-4 text-emerald-600" />
            <span>Danh Sách Các Đợt Nghiệm Thu Tại Xưởng ({project.batches.length} đợt)</span>
          </h3>
          <span className="text-xs text-slate-400">Bấm vào từng đợt bên dưới để đóng/mở (xổ xuống) xem chi tiết</span>
        </div>

        <div className="space-y-3">
          {project.batches.map((batch, bIdx) => {
            const isOpen = !!openBatches[bIdx];
            const resLower = (batch.result || '').toLowerCase();
            const isPass = resLower.includes('đạt') && !resLower.includes('không');
            const isFail = resLower.includes('không');

            const passStoresCount = batch.storesPass ? batch.storesPass.split(',').map(s => s.trim()).filter(Boolean).length : 0;
            const failStoresCount = batch.storesFail ? batch.storesFail.split(',').map(s => s.trim()).filter(Boolean).length : 0;

            return (
              <div 
                key={bIdx}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  isFail 
                    ? 'border-rose-200 dark:border-rose-900/60' 
                    : isPass 
                      ? 'border-slate-200/80 dark:border-slate-800' 
                      : 'border-amber-200 dark:border-amber-900/60'
                }`}
              >
                {/* BATCH CARD HEADER BAR - CLICK TO TOGGLE EXPAND/COLLAPSE (XỔ XUỐNG) */}
                <div 
                  onClick={() => toggleBatchCard(bIdx)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5 flex-wrap">
                    <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>

                    <span className="text-xs font-extrabold px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                      Đợt #{bIdx + 1}
                    </span>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span>Nhà thầu: <strong className="text-slate-900 dark:text-white">{batch.supplierName || 'Chưa gán'}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Hạng mục: <strong>{batch.item}</strong></span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{batch.qty} {batch.unit || 'Cái'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block text-xs">
                      <span className="text-slate-400 block text-[10px]">Ngày NTXX thực tế</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{batch.actualDate || 'Chưa thực hiện'}</span>
                    </div>

                    {isPass ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-1">
                        🟢 ĐẠT XUẤT XƯỞNG
                      </Badge>
                    ) : isFail ? (
                      <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1">
                        🔴 KHÔNG ĐẠT
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-bold text-xs px-3 py-1">
                        🟡 KHÁC: {batch.result || 'Chưa cập nhật'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* BATCH EXPANDED BODY (XỔ XUỐNG CHI TIẾT) */}
                {isOpen && (
                  <div className="p-5 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                    
                    {/* Key Milestones & Personnel Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      
                      {/* Milestone 1: Ngày gửi lịch */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-sky-500" />
                          <span>Ngày gửi lịch NTXX</span>
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                          {batch.scheduleDate || 'Chưa gửi lịch'}
                        </div>
                      </div>

                      {/* Milestone 2: Ngày thực tế NTXX tại xưởng */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                          <Factory className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Ngày thực tế NTXX</span>
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                          {batch.actualDate || 'Chưa thực hiện'}
                        </div>
                      </div>

                      {/* Supplier */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[11px] font-medium text-slate-400">Nhà thầu (Supplier)</div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                          {batch.supplierName || 'Chưa gán'}
                        </div>
                      </div>

                      {/* POSM QC Tech */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>POSM QC Technician</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {batch.technician || 'Chưa cập nhật'}
                          {batch.email && <span className="text-[10px] text-slate-400 block font-normal truncate">{batch.email}</span>}
                        </div>
                      </div>

                    </div>

                    {/* Store Breakdowns Triggers (Cửa hàng Đạt & Không Đạt -> Click to open Sidebar Right Drawer) */}
                    {(batch.storesPass || batch.storesFail) && (
                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-500" />
                          <span>Danh Sách Cửa Hàng Phân Bổ ({passStoresCount + failStoresCount} store) — Bấm vào để xem chi tiết SR / VIS-Tech:</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {batch.storesPass && (
                            <button
                              type="button"
                              onClick={() => onOpenStoreDrawer({
                                type: 'PASS',
                                storesList: batch.storesPass.split(',').map(s => s.trim()).filter(Boolean),
                                batchIndex: bIdx,
                                projectCode: project.projectCode,
                                supplierName: batch.supplierName
                              })}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-extrabold transition-all cursor-pointer shadow-2xs group"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>🟢 Cửa hàng Đạt ({passStoresCount} store)</span>
                              <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
                            </button>
                          )}

                          {batch.storesFail && (
                            <button
                              type="button"
                              onClick={() => onOpenStoreDrawer({
                                type: 'FAIL',
                                storesList: batch.storesFail.split(',').map(s => s.trim()).filter(Boolean),
                                batchIndex: bIdx,
                                projectCode: project.projectCode,
                                supplierName: batch.supplierName
                              })}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100/90 text-rose-800 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-extrabold transition-all cursor-pointer shadow-2xs group"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>🔴 Cửa hàng Không Đạt ({failStoresCount} store)</span>
                              <ChevronRight className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Drive Evidence Documents / Media Attachments */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                        📂 Hồ Sơ Minh Chứng &amp; Tài Liệu Drive Đính Kèm
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {batch.bbntLink && (
                          <a
                            href={batch.bbntLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900 transition-colors shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ảnh BBNT</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                        {batch.overviewLink && (
                          <a
                            href={batch.overviewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900 transition-colors shadow-2xs"
                          >
                            <Image className="w-3.5 h-3.5" />
                            <span>Ảnh Tổng Quan</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                        {batch.detailLink1 && (
                          <a
                            href={batch.detailLink1}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900 transition-colors shadow-2xs"
                          >
                            <Image className="w-3.5 h-3.5" />
                            <span>Ảnh Chi Tiết 1</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                        {batch.detailLink2 && (
                          <a
                            href={batch.detailLink2}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900 transition-colors shadow-2xs"
                          >
                            <Image className="w-3.5 h-3.5" />
                            <span>Ảnh Chi Tiết 2</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                        {batch.videoLink && (
                          <a
                            href={batch.videoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900 transition-colors shadow-2xs"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Video Chi Tiết</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                        {!batch.bbntLink && !batch.overviewLink && !batch.detailLink1 && !batch.detailLink2 && !batch.videoLink && (
                          <span className="text-xs text-slate-400 italic">Chưa đính kèm link Drive</span>
                        )}
                      </div>
                    </div>

                    {/* QC Comments / Note */}
                    {batch.note && (
                      <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 text-xs">
                        <span className="font-bold text-amber-900 dark:text-amber-200 block mb-0.5">💬 Ghi chú của QC Inspector:</span>
                        <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                          {batch.note}
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

{/* STORE LIST RIGHT SIDEBAR DRAWER COMPONENT */}
function NtxxStoreListDrawer({
  isOpen,
  onClose,
  type,
  storesList,
  batchIndex,
  projectCode,
  supplierName,
  contactMap
}: {
  isOpen: boolean;
  onClose: () => void;
  type: 'PASS' | 'FAIL';
  storesList: string[];
  batchIndex: number;
  projectCode: string;
  supplierName: string;
  contactMap: Map<string, MasterStoreContactInfo>;
}) {
  const [search, setSearch] = useState('');
  const [selectedVisTech, setSelectedVisTech] = useState<string>('all');

  // Compute VIS-Tech counts for stores in this list
  const visTechOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    storesList.forEach(sName => {
      const info = findStoreContactInfo(sName, contactMap);
      const name = info?.mer_name || info?.opsup_name || 'Chưa cập nhật VIS-Tech';
      counts[name] = (counts[name] || 0) + 1;
    });

    const list = Object.entries(counts).map(([name, count]) => ({
      name,
      count
    }));

    list.sort((a, b) => {
      if (a.name.includes('Chưa cập nhật')) return 1;
      if (b.name.includes('Chưa cập nhật')) return -1;
      return a.name.localeCompare(b.name, 'vi');
    });

    return list;
  }, [storesList, contactMap]);

  if (!isOpen) return null;

  // Filter stores by search query & VIS-Tech
  const filteredStores = storesList.filter(sName => {
    const info = findStoreContactInfo(sName, contactMap);
    const visTechName = info?.mer_name || info?.opsup_name || 'Chưa cập nhật VIS-Tech';

    if (selectedVisTech !== 'all' && visTechName !== selectedVisTech) {
      return false;
    }

    const term = search.trim().toLowerCase();
    if (!term) return true;
    
    // Fuzzy lookup in contact map
    const textToMatch = [
      sName,
      info?.store_code || '',
      info?.store_name || '',
      info?.sr_name || '',
      info?.mer_name || '',
      info?.opsup_name || '',
      info?.address || ''
    ].join(' ').toLowerCase();

    return textToMatch.includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-250">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${type === 'PASS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {type === 'PASS' ? `Cửa Hàng Đạt (${storesList.length} store)` : `Cửa Hàng Không Đạt (${storesList.length} store)`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mã dự án <strong>#{projectCode}</strong> • Đợt #{batchIndex + 1} ({supplierName})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & VIS-Tech Filter Bar */}
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên store, mã store, SR, VIS-Tech..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-900 dark:text-slate-100 font-medium"
            />
          </div>

          {/* VIS-Tech Select Dropdown showing store counts */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedVisTech}
                onChange={(e) => setSelectedVisTech(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-900 dark:text-slate-100 cursor-pointer appearance-none"
              >
                <option value="all">🔍 Tất cả VIS-Tech ({storesList.length} Cửa hàng)</option>
                {visTechOptions.map((v) => (
                  <option key={v.name} value={v.name}>
                    👤 {v.name} ({v.count} Cửa hàng)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedVisTech !== 'all' && (
              <button
                onClick={() => setSelectedVisTech('all')}
                className="px-2.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors shrink-0 cursor-pointer"
              >
                Bỏ lọc
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List of Store Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredStores.map((sName, idx) => {
            const info = findStoreContactInfo(sName, contactMap);

            return (
              <div 
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  type === 'FAIL' 
                    ? 'bg-rose-50/20 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/60' 
                    : 'bg-white dark:bg-slate-950 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Store Name & Code */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{info?.store_name || sName}</span>
                    </div>
                    {info?.store_code && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold block mt-0.5">
                        Mã Store: {info.store_code}
                      </span>
                    )}
                  </div>

                  <Badge className={type === 'PASS' ? 'bg-emerald-500 text-white text-[10px]' : 'bg-rose-500 text-white text-[10px]'}>
                    {type === 'PASS' ? '🟢 ĐẠT' : '🔴 KHÔNG ĐẠT'}
                  </Badge>
                </div>

                {/* SR & VIS-Tech Info Grid */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  {/* SR Name & Phone */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                      <User className="w-3 h-3 text-indigo-500" />
                      <span>Sales Rep (SR)</span>
                    </div>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                      {info?.sr_name || 'Chưa cập nhật SR'}
                    </div>
                    {info?.sr_phone && (
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{info.sr_phone}</span>
                      </div>
                    )}
                  </div>

                  {/* VIS-Tech (Unilever Supervisor / MER) */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                      <UserCheck className="w-3 h-3 text-emerald-500" />
                      <span>VIS-Tech (Unilever)</span>
                    </div>
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                      {info?.mer_name || info?.opsup_name || 'Chưa cập nhật VIS-Tech'}
                    </div>
                    {info?.opsup_phone && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{info.opsup_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {info?.address && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{info.address} {info.district ? `, ${info.district}` : ''} {info.province ? `, ${info.province}` : ''}</span>
                  </div>
                )}

              </div>
            );
          })}

          {filteredStores.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              Không tìm thấy cửa hàng nào khớp với "{search}"
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>

      </div>
    </div>
  );
}

// Helper to find Store Contact Info from Master Directory
function findStoreContactInfo(sNameRaw: string, contactMap: Map<string, MasterStoreContactInfo>): MasterStoreContactInfo | null {
  if (!sNameRaw) return null;
  const rawClean = sNameRaw.trim().toUpperCase();

  if (contactMap.has(rawClean)) return contactMap.get(rawClean)!;

  // Search by substring matching store_name or store_code
  for (const info of contactMap.values()) {
    if (info.store_name && info.store_name.toUpperCase().includes(rawClean)) {
      return info;
    }
    if (info.store_name && rawClean.includes(info.store_name.toUpperCase())) {
      return info;
    }
  }

  return null;
}
