import React, { useState, useMemo } from 'react';
import { 
  BarChart3, Filter, RotateCcw, Download, Calendar, 
  Building2, AlertTriangle, CheckCircle2, Clock, 
  Layers, Store, Tag, ChevronRight, Search, ExternalLink,
  ShieldAlert, Sparkles, PieChart
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

// Smart Categorization of Error Causes based on actual operations
const detectErrorCause = (item: WarrantyItem): { cause: string; supplierTag: string } => {
  const detail = `${item.errorDetail || ''} ${item.note || ''}`.toLowerCase();
  const sup = item.supplier?.trim() || 'Chưa rõ';

  if (detail.includes('đèn') || detail.includes('led') || detail.includes('cầu chì') || detail.includes('tắt đèn') || detail.includes('nguồn đèn') || detail.includes('sáng')) {
    return {
      cause: 'Tắt, hỏng hệ thống cầu chì/Đèn LED',
      supplierTag: sup
    };
  }

  if (detail.includes('màn hình') || detail.includes('dummy') || detail.includes('xoay 3d') || detail.includes('mô tơ') || detail.includes('adapter') || detail.includes('thông minh') || detail.includes('hút nổi') || detail.includes('nguồn')) {
    return {
      cause: 'Thiết bị nguồn/Điện thông minh hư hại',
      supplierTag: sup
    };
  }

  if (detail.includes('xe đẩy') || detail.includes('ngoại lực') || detail.includes('khách') || detail.includes('va quẹt') || detail.includes('bể') || detail.includes('trầy') || detail.includes('gãy') || detail.includes('nứt') || detail.includes('bung keo')) {
    return {
      cause: 'Tác động ngoại lực (Xe đẩy siêu thị, khách hàng)',
      supplierTag: sup
    };
  }

  return {
    cause: 'Sự cố kết cấu & thiết bị khác',
    supplierTag: sup
  };
};

export const WarrantyReportPowerBIView: React.FC<WarrantyReportPowerBIViewProps> = ({
  warrantyItems = [],
  onOpenWarrantyDrawer,
  onExportExcel
}) => {
  // Slicers / Interactive Filter States
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPosmType, setSelectedPosmType] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedCause, setSelectedCause] = useState<string>('all');
  const [selectedTimelineDelay, setSelectedTimelineDelay] = useState<string>('all'); // '1-3', '4-7', '>7'
  const [tableSearch, setTableSearch] = useState<string>('');

  // Auto-detect dynamic weeks in dataset (sorted newest first)
  const availableWeeks = useMemo(() => {
    const weekMap = new Map<string, { label: string; startMs: number; endMs: number; count: number }>();
    
    warrantyItems.forEach(item => {
      const ms = parseDateToMs(item.sentDate);
      if (!ms) return;
      
      const d = new Date(ms);
      // Find start of week (Monday)
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const fMon = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`;
      const fSun = `${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${sunday.getFullYear()}`;
      const key = `${monday.getTime()}_${sunday.getTime()}`;
      const label = `Weekly (${fMon} - ${fSun})`;

      if (!weekMap.has(key)) {
        weekMap.set(key, { label, startMs: monday.getTime(), endMs: sunday.getTime(), count: 0 });
      }
      weekMap.get(key)!.count += 1;
    });

    return Array.from(weekMap.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.startMs - a.startMs);
  }, [warrantyItems]);

  // Filtered dataset applying all Power BI Slicers
  const filteredData = useMemo(() => {
    return warrantyItems.filter(item => {
      // 1. Year filter
      if (selectedYear !== 'all') {
        const dateStr = item.sentDate || item.installationDate || '';
        const match = dateStr.match(/\b(202[0-9]|201[0-9])\b/);
        if (match && match[1] !== selectedYear) return false;
      }

      // 2. Week filter
      if (selectedWeek !== 'all') {
        const foundWeek = availableWeeks.find(w => w.key === selectedWeek);
        if (foundWeek) {
          const itemMs = parseDateToMs(item.sentDate);
          if (!itemMs || itemMs < foundWeek.startMs || itemMs > foundWeek.endMs) {
            return false;
          }
        }
      }

      // 3. Supplier filter
      if (selectedSupplier !== 'all') {
        const sup = (item.supplier || '').trim().toLowerCase();
        if (sup !== selectedSupplier.toLowerCase()) return false;
      }

      // 4. Project filter
      if (selectedProject !== 'all') {
        const prj = (item.projectCode || '').trim().toLowerCase();
        if (prj !== selectedProject.toLowerCase()) return false;
      }

      // 5. POSM Type filter
      if (selectedPosmType !== 'all') {
        const posm = (item.posmType || '').trim().toLowerCase();
        if (posm !== selectedPosmType.toLowerCase()) return false;
      }

      // 6. Store filter
      if (selectedStore !== 'all') {
        const st = (item.storeName || item.storeCode || '').trim().toLowerCase();
        if (st !== selectedStore.toLowerCase()) return false;
      }

      // 7. Cat filter
      if (selectedCat !== 'all') {
        const cat = (item.category || '').trim().toLowerCase();
        if (cat !== selectedCat.toLowerCase()) return false;
      }

      // 8. Cause filter
      if (selectedCause !== 'all') {
        const causeInfo = detectErrorCause(item);
        if (causeInfo.cause !== selectedCause) return false;
      }

      // 9. Timeline delay filter
      if (selectedTimelineDelay !== 'all') {
        const sentMs = parseDateToMs(item.sentDate);
        const expMs = parseDateToMs(item.expectedDate);
        const compMs = parseDateToMs(item.completedDate);
        const isDone = (item.progress || '').toLowerCase().includes('hoàn thành');
        const effectiveDoneMs = isDone && compMs ? compMs : Date.now();

        if (expMs && effectiveDoneMs > expMs) {
          const delayDays = Math.ceil((effectiveDoneMs - expMs) / (1000 * 60 * 60 * 24));
          if (selectedTimelineDelay === '1-3' && (delayDays < 1 || delayDays > 3)) return false;
          if (selectedTimelineDelay === '4-7' && (delayDays < 4 || delayDays > 7)) return false;
          if (selectedTimelineDelay === '>7' && delayDays <= 7) return false;
        } else {
          return false;
        }
      }

      // 10. Table text search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const text = `${item.requestId} ${item.storeName} ${item.posmType} ${item.brand} ${item.category} ${item.projectCode} ${item.supplier} ${item.errorDetail} ${item.progress} ${item.note}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [
    warrantyItems, selectedYear, selectedWeek, selectedSupplier, 
    selectedProject, selectedPosmType, selectedStore, selectedCat, 
    selectedCause, selectedTimelineDelay, tableSearch, availableWeeks
  ]);

  // Summary Metrics Computation (Row 1 KPI Cards)
  const metrics = useMemo(() => {
    const total = filteredData.length;
    let onTimeCount = 0;
    let delayedCount = 0;
    let earlyFailCount = 0; // < 30 days from installation

    const supplierCount: Record<string, number> = {};
    const projectCount: Record<string, number> = {};
    const storeCount: Record<string, number> = {};
    const catCount: Record<string, number> = {};
    const posmCount: Record<string, number> = {};
    const activeProjectsSet = new Set<string>();

    filteredData.forEach(item => {
      const isDone = (item.progress || '').toLowerCase().includes('hoàn thành');
      const sentMs = parseDateToMs(item.sentDate);
      const installMs = parseDateToMs(item.installationDate);
      const expMs = parseDateToMs(item.expectedDate);
      const compMs = parseDateToMs(item.completedDate);
      const effectiveDoneMs = isDone && compMs ? compMs : Date.now();

      // On-time vs Delayed calculation
      if (expMs) {
        if (effectiveDoneMs <= expMs) {
          onTimeCount += 1;
        } else {
          delayedCount += 1;
        }
      } else {
        if (isDone) onTimeCount += 1;
        else delayedCount += 1;
      }

      // Early defect (< 30 days from install)
      if (installMs && sentMs && sentMs >= installMs) {
        const daysToFail = (sentMs - installMs) / (1000 * 60 * 60 * 24);
        if (daysToFail < 30) {
          earlyFailCount += 1;
        }
      }

      // Counts for Top Callouts
      if (item.supplier?.trim()) {
        const s = item.supplier.trim();
        supplierCount[s] = (supplierCount[s] || 0) + 1;
      }
      if (item.projectCode?.trim()) {
        const p = item.projectCode.trim();
        projectCount[p] = (projectCount[p] || 0) + 1;
      }
      if (item.storeName?.trim()) {
        const st = item.storeName.trim();
        storeCount[st] = (storeCount[st] || 0) + 1;
      }
      if (item.category?.trim()) {
        const c = item.category.trim();
        catCount[c] = (catCount[c] || 0) + 1;
      }
      if (item.posmType?.trim()) {
        const posm = item.posmType.trim();
        posmCount[posm] = (posmCount[posm] || 0) + 1;
      }

      // Active in-progress tracking
      if (!isDone && item.projectCode?.trim()) {
        activeProjectsSet.add(item.projectCode.trim());
      }
    });

    const getTop = (map: Record<string, number>) => {
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return { name: '-', count: 0, pct: 0 };
      return {
        name: entries[0][0],
        count: entries[0][1],
        pct: total > 0 ? (entries[0][1] / total) * 100 : 0
      };
    };

    return {
      total,
      onTimeCount,
      onTimePct: total > 0 ? (onTimeCount / total) * 100 : 0,
      delayedCount,
      delayedPct: total > 0 ? (delayedCount / total) * 100 : 0,
      earlyFailCount,
      earlyFailPct: total > 0 ? (earlyFailCount / total) * 100 : 0,
      topSupplier: getTop(supplierCount),
      topProject: getTop(projectCount),
      topStore: getTop(storeCount),
      topCat: getTop(catCount),
      topPosm: getTop(posmCount),
      activeProjects: Array.from(activeProjectsSet)
    };
  }, [filteredData]);

  // Section 1: By Supplier Breakdown
  const supplierBreakdown = useMemo(() => {
    const map: Record<string, {
      supplier: string;
      total: number;
      earlyFail: number;
      recurrent: number;
      delayed: number;
      completed: number;
    }> = {};

    filteredData.forEach(item => {
      const sup = item.supplier?.trim() || 'Chưa gán thầu';
      if (!map[sup]) {
        map[sup] = { supplier: sup, total: 0, earlyFail: 0, recurrent: 0, delayed: 0, completed: 0 };
      }
      map[sup].total += 1;

      const isDone = (item.progress || '').toLowerCase().includes('hoàn thành');
      if (isDone) map[sup].completed += 1;

      const installMs = parseDateToMs(item.installationDate);
      const sentMs = parseDateToMs(item.sentDate);
      if (installMs && sentMs && sentMs >= installMs) {
        const days = (sentMs - installMs) / (1000 * 60 * 60 * 24);
        if (days < 30) map[sup].earlyFail += 1;
      }

      if (item.precedingRequestId?.trim()) {
        map[sup].recurrent += 1;
      }

      const expMs = parseDateToMs(item.expectedDate);
      const compMs = parseDateToMs(item.completedDate);
      const effDoneMs = isDone && compMs ? compMs : Date.now();
      if (expMs && effDoneMs > expMs) {
        map[sup].delayed += 1;
      }
    });

    return Object.values(map).map(row => ({
      ...row,
      progressPct: row.total > 0 ? (row.completed / row.total) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Section 2: By Cause Breakdown
  const causeBreakdown = useMemo(() => {
    const map: Record<string, { cause: string; count: number; topSupplier: string }> = {};

    filteredData.forEach(item => {
      const { cause, supplierTag } = detectErrorCause(item);
      if (!map[cause]) {
        map[cause] = { cause, count: 0, topSupplier: supplierTag };
      }
      map[cause].count += 1;
    });

    const total = filteredData.length;
    return Object.values(map).map(c => ({
      ...c,
      pct: total > 0 ? (c.count / total) * 100 : 0
    })).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Section 3: By Timeline Delay Breakdown
  const timelineDelayBreakdown = useMemo(() => {
    let delay1to3 = 0;
    let delay4to7 = 0;
    let delayOver7 = 0;

    filteredData.forEach(item => {
      const isDone = (item.progress || '').toLowerCase().includes('hoàn thành');
      const expMs = parseDateToMs(item.expectedDate);
      const compMs = parseDateToMs(item.completedDate);
      const effDoneMs = isDone && compMs ? compMs : Date.now();

      if (expMs && effDoneMs > expMs) {
        const days = Math.ceil((effDoneMs - expMs) / (1000 * 60 * 60 * 24));
        if (days >= 1 && days <= 3) delay1to3 += 1;
        else if (days >= 4 && days <= 7) delay4to7 += 1;
        else if (days > 7) delayOver7 += 1;
      }
    });

    const total = filteredData.length;
    return [
      {
        key: '1-3',
        label: '1 – 3 ngày (Trễ nhẹ)',
        count: delay1to3,
        pct: total > 0 ? (delay1to3 / total) * 100 : 0,
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800'
      },
      {
        key: '4-7',
        label: '4 – 7 ngày (Cảnh báo tiến độ)',
        count: delay4to7,
        pct: total > 0 ? (delay4to7 / total) * 100 : 0,
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800'
      },
      {
        key: '>7',
        label: '> 7 ngày (Quá hạn nghiêm trọng)',
        count: delayOver7,
        pct: total > 0 ? (delayOver7 / total) * 100 : 0,
        color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
      }
    ];
  }, [filteredData]);

  // Section 4-7: Category Distributions
  const posmBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(i => {
      const p = i.posmType?.trim() || 'Chưa xác định';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const storeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(i => {
      const s = i.storeName?.trim() || 'Chưa xác định';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredData]);

  const projectBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(i => {
      const p = i.projectCode?.trim() || 'Chưa xác định';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.forEach(i => {
      const c = i.category?.trim() || 'Chưa xác định';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedWeek('all');
    setSelectedYear('2026');
    setSelectedSupplier('all');
    setSelectedProject('all');
    setSelectedPosmType('all');
    setSelectedStore('all');
    setSelectedCat('all');
    setSelectedCause('all');
    setSelectedTimelineDelay('all');
    setTableSearch('');
    toast.success('Đã đặt lại toàn bộ bộ lọc về trạng thái ban đầu');
  };

  const isAnyFilterActive = selectedWeek !== 'all' || selectedYear !== '2026' || selectedSupplier !== 'all' || 
    selectedProject !== 'all' || selectedPosmType !== 'all' || selectedStore !== 'all' || 
    selectedCat !== 'all' || selectedCause !== 'all' || selectedTimelineDelay !== 'all' || tableSearch !== '';

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-12 font-sans select-none">
      {/* POWER BI HEADER & INTERACTIVE SLICER TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Báo Cáo Phân Tích &amp; Tổng Hợp Bảo Hành POSM
                </h2>
                <Badge className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[10px] font-bold">
                  Power BI Canvas
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bảng điều khiển tương tác trực quan chuẩn Weekly Report • <strong className="text-slate-700 dark:text-slate-200">{filteredData.length} Ca Phù Hợp</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                title="Bỏ toàn bộ lọc và xem toàn hệ thống"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt Lại Bộ Lọc</span>
              </button>
            )}

            <button
              onClick={() => onExportExcel(selectedProject !== 'all' ? selectedProject : undefined)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition-colors cursor-pointer border border-emerald-500"
              title="Xuất file báo cáo Excel theo đúng mẫu Weekly Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Báo Cáo Excel</span>
            </button>
          </div>
        </div>

        {/* SLICERS BAR (BỘ LỌC TƯƠNG TÁC POWER BI) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
          {/* Week Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-500" />
              <span>Tuần Báo Cáo:</span>
            </label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">📅 Tất Cả Các Tuần (Lũy Kế)</option>
              {availableWeeks.map(w => (
                <option key={w.key} value={w.key}>
                  {w.label} ({w.count} ca)
                </option>
              ))}
            </select>
          </div>

          {/* Year Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-500" />
              <span>Năm:</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">Tất cả Năm</option>
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
            </select>
          </div>

          {/* Supplier Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-500" />
              <span>Nhà Thầu:</span>
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">Tất cả Nhà Thầu</option>
              {supplierBreakdown.map(s => (
                <option key={s.supplier} value={s.supplier}>
                  {s.supplier} ({s.total} ca)
                </option>
              ))}
            </select>
          </div>

          {/* Project Code Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-500" />
              <span>Mã Dự Án:</span>
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">Tất cả Dự Án</option>
              {projectBreakdown.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.count} ca)
                </option>
              ))}
            </select>
          </div>

          {/* POSM Type Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-500" />
              <span>Loại POSM:</span>
            </label>
            <select
              value={selectedPosmType}
              onChange={(e) => setSelectedPosmType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">Tất cả Loại POSM</option>
              {posmBreakdown.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.count} ca)
                </option>
              ))}
            </select>
          </div>

          {/* Store Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Store className="w-3 h-3 text-emerald-500" />
              <span>Siêu Thị:</span>
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-medium"
            >
              <option value="all">Tất cả Siêu Thị</option>
              {storeBreakdown.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count} ca)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* HÀNG 1: 9 THẺ CHỈ SỐ ĐO LƯỜNG THEN CHỐT (POWER BI SUMMARY TILES) */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2.5">
          {/* Card 1: Tổng Ca BH */}
          <div 
            onClick={() => handleResetFilters()}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-sky-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TỔNG CA BẢO HÀNH
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.total} <span className="text-xs font-normal text-slate-400">ca</span>
            </div>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 mt-0.5 block font-medium">
              Toàn bộ hệ thống
            </span>
          </div>

          {/* Card 2: % Đúng Hạn */}
          <div 
            onClick={() => setSelectedTimelineDelay('all')}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block truncate">
              % XỬ LÝ ĐÚNG HẠN
            </span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.onTimePct.toFixed(1)}%
            </div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 block font-mono font-bold">
              ⚡ {metrics.onTimeCount}/{metrics.total} ca
            </span>
          </div>

          {/* Card 3: % Trễ Hạn */}
          <div 
            onClick={() => setSelectedTimelineDelay('>7')}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-rose-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block truncate">
              % XỬ LÝ TRỄ HẠN
            </span>
            <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {metrics.delayedPct.toFixed(1)}%
            </div>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 block font-mono font-bold">
              ⚠️ {metrics.delayedCount}/{metrics.total} ca
            </span>
          </div>

          {/* Card 4: % Hỏng Sớm */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block truncate" title="% HỎNG SỚM (<30 NGÀY TỪ NGÀY LẮP ĐẶT)">
              % HỎNG SỚM (&lt;30d)
            </span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {metrics.earlyFailPct.toFixed(1)}%
            </div>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 block font-mono font-bold">
              ⚠️ {metrics.earlyFailCount}/{metrics.total} ca
            </span>
          </div>

          {/* Card 5: Top Nhà Thầu */}
          <div 
            onClick={() => metrics.topSupplier.name !== '-' && setSelectedSupplier(metrics.topSupplier.name)}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-indigo-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TOP NHÀ THẦU
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {metrics.topSupplier.name}
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 block font-mono font-semibold">
              {metrics.topSupplier.count} ca ({metrics.topSupplier.pct.toFixed(1)}%)
            </span>
          </div>

          {/* Card 6: Top Dự Án */}
          <div 
            onClick={() => metrics.topProject.name !== '-' && setSelectedProject(metrics.topProject.name)}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-amber-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TOP DỰ ÁN SỰ CỐ
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {metrics.topProject.name}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block font-mono font-semibold">
              {metrics.topProject.count} ca ({metrics.topProject.pct.toFixed(1)}%)
            </span>
          </div>

          {/* Card 7: Top Siêu Thị */}
          <div 
            onClick={() => metrics.topStore.name !== '-' && setSelectedStore(metrics.topStore.name)}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TOP SIÊU THỊ
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {metrics.topStore.name}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-mono font-semibold">
              {metrics.topStore.count} ca ({metrics.topStore.pct.toFixed(1)}%)
            </span>
          </div>

          {/* Card 8: Top Ngành Hàng */}
          <div 
            onClick={() => metrics.topCat.name !== '-' && setSelectedCat(metrics.topCat.name)}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-purple-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TOP NGÀNH HÀNG
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {metrics.topCat.name}
            </div>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 block font-mono font-semibold">
              {metrics.topCat.count} ca ({metrics.topCat.pct.toFixed(1)}%)
            </span>
          </div>

          {/* Card 9: Top Loại POSM */}
          <div 
            onClick={() => metrics.topPosm.name !== '-' && setSelectedPosmType(metrics.topPosm.name)}
            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-sky-400 transition-all cursor-pointer group"
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              TOP LOẠI POSM
            </span>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {metrics.topPosm.name}
            </div>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 mt-0.5 block font-mono font-semibold">
              {metrics.topPosm.count} ca ({metrics.topPosm.pct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* DÒNG THÔNG TIN PHỤ: CÁC DỰ ÁN ĐANG CÓ CA ĐANG XỬ LÝ */}
        {metrics.activeProjects.length > 0 && (
          <div className="px-3.5 py-2 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>⏳ Đang xử lý các ca thuộc dự án:</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {metrics.activeProjects.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedProject(p)}
                    className="px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-amber-100 text-amber-900 dark:text-amber-200 font-mono font-bold text-[11px] rounded-md border border-amber-300 dark:border-amber-700 cursor-pointer shadow-2xs"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
              Bấm vào mã dự án để lọc nhanh
            </span>
          </div>
        )}
      </div>

      {/* HÀNG 2: 3 BẢNG PHÂN TÍCH TRỌNG TÂM (BY SUPPLIER • BY CAUSE • BY TIMELINE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. THEO NHÀ THẦU (BY SUPPLIER) - 5 cols */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>1. THEO NHÀ THẦU (BY SUPPLIER)</span>
              </h3>
              <span className="text-[10px] text-slate-400">Click dòng để lọc</span>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-2 px-2 font-bold">Nhà Thầu</th>
                    <th className="py-2 px-1 text-center font-bold">Tổng Ca</th>
                    <th className="py-2 px-1 text-center font-bold text-amber-600" title="Số ca hỏng sớm <30 ngày">Hỏng Sớm</th>
                    <th className="py-2 px-1 text-center font-bold text-purple-600" title="Số ca tái diễn trên cùng 1 POSM">Tái Diễn</th>
                    <th className="py-2 px-1 text-center font-bold text-rose-600">Trễ Hạn</th>
                    <th className="py-2 px-2 text-right font-bold text-emerald-600">% Tiến Độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {supplierBreakdown.map(s => {
                    const isSelected = selectedSupplier.toLowerCase() === s.supplier.toLowerCase();
                    return (
                      <tr 
                        key={s.supplier}
                        onClick={() => setSelectedSupplier(isSelected ? 'all' : s.supplier)}
                        className={`hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-100/70 dark:bg-indigo-950/80 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-2 font-bold text-slate-900 dark:text-slate-100">
                          {s.supplier}
                        </td>
                        <td className="py-2 px-1 text-center font-mono font-bold">
                          {s.total}
                        </td>
                        <td className="py-2 px-1 text-center font-mono text-amber-600 font-bold">
                          {s.earlyFail > 0 ? s.earlyFail : '-'}
                        </td>
                        <td className="py-2 px-1 text-center font-mono text-purple-600 font-bold">
                          {s.recurrent > 0 ? s.recurrent : '-'}
                        </td>
                        <td className="py-2 px-1 text-center font-mono text-rose-600 font-bold">
                          {s.delayed > 0 ? s.delayed : '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full" 
                                style={{ width: `${Math.min(100, Math.max(0, s.progressPct))}%` }} 
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              {s.progressPct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. THEO NGUYÊN NHÂN LỖI (BY CAUSE) - 4 cols */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>2. THEO NGUYÊN NHÂN LỖI (BY CAUSE)</span>
              </h3>
              <span className="text-[10px] text-slate-400">Click để lọc</span>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-2 px-2 font-bold">Nguyên Nhân Lỗi</th>
                    <th className="py-2 px-2 text-center font-bold">Số Ca</th>
                    <th className="py-2 px-2 text-right font-bold">% Tỷ Lệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {causeBreakdown.map(c => {
                    const isSelected = selectedCause === c.cause;
                    return (
                      <tr
                        key={c.cause}
                        onClick={() => setSelectedCause(isSelected ? 'all' : c.cause)}
                        className={`hover:bg-rose-50/60 dark:hover:bg-rose-950/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-rose-100/70 dark:bg-rose-950/80 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-2 text-slate-800 dark:text-slate-200">
                          <span className="block font-semibold">{c.cause}</span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">({c.topSupplier}&gt;&gt;)</span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold">
                          {c.count}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {c.pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. THEO THỜI GIAN TRỄ HẠN (BY TIMELINE) - 3 cols */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>3. THEO THỜI GIAN TRỄ HẠN</span>
              </h3>
              <span className="text-[10px] text-slate-400">Click để lọc</span>
            </div>

            <div className="space-y-2 mt-3">
              {timelineDelayBreakdown.map(t => {
                const isSelected = selectedTimelineDelay === t.key;
                return (
                  <div
                    key={t.key}
                    onClick={() => setSelectedTimelineDelay(isSelected ? 'all' : t.key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${t.color} ${
                      isSelected ? 'ring-2 ring-slate-900 dark:ring-slate-100 font-bold' : ''
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block">{t.label}</span>
                      <span className="text-[10px] opacity-80">{t.pct.toFixed(1)}% trên tổng số ca</span>
                    </div>
                    <span className="text-lg font-black font-mono">
                      {t.count} ca
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* HÀNG 3: THỐNG KÊ CHI TIẾT THEO TỪNG HẠNG MỤC (POSM • STORE • PROJECT • CAT) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            <span>THỐNG KÊ CHI TIẾT THEO TỪNG HẠNG MỤC</span>
          </h3>
          <span className="text-[10px] text-slate-400">Bấm vào bất kỳ dòng nào để lọc toàn bộ báo cáo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 4. THEO LOẠI POSM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">4. THEO LOẠI POSM</span>
              <span className="text-[10px] text-slate-400 font-mono">Số Ca Lỗi</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {posmBreakdown.map(p => {
                const isSelected = selectedPosmType === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => setSelectedPosmType(isSelected ? 'all' : p.name)}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. THEO SIÊU THỊ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">5. THEO SIÊU THỊ</span>
              <span className="text-[10px] text-slate-400 font-mono">Số Ca Lỗi</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {storeBreakdown.map(s => {
                const isSelected = selectedStore === s.name;
                return (
                  <div
                    key={s.name}
                    onClick={() => setSelectedStore(isSelected ? 'all' : s.name)}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">{s.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. THEO MÃ DỰ ÁN */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">6. THEO MÃ DỰ ÁN</span>
              <span className="text-[10px] text-slate-400 font-mono">Số Ca Lỗi</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {projectBreakdown.map(p => {
                const isSelected = selectedProject === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => setSelectedProject(isSelected ? 'all' : p.name)}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2 font-mono">{p.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. THEO NGÀNH HÀNG */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">7. THEO NGÀNH HÀNG</span>
              <span className="text-[10px] text-slate-400 font-mono">Số Ca Lỗi</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {catBreakdown.map(c => {
                const isSelected = selectedCat === c.name;
                return (
                  <div
                    key={c.name}
                    onClick={() => setSelectedCat(isSelected ? 'all' : c.name)}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">{c.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{c.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* HÀNG 4: BẢNG CHI TIẾT CÁC CA BẢO HÀNH ĐÃ CÓ HÀNH ĐỘNG XỬ LÝ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>CHI TIẾT CÁC CASE BẢO HÀNH ĐÃ CÓ ACTION ({filteredData.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Bấm vào bất kỳ dòng nào để mở bảng chỉnh sửa chi tiết và cập nhật tiến độ
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm ca, lỗi, siêu thị..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 z-10">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">ID</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Store</th>
                <th className="py-2.5 px-3 whitespace-nowrap">POSM</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Brand</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Cat</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Mã Dự Án</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Supplier</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Ngày Lắp Đặt</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Ngày Gửi BH</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Loại Lỗi</th>
                <th className="py-2.5 px-3 whitespace-nowrap min-w-[180px]">Chi Tiết Lỗi</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Hẹn Xử Lý</th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Hoàn Thành</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Ghi Chú Tiến Độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
              {filteredData.map(item => {
                const { cause } = detectErrorCause(item);
                const isDone = (item.progress || '').toLowerCase().includes('hoàn thành');
                const sentMs = parseDateToMs(item.sentDate);
                const expMs = parseDateToMs(item.expectedDate);
                const compMs = parseDateToMs(item.completedDate);
                const installMs = parseDateToMs(item.installationDate);
                const effDoneMs = isDone && compMs ? compMs : Date.now();

                let noteBadge = 'Đang xử lý';
                let noteColor = 'text-slate-600 bg-slate-100 dark:bg-slate-800';

                if (installMs && sentMs && sentMs >= installMs && (sentMs - installMs) / (1000 * 60 * 60 * 24) < 30) {
                  noteBadge = 'Hỏng sớm (<30d)';
                  noteColor = 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300';
                } else if (expMs) {
                  if (effDoneMs <= expMs) {
                    noteBadge = 'Đúng hạn';
                    noteColor = 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300';
                  } else {
                    const d = Math.ceil((effDoneMs - expMs) / (1000 * 60 * 60 * 24));
                    noteBadge = `Trễ hạn ${d} ngày`;
                    noteColor = 'text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300';
                  }
                }

                return (
                  <tr
                    key={item.id || item.requestId}
                    onClick={() => onOpenWarrantyDrawer(item)}
                    className="hover:bg-sky-50/60 dark:hover:bg-sky-950/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                      {item.requestId}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.storeName || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.posmType || '-'}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {item.brand || '-'}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {item.category || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-amber-700 dark:text-amber-300 whitespace-nowrap">
                      {item.projectCode || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                      {item.supplier || '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateDisplay(item.installationDate)}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateDisplay(item.sentDate)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] max-w-[150px] truncate" title={cause}>
                      {cause}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px] max-w-[220px] truncate" title={item.errorDetail}>
                      {item.errorDetail || '-'}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateDisplay(item.expectedDate)}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateDisplay(item.completedDate)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge className={`text-[10px] font-semibold ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-sky-600 text-white'
                      }`}>
                        {item.progress || 'Not Started'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${noteColor}`}>
                        {noteBadge}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
