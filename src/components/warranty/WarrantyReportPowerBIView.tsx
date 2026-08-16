import React, { useState, useMemo } from 'react';
import { 
  Filter, RotateCcw, Download, Calendar, 
  Building2, AlertTriangle, CheckCircle2, Clock, 
  Layers, Store, Tag, Search, Maximize2, Minimize2,
  FileSpreadsheet, SlidersHorizontal, ChevronDown, Check,
  X, Info, ExternalLink, HelpCircle
} from 'lucide-react';
import type { WarrantyItem } from '@/types/warranty';
import toast from 'react-hot-toast';

interface WarrantyReportPowerBIViewProps {
  warrantyItems: WarrantyItem[];
  onOpenWarrantyDrawer: (item: WarrantyItem) => void;
  onExportExcel: (projectCode?: string) => void;
}

// Helper to parse date strings (DD/MM/YYYY, YYYY-MM-DD, or Excel Serial Numbers) to timestamp ms
const parseDateToMs = (str?: string): number | null => {
  if (!str || !str.trim()) return null;
  const trimmed = str.trim();
  
  // Excel serial date number (e.g., 46245.7)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    return Math.floor(serial - 25569) * 86400 * 1000;
  }
  
  // ISO Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split(/[-T ]/)[0].split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[/ -]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return isNaN(d.getTime()) ? null : d.getTime();
    } else {
      const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }
  
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.getTime();
};

const formatDateDisplay = (str?: string): string => {
  if (!str || !str.trim()) return '-';
  const ms = parseDateToMs(str);
  if (!ms) return str;
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Power BI Visual Container Component with Standard Fluent Header Toolbar
const PowerBIVisual: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  onFocus?: () => void;
  accentColor?: string;
  filterActive?: boolean;
}> = ({ title, subtitle, className = '', children, onFocus, accentColor, filterActive }) => {
  return (
    <div className={`bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col relative transition-all group/pbi ${className}`}>
      {accentColor && (
        <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />
      )}
      
      {/* Power BI Visual Header */}
      <div className="px-3 py-2 border-b border-[#EDEBE9] dark:border-[#323130] flex items-center justify-between gap-2 select-none">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[12px] font-semibold text-[#252423] dark:text-[#F3F2F1] tracking-tight truncate font-sans">
              {title}
            </h3>
            {filterActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#118DFF]" title="Đang lọc theo visual này" />
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] truncate font-sans">
              {subtitle}
            </p>
          )}
        </div>

        {/* Visual Header Hover Icons */}
        <div className="flex items-center gap-1 opacity-40 group-hover/pbi:opacity-100 transition-opacity">
          {onFocus && (
            <button
              onClick={onFocus}
              className="p-1 hover:bg-[#F3F2F1] dark:hover:bg-[#323130] rounded text-[#605E5C] dark:text-[#C8C6C4] transition-colors cursor-pointer"
              title="Chế độ tiêu điểm (Focus Mode)"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Content Body */}
      <div className="p-3 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
};

export const WarrantyReportPowerBIView: React.FC<WarrantyReportPowerBIViewProps> = ({
  warrantyItems,
  onOpenWarrantyDrawer,
  onExportExcel
}) => {
  // Page Tab state (mimicking Power BI Desktop bottom page tabs)
  const [activeReportPage, setActiveReportPage] = useState<'SUMMARY' | 'DETAIL'>('SUMMARY');

  // Slicer States - Group 1: Date Group
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Slicer States - Group 2: Classification Group
  const [selectedVisTech, setSelectedVisTech] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedPosmType, setSelectedPosmType] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [detailSearch, setDetailSearch] = useState<string>('');
  const [isDateSlicerOpen, setIsDateSlicerOpen] = useState<boolean>(false);
  const [isClassSlicerOpen, setIsClassSlicerOpen] = useState<boolean>(false);
  const [isProjectSlicerOpen, setIsProjectSlicerOpen] = useState<boolean>(false);
  const [projectSlicerSearch, setProjectSlicerSearch] = useState<string>('');

  // Cross-filtering clicked state
  const [crossFilter, setCrossFilter] = useState<{
    type: 'supplier' | 'cause' | 'delay' | 'posm' | 'store' | 'project' | 'brand' | null;
    value: string;
  }>({ type: null, value: '' });

  // Helper to parse item date
  const parseItemDate = (item: WarrantyItem) => {
    const raw = item.sentDate || item.installationDate || item.raiseMailTime || '';
    if (!raw) return null;
    const trimmed = raw.trim();
    let d: Date | null = null;

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      }
    } else if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    }

    if (!d || isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    // ISO week
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    return { year, month, quarter, week, time: d.getTime() };
  };

  // Unique options
  const uniqueVisTechs = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => (i.visTech || '').trim()).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueSuppliers = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => (i.supplier || '').trim()).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueProjects = useMemo(() => {
    const map = new Map<string, number>();
    warrantyItems.forEach(i => {
      const prj = (i.projectCode || '').trim();
      if (prj) {
        map.set(prj, (map.get(prj) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [warrantyItems]);

  const filteredProjects = useMemo(() => {
    if (!projectSlicerSearch.trim()) return uniqueProjects;
    const s = projectSlicerSearch.toLowerCase().trim();
    return uniqueProjects.filter(p => p.code.toLowerCase().includes(s));
  }, [uniqueProjects, projectSlicerSearch]);

  const uniquePosmTypes = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => (i.posmType || '').trim()).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueStores = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => (i.storeName || '').trim()).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => (i.brand || '').trim()).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    warrantyItems.forEach(i => {
      const match = (i.sentDate || i.installationDate || '').match(/\b(202[0-9]|201[0-9])\b/);
      if (match) set.add(match[1]);
    });
    if (set.size === 0) set.add('2026');
    return Array.from(set).sort().reverse();
  }, [warrantyItems]);

  // Filtered dataset according to 2-Group Slicers + Cross Filter
  const filteredData = useMemo(() => {
    return warrantyItems.filter(item => {
      // 1. Date Group Slicers
      const dateObj = parseItemDate(item);
      if (selectedYear !== 'all') {
        if (!dateObj || String(dateObj.year) !== selectedYear) return false;
      }
      if (selectedQuarter !== 'all') {
        if (!dateObj || String(dateObj.quarter) !== selectedQuarter) return false;
      }
      if (selectedMonth !== 'all') {
        if (!dateObj || String(dateObj.month) !== selectedMonth) return false;
      }
      if (selectedWeek !== 'all') {
        if (!dateObj || String(dateObj.week) !== selectedWeek) return false;
      }
      if (dateFrom) {
        const fromMs = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (!dateObj || dateObj.time < fromMs) return false;
      }
      if (dateTo) {
        const toMs = new Date(dateTo).setHours(23, 59, 59, 999);
        if (!dateObj || dateObj.time > toMs) return false;
      }

      // 2. Classification Group Slicers
      if (selectedVisTech !== 'all' && (item.visTech || '').trim() !== selectedVisTech) return false;
      if (selectedSupplier !== 'all' && (item.supplier || '').trim() !== selectedSupplier) return false;
      if (selectedStore !== 'all' && (item.storeName || '').trim() !== selectedStore) return false;
      if (selectedPosmType !== 'all' && (item.posmType || '').trim() !== selectedPosmType) return false;
      if (selectedBrand !== 'all' && (item.brand || '').trim() !== selectedBrand) return false;
      if (selectedProjects.length > 0 && !selectedProjects.includes((item.projectCode || '').trim())) return false;

      // 3. Cross-Filtering
      if (crossFilter.type && crossFilter.value) {
        if (crossFilter.type === 'supplier' && (item.supplier || '').trim() !== crossFilter.value) return false;
        if (crossFilter.type === 'posm' && (item.posmType || '').trim() !== crossFilter.value) return false;
        if (crossFilter.type === 'store' && (item.storeName || '').trim() !== crossFilter.value) return false;
        if (crossFilter.type === 'project' && (item.projectCode || '').trim() !== crossFilter.value) return false;
        if (crossFilter.type === 'brand' && (item.brand || '').trim() !== crossFilter.value) return false;
      }

      return true;
    });
  }, [
    warrantyItems, selectedYear, selectedQuarter, selectedMonth, selectedWeek, dateFrom, dateTo,
    selectedVisTech, selectedSupplier, selectedStore, selectedPosmType, selectedBrand, selectedProjects,
    crossFilter
  ]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const total = filteredData.length;
    if (total === 0) {
      return {
        total: 0,
        onTimeCount: 0,
        onTimePct: '0.0%',
        overdueCount: 0,
        overduePct: '0.0%',
        earlyFailCount: 0,
        earlyFailPct: '0.0%',
        topSupplier: { name: '-', count: 0, pct: '0.0%' },
        topProject: { name: '-', count: 0, pct: '0.0%' },
        topStore: { name: '-', count: 0, pct: '0.0%' },
        topBrand: { name: '-', count: 0, pct: '0.0%' },
        topPosm: { name: '-', count: 0, pct: '0.0%' },
        activeProjects: []
      };
    }

    let onTime = 0;
    let overdue = 0;
    let earlyFail = 0;

    const supplierMap = new Map<string, number>();
    const projectMap = new Map<string, number>();
    const storeMap = new Map<string, number>();
    const brandMap = new Map<string, number>();
    const posmMap = new Map<string, number>();
    const activeProjSet = new Set<string>();

    filteredData.forEach(item => {
      const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;
      const sentMs = parseDateToMs(item.sentDate || item.createdAt);
      const doneMs = parseDateToMs(item.completedDate);
      const schedMs = parseDateToMs(item.scheduledDate);
      const installMs = parseDateToMs(item.installationDate);

      // Check Early Fail (<30 days from install to fault)
      if (installMs && sentMs && sentMs >= installMs) {
        const days = Math.round((sentMs - installMs) / 86400000);
        if (days < 30) earlyFail++;
      }

      // Check On-time vs Overdue
      if (isDone) {
        if (doneMs && schedMs && doneMs > schedMs + 86400000) {
          overdue++;
        } else if (sentMs && doneMs && (doneMs - sentMs) > 7 * 86400000) {
          overdue++;
        } else {
          onTime++;
        }
      } else {
        const now = Date.now();
        if (sentMs && (now - sentMs) > 7 * 86400000) {
          overdue++;
        } else {
          onTime++;
        }
        if (item.projectCode && item.projectCode.trim()) {
          activeProjSet.add(item.projectCode.trim());
        }
      }

      // Counts for Tops
      const sup = (item.supplier || 'Chưa gán').trim();
      supplierMap.set(sup, (supplierMap.get(sup) || 0) + 1);

      const prj = (item.projectCode || 'Chưa gán').trim();
      projectMap.set(prj, (projectMap.get(prj) || 0) + 1);

      const st = (item.storeName || 'Chưa gán').trim();
      storeMap.set(st, (storeMap.get(st) || 0) + 1);

      const br = (item.brand || 'Chưa gán').trim();
      brandMap.set(br, (brandMap.get(br) || 0) + 1);

      const po = (item.posmType || 'Chưa gán').trim();
      posmMap.set(po, (posmMap.get(po) || 0) + 1);
    });

    const getTop = (map: Map<string, number>) => {
      let topName = '-';
      let maxVal = 0;
      map.forEach((val, key) => {
        if (val > maxVal) {
          maxVal = val;
          topName = key;
        }
      });
      return {
        name: topName,
        count: maxVal,
        pct: `${((maxVal / total) * 100).toFixed(1)}%`
      };
    };

    return {
      total,
      onTimeCount: onTime,
      onTimePct: `${((onTime / total) * 100).toFixed(1)}%`,
      overdueCount: overdue,
      overduePct: `${((overdue / total) * 100).toFixed(1)}%`,
      earlyFailCount: earlyFail,
      earlyFailPct: `${((earlyFail / total) * 100).toFixed(1)}%`,
      topSupplier: getTop(supplierMap),
      topProject: getTop(projectMap),
      topStore: getTop(storeMap),
      topBrand: getTop(brandMap),
      topPosm: getTop(posmMap),
      activeProjects: Array.from(activeProjSet)
    };
  }, [filteredData]);

  // Section 1: Đánh Giá Nhà Thầu Breakdown
  const supplierMatrix = useMemo(() => {
    const map = new Map<string, {
      supplier: string;
      total: number;
      earlyFail: number;
      recurrent: number;
      overdue: number;
      onTime: number;
    }>();

    // Track recurrent by store + posm
    const storePosmCounts = new Map<string, number>();
    filteredData.forEach(item => {
      const key = `${(item.storeName || '').trim()}__${(item.posmType || '').trim()}`;
      storePosmCounts.set(key, (storePosmCounts.get(key) || 0) + 1);
    });

    filteredData.forEach(item => {
      const sup = (item.supplier || 'Chưa gán').trim();
      if (!map.has(sup)) {
        map.set(sup, { supplier: sup, total: 0, earlyFail: 0, recurrent: 0, overdue: 0, onTime: 0 });
      }
      const entry = map.get(sup)!;
      entry.total++;

      const sentMs = parseDateToMs(item.sentDate || item.createdAt);
      const installMs = parseDateToMs(item.installationDate);
      const doneMs = parseDateToMs(item.completedDate);
      const schedMs = parseDateToMs(item.scheduledDate);
      const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;

      if (installMs && sentMs && sentMs >= installMs && (sentMs - installMs) < 30 * 86400000) {
        entry.earlyFail++;
      }

      const key = `${(item.storeName || '').trim()}__${(item.posmType || '').trim()}`;
      if ((storePosmCounts.get(key) || 0) > 1) {
        entry.recurrent++;
      }

      if (isDone) {
        if (doneMs && schedMs && doneMs > schedMs + 86400000) {
          entry.overdue++;
        } else if (sentMs && doneMs && (doneMs - sentMs) > 7 * 86400000) {
          entry.overdue++;
        } else {
          entry.onTime++;
        }
      } else {
        const now = Date.now();
        if (sentMs && (now - sentMs) > 7 * 86400000) {
          entry.overdue++;
        } else {
          entry.onTime++;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Section 2: Nguyên Nhân Hư Hỏng Breakdown (Dynamic from Column W / errorType, with fallback)
  const causeBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; suppliers: Set<string> }>();

    filteredData.forEach(item => {
      // 1. Prioritize explicit Column W / errorType from Sheet
      let causeKey = (item.errorType || '').trim();
      const sup = (item.supplier || '').trim();

      // 2. Fallback to keyword matching if column W is empty on this row
      if (!causeKey) {
        const err = (item.errorDetail || item.reason || item.notes || '').toLowerCase();
        if (err.includes('cầu chì') || err.includes('đèn led') || err.includes('led') || err.includes('đèn') || err.includes('tắt đèn')) {
          causeKey = 'Tắt, hỏng hệ thống cầu chì/Đèn LED';
        } else if (err.includes('nguồn') || err.includes('điện') || err.includes('adapter') || err.includes('chập')) {
          causeKey = 'Thiết bị nguồn/Điện thông minh hư hại';
        } else if (err.includes('xe đẩy') || err.includes('ngoại lực') || err.includes('khách') || err.includes('va đập') || err.includes('gãy') || err.includes('vỡ') || err.includes('móp')) {
          causeKey = 'Tác động ngoại lực (Xe đẩy siêu thị, khách hàng)';
        } else {
          causeKey = 'Khác / Chưa phân loại';
        }
      }

      if (!map.has(causeKey)) {
        map.set(causeKey, { count: 0, suppliers: new Set<string>() });
      }
      const entry = map.get(causeKey)!;
      entry.count++;
      if (sup) entry.suppliers.add(sup);
    });

    const total = filteredData.length || 1;

    return Array.from(map.entries()).map(([title, val], idx) => ({
      id: `cause_${idx}`,
      title,
      count: val.count,
      pct: ((val.count / total) * 100).toFixed(1),
      suppliers: Array.from(val.suppliers)
    })).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Section 3: Cảnh Báo Trễ Hạn Breakdown (3 standard operational brackets)
  const delayTiers = useMemo(() => {
    let t1 = 0; // 1-3 days
    let t2 = 0; // 4-7 days
    let t3 = 0; // >7 days

    filteredData.forEach(item => {
      const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;
      const sentMs = parseDateToMs(item.sentDate || item.createdAt);
      const schedMs = parseDateToMs(item.scheduledDate);
      const doneMs = parseDateToMs(item.completedDate);
      
      let delayDays = 0;
      if (isDone && doneMs && schedMs && doneMs > schedMs) {
        delayDays = Math.round((doneMs - schedMs) / 86400000);
      } else if (!isDone && sentMs) {
        const diff = Math.round((Date.now() - sentMs) / 86400000);
        if (diff > 3) delayDays = diff - 3;
      }

      if (delayDays >= 1 && delayDays <= 3) t1++;
      else if (delayDays >= 4 && delayDays <= 7) t2++;
      else if (delayDays > 7) t3++;
    });

    const total = filteredData.length || 1;

    return [
      {
        id: 'tier1',
        label: '1 - 3 ngày (Trễ nhẹ)',
        count: t1,
        pct: ((t1 / total) * 100).toFixed(1),
        color: '#D9B300'
      },
      {
        id: 'tier2',
        label: '4 - 7 ngày (Cảnh báo tiến độ)',
        count: t2,
        pct: ((t2 / total) * 100).toFixed(1),
        color: '#E66C37'
      },
      {
        id: 'tier3',
        label: '> 7 ngày (Quá hạn nghiêm trọng)',
        count: t3,
        pct: ((t3 / total) * 100).toFixed(1),
        color: '#D64550'
      }
    ];
  }, [filteredData]);

  // Sections 4-7: Category Distributions
  const categoryDistributions = useMemo(() => {
    const getBreakdown = (extractor: (i: WarrantyItem) => string) => {
      const map = new Map<string, number>();
      filteredData.forEach(item => {
        const val = extractor(item).trim() || 'Chưa gán';
        map.set(val, (map.get(val) || 0) + 1);
      });
      const total = filteredData.length || 1;
      return Array.from(map.entries())
        .map(([name, count]) => ({
          name,
          count,
          pct: ((count / total) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };

    return {
      posm: getBreakdown(i => i.posmType || ''),
      store: getBreakdown(i => i.storeName || ''),
      project: getBreakdown(i => i.projectCode || ''),
      brand: getBreakdown(i => i.brand || '')
    };
  }, [filteredData]);

  // Detail Matrix Rows (Filtered by search text)
  const detailTableRows = useMemo(() => {
    return filteredData.filter(item => {
      if (!detailSearch.trim()) return true;
      const s = detailSearch.toLowerCase().trim();
      return (
        (item.requestId || '').toLowerCase().includes(s) ||
        (item.projectCode || '').toLowerCase().includes(s) ||
        (item.storeName || '').toLowerCase().includes(s) ||
        (item.supplier || '').toLowerCase().includes(s) ||
        (item.brand || '').toLowerCase().includes(s) ||
        (item.posmType || '').toLowerCase().includes(s)
      );
    });
  }, [filteredData, detailSearch]);

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedQuarter('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
    setDateFrom('');
    setDateTo('');
    setSelectedVisTech('all');
    setSelectedSupplier('all');
    setSelectedStore('all');
    setSelectedPosmType('all');
    setSelectedBrand('all');
    setSelectedProjects([]);
    setCrossFilter({ type: null, value: '' });
    setDetailSearch('');
    toast.success('Đã làm mới tất cả các bộ lọc slicers');
  };

  const isDateFiltered = selectedYear !== 'all' || selectedQuarter !== 'all' || selectedMonth !== 'all' || selectedWeek !== 'all' || !!dateFrom || !!dateTo;
  const isClassFiltered = selectedVisTech !== 'all' || selectedSupplier !== 'all' || selectedStore !== 'all' || selectedPosmType !== 'all' || selectedBrand !== 'all';
  const isProjectFiltered = selectedProjects.length > 0;
  const isFilterActive = isDateFiltered || isClassFiltered || isProjectFiltered || crossFilter.type !== null;

  const getDateFilterLabel = () => {
    if (dateFrom && dateTo) return `${dateFrom} ➔ ${dateTo}`;
    if (dateFrom) return `Từ ${dateFrom}`;
    if (dateTo) return `Đến ${dateTo}`;
    if (selectedWeek !== 'all') return `Tuần ${selectedWeek}`;
    if (selectedQuarter !== 'all' && selectedYear !== 'all') return `Quý ${selectedQuarter}/${selectedYear}`;
    if (selectedQuarter !== 'all') return `Quý ${selectedQuarter}`;
    if (selectedMonth !== 'all' && selectedYear !== 'all') return `T${selectedMonth}/${selectedYear}`;
    if (selectedMonth !== 'all') return `Tháng ${selectedMonth}`;
    if (selectedYear !== 'all') return `Năm ${selectedYear}`;
    return 'Tất cả';
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#181818] text-[#252423] dark:text-[#F3F2F1] flex flex-col font-sans select-text pb-14">
      
      {/* POWER BI DESKTOP TOP COMMAND BAR */}
      <div className="bg-[#FFFFFF] dark:bg-[#202020] border-b border-[#D2D0CE] dark:border-[#383838] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#F2C811] text-[#252423] font-black text-xs flex items-center justify-center rounded-[2px] shadow-sm tracking-tighter">
            PBI
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#252423] dark:text-[#FFFFFF] leading-tight flex items-center gap-2">
              <span>Báo Cáo Phân Tích Sự Cố Bảo Hành POSM</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 bg-[#F3F2F1] dark:bg-[#323130] text-[#605E5C] dark:text-[#C8C6C4] border border-[#EDEBE9] dark:border-[#383838] rounded-[2px]">
                Power BI Canvas
              </span>
            </h1>
            <p className="text-[11px] text-[#605E5C] dark:text-[#A19F9D]">
              Đồng bộ cấu trúc dữ liệu 1:1 theo template Weekly_Report.xlsx
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-xs font-semibold bg-[#F3F2F1] hover:bg-[#EDEBE9] dark:bg-[#2D2D2D] dark:hover:bg-[#383838] text-[#252423] dark:text-[#FFFFFF] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#605E5C]" />
              <span>Xóa bộ lọc</span>
            </button>
          )}

          <button
            onClick={() => onExportExcel()}
            className="px-3 py-1 text-xs font-bold bg-[#107C41] hover:bg-[#0E6C38] text-white rounded-[2px] flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            title="Xuất báo cáo Excel 3-Sheet đầy đủ theo chuẩn Weekly_Report"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel (3 Sheet)</span>
          </button>
        </div>
      </div>

      {/* POWER BI SLICERS / FILTER PANE BAR (UNIFIED 2-GROUPS: DATE + CLASSIFICATION) */}
      <div className="bg-[#FFFFFF] dark:bg-[#242424] border-b border-[#D2D0CE] dark:border-[#383838] px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-[#605E5C] dark:text-[#A19F9D] font-semibold uppercase text-[11px] pr-2 border-r border-[#EDEBE9] dark:border-[#383838]">
            <Filter className="w-3.5 h-3.5 text-[#118DFF]" />
            <span>Slicers:</span>
          </div>

          {/* 1. UNIFIED DATE FILTER SLICER BUTTON */}
          <div className="relative">
            <button
              onClick={() => {
                setIsDateSlicerOpen(!isDateSlicerOpen);
                setIsClassSlicerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer font-semibold ${
                isDateFiltered
                  ? 'bg-[#118DFF]/10 text-[#118DFF] border-[#118DFF]'
                  : 'bg-[#F8F9FA] dark:bg-[#2A2A2A] border-[#D2D0CE] dark:border-[#3B3A39] text-[#252423] dark:text-[#F3F2F1]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#118DFF]" />
              <span>Thời gian: {getDateFilterLabel()}</span>
              <ChevronDown className={`w-3 h-3 text-[#8A8886] transition-transform ${isDateSlicerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateSlicerOpen && (
              <div className="absolute left-0 mt-1.5 w-80 sm:w-96 bg-[#FFFFFF] dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] shadow-xl z-50 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#383838] pb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#118DFF]" />
                    Bộ Lọc Thời Gian
                  </span>
                  {isDateFiltered && (
                    <button
                      onClick={() => {
                        setSelectedYear('all');
                        setSelectedQuarter('all');
                        setSelectedMonth('all');
                        setSelectedWeek('all');
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-[11px] text-[#D64550] hover:underline font-semibold"
                    >
                      Đặt lại
                    </button>
                  )}
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedYear('all');
                      setSelectedQuarter('all');
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className={`px-2 py-0.5 rounded-[2px] text-[11px] font-semibold ${!isDateFiltered ? 'bg-[#118DFF] text-white' : 'bg-[#F3F2F1] dark:bg-[#323130]'}`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(String(now.getFullYear()));
                      setSelectedQuarter('all');
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="px-2 py-0.5 bg-[#F3F2F1] dark:bg-[#323130] rounded-[2px] text-[11px] font-semibold hover:bg-[#EDEBE9]"
                  >
                    Năm nay ({new Date().getFullYear()})
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(String(now.getFullYear()));
                      setSelectedQuarter(String(Math.ceil((now.getMonth() + 1) / 3)));
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="px-2 py-0.5 bg-[#F3F2F1] dark:bg-[#323130] rounded-[2px] text-[11px] font-semibold hover:bg-[#EDEBE9]"
                  >
                    Quý này (Q{Math.ceil((new Date().getMonth() + 1) / 3)})
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(String(now.getFullYear()));
                      setSelectedQuarter('all');
                      setSelectedMonth(String(now.getMonth() + 1));
                      setSelectedWeek('all');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="px-2 py-0.5 bg-[#F3F2F1] dark:bg-[#323130] rounded-[2px] text-[11px] font-semibold hover:bg-[#EDEBE9]"
                  >
                    Tháng này (T{new Date().getMonth() + 1})
                  </button>
                </div>

                {/* Grid selectors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">Năm</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-xs font-semibold"
                    >
                      <option value="all">Tất cả</option>
                      {uniqueYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">Quý</label>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-xs font-semibold"
                    >
                      <option value="all">Tất cả</option>
                      <option value="1">Quý 1</option>
                      <option value="2">Quý 2</option>
                      <option value="3">Quý 3</option>
                      <option value="4">Quý 4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">Tháng</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-xs font-semibold"
                    >
                      <option value="all">Tất cả</option>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
                        <option key={m} value={m}>T{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">Tuần</label>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-xs font-semibold"
                    >
                      <option value="all">Tất cả</option>
                      {Array.from({ length: 52 }, (_, i) => String(i + 1)).map(w => (
                        <option key={w} value={w}>Tuần {w}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Range */}
                <div className="pt-2 border-t border-[#EDEBE9] dark:border-[#383838] grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[#605E5C] block mb-0.5">Từ ngày:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full p-1 text-xs border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] bg-transparent"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#605E5C] block mb-0.5">Đến ngày:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full p-1 text-xs border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setIsDateSlicerOpen(false)}
                    className="px-3 py-1 bg-[#118DFF] text-white text-xs font-bold rounded-[2px]"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. UNIFIED CLASSIFICATION FILTER SLICER BUTTON */}
          <div className="relative">
            <button
              onClick={() => {
                setIsClassSlicerOpen(!isClassSlicerOpen);
                setIsDateSlicerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer font-semibold ${
                isClassFiltered
                  ? 'bg-[#5C2D91]/10 text-[#5C2D91] dark:text-[#C58AF9] border-[#5C2D91]'
                  : 'bg-[#F8F9FA] dark:bg-[#2A2A2A] border-[#D2D0CE] dark:border-[#3B3A39] text-[#252423] dark:text-[#F3F2F1]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#5C2D91] dark:text-[#C58AF9]" />
              <span>Phân loại: {isClassFiltered ? 'Đang lọc' : 'Tất cả'}</span>
              <ChevronDown className={`w-3 h-3 text-[#8A8886] transition-transform ${isClassSlicerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isClassSlicerOpen && (
              <div className="absolute left-0 mt-1.5 w-80 sm:w-[380px] bg-[#FFFFFF] dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] shadow-xl z-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#383838] pb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#5C2D91]" />
                    Bộ Lọc Phân Loại POSM
                  </span>
                  {isClassFiltered && (
                    <button
                      onClick={() => {
                        setSelectedVisTech('all');
                        setSelectedSupplier('all');
                        setSelectedStore('all');
                        setSelectedPosmType('all');
                        setSelectedBrand('all');
                      }}
                      className="text-[11px] text-[#D64550] hover:underline font-semibold"
                    >
                      Đặt lại
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {/* VIS-Tech */}
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">1. VIS-Tech</label>
                    <select
                      value={selectedVisTech}
                      onChange={(e) => setSelectedVisTech(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]"
                    >
                      <option value="all">Tất cả VIS-Tech ({uniqueVisTechs.length})</option>
                      {uniqueVisTechs.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier */}
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">2. Nhà thầu (Supplier)</label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]"
                    >
                      <option value="all">Tất cả Nhà thầu ({uniqueSuppliers.length})</option>
                      {uniqueSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Store */}
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">3. Siêu thị (Store)</label>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]"
                    >
                      <option value="all">Tất cả Siêu thị ({uniqueStores.length})</option>
                      {uniqueStores.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Loại POSM */}
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">4. Loại POSM</label>
                    <select
                      value={selectedPosmType}
                      onChange={(e) => setSelectedPosmType(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]"
                    >
                      <option value="all">Tất cả Loại POSM ({uniquePosmTypes.length})</option>
                      {uniquePosmTypes.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Brand / Nhãn */}
                  <div>
                    <label className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] block mb-0.5">5. Nhãn / Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full p-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]"
                    >
                      <option value="all">Tất cả Brand ({uniqueBrands.length})</option>
                      {uniqueBrands.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setIsClassSlicerOpen(false)}
                    className="px-3 py-1 bg-[#5C2D91] text-white text-xs font-bold rounded-[2px]"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. DEDICATED PROJECT CODE SLICER POPOVER WITH SEARCH */}
          <div className="relative">
            <button
              onClick={() => {
                setIsProjectSlicerOpen(!isProjectSlicerOpen);
                setIsDateSlicerOpen(false);
                setIsClassSlicerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border transition-colors cursor-pointer font-semibold ${
                isProjectFiltered
                  ? 'bg-[#B146C2]/10 text-[#B146C2] dark:text-[#E289F2] border-[#B146C2]'
                  : 'bg-[#F8F9FA] dark:bg-[#2A2A2A] border-[#D2D0CE] dark:border-[#3B3A39] text-[#252423] dark:text-[#F3F2F1]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#B146C2] dark:text-[#E289F2]" />
              <span>
                Dự án: {selectedProjects.length === 0
                  ? 'Tất cả'
                  : selectedProjects.length === 1
                  ? selectedProjects[0]
                  : `${selectedProjects.length} mã đã chọn`}
              </span>
              <ChevronDown className={`w-3 h-3 text-[#8A8886] transition-transform ${isProjectSlicerOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProjectSlicerOpen && (
              <div className="absolute left-0 mt-1.5 w-80 sm:w-96 bg-[#FFFFFF] dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] shadow-xl z-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#383838] pb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#B146C2]" />
                    Bộ Lọc Mã Dự Án ({uniqueProjects.length})
                  </span>
                  {isProjectFiltered && (
                    <button
                      onClick={() => setSelectedProjects([])}
                      className="text-[11px] text-[#D64550] hover:underline font-semibold"
                    >
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>

                {/* In-Popover Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8886]" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm mã dự án..."
                    value={projectSlicerSearch}
                    onChange={(e) => setProjectSlicerSearch(e.target.value)}
                    className="w-full pl-8 pr-6 py-1 bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-xs outline-none focus:border-[#B146C2]"
                  />
                  {projectSlicerSearch && (
                    <button
                      onClick={() => setProjectSlicerSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8886] hover:text-[#252423] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center justify-between text-[11px] text-[#605E5C] dark:text-[#A19F9D]">
                  <span>{filteredProjects.length} mã phù hợp</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const visibleCodes = filteredProjects.map(p => p.code);
                        const merged = Array.from(new Set([...selectedProjects, ...visibleCodes]));
                        setSelectedProjects(merged);
                      }}
                      className="text-[#118DFF] hover:underline font-semibold cursor-pointer"
                    >
                      Chọn tất cả ({filteredProjects.length})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProjects([])}
                      className="text-[#605E5C] hover:underline cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Project Checklist */}
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pr-1 border border-[#EDEBE9] dark:border-[#383838] p-1.5 rounded-[2px] bg-[#F8F9FA] dark:bg-[#2A2A2A]">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8A8886] italic">
                      Không tìm thấy mã dự án nào khớp với "{projectSlicerSearch}"
                    </div>
                  ) : (
                    filteredProjects.map(({ code, count }) => {
                      const isChecked = selectedProjects.includes(code);
                      return (
                        <label
                          key={code}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedProjects(selectedProjects.filter(c => c !== code));
                            } else {
                              setSelectedProjects([...selectedProjects, code]);
                            }
                          }}
                          className={`flex items-center justify-between px-2 py-1 rounded-[2px] text-xs cursor-pointer select-none transition-colors ${
                            isChecked
                              ? 'bg-[#B146C2]/15 font-bold text-[#252423] dark:text-[#FFFFFF]'
                              : 'hover:bg-[#EDEBE9] dark:hover:bg-[#323130] text-[#252423] dark:text-[#F3F2F1]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div
                              className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? 'bg-[#B146C2] border-[#B146C2] text-white'
                                  : 'border-[#D2D0CE] dark:border-[#605E5C] bg-white dark:bg-[#202020]'
                              }`}
                            >
                              {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="truncate font-mono">{code}</span>
                          </div>
                          <span className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] shrink-0 font-mono">
                            {count} ca
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setIsProjectSlicerOpen(false)}
                    className="px-3 py-1 bg-[#B146C2] text-white text-xs font-bold rounded-[2px]"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Cross Filter Indicator */}
          {crossFilter.type && (
            <div className="flex items-center gap-1 bg-[#118DFF]/10 text-[#118DFF] border border-[#118DFF]/30 px-2 py-0.5 rounded-[2px] text-xs font-semibold">
              <span>Đang lọc: {crossFilter.value}</span>
              <X 
                className="w-3 h-3 cursor-pointer hover:text-[#0B66C3]" 
                onClick={() => setCrossFilter({ type: null, value: '' })}
              />
            </div>
          )}

          <div className="ml-auto text-xs text-[#605E5C] dark:text-[#A19F9D] font-mono">
            Hiển thị <span className="font-bold text-[#252423] dark:text-[#FFFFFF]">{filteredData.length}</span> / {warrantyItems.length} ca
          </div>
        </div>
      </div>

      {/* POWER BI REPORT CANVAS AREA */}
      <div className="p-4 space-y-4 max-w-[1700px] mx-auto w-full">

        {/* TAB 1: WEEKLY SUMMARY CANVAS */}
        {activeReportPage === 'SUMMARY' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            {/* ROW 1: 9 KPI METRIC CARDS (POWER BI MULTI-ROW CARD VISUALS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
              
              {/* Card 1: Tổng Ca */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#118DFF] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Tổng Ca Bảo Hành
                </div>
                <div className="text-2xl font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1">
                  {kpiData.total}
                </div>
                <div className="text-[10px] text-[#8A8886] mt-0.5">Toàn bộ hồ sơ</div>
              </div>

              {/* Card 2: % Đúng Hạn */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#107C41] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  % Xử Lý Đúng Hạn
                </div>
                <div className="text-2xl font-bold font-sans text-[#107C41] dark:text-[#27AE60] mt-1">
                  {kpiData.onTimePct}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  ⚡ {kpiData.onTimeCount}/{kpiData.total} ca
                </div>
              </div>

              {/* Card 3: % Trễ Hạn */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#D64550] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  % Xử Lý Trễ Hạn
                </div>
                <div className="text-2xl font-bold font-sans text-[#D64550] mt-1">
                  {kpiData.overduePct}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  ⚠️ {kpiData.overdueCount}/{kpiData.total} ca
                </div>
              </div>

              {/* Card 4: % Hỏng Sớm */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#D9B300] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate" title="Hỏng sớm < 30 ngày từ ngày lắp đặt">
                  % Hỏng Sớm (&lt;30d)
                </div>
                <div className="text-2xl font-bold font-sans text-[#D9B300] dark:text-[#F2C811] mt-1">
                  {kpiData.earlyFailPct}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  ⚠️ {kpiData.earlyFailCount}/{kpiData.total} ca
                </div>
              </div>

              {/* Card 5: Top Nhà Thầu */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#0078D4] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Top Nhà Thầu Sự Cố
                </div>
                <div className="text-lg font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1 truncate" title={kpiData.topSupplier.name}>
                  {kpiData.topSupplier.name}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  {kpiData.topSupplier.count} ca ({kpiData.topSupplier.pct})
                </div>
              </div>

              {/* Card 6: Top Dự Án */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#5C2D91] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Top Dự Án Sự Cố
                </div>
                <div className="text-lg font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1 font-mono truncate" title={kpiData.topProject.name}>
                  {kpiData.topProject.name}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  {kpiData.topProject.count} ca ({kpiData.topProject.pct})
                </div>
              </div>

              {/* Card 7: Top Siêu Thị */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#008272] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Top Siêu Thị Sự Cố
                </div>
                <div className="text-lg font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1 truncate" title={kpiData.topStore.name}>
                  {kpiData.topStore.name}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  {kpiData.topStore.count} ca ({kpiData.topStore.pct})
                </div>
              </div>

              {/* Card 8: Top Ngành Hàng */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#B4009E] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Top Ngành Hàng
                </div>
                <div className="text-lg font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1 truncate" title={kpiData.topBrand.name}>
                  {kpiData.topBrand.name}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  {kpiData.topBrand.count} ca ({kpiData.topBrand.pct})
                </div>
              </div>

              {/* Card 9: Top POSM */}
              <div className="bg-white dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] border-t-[3px] border-t-[#E66C37] p-2.5 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605E5C] dark:text-[#A19F9D] truncate">
                  Top Loại POSM
                </div>
                <div className="text-lg font-bold font-sans text-[#252423] dark:text-[#FFFFFF] mt-1 truncate" title={kpiData.topPosm.name}>
                  {kpiData.topPosm.name}
                </div>
                <div className="text-[10px] text-[#605E5C] font-mono mt-0.5">
                  {kpiData.topPosm.count} ca ({kpiData.topPosm.pct})
                </div>
              </div>

            </div>

            {/* Sub-bar: Active In-Progress Projects */}
            {kpiData.activeProjects.length > 0 && (
              <div className="bg-[#FFFFFF] dark:bg-[#242424] border border-[#D2D0CE] dark:border-[#383838] px-3 py-1.5 rounded-[2px] flex items-center gap-2 text-xs">
                <span className="font-bold text-[#D64550] flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  ⏳ Đang xử lý:
                </span>
                <span className="text-[#605E5C] dark:text-[#A19F9D]">
                  Thuộc các mã dự án:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {kpiData.activeProjects.map(prj => (
                    <span 
                      key={prj}
                      onClick={() => setSelectedProject(prj)}
                      className="px-1.5 py-0.2 bg-[#F3F2F1] dark:bg-[#323130] hover:bg-[#EDEBE9] text-[#252423] dark:text-[#FFFFFF] font-mono font-bold border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] cursor-pointer text-[11px]"
                      title="Bấm để lọc theo dự án này"
                    >
                      {prj}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ROW 2: 3 CORE OPERATIONAL TABLES / CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              
              {/* Visual 1: Đánh Giá Nhà Thầu (Power BI Table with Progress Data Bars) */}
              <PowerBIVisual
                title="1. ĐÁNH GIÁ NHÀ THẦU"
                subtitle="Thống kê hiệu suất & tỷ lệ đạt tiến độ"
                accentColor="#118DFF"
                filterActive={crossFilter.type === 'supplier'}
              >
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-[#D2D0CE] dark:border-[#383838] text-[#605E5C] dark:text-[#A19F9D] font-bold text-[11px] bg-[#F8F9FA] dark:bg-[#2A2A2A]">
                        <th className="py-1.5 px-2">Nhà Thầu</th>
                        <th className="py-1.5 px-1 text-center">Total Case</th>
                        <th className="py-1.5 px-1 text-center" title="Số ca hỏng sớm < 30 ngày từ ngày nghiệm thu lắp đặt">Hỏng Sớm (&lt;30d)</th>
                        <th className="py-1.5 px-1 text-center" title="Số ca tái diễn trên cùng 1 POSM">Tái Diễn</th>
                        <th className="py-1.5 px-1 text-center">Trễ Hạn</th>
                        <th className="py-1.5 px-2 text-right">% Đạt Tiến Độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#323130]">
                      {supplierMatrix.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-[#A19F9D] italic">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        supplierMatrix.map(row => {
                          const rate = row.total > 0 ? Math.round((row.onTime / row.total) * 100) : 0;
                          const isSelected = crossFilter.type === 'supplier' && crossFilter.value === row.supplier;
                          return (
                            <tr
                              key={row.supplier}
                              onClick={() => {
                                setCrossFilter(prev => 
                                  prev.type === 'supplier' && prev.value === row.supplier
                                    ? { type: null, value: '' }
                                    : { type: 'supplier', value: row.supplier }
                                );
                              }}
                              className={`cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-[#118DFF]/15 font-semibold' 
                                  : 'hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A]'
                              }`}
                            >
                              <td className="py-1.5 px-2 font-bold text-[#252423] dark:text-[#FFFFFF]">
                                {row.supplier}
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono font-bold">
                                {row.total}
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono text-[#D9B300] font-semibold">
                                {row.earlyFail > 0 ? row.earlyFail : '-'}
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono text-[#E66C37] font-semibold">
                                {row.recurrent > 0 ? row.recurrent : '-'}
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono text-[#D64550] font-bold">
                                {row.overdue > 0 ? row.overdue : '-'}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                                    <div 
                                      className="h-full bg-[#107C41] transition-all"
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[11px] font-bold w-9 text-right">
                                    {rate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </PowerBIVisual>

              {/* Visual 2: Phân Loại Nguyên Nhân Hư Hỏng */}
              <PowerBIVisual
                title="2. NGUYÊN NHÂN HƯ HỎNG"
                subtitle="Nhóm lỗi chính theo ghi nhận thực tế"
                accentColor="#E66C37"
              >
                <div className="space-y-3 flex-1 flex flex-col justify-around">
                  {causeBreakdown.map((c, idx) => (
                    <div 
                      key={c.id}
                      className="p-2.5 border border-[#EDEBE9] dark:border-[#383838] bg-[#F8F9FA] dark:bg-[#2A2A2A] rounded-[2px] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#252423] dark:text-[#FFFFFF] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: idx === 0 ? '#118DFF' : idx === 1 ? '#E66C37' : '#D64550' }} />
                          {c.title}
                        </span>
                        <span className="font-mono font-bold text-[#252423] dark:text-[#FFFFFF]">
                          {c.count} ca ({c.pct}%)
                        </span>
                      </div>

                      {/* Power BI Bar */}
                      <div className="w-full h-1.5 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                        <div 
                          className="h-full transition-all"
                          style={{ 
                            width: `${c.pct}%`, 
                            backgroundColor: idx === 0 ? '#118DFF' : idx === 1 ? '#E66C37' : '#D64550' 
                          }}
                        />
                      </div>

                      {c.suppliers.length > 0 && (
                        <div className="text-[10px] text-[#605E5C] dark:text-[#A19F9D] flex items-center gap-1 truncate">
                          <span>Thầu liên quan:</span>
                          <span className="font-mono text-[#252423] dark:text-[#F3F2F1]">
                            {c.suppliers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

              {/* Visual 3: Cảnh Báo Trễ Hạn */}
              <PowerBIVisual
                title="3. THỜI GIAN TRỄ HẠN"
                subtitle="Phân tầng ca chậm tiến độ theo mức độ"
                accentColor="#D64550"
              >
                <div className="space-y-3 flex-1 flex flex-col justify-around">
                  {delayTiers.map(t => (
                    <div 
                      key={t.id}
                      className="p-3 border border-[#EDEBE9] dark:border-[#383838] bg-[#F8F9FA] dark:bg-[#2A2A2A] rounded-[2px] flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-[#252423] dark:text-[#FFFFFF] block">
                          {t.label}
                        </span>
                        <span className="text-[11px] text-[#605E5C] dark:text-[#A19F9D] font-mono">
                          Chiếm {t.pct}% trên tổng số ca
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold font-mono" style={{ color: t.color }}>
                          {t.count}
                        </div>
                        <div className="text-[10px] text-[#8A8886]">ca</div>
                      </div>
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

            </div>

            {/* ROW 3: 4 CATEGORY MATRICES (THEO TỪNG HẠNG MỤC) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* 4. Theo Loại POSM */}
              <PowerBIVisual 
                title="4. THEO LOẠI POSM" 
                subtitle="Top phát sinh hư hỏng"
                accentColor="#5C2D91"
                filterActive={crossFilter.type === 'posm'}
              >
                <div className="space-y-2 flex-1">
                  {categoryDistributions.posm.map(item => (
                    <div 
                      key={item.name}
                      onClick={() => setCrossFilter(prev => prev.type === 'posm' && prev.value === item.name ? { type: null, value: '' } : { type: 'posm', value: item.name })}
                      className="space-y-1 cursor-pointer hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] p-1 rounded-[2px] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#252423] dark:text-[#F3F2F1] truncate max-w-[140px]" title={item.name}>
                          {item.name}
                        </span>
                        <span className="font-mono text-[#605E5C] dark:text-[#A19F9D]">
                          {item.count} ca ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                        <div className="h-full bg-[#5C2D91]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

              {/* 5. Theo Siêu Thị */}
              <PowerBIVisual 
                title="5. THEO SIÊU THỊ" 
                subtitle="Top vị trí ghi nhận lỗi"
                accentColor="#008272"
                filterActive={crossFilter.type === 'store'}
              >
                <div className="space-y-2 flex-1">
                  {categoryDistributions.store.map(item => (
                    <div 
                      key={item.name}
                      onClick={() => setCrossFilter(prev => prev.type === 'store' && prev.value === item.name ? { type: null, value: '' } : { type: 'store', value: item.name })}
                      className="space-y-1 cursor-pointer hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] p-1 rounded-[2px] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#252423] dark:text-[#F3F2F1] truncate max-w-[140px]" title={item.name}>
                          {item.name}
                        </span>
                        <span className="font-mono text-[#605E5C] dark:text-[#A19F9D]">
                          {item.count} ca ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                        <div className="h-full bg-[#008272]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

              {/* 6. Theo Mã Dự Án */}
              <PowerBIVisual 
                title="6. THEO MÃ DỰ ÁN" 
                subtitle="Top mã dự án phát sinh ca"
                accentColor="#118DFF"
                filterActive={crossFilter.type === 'project'}
              >
                <div className="space-y-2 flex-1">
                  {categoryDistributions.project.map(item => (
                    <div 
                      key={item.name}
                      onClick={() => setCrossFilter(prev => prev.type === 'project' && prev.value === item.name ? { type: null, value: '' } : { type: 'project', value: item.name })}
                      className="space-y-1 cursor-pointer hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] p-1 rounded-[2px] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-[#118DFF] truncate max-w-[140px]" title={item.name}>
                          {item.name}
                        </span>
                        <span className="font-mono text-[#605E5C] dark:text-[#A19F9D]">
                          {item.count} ca ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                        <div className="h-full bg-[#118DFF]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

              {/* 7. Theo Ngành Hàng */}
              <PowerBIVisual 
                title="7. THEO NGÀNH HÀNG" 
                subtitle="Tỷ trọng sự cố theo Brand/Cat"
                accentColor="#B4009E"
                filterActive={crossFilter.type === 'brand'}
              >
                <div className="space-y-2 flex-1">
                  {categoryDistributions.brand.map(item => (
                    <div 
                      key={item.name}
                      onClick={() => setCrossFilter(prev => prev.type === 'brand' && prev.value === item.name ? { type: null, value: '' } : { type: 'brand', value: item.name })}
                      className="space-y-1 cursor-pointer hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] p-1 rounded-[2px] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#252423] dark:text-[#F3F2F1] truncate max-w-[140px]" title={item.name}>
                          {item.name}
                        </span>
                        <span className="font-mono text-[#605E5C] dark:text-[#A19F9D]">
                          {item.count} ca ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EDEBE9] dark:bg-[#383838] rounded-[1px] overflow-hidden">
                        <div className="h-full bg-[#B4009E]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </PowerBIVisual>

            </div>

            {/* ROW 4: 17-COLUMN OPERATIONAL MATRIX DRILL-DOWN TABLE */}
            <PowerBIVisual
              title="8. CHI TIẾT CÁC CASE BẢO HÀNH ĐÃ CÓ ACTION"
              subtitle="Khớp 1:1 theo 17 cột nghiệp vụ bảng Weekly_Report.xlsx (Bấm vào từng dòng để mở Drawer)"
              accentColor="#252423"
            >
              {/* Search & Actions toolbar */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8886]" />
                  <input
                    type="text"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Tìm theo Mã Request, Dự án, Siêu thị, Thầu..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-[#D2D0CE] dark:border-[#383838] bg-[#FFFFFF] dark:bg-[#1F1F1F] rounded-[2px] focus:outline-none focus:border-[#118DFF]"
                  />
                  {detailSearch && (
                    <X 
                      className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8886] cursor-pointer hover:text-[#252423]" 
                      onClick={() => setDetailSearch('')} 
                    />
                  )}
                </div>

                <div className="text-xs text-[#605E5C] dark:text-[#A19F9D] font-mono">
                  {detailTableRows.length} dòng dữ liệu
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto border border-[#D2D0CE] dark:border-[#383838] rounded-[2px]">
                <table className="w-full text-left text-xs border-collapse font-sans min-w-[1400px]">
                  <thead>
                    <tr className="border-b border-[#D2D0CE] dark:border-[#383838] bg-[#F3F2F1] dark:bg-[#2A2A2A] text-[#252423] dark:text-[#F3F2F1] font-bold text-[11px]">
                      <th className="py-2 px-2.5 text-center w-10">STT</th>
                      <th className="py-2 px-2.5">Mã Request</th>
                      <th className="py-2 px-2.5">Mã Dự Án</th>
                      <th className="py-2 px-2.5">Ngành Hàng</th>
                      <th className="py-2 px-2.5">Brand</th>
                      <th className="py-2 px-2.5">Loại POSM</th>
                      <th className="py-2 px-2.5">Mã Store</th>
                      <th className="py-2 px-2.5">Tên Siêu Thị</th>
                      <th className="py-2 px-2.5">Tỉnh Thành</th>
                      <th className="py-2 px-2.5">Nhà Thầu</th>
                      <th className="py-2 px-2.5">Ngày Báo Lỗi</th>
                      <th className="py-2 px-2.5">Ngày Lắp Đặt</th>
                      <th className="py-2 px-2.5 text-center">Tuổi Thọ</th>
                      <th className="py-2 px-2.5">Loại Lỗi</th>
                      <th className="py-2 px-2.5">Tình Trạng Hư Hỏng</th>
                      <th className="py-2 px-2.5">Ngày Hẹn Xử Lý</th>
                      <th className="py-2 px-2.5">Ngày Hoàn Thành</th>
                      <th className="py-2 px-2.5 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#323130]">
                    {detailTableRows.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="py-6 text-center text-[#8A8886] italic">
                          Không tìm thấy ca bảo hành nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      detailTableRows.map((item, idx) => {
                        const sentMs = parseDateToMs(item.sentDate || item.createdAt);
                        const installMs = parseDateToMs(item.installationDate);
                        let ageDays: number | null = null;
                        if (installMs && sentMs && sentMs >= installMs) {
                          ageDays = Math.round((sentMs - installMs) / 86400000);
                        }

                        const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;

                        return (
                          <tr
                            key={item.id || idx}
                            onClick={() => onOpenWarrantyDrawer(item)}
                            className="hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] cursor-pointer transition-colors text-xs font-normal"
                          >
                            <td className="py-2 px-2.5 text-center font-mono text-[#8A8886]">{idx + 1}</td>
                            <td className="py-2 px-2.5 font-mono font-bold text-[#118DFF]">{item.requestId || item.id}</td>
                            <td className="py-2 px-2.5 font-mono text-[#252423] dark:text-[#FFFFFF]">{item.projectCode || '-'}</td>
                            <td className="py-2 px-2.5 text-[#605E5C] dark:text-[#A19F9D]">{item.category || item.brand || '-'}</td>
                            <td className="py-2 px-2.5 font-medium text-[#252423] dark:text-[#FFFFFF]">{item.brand || '-'}</td>
                            <td className="py-2 px-2.5 text-[#252423] dark:text-[#FFFFFF]">{item.posmType || '-'}</td>
                            <td className="py-2 px-2.5 font-mono text-[#605E5C] dark:text-[#A19F9D]">{item.storeCode || '-'}</td>
                            <td className="py-2 px-2.5 font-semibold text-[#252423] dark:text-[#FFFFFF] max-w-[200px] truncate" title={item.storeName}>
                              {item.storeName || '-'}
                            </td>
                            <td className="py-2 px-2.5 text-[#605E5C] dark:text-[#A19F9D]">{item.province || '-'}</td>
                            <td className="py-2 px-2.5 font-semibold text-[#252423] dark:text-[#FFFFFF]">{item.supplier || '-'}</td>
                            <td className="py-2 px-2.5 font-mono">{formatDateDisplay(item.sentDate || item.createdAt)}</td>
                            <td className="py-2 px-2.5 font-mono">{formatDateDisplay(item.installationDate)}</td>
                            <td className="py-2 px-2.5 text-center font-mono">
                              {ageDays !== null ? (
                                <span className={ageDays < 30 ? 'font-bold text-[#D9B300]' : 'text-[#605E5C]'}>
                                  {ageDays} ngày
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-[#252423] dark:text-[#FFFFFF] max-w-[160px] truncate" title={item.errorType}>
                              {item.errorType ? (
                                <span className="px-1.5 py-0.5 bg-[#F3F2F1] dark:bg-[#323130] border border-[#D2D0CE] dark:border-[#383838] rounded-[2px] text-[11px]">
                                  {item.errorType}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-2.5 max-w-[220px] truncate text-[#605E5C] dark:text-[#A19F9D]" title={item.errorDetail || item.reason || item.notes}>
                              {item.errorDetail || item.reason || item.notes || '-'}
                            </td>
                            <td className="py-2 px-2.5 font-mono">{formatDateDisplay(item.scheduledDate)}</td>
                            <td className="py-2 px-2.5 font-mono">{formatDateDisplay(item.completedDate)}</td>
                            <td className="py-2 px-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-[2px] ${
                                isDone 
                                  ? 'bg-[#107C41]/10 text-[#107C41] border border-[#107C41]/30' 
                                  : 'bg-[#118DFF]/10 text-[#118DFF] border border-[#118DFF]/30'
                              }`}>
                                {isDone ? 'Hoàn thành' : 'Đang xử lý'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </PowerBIVisual>

          </div>
        )}

      </div>

      {/* POWER BI DESKTOP BOTTOM PAGE NAVIGATION TABS BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFFFFF] dark:bg-[#202020] border-t border-[#D2D0CE] dark:border-[#383838] px-4 py-1.5 flex items-center justify-between text-xs z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
        
        {/* Page Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveReportPage('SUMMARY')}
            className={`px-3 py-1 rounded-[2px] font-semibold text-xs transition-colors flex items-center gap-1.5 ${
              activeReportPage === 'SUMMARY'
                ? 'bg-[#F2C811] text-[#252423] shadow-xs'
                : 'text-[#605E5C] dark:text-[#C8C6C4] hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A]'
            }`}
          >
            <span>📄 1. Báo Cáo Tuần (Weekly Summary)</span>
          </button>
          
          <button
            onClick={() => setActiveReportPage('SUMMARY')}
            className="px-3 py-1 rounded-[2px] font-medium text-xs text-[#8A8886] hover:bg-[#F3F2F1] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Trang 2: Chi tiết các ca xử lý"
          >
            <span>📄 2. Dữ Liệu Chi Tiết</span>
          </button>
        </div>

        {/* Zoom & Canvas controls */}
        <div className="flex items-center gap-3 text-[#605E5C] dark:text-[#A19F9D] text-[11px] font-mono">
          <span>Trang 1 / 1</span>
          <span className="text-[#D2D0CE] dark:text-[#383838]">|</span>
          <span>100% Fit to page</span>
        </div>

      </div>

    </div>
  );
};
