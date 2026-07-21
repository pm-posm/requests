import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Search, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp, ChevronRight,
  CheckCircle2, AlertTriangle, Hammer, ClipboardList, Filter, FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Define the interface for the raw spreadsheet row mapped to clean camelCase fields
interface InstallationRow {
  projectCode: string;      // Mã dự án
  projectName: string;      // Tên dự án
  posmTypeCode: string;     // Mã của loại POSM
  categoryCode: string;     // Mã Ngành hàng
  brandCode: string;        // Mã nhãn hàng
  brandName: string;        // Tên nhãn hàng
  qtyPerAsset: string;      // Số lượng theo mỗi AssetID
  region: string;           // Vùng
  customer: string;         // Customer
  storeCode: string;        // Mã cửa hàng
  storeName: string;        // Tên cửa hàng
  plannedStartDate: string; // Dự kiến thực hiện từ ngày
  plannedEndDate: string;   // Dự kiến thực hiện đến ngày
  item: string;             // Hạng mục
  size: string;             // Size
  supplierEmail: string;    // Supplier email
  supplierName: string;     // Supplier Name
  agencyContact: string;    // Email người phụ trách từ Agency
  technician: string;       // POSM QC Technician
  status: string;           // Status
  actualTime: string;       // Actual Time
  completionTime: string;   // Completion time
  warranty: string;         // Warranty - Uninstall
  note: string;             // Note
}

// Grouped Project interface
interface GroupedProject {
  projectCode: string;
  projectName: string;
  brandName: string;
  stores: InstallationRow[];
  stats: {
    total: number;
    completed: number;
    installing: number;
    qcFailed: number;
    warranty: number;
    cancelled: number;
    completedRate: number;
  };
}

// Mapped columns from Vietnamese sheet header to English fields
const COLUMN_MAPPING: Record<string, keyof InstallationRow> = {
  'Mã dự án': 'projectCode',
  'Tên dự án': 'projectName',
  'Mã của loại POSM': 'posmTypeCode',
  'Mã Ngành hàng': 'categoryCode',
  'Mã nhãn hàng': 'brandCode',
  'Tên nhãn hàng': 'brandName',
  'Số lượng theo mỗi AssetID': 'qtyPerAsset',
  'Vùng': 'region',
  'Customer': 'customer',
  'Mã cửa hàng': 'storeCode',
  'Tên cửa hàng': 'storeName',
  'Dự kiến thực hiện từ ngày': 'plannedStartDate',
  'Dự kiến thực hiện đến ngày': 'plannedEndDate',
  'Hạng mục': 'item',
  'Size': 'size',
  'Supplier email': 'supplierEmail',
  'Supplier Name': 'supplierName',
  'Email người phụ trách từ Agency': 'agencyContact',
  'POSM QC Technician': 'technician',
  'Status': 'status',
  'Actual Time': 'actualTime',
  'Completion time': 'completionTime',
  'Warranty - Uninstall': 'warranty',
  'Note': 'note',
};

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1Ud0eGEiyKzR9mZu1DTul-WF3rUif7ams580D9fYgung/export?format=csv&gid=0';

export default function TrackingInstallation() {
  const [rawData, setRawData] = useState<InstallationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Expanded projects state (tần 1)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  // Expanded stores state (tầng 2)
  const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState('all');

  // Pagination State (cho Projects cha)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors);
        }
        
        // Map raw row fields
        const formattedData = (results.data as any[]).map((row) => {
          const mappedRow: Partial<InstallationRow> = {};
          Object.entries(row).forEach(([key, val]) => {
            const trimmedKey = key.trim();
            const mappedField = COLUMN_MAPPING[trimmedKey];
            if (mappedField) {
              mappedRow[mappedField] = (val as string || '').trim();
            }
          });
          return mappedRow as InstallationRow;
        }).filter(item => item.projectCode || item.projectName || item.storeName); // Filter empty rows

        setRawData(formattedData);
        setIsLoading(false);
        setIsRefreshing(false);
      },
      error: (err: any) => {
        console.error('Error fetching sheet data:', err);
        setError('Không thể lấy dữ liệu từ Google Sheet. Vui lòng kiểm tra quyền truy cập hoặc kết nối internet.');
        setIsLoading(false);
        setIsRefreshing(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Get unique options for filter dropdowns (based on ALL raw data)
  const filterOptions = useMemo(() => {
    const regions = new Set<string>();
    const brands = new Set<string>();
    const suppliers = new Set<string>();
    const statuses = new Set<string>();
    const technicians = new Set<string>();

    rawData.forEach(row => {
      if (row.region) regions.add(row.region);
      if (row.brandName) brands.add(row.brandName);
      if (row.supplierName) suppliers.add(row.supplierName);
      if (row.status) statuses.add(row.status);
      if (row.technician) technicians.add(row.technician);
    });

    return {
      regions: Array.from(regions).sort(),
      brands: Array.from(brands).sort(),
      suppliers: Array.from(suppliers).sort(),
      statuses: Array.from(statuses).sort(),
      technicians: Array.from(technicians).sort()
    };
  }, [rawData]);

  // Step 1: Filter Flat Rows based on UI filters
  const filteredFlatRows = useMemo(() => {
    return rawData.filter(row => {
      // 1. Text Search matching Tên DA, Mã DA, Mã CH, Tên CH, Hạng mục, Note
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ? true : (
        (row.projectName || '').toLowerCase().includes(term) ||
        (row.projectCode || '').toLowerCase().includes(term) ||
        (row.storeCode || '').toLowerCase().includes(term) ||
        (row.storeName || '').toLowerCase().includes(term) ||
        (row.item || '').toLowerCase().includes(term) ||
        (row.note || '').toLowerCase().includes(term)
      );

      // 2. Select Filters
      const matchesRegion = selectedRegion === 'all' || row.region === selectedRegion;
      const matchesBrand = selectedBrand === 'all' || row.brandName === selectedBrand;
      const matchesSupplier = selectedSupplier === 'all' || row.supplierName === selectedSupplier;
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus;
      const matchesTechnician = selectedTechnician === 'all' || row.technician === selectedTechnician;

      return matchesSearch && matchesRegion && matchesBrand && matchesSupplier && matchesStatus && matchesTechnician;
    });
  }, [rawData, searchTerm, selectedRegion, selectedBrand, selectedSupplier, selectedStatus, selectedTechnician]);

  // Step 2: Group the filtered flat rows into Grouped Projects
  const groupedProjects = useMemo(() => {
    const groups: Record<string, GroupedProject> = {};

    filteredFlatRows.forEach(row => {
      const code = row.projectCode || 'NO_CODE';
      if (!groups[code]) {
        groups[code] = {
          projectCode: code,
          projectName: row.projectName || 'Dự án không tên',
          brandName: row.brandName || 'N/A',
          stores: [],
          stats: {
            total: 0,
            completed: 0,
            installing: 0,
            qcFailed: 0,
            warranty: 0,
            cancelled: 0,
            completedRate: 0
          }
        };
      }
      
      groups[code].stores.push(row);
    });

    // Compute stats for each project
    const projectList = Object.values(groups).map(project => {
      let total = project.stores.length;
      let completed = 0;
      let installing = 0;
      let qcFailed = 0;
      let warranty = 0;
      let cancelled = 0;

      project.stores.forEach(store => {
        const s = (store.status || '').toLowerCase();
        if (s === 'completed') {
          completed++;
        } else if (s.includes('failed')) {
          qcFailed++;
        } else if (s.includes('bảo hành') || s.includes('warranty') || s.includes('supplier bảo hành')) {
          warranty++;
        } else if (s === 'cancelled') {
          cancelled++;
        } else if (s === 'installing' || s === 'pending install' || s === 'pending') {
          installing++;
        }
      });

      const completedRate = total > 0 ? Math.round((completed / (total - cancelled || 1)) * 100) : 0;

      project.stats = {
        total,
        completed,
        installing,
        qcFailed,
        warranty,
        cancelled,
        completedRate
      };

      return project;
    });

    // Sort projects alphabetically by project code
    return projectList.sort((a, b) => a.projectCode.localeCompare(b.projectCode));
  }, [filteredFlatRows]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRegion, selectedBrand, selectedSupplier, selectedStatus, selectedTechnician]);

  // Pagination Logic for Projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return groupedProjects.slice(startIndex, startIndex + pageSize);
  }, [groupedProjects, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(groupedProjects.length / pageSize));

  // Global KPI Calculations (based on filtered flat stores data)
  const stats = useMemo(() => {
    const totalStores = filteredFlatRows.length;
    const totalProjects = groupedProjects.length;
    let completed = 0;
    let installing = 0;
    let qcFailed = 0;
    let warranty = 0;
    let cancelled = 0;

    filteredFlatRows.forEach(row => {
      const statusLower = (row.status || '').toLowerCase();
      if (statusLower === 'completed') {
        completed++;
      } else if (statusLower.includes('failed')) {
        qcFailed++;
      } else if (statusLower.includes('bảo hành') || statusLower.includes('warranty') || statusLower.includes('supplier bảo hành')) {
        warranty++;
      } else if (statusLower === 'cancelled') {
        cancelled++;
      } else if (statusLower === 'installing' || statusLower === 'pending install' || statusLower === 'pending') {
        installing++;
      }
    });

    const installCompletedRate = totalStores > 0 ? Math.round((completed / (totalStores - cancelled || 1)) * 100) : 0;

    return {
      totalProjects,
      totalStores,
      completed,
      installing,
      qcFailed,
      warranty,
      cancelled,
      installCompletedRate
    };
  }, [filteredFlatRows, groupedProjects]);

  // Toggle Project Expand/Collapse
  const toggleProject = (projectCode: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectCode]: !prev[projectCode]
    }));
  };

  // Toggle Store Expand/Collapse
  const toggleStore = (storeKey: string) => {
    setExpandedStores(prev => ({
      ...prev,
      [storeKey]: !prev[storeKey]
    }));
  };

  // Helper to determine status badges styling
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (s.includes('failed')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800';
    }
    if (s.includes('bảo hành') || s.includes('warranty') || s.includes('supplier bảo hành')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800';
    }
    if (s === 'cancelled') {
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
    if (s === 'installing' || s === 'pending install' || s === 'pending') {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800';
    }
    if (s === 'new') {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
            Theo dõi Lắp đặt POSM (Phân nhóm Dự án)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và cập nhật tiến độ thi công POSM nhóm theo Dự án.
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors font-medium shadow-sm cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
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
          {/* KPI Dashboard Cards - Standard PM View */}
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
                  <span className="block text-xs text-slate-400 mt-0.5">({stats.totalStores} Cửa hàng)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đã hoàn thành</span>
                  <div className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.completed}</span>
                  <span className="block text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Tỷ lệ: {stats.installCompletedRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-blue-500">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đang thi công</span>
                  <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                    <Hammer className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.installing}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Cửa hàng chờ/thi công</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-rose-500">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lỗi nghiệm thu</span>
                  <div className="p-1 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.qcFailed}</span>
                  <span className="block text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">Cửa hàng lỗi QC</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cần Bảo Hành</span>
                  <div className="p-1 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">{stats.warranty}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Đang yêu cầu bảo hành</span>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Filtering Area */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Filter className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">BỘ LỌC TÌM KIẾM NÂNG CAO</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
              
              {/* Text search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm dự án, cửa hàng, mã..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
                />
              </div>

              {/* Region Filter */}
              <div>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium cursor-pointer"
                >
                  <option value="all">Vùng miền (Tất cả)</option>
                  {filterOptions.regions.map(r => (
                    <option key={r} value={r}>{r}</option>
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
                <span>Trạng thái cửa hàng:</span>
                <div className="flex flex-wrap gap-1">
                  <button 
                    onClick={() => setSelectedStatus('all')}
                    className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${selectedStatus === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Tất cả ({rawData.length})
                  </button>
                  {filterOptions.statuses.map(status => {
                    const count = rawData.filter(r => r.status === status).length;
                    return (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(status)}
                        className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${selectedStatus === status ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {status} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {(searchTerm || selectedRegion !== 'all' || selectedBrand !== 'all' || selectedSupplier !== 'all' || selectedStatus !== 'all' || selectedTechnician !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedRegion('all');
                    setSelectedBrand('all');
                    setSelectedSupplier('all');
                    setSelectedStatus('all');
                    setSelectedTechnician('all');
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

          </div>

          {/* Grouped Projects Table (Tầng 1) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800 text-left text-sm text-slate-800 dark:text-slate-200">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4 w-[1%]">Dự án</th>
                    <th scope="col" className="px-6 py-4 w-[15%]">Mã Dự án</th>
                    <th scope="col" className="px-6 py-4">Tên Dự án</th>
                    <th scope="col" className="px-6 py-4 w-[15%]">Nhãn hàng</th>
                    <th scope="col" className="px-6 py-4 w-[12%]">Số Cửa Hàng</th>
                    <th scope="col" className="px-6 py-4 w-[25%]">Tiến độ thi công</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {paginatedProjects.map((project) => {
                    const isProjectExpanded = !!expandedProjects[project.projectCode];
                    const { completed, total, completedRate, installing, qcFailed, warranty, cancelled } = project.stats;

                    return (
                      <React.Fragment key={project.projectCode}>
                        {/* Project Row (Tầng 1) */}
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors font-medium border-l-2 border-l-transparent hover:border-l-emerald-500">
                          {/* Toggle Expand Column */}
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleProject(project.projectCode)}
                              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                            >
                              {isProjectExpanded ? (
                                <ChevronDown className="h-4.5 w-4.5" />
                              ) : (
                                <ChevronRight className="h-4.5 w-4.5" />
                              )}
                            </button>
                          </td>

                          {/* Project Code */}
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 dark:text-white select-all">
                              {project.projectCode}
                            </span>
                          </td>

                          {/* Project Name */}
                          <td className="px-6 py-4 max-w-sm">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words" title={project.projectName}>
                              {project.projectName}
                            </div>
                          </td>

                          {/* Brand Name */}
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-300 font-bold border border-slate-200/40">
                              {project.brandName}
                            </Badge>
                          </td>

                          {/* Total Stores Count */}
                          <td className="px-6 py-4">
                            <div className="text-slate-900 dark:text-slate-100 font-bold">{total} CH</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-1.5 font-semibold">
                              {installing > 0 && <span className="text-blue-500">{installing} Đang thi công</span>}
                              {qcFailed > 0 && <span className="text-rose-500">{qcFailed} Lỗi QC</span>}
                              {warranty > 0 && <span className="text-amber-500">{warranty} Bảo hành</span>}
                            </div>
                          </td>

                          {/* Progress bar + rate */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                              <span>{completed}/{total - cancelled} Hoàn tất</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{completedRate}%</span>
                            </div>
                            {/* Visual Progress Bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/20 shadow-inner">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${completedRate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${completedRate}%` }}
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Nested Stores List (Tầng 2) */}
                        {isProjectExpanded && (
                          <tr className="bg-slate-50/20 dark:bg-slate-900/30">
                            <td colSpan={6} className="px-6 py-4 border-t border-b border-slate-150 dark:border-slate-800/80">
                              <div className="pl-6 pr-2 py-2 border-l-2 border-l-slate-200 dark:border-l-slate-800 space-y-3">
                                
                                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>Danh sách cửa hàng trực thuộc dự án ({project.stores.length} cửa hàng)</span>
                                </div>

                                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                                  <table className="min-w-full divide-y divide-slate-150 dark:divide-slate-800 text-left text-xs">
                                    <thead className="bg-slate-55 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                      <tr>
                                        <th scope="col" className="px-4 py-3 w-[1%]">Chi tiết</th>
                                        <th scope="col" className="px-4 py-3">Mã cửa hàng</th>
                                        <th scope="col" className="px-4 py-3">Tên cửa hàng</th>
                                        <th scope="col" className="px-4 py-3 w-[10%]">Vùng</th>
                                        <th scope="col" className="px-4 py-3">Nhà thầu & QC</th>
                                        <th scope="col" className="px-4 py-3">Lịch thi công</th>
                                        <th scope="col" className="px-4 py-3">Trạng thái</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300">
                                      {project.stores.map((store, storeIdx) => {
                                        const storeKey = `${project.projectCode}_${store.storeCode || 'N/A'}_${storeIdx}`;
                                        const isStoreExpanded = !!expandedStores[storeKey];

                                        return (
                                          <React.Fragment key={storeKey}>
                                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                                              
                                              {/* Store detail toggle */}
                                              <td className="px-4 py-3">
                                                <button
                                                  onClick={() => toggleStore(storeKey)}
                                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 transition-colors cursor-pointer"
                                                >
                                                  {isStoreExpanded ? (
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                  ) : (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                  )}
                                                </button>
                                              </td>

                                              {/* Store Code */}
                                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                                                {store.storeCode || 'N/A'}
                                              </td>

                                              {/* Store Name */}
                                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                                                {store.storeName}
                                              </td>

                                              {/* Region */}
                                              <td className="px-4 py-3">
                                                <span className="font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                                                  {store.region || 'Khác'}
                                                </span>
                                              </td>

                                              {/* Supplier & QC */}
                                              <td className="px-4 py-3">
                                                <div>{store.supplierName || 'N/A'}</div>
                                                {store.technician && (
                                                  <div className="text-[10px] text-slate-400 mt-0.5">QC: {store.technician}</div>
                                                )}
                                              </td>

                                              {/* Dates */}
                                              <td className="px-4 py-3 text-[10px] font-semibold text-slate-500">
                                                <div>Bắt đầu: {store.plannedStartDate || 'N/A'}</div>
                                                <div>Kết thúc: {store.plannedEndDate || 'N/A'}</div>
                                              </td>

                                              {/* Status */}
                                              <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadgeStyle(store.status)}`}>
                                                  {store.status || 'Mới'}
                                                </span>
                                              </td>

                                            </tr>

                                            {/* Store Sub-details Expanded (Tầng 3) */}
                                            {isStoreExpanded && (
                                              <tr className="bg-slate-50/50 dark:bg-slate-900/60">
                                                <td colSpan={7} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-slate-600 dark:text-slate-400 p-1">
                                                    
                                                    <div className="space-y-1.5">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Chi tiết Kỹ thuật</span>
                                                      <div>
                                                        <span className="font-semibold text-slate-500">Hạng mục:</span>
                                                        <p className="mt-1 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 text-[10px] whitespace-pre-line leading-relaxed">
                                                          {store.item || 'N/A'}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <span className="font-semibold text-slate-500">Kích thước:</span>
                                                        <p className="mt-1 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 text-[10px] whitespace-pre-line leading-relaxed">
                                                          {store.size || 'N/A'}
                                                        </p>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tiến độ thực tế</span>
                                                      <div className="space-y-1 text-[10px] font-medium">
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500">Thời gian thi công:</span>
                                                          <span>{store.actualTime || 'Chưa thực hiện'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500">Ngày nghiệm thu hoàn thành:</span>
                                                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{store.completionTime || 'Chưa hoàn tất'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500">Bảo hành tháo dỡ:</span>
                                                          <span>{store.warranty || 'Không'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500">Số lượng AssetID:</span>
                                                          <span>{store.qtyPerAsset || '0'}</span>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Liên hệ & Note</span>
                                                      <div className="space-y-1 text-[10px]">
                                                        <div>
                                                          <span className="font-semibold text-slate-500">Email Nhà thầu:</span>
                                                          <span className="block font-mono select-all text-slate-800 dark:text-slate-200">{store.supplierEmail || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                          <span className="font-semibold text-slate-500">Email Agency:</span>
                                                          <span className="block font-mono select-all text-slate-800 dark:text-slate-200">{store.agencyContact || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                          <span className="font-semibold text-slate-500">Ghi chú QC:</span>
                                                          <p className="mt-1 bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 font-semibold text-amber-800 dark:text-amber-400 whitespace-pre-line leading-relaxed">
                                                            {store.note || 'Không có ghi chú'}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    </div>

                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {groupedProjects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                        Không có dự án lắp đặt nào khớp với bộ lọc tìm kiếm.
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
                  <span>trên tổng số <strong>{groupedProjects.length}</strong> dự án ({filteredFlatRows.length} cửa hàng)</span>
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
        </>
      )}

    </div>
  );
}
