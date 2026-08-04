import { useState, useMemo } from 'react';
import type { InstallationItem } from '@/services/installationSyncService';
import type { MasterStoreContactInfo } from '@/services/sheetSyncService';
import { getRowMonthYear } from '../utils/statusCalculators';

export interface GroupedProject {
  projectCode: string;
  projectName: string;
  brandName: string;
  categoryCode: string;
  brandCode: string;
  actualTimeRange?: string;
  plannedTimeRange?: string;
  customerSummary?: string;
  itemSummary?: string;
  stores: InstallationItem[];
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

export function useInstallationFilters(
  rawData: InstallationItem[],
  contactMap: Map<string, MasterStoreContactInfo>,
  baselineMaxRowId: number,
  editFormStatus?: string
) {
  // Filter States (Data List)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTechnician, setSelectedTechnician] = useState('all');
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedResult, setSelectedResult] = useState('all');

  // Time Filter States (Analyst Tab)
  const [analystSelectedMonth, setAnalystSelectedMonth] = useState<string>('all');
  const [analystSelectedYear, setAnalystSelectedYear] = useState<string>('all');

  // Supplier Matrix Issue Dropdown & Issue Audit States
  const [expandedSupplierIssues, setExpandedSupplierIssues] = useState<Record<string, boolean>>({});
  const [issueSearchTerm, setIssueSearchTerm] = useState<string>('');
  const [issueSelectedSupplier, setIssueSelectedSupplier] = useState<string>('all');

  // Drawer & Project Detail States
  const [supplierDrawerConfig, setSupplierDrawerConfig] = useState<{
    isOpen: boolean;
    supplierName: string;
    metricType: 'TOTAL' | 'COMPLETED' | 'ISSUE' | 'UNUPDATED';
    metricTitle: string;
    colorTheme: string;
    items: InstallationItem[];
  } | null>(null);
  const [drawerSearchTerm, setDrawerSearchTerm] = useState('');

  const [activeProjectDetailCode, setActiveProjectDetailCode] = useState<string | null>(null);

  // Dedicated Store Filters for Detail View
  const [detailStoreSearch, setDetailStoreSearch] = useState('');
  const [detailSelectedQcTech, setDetailSelectedQcTech] = useState('all');
  const [detailSelectedStatus, setDetailSelectedStatus] = useState('all');
  const [detailSelectedSupplier, setDetailSelectedSupplier] = useState('all');
  const [detailSelectedResult, setDetailSelectedResult] = useState('all');

  // Expansion States
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Unique Filter Options
  const filterOptions = useMemo(() => {
    const regions = new Set<string>();
    const brands = new Set<string>();
    const suppliers = new Set<string>();
    const statuses = new Set<string>();
    const technicians = new Set<string>();
    const cats = new Set<string>();

    rawData.forEach(row => {
      if (row.region) regions.add(row.region);
      if (row.brandName) brands.add(row.brandName);
      if (row.supplierName) suppliers.add(row.supplierName);
      if (row.status) statuses.add(row.status);
      if (row.technician) technicians.add(row.technician);
      if (row.catName) cats.add(row.catName);
    });

    return {
      regions: Array.from(regions).sort(),
      brands: Array.from(brands).sort(),
      suppliers: Array.from(suppliers).sort(),
      statuses: Array.from(statuses).sort(),
      technicians: Array.from(technicians).sort(),
      cats: Array.from(cats).sort()
    };
  }, [rawData]);

  // Modal Status Options
  const modalStatusOptions = useMemo(() => {
    const SHEET_DATA_VALIDATION_STATUSES = [
      'Completed',
      'Pending Install',
      'New',
      'QC Failed',
      'Cancelled',
      'Installation QC Failed',
      'QC Passed',
      'Supplier chưa gửi Report'
    ];

    const set = new Set<string>(SHEET_DATA_VALIDATION_STATUSES);
    filterOptions.statuses.forEach(st => {
      if (st && st.trim()) set.add(st.trim());
    });
    if (editFormStatus && editFormStatus.trim()) {
      set.add(editFormStatus.trim());
    }
    return Array.from(set);
  }, [filterOptions.statuses, editFormStatus]);

  // Filter Flat Rows
  const filteredFlatRows = useMemo(() => {
    return rawData.filter(row => {
      const term = searchTerm.trim().toLowerCase();
      
      const storeCodeKey = (row.storeCode || '').toUpperCase().trim();
      const contactInfo = contactMap.get(storeCodeKey);
      const srName = (contactInfo?.sr_name || '').toLowerCase();
      const srPhone = (contactInfo?.sr_phone || contactInfo?.sr_phone_2 || '').toLowerCase();

      const matchesSearch = !term ? true : (
        (row.projectName || '').toLowerCase().includes(term) ||
        (row.projectCode || '').toLowerCase().includes(term) ||
        (row.storeCode || '').toLowerCase().includes(term) ||
        (row.storeName || '').toLowerCase().includes(term) ||
        (row.item || '').toLowerCase().includes(term) ||
        (row.note || '').toLowerCase().includes(term) ||
        srName.includes(term) ||
        srPhone.includes(term)
      );

      const matchesRegion = selectedRegion === 'all' || row.region === selectedRegion;
      const matchesBrand = selectedBrand === 'all' || row.brandName === selectedBrand;
      const matchesSupplier = selectedSupplier === 'all' || row.supplierName === selectedSupplier;
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus;
      const matchesTechnician = selectedTechnician === 'all' || row.technician === selectedTechnician;
      const matchesCat = selectedCat === 'all' || row.catName === selectedCat;

      let matchesResult = true;
      if (selectedResult === 'pass') matchesResult = row.resultSign === '✔';
      else if (selectedResult === 'fail') matchesResult = row.resultSign === '❌';
      else if (selectedResult === 'overdue') matchesResult = row.resultSign === 'OVERDUE_RED';

      return matchesSearch && matchesRegion && matchesBrand && matchesSupplier && matchesStatus && matchesTechnician && matchesCat && matchesResult;
    });
  }, [rawData, contactMap, searchTerm, selectedRegion, selectedBrand, selectedSupplier, selectedStatus, selectedTechnician, selectedCat, selectedResult]);

  // Group by Project
  const groupedProjects = useMemo(() => {
    const map = new Map<string, InstallationItem[]>();

    filteredFlatRows.forEach(row => {
      const key = row.projectCode || row.projectName || 'DU_AN_KHAC';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    });

    const result: GroupedProject[] = [];

    map.forEach((stores, projectCode) => {
      const firstRow = stores[0] || {};
      const projectName = firstRow.projectName || projectCode;
      const brandName = firstRow.brandName || '-';
      const categoryCode = firstRow.categoryCode || firstRow.catName || '-';
      const brandCode = firstRow.brandCode || '';

      let completed = 0;
      let installing = 0;
      let qcFailed = 0;
      let warranty = 0;
      let cancelled = 0;

      stores.forEach(s => {
        const st = (s.status || '').toLowerCase();
        if (st.includes('hoàn thành') || st.includes('completed') || st.includes('pass') || s.resultSign === '✔') completed++;
        else if (st.includes('thi công') || st.includes('lắp đặt') || st.includes('progress')) installing++;
        else if (st.includes('failed') || st.includes('lỗi') || s.resultSign === '❌') qcFailed++;
        else if (st.includes('warranty') || st.includes('bảo hành') || st.includes('tháo dỡ')) warranty++;
        else if (st.includes('cancel') || st.includes('hủy')) cancelled++;
      });

      const total = stores.length;
      const completedRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const timeSet = stores.map(s => s.actualTime).filter(t => t && t.trim());
      const actualTimeRange = timeSet.length > 0 ? timeSet[0] : 'Xem từng cửa hàng';

      const customerSet = Array.from(new Set(stores.map(s => s.customer).filter(c => c && c.trim())));
      const customerSummary = customerSet.length === 1 
        ? customerSet[0] 
        : customerSet.length > 1 
          ? customerSet.slice(0, 2).join(', ') + (customerSet.length > 2 ? ` (+${customerSet.length - 2})` : '')
          : 'Chưa cập nhật';

      const itemSet = Array.from(new Set(stores.map(s => s.item).filter(i => i && i.trim())));
      const itemSummary = itemSet.length === 1 
        ? itemSet[0] 
        : itemSet.length > 1 
          ? itemSet.slice(0, 2).join(', ') + (itemSet.length > 2 ? ` (+${itemSet.length - 2})` : '')
          : 'Chưa phân loại';

      const plannedStartSet = stores.map(s => s.plannedStartDate).filter(d => d && d.trim());
      const plannedEndSet = stores.map(s => s.plannedEndDate).filter(d => d && d.trim());
      const plannedTimeRange = (plannedStartSet.length > 0 && plannedEndSet.length > 0)
        ? `${plannedStartSet[0]} ➔ ${plannedEndSet[0]}`
        : (plannedStartSet.length > 0 ? plannedStartSet[0] : 'Chưa có kế hoạch');

      result.push({
        projectCode,
        projectName,
        brandName,
        categoryCode,
        brandCode,
        actualTimeRange,
        plannedTimeRange,
        customerSummary,
        itemSummary,
        stores,
        stats: {
          total,
          completed,
          installing,
          qcFailed,
          warranty,
          cancelled,
          completedRate
        }
      });
    });

    return result.sort((a, b) => b.stats.total - a.stats.total);
  }, [filteredFlatRows]);

  // Current active project object for Detail View
  const currentDetailProject = useMemo(() => {
    if (!activeProjectDetailCode) return null;
    return groupedProjects.find(p => p.projectCode === activeProjectDetailCode) || null;
  }, [groupedProjects, activeProjectDetailCode]);

  // Filter options for currentDetailProject stores
  const detailFilterOptions = useMemo(() => {
    if (!currentDetailProject) return { technicians: [], statuses: [], suppliers: [] };
    const techs = new Set<string>();
    const stats = new Set<string>();
    const supps = new Set<string>();

    currentDetailProject.stores.forEach(s => {
      if (s.technician && s.technician.trim()) techs.add(s.technician.trim());
      if (s.status && s.status.trim()) stats.add(s.status.trim());
      if (s.supplierName && s.supplierName.trim()) supps.add(s.supplierName.trim());
    });

    return {
      technicians: Array.from(techs).sort(),
      statuses: Array.from(stats).sort(),
      suppliers: Array.from(supps).sort()
    };
  }, [currentDetailProject]);

  // Filtered stores for currentDetailProject
  const filteredProjectDetailStores = useMemo(() => {
    if (!currentDetailProject) return [];
    return currentDetailProject.stores.filter(store => {
      const term = detailStoreSearch.trim().toLowerCase();
      
      const storeCodeKey = (store.storeCode || '').toUpperCase().trim();
      const contactInfo = contactMap.get(storeCodeKey);
      const srName = (contactInfo?.sr_name || '').toLowerCase();
      const srPhone = (contactInfo?.sr_phone || contactInfo?.sr_phone_2 || '').toLowerCase();

      const matchesSearch = !term ? true : (
        (store.storeCode || '').toLowerCase().includes(term) ||
        (store.storeName || '').toLowerCase().includes(term) ||
        (store.item || '').toLowerCase().includes(term) ||
        (store.note || '').toLowerCase().includes(term) ||
        srName.includes(term) ||
        srPhone.includes(term)
      );

      const matchesQcTech = detailSelectedQcTech === 'all' || 
        (store.technician || '').toUpperCase().trim() === detailSelectedQcTech.toUpperCase().trim();

      const matchesStatus = detailSelectedStatus === 'all' || 
        (store.status || '').toUpperCase().trim() === detailSelectedStatus.toUpperCase().trim();

      const matchesSupplier = detailSelectedSupplier === 'all' || 
        (store.supplierName || '').toUpperCase().trim() === detailSelectedSupplier.toUpperCase().trim();

      let matchesResult = true;
      if (detailSelectedResult === 'pass') {
        matchesResult = store.resultSign === '✔';
      } else if (detailSelectedResult === 'fail') {
        matchesResult = store.resultSign === '❌';
      } else if (detailSelectedResult === 'overdue') {
        matchesResult = store.resultSign === 'OVERDUE_RED';
      }

      return matchesSearch && matchesQcTech && matchesStatus && matchesSupplier && matchesResult;
    });
  }, [currentDetailProject, detailStoreSearch, detailSelectedQcTech, detailSelectedStatus, detailSelectedSupplier, detailSelectedResult, contactMap]);

  // Pagination for Projects
  const totalPages = Math.ceil(groupedProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedProjects.slice(start, start + pageSize);
  }, [groupedProjects, currentPage, pageSize]);

  // Unique years in raw dataset
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    rawData.forEach(row => {
      const { year } = getRowMonthYear(row);
      if (year) yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [rawData]);

  // Filtered rows for Analyst Tab based on Time Filter
  const filteredAnalystRows = useMemo(() => {
    return rawData.filter(row => {
      const { month, year } = getRowMonthYear(row);

      if (analystSelectedYear !== 'all') {
        if (year === null || year !== Number(analystSelectedYear)) {
          return false;
        }
      }

      if (analystSelectedMonth !== 'all') {
        if (month === null || month !== Number(analystSelectedMonth)) {
          return false;
        }
      }

      return true;
    });
  }, [rawData, analystSelectedMonth, analystSelectedYear]);

  // Overall KPI BI Analytics Calculation
  const overallStats = useMemo(() => {
    const total = filteredAnalystRows.length;
    let noActualTimeTotalCount = 0;
    let activeExecutedTotalCount = 0;
    let completed = 0;
    let issueCount = 0;
    let overdueCount = 0;
    let noReportCount = 0;
    let cancelledCount = 0;
    let unupdatedCount = 0;

    const supplierMap: Record<string, {
      displayName: string;
      total: number;
      noActualTime: number;
      activeExecuted: number;
      success: number;
      issue: number;
      noReport: number;
      cancelled: number;
      unupdated: number;
      totalItems: InstallationItem[];
      noActualTimeItems: InstallationItem[];
      activeExecutedItems: InstallationItem[];
      completedItems: InstallationItem[];
      issueItems: InstallationItem[];
      unupdatedItems: InstallationItem[];
    }> = {};

    const catMap: Record<string, number> = {};
    const issueAuditList: InstallationItem[] = [];

    filteredAnalystRows.forEach(row => {
      const statusLower = (row.status || '').toLowerCase().trim();
      const noteLower = (row.note || '').toLowerCase().trim();
      const resultSign = row.resultSign || '';
      const hasActualTime = !!(row.actualTime && row.actualTime.trim());

      const supplierName = row.supplierName || 'Khác/Chưa rõ';
      const supplierKey = supplierName.toUpperCase();

      if (!supplierMap[supplierKey]) {
        supplierMap[supplierKey] = {
          displayName: supplierName,
          total: 0,
          noActualTime: 0,
          activeExecuted: 0,
          success: 0,
          issue: 0,
          noReport: 0,
          cancelled: 0,
          unupdated: 0,
          totalItems: [],
          noActualTimeItems: [],
          activeExecutedItems: [],
          completedItems: [],
          issueItems: [],
          unupdatedItems: []
        };
      }
      supplierMap[supplierKey].total++;
      supplierMap[supplierKey].totalItems.push(row);

      if (!hasActualTime) {
        noActualTimeTotalCount++;
        supplierMap[supplierKey].noActualTime++;
        supplierMap[supplierKey].noActualTimeItems.push(row);
      } else {
        activeExecutedTotalCount++;
        supplierMap[supplierKey].activeExecuted++;
        supplierMap[supplierKey].activeExecutedItems.push(row);

        const isQCFailed = statusLower.includes('installation qc failed') || statusLower.includes('failed') || statusLower.includes('lỗi');
        const isPendingInstall = statusLower.includes('pending install');
        const isCancelled = statusLower.includes('cancelled') || statusLower.includes('cancel');
        const isNoReport = noteLower.includes('chưa gửi report') || statusLower.includes('chưa gửi report');

        if (resultSign === '❌' || resultSign === 'OVERDUE_RED' || (resultSign === '✔' && isQCFailed) || isPendingInstall) {
          issueCount++;
          if (resultSign === 'OVERDUE_RED') overdueCount++;
          supplierMap[supplierKey].issue++;
          supplierMap[supplierKey].issueItems.push(row);
          issueAuditList.push(row);
        } else if (isCancelled) {
          cancelledCount++;
          supplierMap[supplierKey].cancelled++;
          supplierMap[supplierKey].unupdatedItems.push(row);
        } else if (isNoReport) {
          noReportCount++;
          supplierMap[supplierKey].noReport++;
          supplierMap[supplierKey].unupdatedItems.push(row);
        } else if (resultSign === '✔') {
          completed++;
          supplierMap[supplierKey].success++;
          supplierMap[supplierKey].completedItems.push(row);
        } else {
          unupdatedCount++;
          supplierMap[supplierKey].unupdated++;
          supplierMap[supplierKey].unupdatedItems.push(row);
        }
      }

      const cat = row.catName || 'Khác';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const completionRate = activeExecutedTotalCount > 0 ? ((completed / activeExecutedTotalCount) * 100).toFixed(1) : '0';

    const uniqueProjectSet = new Set(filteredAnalystRows.map(r => r.projectCode || r.projectName));
    const totalProjects = uniqueProjectSet.size;

    const newRowItems = filteredAnalystRows.filter(r => r.rowId > baselineMaxRowId);
    const newAssetsCount = newRowItems.length;
    const newProjectsSet = new Set(newRowItems.map(r => r.projectCode || r.projectName));
    const newProjectsCount = newProjectsSet.size;

    return {
      total,
      totalProjects,
      newProjectsCount,
      newAssetsCount,
      noActualTimeTotalCount,
      activeExecutedTotalCount,
      completed,
      issueCount,
      overdueCount,
      noReportCount,
      cancelledCount,
      unupdatedCount,
      completionRate,
      supplierMap: Object.values(supplierMap).sort((a, b) => b.total - a.total),
      catMap: Object.entries(catMap).sort((a, b) => b[1] - a[1]),
      issueAuditList
    };
  }, [filteredAnalystRows, baselineMaxRowId]);

  // Drawer items
  const filteredDrawerItems = useMemo(() => {
    if (!supplierDrawerConfig || !supplierDrawerConfig.items) return [];
    const term = drawerSearchTerm.trim().toLowerCase();
    if (!term) return supplierDrawerConfig.items;

    return supplierDrawerConfig.items.filter(item => {
      const storeCodeKey = (item.storeCode || '').toUpperCase().trim();
      const contactInfo = contactMap.get(storeCodeKey);
      const srName = (contactInfo?.sr_name || '').toLowerCase();
      const srPhone = (contactInfo?.sr_phone || contactInfo?.sr_phone_2 || '').toLowerCase();

      return (
        (item.projectCode || '').toLowerCase().includes(term) ||
        (item.projectName || '').toLowerCase().includes(term) ||
        (item.storeCode || '').toLowerCase().includes(term) ||
        (item.storeName || '').toLowerCase().includes(term) ||
        (item.item || '').toLowerCase().includes(term) ||
        (item.technician || '').toLowerCase().includes(term) ||
        (item.note || '').toLowerCase().includes(term) ||
        srName.includes(term) ||
        srPhone.includes(term)
      );
    });
  }, [supplierDrawerConfig, drawerSearchTerm, contactMap]);

  // Filtered issue list
  const filteredIssueList = useMemo(() => {
    return overallStats.issueAuditList.filter(item => {
      const term = issueSearchTerm.trim().toLowerCase();
      const matchesSearch = !term ? true : (
        (item.projectCode || '').toLowerCase().includes(term) ||
        (item.storeName || '').toLowerCase().includes(term) ||
        (item.item || '').toLowerCase().includes(term) ||
        (item.note || '').toLowerCase().includes(term) ||
        (item.supplierName || '').toLowerCase().includes(term)
      );

      const matchesSupplier = issueSelectedSupplier === 'all' || 
        (item.supplierName || '').toUpperCase().trim() === issueSelectedSupplier.toUpperCase().trim();

      return matchesSearch && matchesSupplier;
    });
  }, [overallStats.issueAuditList, issueSearchTerm, issueSelectedSupplier]);

  const toggleProjectExpand = (code: string) => {
    setExpandedProjects(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleStoreExpand = (storeKey: string) => {
    setExpandedStores(prev => ({ ...prev, [storeKey]: !prev[storeKey] }));
  };

  const toggleSupplierIssueExpand = (supplierName: string) => {
    setExpandedSupplierIssues(prev => ({
      ...prev,
      [supplierName]: !prev[supplierName]
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setSelectedBrand('all');
    setSelectedSupplier('all');
    setSelectedStatus('all');
    setSelectedTechnician('all');
    setSelectedCat('all');
    setSelectedResult('all');
  };

  return {
    searchTerm, setSearchTerm,
    selectedRegion, setSelectedRegion,
    selectedBrand, setSelectedBrand,
    selectedSupplier, setSelectedSupplier,
    selectedStatus, setSelectedStatus,
    selectedTechnician, setSelectedTechnician,
    selectedCat, setSelectedCat,
    selectedResult, setSelectedResult,
    analystSelectedMonth, setAnalystSelectedMonth,
    analystSelectedYear, setAnalystSelectedYear,
    expandedSupplierIssues, setExpandedSupplierIssues,
    issueSearchTerm, setIssueSearchTerm,
    issueSelectedSupplier, setIssueSelectedSupplier,
    supplierDrawerConfig, setSupplierDrawerConfig,
    drawerSearchTerm, setDrawerSearchTerm,
    activeProjectDetailCode, setActiveProjectDetailCode,
    detailStoreSearch, setDetailStoreSearch,
    detailSelectedQcTech, setDetailSelectedQcTech,
    detailSelectedStatus, setDetailSelectedStatus,
    detailSelectedSupplier, setDetailSelectedSupplier,
    detailSelectedResult, setDetailSelectedResult,
    expandedProjects, setExpandedProjects,
    expandedStores, setExpandedStores,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    filterOptions,
    modalStatusOptions,
    filteredFlatRows,
    groupedProjects,
    currentDetailProject,
    detailFilterOptions,
    filteredProjectDetailStores,
    totalPages,
    paginatedProjects,
    availableYears,
    filteredAnalystRows,
    overallStats,
    filteredDrawerItems,
    filteredIssueList,
    toggleProjectExpand,
    toggleStoreExpand,
    toggleSupplierIssueExpand,
    clearAllFilters
  };
}
