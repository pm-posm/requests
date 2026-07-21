import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Search, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp, ChevronRight,
  CheckCircle2, AlertTriangle, ClipboardList, Filter, FileSpreadsheet, 
  FileText, Image, Play, ShieldAlert, Award, Package, ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/110dpKX0WPZ76LHImzqrZwt58wG6Kq3rkCJ-ilpRpsbg/export?format=csv&gid=1872121397';

export default function TrackingNtxx() {
  const [rawData, setRawData] = useState<NtxxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        }).filter(item => item.projectCode || item.item || item.supplierName); // Filter empty rows

        setRawData(formattedData);
        setIsLoading(false);
        setIsRefreshing(false);
      },
      error: (err: any) => {
        console.error('Error fetching NTXX sheet data:', err);
        setError('Không thể lấy dữ liệu Nghiệm thu xuất xưởng từ Google Sheet. Vui lòng kiểm tra quyền truy cập hoặc kết nối.');
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
      // Search term matches: Mã dự án, Supplier, CAT, Brand, Hạng mục, Ghi chú, Cửa hàng
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ? true : (
        (row.projectCode || '').toLowerCase().includes(term) ||
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

  return (
    <div className="space-y-6">
      
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
            Nghiệm thu Xuất xưởng (FAT - NTXX)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi chất lượng sản xuất POSM tại xưởng trước khi phân phối tới các cửa hàng.
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

          {/* Grouped Projects Table (Tầng 1) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800 text-left text-sm text-slate-800 dark:text-slate-200">
                <thead className="bg-slate-55 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4 w-[1%]">Dự án</th>
                    <th scope="col" className="px-6 py-4 w-[15%]">Mã Dự án</th>
                    <th scope="col" className="px-6 py-4">Nhãn hàng & CAT</th>
                    <th scope="col" className="px-6 py-4">Hạng mục tiêu biểu</th>
                    <th scope="col" className="px-6 py-4 w-[15%]">Đợt Nghiệm Thu</th>
                    <th scope="col" className="px-6 py-4 w-[25%]">Tỷ lệ Đạt Xuất Xưởng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {paginatedProjects.map((project) => {
                    const isProjectExpanded = !!expandedProjects[project.projectCode];
                    const { totalBatches, totalQty, passedBatches, failedBatches, passRate, isFailed } = project.stats;

                    return (
                      <React.Fragment key={project.projectCode}>
                        {/* Project Row (Tầng 1) */}
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors font-medium border-l-2 border-l-transparent hover:border-l-indigo-500">
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

                          {/* Brand & Category */}
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900">
                                {project.brand}
                              </Badge>
                              <span className="text-xs text-slate-450 dark:text-slate-500 font-semibold">({project.category})</span>
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
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Số lượng: {totalQty} cái</div>
                          </td>

                          {/* Pass rate & visual progress bar */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                              <span className="flex items-center gap-1">
                                {isFailed ? (
                                  <span className="text-rose-500 font-bold">{failedBatches} đợt LỖI</span>
                                ) : (
                                  <span className="text-emerald-600 font-semibold">{passedBatches}/{totalBatches} Đạt</span>
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
                        </tr>

                        {/* Nested Inspections List (Tầng 2) */}
                        {isProjectExpanded && (
                          <tr className="bg-slate-50/20 dark:bg-slate-900/30">
                            <td colSpan={6} className="px-6 py-4 border-t border-b border-slate-150 dark:border-slate-800/80">
                              <div className="pl-6 pr-2 py-2 border-l-2 border-l-indigo-300 dark:border-l-indigo-900 space-y-3">
                                
                                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>Danh sách đợt nghiệm thu tại xưởng ({project.batches.length} đợt)</span>
                                </div>

                                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                                  <table className="min-w-full divide-y divide-slate-155 dark:divide-slate-800 text-left text-xs">
                                    <thead className="bg-slate-55 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                      <tr>
                                        <th scope="col" className="px-4 py-3 w-[1%]">Chi tiết</th>
                                        <th scope="col" className="px-4 py-3">Ngày NTXX</th>
                                        <th scope="col" className="px-4 py-3">Nhà thầu (Supplier)</th>
                                        <th scope="col" className="px-4 py-3">Hạng mục thi công</th>
                                        <th scope="col" className="px-4 py-3 w-[12%]">Số lượng</th>
                                        <th scope="col" className="px-4 py-3">Kết quả</th>
                                        <th scope="col" className="px-4 py-3 w-[20%]">Tài liệu NT (Drive)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-955 text-slate-700 dark:text-slate-300">
                                      {project.batches.map((batch, batchIdx) => {
                                        const batchKey = `${project.projectCode}_${batchIdx}`;
                                        const isBatchExpanded = !!expandedBatches[batchKey];

                                        return (
                                          <React.Fragment key={batchKey}>
                                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                                              
                                              {/* Batch detail toggle */}
                                              <td className="px-4 py-3">
                                                <button
                                                  onClick={() => toggleBatch(batchKey)}
                                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 transition-colors cursor-pointer"
                                                >
                                                  {isBatchExpanded ? (
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                  ) : (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                  )}
                                                </button>
                                              </td>

                                              {/* Actual NTXX Date */}
                                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                                                {batch.actualDate || 'Chưa thực hiện'}
                                                {batch.scheduleDate && (
                                                  <div className="text-[9px] text-slate-400 font-medium mt-0.5">Lịch gửi: {batch.scheduleDate}</div>
                                                )}
                                              </td>

                                              {/* Supplier */}
                                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                                                {batch.supplierName}
                                              </td>

                                              {/* Item spec */}
                                              <td className="px-4 py-3 max-w-[180px] truncate" title={batch.item}>
                                                {batch.item}
                                              </td>

                                              {/* Quantity */}
                                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                {batch.qty} {batch.unit || 'cái'}
                                              </td>

                                              {/* Result badge */}
                                              <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${getResultBadgeStyle(batch.result)}`}>
                                                  {batch.result || 'Chưa rõ'}
                                                </span>
                                              </td>

                                              {/* Multimedia Drive links preview */}
                                              <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                  {renderDriveLink(batch.bbntLink, 'BBNT', <FileText className="h-3 w-3" />)}
                                                  {renderDriveLink(batch.overviewLink, 'Tổng quan', <Image className="h-3 w-3" />)}
                                                  {(batch.detailLink1 || batch.detailLink2 || batch.videoLink) && (
                                                    <Badge variant="outline" className="text-[9px] border-slate-200 dark:border-slate-800 scale-90 origin-left">
                                                      +{ [batch.detailLink1, batch.detailLink2, batch.videoLink].filter(Boolean).length } tệp khác
                                                    </Badge>
                                                  )}
                                                </div>
                                              </td>

                                            </tr>

                                            {/* Batch Sub-details (Tầng 3 - Cửa hàng, Ảnh, Video chi tiết) */}
                                            {isBatchExpanded && (
                                              <tr className="bg-slate-50/50 dark:bg-slate-900/60 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <td colSpan={7} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-slate-600 dark:text-slate-400 p-1">
                                                    
                                                    {/* Category / Brand / Specs */}
                                                    <div className="space-y-1.5">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Chi tiết Nghiệm thu</span>
                                                      <div className="space-y-1">
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500 font-semibold">Ngành hàng (CAT):</span>
                                                          <span className="text-slate-800 dark:text-slate-200 font-bold">{batch.category || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500 font-semibold">Nhãn hàng (Brand):</span>
                                                          <span className="text-slate-800 dark:text-slate-200 font-bold">{batch.brand || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500 font-semibold">QC Technician:</span>
                                                          <span className="text-slate-800 dark:text-slate-200 font-bold">{batch.technician || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                                                          <span className="text-slate-500 font-semibold">Người gửi:</span>
                                                          <span className="text-slate-800 dark:text-slate-200 font-mono select-all truncate max-w-[120px]">{batch.email || 'N/A'}</span>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Multimedia links & Files */}
                                                    <div className="space-y-1.5">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tài liệu & Hình ảnh (Drive)</span>
                                                      <div className="flex flex-col gap-1.5 pt-1">
                                                        {batch.bbntLink && renderDriveLink(batch.bbntLink, 'Biên bản nghiệm thu (BBNT)', <FileText className="h-3.5 w-3.5" />)}
                                                        {batch.overviewLink && renderDriveLink(batch.overviewLink, 'Ảnh chụp Tổng quan', <Image className="h-3.5 w-3.5" />)}
                                                        {batch.detailLink1 && renderDriveLink(batch.detailLink1, 'Ảnh chụp Chi tiết 1', <Image className="h-3.5 w-3.5" />)}
                                                        {batch.detailLink2 && renderDriveLink(batch.detailLink2, 'Ảnh chụp Chi tiết 2', <Image className="h-3.5 w-3.5" />)}
                                                        {batch.videoLink && renderDriveLink(batch.videoLink, 'Video nghiệm thu', <Play className="h-3.5 w-3.5 text-rose-500" />)}
                                                        {(!batch.bbntLink && !batch.overviewLink && !batch.detailLink1 && !batch.detailLink2 && !batch.videoLink) && (
                                                          <span className="text-slate-400 italic">Không có tài liệu đính kèm</span>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Stores allocated & Notes */}
                                                    <div className="space-y-2">
                                                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Danh sách Cửa hàng phân bổ</span>
                                                      <div className="space-y-1 text-[10px] leading-relaxed">
                                                        {batch.storesPass && (
                                                          <div>
                                                            <span className="font-bold text-emerald-600">Đạt ({batch.customer}):</span>
                                                            <p className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded border border-emerald-100 dark:border-emerald-900/30 text-slate-800 dark:text-slate-200 mt-0.5 leading-normal">
                                                              {batch.storesPass}
                                                            </p>
                                                          </div>
                                                        )}
                                                        {batch.storesFail && (
                                                          <div className="mt-1">
                                                            <span className="font-bold text-rose-600">Không đạt:</span>
                                                            <p className="bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900/30 text-slate-800 dark:text-slate-200 mt-0.5 leading-normal">
                                                              {batch.storesFail}
                                                            </p>
                                                          </div>
                                                        )}
                                                        {batch.note && (
                                                          <div className="mt-1.5">
                                                            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Ghi chú QC</span>
                                                            <p className="bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 font-semibold mt-0.5 leading-relaxed">
                                                              {batch.note}
                                                            </p>
                                                          </div>
                                                        )}
                                                        {(!batch.storesPass && !batch.storesFail) && (
                                                          <div className="text-slate-400 italic">Không phân bổ cửa hàng cụ thể.</div>
                                                        )}
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
        </>
      )}

    </div>
  );
}
