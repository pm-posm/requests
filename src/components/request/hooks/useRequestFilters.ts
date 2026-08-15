import { useState, useMemo, useEffect } from 'react';
import type { RequestItem } from '@/services/requestSyncService';

export const parseRqDate = (dateStr?: string): Date | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

// PREDEFINED 1:1 SHEET VALUES FOR PHƯƠNG ÁN & TIẾN ĐỘ DỰ ÁN
export const DEFAULT_PLAN_OPTIONS = [
  'Visibility Rquest',
  'Mer Quick Fix',
  'Đưa vào RQ by Store',
  'Đã đưa vào RQ tuần',
  'Supplier bảo hành',
  'Request CSP'
];

export const DEFAULT_PROGRESS_OPTIONS = [
  'Not started',
  'Hoàn Thành',
  'Cancelled',
  'Vis - Gửi lịch khảo sát',
  'Vis - Đã gửi RQ tới Agency',
  'Agency - Bidding',
  'CSP - CF Sửa chữa / Cancel',
  'CSP - Gửi thiết kế , AW',
  'CSP - Raise PO KS',
  'CSP - Raise PO sửa chữa',
  'Supplier - Đã Trả KQKS',
  'Supplier - Sản Xuất',
  'Supplier - Lắp Đặt',
  'REJECTED By CSP'
];

export const DEFAULT_STATUS_OPTIONS = [
  'New',
  'Under CSP Review',
  'Sent to CSP',
  'Approved',
  'Mer quick fix',
  'Supplier Bảo Hành',
  'Rejected',
  'Cancelled'
];

export type ProgressCategory = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED_REJECTED';

export const getProgressCategory = (projectProgress?: string): 'COMPLETED' | 'CANCELLED_REJECTED' | 'IN_PROGRESS' => {
  const prg = (projectProgress || '').toLowerCase().trim();
  if (prg.includes('hoàn thành') || prg.includes('completed') || prg.includes('done')) {
    return 'COMPLETED';
  }
  if (prg.includes('cancel') || prg.includes('hủy') || prg.includes('reject') || prg.includes('từ chối')) {
    return 'CANCELLED_REJECTED';
  }
  return 'IN_PROGRESS';
};

export function useRequestFilters(rawData: RequestItem[], baselineMaxRowId: number) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // 5 CORE BUSINESS MULTI-SELECT FILTERS: Phương án, Status, Tiến độ, Mer, Supplier
  const [selectedPlanOptions, setSelectedPlanOptions] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProgresses, setSelectedProgresses] = useState<string[]>([]);
  const [selectedMers, setSelectedMers] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  // DATE / MONTH / YEAR / WEEK FILTERS
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [sortOrder, setSortOrder] = useState<'NEWEST_FIRST' | 'SHEET_ORDER'>('NEWEST_FIRST');
  const [onlyNewFilter, setOnlyNewFilter] = useState<boolean>(false);
  const [quickProgressFilter, setQuickProgressFilter] = useState<ProgressCategory>('ALL');

  // FIX F4: Reset pagination to page 1 whenever any filter parameter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedPlanOptions,
    selectedStatuses,
    selectedProgresses,
    selectedMers,
    selectedSuppliers,
    selectedYear,
    selectedMonth,
    selectedWeek,
    dateFrom,
    dateTo,
    onlyNewFilter,
    sortOrder,
    quickProgressFilter
  ]);

  // Extract unique filter options (combining defaults + live sheet data)
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>(DEFAULT_STATUS_OPTIONS);
    const mers = new Set<string>();
    const suppliers = new Set<string>();
    const years = new Set<string>();
    const weeks = new Set<string>();
    const planOptions = new Set<string>(DEFAULT_PLAN_OPTIONS);
    const progressOptions = new Set<string>(DEFAULT_PROGRESS_OPTIONS);

    rawData.forEach(item => {
      if (item.status?.trim()) statuses.add(item.status.trim());
      if (item.merName?.trim()) mers.add(item.merName.trim());
      if (item.supplier?.trim()) suppliers.add(item.supplier.trim());
      if (item.week?.trim()) weeks.add(item.week.trim());
      if (item.planOption?.trim()) planOptions.add(item.planOption.trim());
      if (item.projectProgress?.trim()) progressOptions.add(item.projectProgress.trim());

      const d = parseRqDate(item.dateOfRq);
      if (d) {
        years.add(String(d.getFullYear()));
      }
    });

    if (years.size === 0) {
      const currentYr = new Date().getFullYear();
      years.add(String(currentYr - 1));
      years.add(String(currentYr));
    }

    return {
      planOptions: Array.from(planOptions).sort(),
      statuses: Array.from(statuses).sort(),
      progressOptions: Array.from(progressOptions).sort(),
      mers: Array.from(mers).sort(),
      suppliers: Array.from(suppliers).sort(),
      years: Array.from(years).sort((a, b) => Number(b) - Number(a)),
      weeks: Array.from(weeks).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }),
    };
  }, [rawData]);

  // Base filtered items under general filters (excluding quickProgressFilter)
  const baseFilteredItems = useMemo(() => {
    return rawData.filter(item => {
      // 0. Only New Filter
      if (onlyNewFilter) {
        if (!(baselineMaxRowId > 0 && item.rowId > baselineMaxRowId)) return false;
      }

      // 1. Search term matching
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const searchTarget = [
          item.storeName,
          item.storeCode,
          item.srName,
          item.merName,
          item.projectCode,
          item.requestId,
          item.posmType,
          item.brand,
          item.cat,
          item.srNote,
          item.supplier,
          item.emailTitle,
          item.planOption,
          item.projectProgress
        ].map(v => (v || '').toLowerCase()).join(' ');

        if (!searchTarget.includes(term)) return false;
      }

      // 2. 5 Core Business Multi-Select Filters
      if (selectedPlanOptions.length > 0) {
        const val = (item.planOption || '').trim().toLowerCase();
        if (!selectedPlanOptions.some(opt => opt.trim().toLowerCase() === val)) return false;
      }
      if (selectedStatuses.length > 0) {
        const val = (item.status || '').trim().toLowerCase();
        if (!selectedStatuses.some(opt => opt.trim().toLowerCase() === val)) return false;
      }
      if (selectedProgresses.length > 0) {
        const val = (item.projectProgress || '').trim().toLowerCase();
        if (!selectedProgresses.some(opt => opt.trim().toLowerCase() === val)) return false;
      }
      if (selectedMers.length > 0) {
        const val = (item.merName || '').trim().toLowerCase();
        if (!selectedMers.some(opt => opt.trim().toLowerCase() === val)) return false;
      }
      if (selectedSuppliers.length > 0) {
        const val = (item.supplier || '').trim().toLowerCase();
        if (!selectedSuppliers.some(opt => opt.trim().toLowerCase() === val)) return false;
      }

      // 3. Date / Month / Year Filtering
      const d = parseRqDate(item.dateOfRq);

      if (selectedYear !== 'all') {
        if (!d || String(d.getFullYear()) !== selectedYear) {
          if (!item.dateOfRq || !item.dateOfRq.includes(selectedYear)) return false;
        }
      }

      if (selectedMonth !== 'all') {
        if (!d || String(d.getMonth() + 1) !== selectedMonth) return false;
      }

      if (selectedWeek !== 'all' && (item.week || '').trim() !== selectedWeek.trim()) return false;

      if (dateFrom) {
        const fromD = new Date(dateFrom);
        fromD.setHours(0, 0, 0, 0);
        if (!d || d < fromD) return false;
      }

      if (dateTo) {
        const toD = new Date(dateTo);
        toD.setHours(23, 59, 59, 999);
        if (!d || d > toD) return false;
      }

      return true;
    });
  }, [
    rawData,
    searchTerm,
    selectedPlanOptions,
    selectedStatuses,
    selectedProgresses,
    selectedMers,
    selectedSuppliers,
    selectedYear,
    selectedMonth,
    selectedWeek,
    dateFrom,
    dateTo,
    onlyNewFilter,
    baselineMaxRowId
  ]);

  // Overall Stats calculated directly on baseFilteredItems using TIẾN ĐỘ DỰ ÁN (Cột Y)
  const overallStats = useMemo(() => {
    let inProgressCount = 0;
    let completedCount = 0;
    let cancelledRejectedCount = 0;
    let newRequestsCount = 0;

    // Count new items from all rawData
    rawData.forEach(item => {
      if (baselineMaxRowId > 0 && item.rowId > baselineMaxRowId) {
        newRequestsCount++;
      }
    });

    baseFilteredItems.forEach(item => {
      const cat = getProgressCategory(item.projectProgress);
      if (cat === 'COMPLETED') {
        completedCount++;
      } else if (cat === 'CANCELLED_REJECTED') {
        cancelledRejectedCount++;
      } else {
        inProgressCount++;
      }
    });

    return {
      total: baseFilteredItems.length,
      inProgressCount,
      completedCount,
      cancelledRejectedCount,
      newRequestsCount
    };
  }, [rawData, baseFilteredItems, baselineMaxRowId]);

  // Final filtered items applying quickProgressFilter and sortOrder
  const filteredItems = useMemo(() => {
    let list = baseFilteredItems;
    if (quickProgressFilter !== 'ALL') {
      list = list.filter(item => getProgressCategory(item.projectProgress) === quickProgressFilter);
    }

    if (sortOrder === 'NEWEST_FIRST') {
      return [...list].sort((a, b) => b.rowId - a.rowId);
    }
    return [...list].sort((a, b) => a.rowId - b.rowId);
  }, [baseFilteredItems, quickProgressFilter, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedPlanOptions([]);
    setSelectedStatuses([]);
    setSelectedProgresses([]);
    setSelectedMers([]);
    setSelectedSuppliers([]);
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
    setDateFrom('');
    setDateTo('');
    setOnlyNewFilter(false);
    setQuickProgressFilter('ALL');
    setCurrentPage(1);
  };

  return {
    searchTerm, setSearchTerm,
    selectedPlanOptions, setSelectedPlanOptions,
    selectedStatuses, setSelectedStatuses,
    selectedProgresses, setSelectedProgresses,
    selectedMers, setSelectedMers,
    selectedSuppliers, setSelectedSuppliers,
    selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth,
    selectedWeek, setSelectedWeek,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sortOrder, setSortOrder,
    onlyNewFilter, setOnlyNewFilter,
    quickProgressFilter, setQuickProgressFilter,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    filterOptions,
    filteredItems,
    paginatedItems,
    totalPages,
    overallStats,
    clearAllFilters
  };
}
