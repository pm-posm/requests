import { useMemo, useCallback } from 'react';
import { useProjects, type Project } from './useProjects';
import { useStoresData } from './useStoresData';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { removeVietnameseTones, normalizeStoreName } from '@/lib/utils';

export const STATUS_STEPS = [
  "New",
  "Under CSP Review",
  "Sent to CSP",
  "Approved",
  "Mer quick fix",
  "Supplier Bảo Hành",
  "Rejected",
  "Cancelled"
];

export const calculateAge = (dateStr?: string) => {
  if (!dateStr) return null;
  let d: Date | null = null;
  const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    d = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00`);
  } else {
    d = new Date(dateStr);
  }
  if (!d || isNaN(d.getTime())) return null;
  const diffTime = new Date().getTime() - d.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export function useDashboardData() {
  const { data: projects, isLoading: isProjectsLoading } = useProjects();
  const { data: storeDataList, isLoading: isStoreLoading } = useStoresData();
  const { 
    searchTerm, filterRegion, filterKA, filterCustomer, filterMer, 
    selectedStore, planOptionFilter 
  } = useDashboardStore();

  const uniqueStoresWithRequests = useMemo(() => {
    const storesMap = new Map<string, string>();
    if (projects) {
      projects.forEach(p => {
        if (p.store_name?.trim()) {
          const name = p.store_name.trim();
          const normalized = normalizeStoreName(name);
          storesMap.set(normalized, name);
        }
      });
    }
    return Array.from(storesMap.values()).sort();
  }, [projects]);

  const storeDataMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (storeDataList) {
      storeDataList.forEach(s => {
        if (s["STORE NAME"]) {
          const key = normalizeStoreName(s["STORE NAME"]);
          map[key] = s;
        }
        if (s["STORE CODE"]) {
          const key = s["STORE CODE"].trim().toLowerCase();
          map[key] = s;
        }
      });
    }
    return map;
  }, [storeDataList]);

  const getStoreData = useCallback((storeName: string) => {
    const project = projects?.find(p => p.store_name === storeName);
    const codeKey = project?.store_code?.trim().toLowerCase();
    const nameKey = normalizeStoreName(storeName);
    
    if (codeKey && storeDataMap[codeKey]) {
      return storeDataMap[codeKey];
    }
    return storeDataMap[nameKey] || null;
  }, [projects, storeDataMap]);

  const filterOptions = useMemo(() => {
    const regions = new Set<string>();
    const kas = new Set<string>();
    const customers = new Set<string>();
    const mers = new Set<string>();

    uniqueStoresWithRequests.forEach(store => {
      const data = getStoreData(store);
      if (data) {
        if (data["REGION"]) regions.add(data["REGION"]);
        if (data["KA"]) kas.add(data["KA"]);
        if (data["CUSTOMER"]) customers.add(data["CUSTOMER"]);
        if (data["MER NAME"]) mers.add(data["MER NAME"]);
      }
    });

    return {
      regions: Array.from(regions).sort(),
      kas: Array.from(kas).sort(),
      customers: Array.from(customers).sort(),
      mers: Array.from(mers).sort()
    };
  }, [uniqueStoresWithRequests, getStoreData]);

  const filteredStoresList = useMemo(() => {
    return uniqueStoresWithRequests.filter(store => {
      const matchesSearch = normalizeStoreName(store).includes(normalizeStoreName(searchTerm));
      if (!matchesSearch) return false;

      const data = getStoreData(store) || {};
      const region = data["REGION"] || 'Khác';
      const ka = data["KA"] || 'Khác';
      const customer = data["CUSTOMER"] || 'Khác';
      const mer = data["MER NAME"] || 'Khác';

      const matchesRegion = filterRegion === 'all' || region === filterRegion;
      const matchesKA = filterKA === 'all' || ka === filterKA;
      const matchesCustomer = filterCustomer === 'all' || customer === filterCustomer;
      const matchesMer = filterMer === 'all' || mer === filterMer;

      return matchesRegion && matchesKA && matchesCustomer && matchesMer;
    });
  }, [uniqueStoresWithRequests, searchTerm, filterRegion, filterKA, filterCustomer, filterMer, getStoreData]);

  const filteredProjects = useMemo(() => {
    return (projects?.filter(p => {
      if (!searchTerm.trim()) return true;
      const term = removeVietnameseTones(searchTerm).toLowerCase();
      return (
        removeVietnameseTones(p.final_key || '').toLowerCase().includes(term) ||
        removeVietnameseTones(p.request_id || '').toLowerCase().includes(term) ||
        removeVietnameseTones(p.store_code || '').toLowerCase().includes(term) ||
        normalizeStoreName(p.store_name || '').includes(term) ||
        removeVietnameseTones(p.normalized_project_name || '').toLowerCase().includes(term) ||
        p.sheet_row_index?.toString().includes(term)
      );
    })?.filter(p => {
      if (planOptionFilter === 'all') return true;
      const plan = p.plan_option?.trim() || "";
      if (planOptionFilter === 'csp_ka') {
        return ["Đưa vào RQ by Store", "Đã đưa vào RQ tuần", "Request CSP", "Visibility Rquest"].includes(plan);
      }
      if (planOptionFilter === 'mer_quick_fix') {
        return plan === "Mer Quick Fix";
      }
      if (planOptionFilter === 'supplier_warranty') {
        return plan === "Supplier bảo hành";
      }
      return true;
    }) || []).sort((a, b) => {
      const ageA = calculateAge(a.request_date);
      const ageB = calculateAge(b.request_date);
      return (ageB !== null ? ageB : -999999) - (ageA !== null ? ageA : -999999);
    });
  }, [projects, searchTerm, planOptionFilter]);

  const srViewProjects = useMemo(() => {
    return (projects?.filter(p => p.store_name === selectedStore) || []).sort((a, b) => {
      const ageA = calculateAge(a.request_date);
      const ageB = calculateAge(b.request_date);
      return (ageB !== null ? ageB : -999999) - (ageA !== null ? ageA : -999999);
    });
  }, [projects, selectedStore]);

  const projectsByStep = useMemo(() => {
    return STATUS_STEPS.reduce((acc, step) => {
      acc[step] = filteredProjects.filter(p => {
        if (step === "New") {
          return !p.status || p.status.trim() === "";
        }
        return p.status === step;
      });
      return acc;
    }, {} as Record<string, Project[]>);
  }, [filteredProjects]);

  return {
    projects,
    storeDataList,
    isLoading: isProjectsLoading || isStoreLoading,
    uniqueStoresWithRequests,
    filterOptions,
    filteredStoresList,
    filteredProjects,
    srViewProjects,
    projectsByStep,
    getStoreData
  };
}
