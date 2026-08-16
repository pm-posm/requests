import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Filter, Calendar, ChevronDown, RotateCcw, X, SlidersHorizontal, Check, Building2, Store, Tag, UserCheck, Layers, FolderKanban, RefreshCw, Settings } from 'lucide-react';
import type { WarrantyItem } from '@/types/warranty';

export interface WarrantyFilterState {
  searchTerm: string;
  // Date group
  selectedYear: string;
  selectedQuarter: string;
  selectedMonth: string;
  selectedWeek: string;
  dateFrom: string;
  dateTo: string;
  // Project group
  selectedProjects: string[];
  // Classification group
  selectedVisTechs: string[];
  selectedSuppliers: string[];
  selectedStores: string[];
  selectedPosmTypes: string[];
  selectedBrands: string[];
  selectedProgresses: string[];
}

export const INITIAL_WARRANTY_FILTER_STATE: WarrantyFilterState = {
  searchTerm: '',
  selectedYear: 'all',
  selectedQuarter: 'all',
  selectedMonth: 'all',
  selectedWeek: 'all',
  dateFrom: '',
  dateTo: '',
  selectedProjects: [],
  selectedVisTechs: [],
  selectedSuppliers: [],
  selectedStores: [],
  selectedPosmTypes: [],
  selectedBrands: [],
  selectedProgresses: []
};

interface MultiSelectGroupProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

const MultiSelectGroup: React.FC<MultiSelectGroupProps> = ({
  label,
  icon,
  options = [],
  selectedValues = [],
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const safeOptions = options || [];
  const safeSelected = selectedValues || [];

  const filteredOptions = useMemo(() => {
    return safeOptions.filter(opt =>
      opt && opt.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [safeOptions, search]);

  const toggleOption = (val: string) => {
    if (safeSelected.includes(val)) {
      onChange(safeSelected.filter(v => v !== val));
    } else {
      onChange([...safeSelected, val]);
    }
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([...safeOptions]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
          {selectedValues.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-600 text-white font-mono">
              {selectedValues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[11px] font-normal truncate max-w-[140px]">
            {selectedValues.length === 0 ? 'Tất cả' : selectedValues.join(', ')}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded Checklist */}
      {isOpen && (
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
          {/* Quick Actions */}
          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={selectAll}
              className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
            >
              Chọn tất cả ({options.length})
            </button>
            {selectedValues.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
              >
                Bỏ chọn ({selectedValues.length})
              </button>
            )}
          </div>

          {/* Search Box if list > 6 */}
          {options.length > 6 && (
            <input
              type="text"
              placeholder={`Tìm trong ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-sky-500"
            />
          )}

          {/* Options List */}
          <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar pr-1">
            {filteredOptions.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-1 text-center">Không tìm thấy</p>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors select-none ${
                      isChecked
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isChecked
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface WarrantyFilterBarProps {
  warrantyItems: WarrantyItem[];
  filters: WarrantyFilterState;
  onFilterChange: (newFilters: WarrantyFilterState) => void;
  onResetFilters: () => void;
  onRefreshSheet?: () => void;
  isRefreshing?: boolean;
  onOpenSettings?: () => void;
}

export const WarrantyFilterBar: React.FC<WarrantyFilterBarProps> = ({
  warrantyItems,
  filters,
  onFilterChange,
  onResetFilters,
  onRefreshSheet,
  isRefreshing = false,
  onOpenSettings
}) => {
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isProjectPopoverOpen, setIsProjectPopoverOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const datePopoverRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const projectPopoverRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setIsDatePopoverOpen(false);
      }
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterPopoverOpen(false);
      }
      if (projectPopoverRef.current && !projectPopoverRef.current.contains(e.target as Node)) {
        setIsProjectPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDatePopoverOpen(false);
        setIsFilterPopoverOpen(false);
        setIsProjectPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute unique options for classification group
  const filterOptions = useMemo(() => {
    const visTechs = new Set<string>();
    const suppliers = new Set<string>();
    const stores = new Set<string>();
    const posmTypes = new Set<string>();
    const brands = new Set<string>();
    const years = new Set<string>();

    warrantyItems.forEach(item => {
      if (item.visTech?.trim()) visTechs.add(item.visTech.trim());
      if (item.supplier?.trim()) suppliers.add(item.supplier.trim());
      if (item.storeName?.trim()) stores.add(item.storeName.trim());
      if (item.posmType?.trim()) posmTypes.add(item.posmType.trim());
      if (item.brand?.trim()) brands.add(item.brand.trim());

      // Parse Year from sentDate or installationDate
      const dateStr = item.sentDate || item.installationDate || '';
      const match = dateStr.match(/\d{4}/);
      if (match) years.add(match[0]);
    });

    return {
      visTechs: Array.from(visTechs).sort(),
      suppliers: Array.from(suppliers).sort(),
      stores: Array.from(stores).sort(),
      posmTypes: Array.from(posmTypes).sort(),
      brands: Array.from(brands).sort(),
      years: Array.from(years).sort().reverse()
    };
  }, [warrantyItems]);

  // Compute unique projects with counts
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

  // Filtered projects by search input
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return uniqueProjects;
    const s = projectSearch.toLowerCase().trim();
    return uniqueProjects.filter(p => p.code.toLowerCase().includes(s));
  }, [uniqueProjects, projectSearch]);

  // Safe defaults for array properties
  const selectedProjects = filters?.selectedProjects || [];
  const selectedVisTechs = filters?.selectedVisTechs || [];
  const selectedSuppliers = filters?.selectedSuppliers || [];
  const selectedStores = filters?.selectedStores || [];
  const selectedPosmTypes = filters?.selectedPosmTypes || [];
  const selectedBrands = filters?.selectedBrands || [];

  // Date active check
  const isDateFiltered = (filters?.selectedYear && filters.selectedYear !== 'all') ||
    (filters?.selectedQuarter && filters.selectedQuarter !== 'all') ||
    (filters?.selectedMonth && filters.selectedMonth !== 'all') ||
    (filters?.selectedWeek && filters.selectedWeek !== 'all') ||
    !!filters?.dateFrom ||
    !!filters?.dateTo;

  // Project active check
  const isProjectFiltered = selectedProjects.length > 0;

  // Dimension active count
  const totalActiveClassificationCount = 
    selectedVisTechs.length +
    selectedSuppliers.length +
    selectedStores.length +
    selectedPosmTypes.length +
    selectedBrands.length;

  const hasAnyActiveFilters = isDateFiltered || isProjectFiltered || totalActiveClassificationCount > 0 || !!(filters?.searchTerm || '').trim();

  // Label for Date trigger button
  const getDateFilterLabel = () => {
    if (filters?.dateFrom && filters?.dateTo) return `${filters.dateFrom} ➔ ${filters.dateTo}`;
    if (filters?.dateFrom) return `Từ ${filters.dateFrom}`;
    if (filters?.dateTo) return `Đến ${filters.dateTo}`;
    if (filters?.selectedWeek && filters.selectedWeek !== 'all') return `Tuần ${filters.selectedWeek}`;
    if (filters?.selectedQuarter && filters.selectedQuarter !== 'all' && filters?.selectedYear && filters.selectedYear !== 'all') return `Quý ${filters.selectedQuarter}/${filters.selectedYear}`;
    if (filters?.selectedQuarter && filters.selectedQuarter !== 'all') return `Quý ${filters.selectedQuarter}`;
    if (filters?.selectedMonth && filters.selectedMonth !== 'all' && filters?.selectedYear && filters.selectedYear !== 'all') return `T${filters.selectedMonth}/${filters.selectedYear}`;
    if (filters?.selectedMonth && filters.selectedMonth !== 'all') return `Tháng ${filters.selectedMonth}`;
    if (filters?.selectedYear && filters.selectedYear !== 'all') return `Năm ${filters.selectedYear}`;
    return 'Tất cả';
  };

  const clearDateFilters = () => {
    onFilterChange({
      ...filters,
      selectedYear: 'all',
      selectedQuarter: 'all',
      selectedMonth: 'all',
      selectedWeek: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  const clearClassificationFilters = () => {
    onFilterChange({
      ...filters,
      selectedVisTechs: [],
      selectedSuppliers: [],
      selectedStores: [],
      selectedPosmTypes: [],
      selectedBrands: []
    });
  };

  const clearProjectFilters = () => {
    onFilterChange({
      ...filters,
      selectedProjects: []
    });
  };

  const toggleProject = (code: string) => {
    if (filters.selectedProjects.includes(code)) {
      onFilterChange({
        ...filters,
        selectedProjects: filters.selectedProjects.filter(c => c !== code)
      });
    } else {
      onFilterChange({
        ...filters,
        selectedProjects: [...filters.selectedProjects, code]
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
      <div className="flex flex-col md:flex-row items-center gap-3">
        
        {/* 1. SEARCH INPUT */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã Request (BH-xxx), Dự Án, Siêu Thị, Thầu, Brand, Loại lỗi..."
            value={filters.searchTerm}
            onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 transition-colors"
          />
          {filters.searchTerm && (
            <button
              onClick={() => onFilterChange({ ...filters, searchTerm: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. UNIFIED DATE FILTER POPOVER TRIGGER */}
        <div className="relative shrink-0 w-full sm:w-auto" ref={datePopoverRef}>
          <button
            onClick={() => {
              setIsDatePopoverOpen(!isDatePopoverOpen);
              setIsFilterPopoverOpen(false);
              setIsProjectPopoverOpen(false);
            }}
            className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isDateFiltered
                ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Thời gian: {getDateFilterLabel()}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDatePopoverOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* DATE POPOVER PANEL */}
          {isDatePopoverOpen && (
            <div className="absolute right-0 md:right-auto md:left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  <span>Bộ Lọc Thời Gian</span>
                </div>
                {isDateFiltered && (
                  <button
                    onClick={clearDateFilters}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại thời gian</span>
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phím tắt:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={clearDateFilters}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      !isDateFiltered
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      onFilterChange({
                        ...filters,
                        selectedYear: String(now.getFullYear()),
                        selectedQuarter: 'all',
                        selectedMonth: 'all',
                        selectedWeek: 'all',
                        dateFrom: '',
                        dateTo: ''
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      filters.selectedYear === String(new Date().getFullYear()) && filters.selectedMonth === 'all' && filters.selectedQuarter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Năm nay ({new Date().getFullYear()})
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const currentQ = String(Math.ceil((now.getMonth() + 1) / 3));
                      onFilterChange({
                        ...filters,
                        selectedYear: String(now.getFullYear()),
                        selectedQuarter: currentQ,
                        selectedMonth: 'all',
                        selectedWeek: 'all',
                        dateFrom: '',
                        dateTo: ''
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      filters.selectedQuarter === String(Math.ceil((new Date().getMonth() + 1) / 3))
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Quý này (Q{Math.ceil((new Date().getMonth() + 1) / 3)})
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      onFilterChange({
                        ...filters,
                        selectedYear: String(now.getFullYear()),
                        selectedQuarter: 'all',
                        selectedMonth: String(now.getMonth() + 1),
                        selectedWeek: 'all',
                        dateFrom: '',
                        dateTo: ''
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      filters.selectedMonth === String(new Date().getMonth() + 1)
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Tháng này (T{new Date().getMonth() + 1})
                  </button>
                </div>
              </div>

              {/* 4-Grid Selectors: Năm, Quý, Tháng, Tuần */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Năm</label>
                  <select
                    value={filters.selectedYear}
                    onChange={(e) => onFilterChange({ ...filters, selectedYear: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Năm</option>
                    {filterOptions.years.map(y => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Quý</label>
                  <select
                    value={filters.selectedQuarter}
                    onChange={(e) => onFilterChange({ ...filters, selectedQuarter: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Quý</option>
                    <option value="1">Quý 1 (T1-T3)</option>
                    <option value="2">Quý 2 (T4-T6)</option>
                    <option value="3">Quý 3 (T7-T9)</option>
                    <option value="4">Quý 4 (T10-T12)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Tháng</label>
                  <select
                    value={filters.selectedMonth}
                    onChange={(e) => onFilterChange({ ...filters, selectedMonth: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Tháng</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Tuần</label>
                  <select
                    value={filters.selectedWeek}
                    onChange={(e) => onFilterChange({ ...filters, selectedWeek: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Tuần</option>
                    {Array.from({ length: 52 }, (_, i) => String(i + 1)).map(w => (
                      <option key={w} value={w}>Tuần {w}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Range: Từ ngày -> Đến ngày */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khoảng ngày tùy chỉnh (Từ ngày ➔ Đến ngày):</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Từ ngày:</span>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Đến ngày:</span>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Popover Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsDatePopoverOpen(false)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Xong &amp; Áp Dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. DEDICATED PROJECT CODE FILTER POPOVER WITH IN-POPOVER SEARCH */}
        <div className="relative shrink-0 w-full sm:w-auto" ref={projectPopoverRef}>
          <button
            onClick={() => {
              setIsProjectPopoverOpen(!isProjectPopoverOpen);
              setIsDatePopoverOpen(false);
              setIsFilterPopoverOpen(false);
            }}
            className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isProjectFiltered
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                Dự án: {selectedProjects.length === 0
                  ? 'Tất cả'
                  : selectedProjects.length === 1
                  ? `${selectedProjects[0]}`
                  : `${selectedProjects.length} mã đã chọn`}
              </span>
            </div>
            {selectedProjects.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                {selectedProjects.length}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProjectPopoverOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* PROJECT POPOVER PANEL */}
          {isProjectPopoverOpen && (
            <div className="absolute right-0 md:right-auto md:left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                  <FolderKanban className="w-4 h-4 text-amber-500" />
                  <span>Bộ Lọc Mã Dự Án ({uniqueProjects.length})</span>
                </div>
                {isProjectFiltered && (
                  <button
                    onClick={clearProjectFilters}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Bỏ chọn tất cả</span>
                  </button>
                )}
              </div>

              {/* In-Popover Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên dự án..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="w-full pl-9 pr-7 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-amber-500 transition-colors"
                />
                {projectSearch && (
                  <button
                    onClick={() => setProjectSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Fast Helpers */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{filteredProjects.length} mã phù hợp</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisibleCodes = filteredProjects.map(p => p.code);
                      const combined = Array.from(new Set([...filters.selectedProjects, ...allVisibleCodes]));
                      onFilterChange({ ...filters, selectedProjects: combined });
                    }}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                  >
                    Chọn kết quả ({filteredProjects.length})
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => onFilterChange({ ...filters, selectedProjects: [] })}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline cursor-pointer"
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* Scrollable Project Checklist */}
              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pr-1 border border-slate-100 dark:border-slate-800/80 rounded-xl p-1.5 bg-slate-50/50 dark:bg-slate-950/50">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic">
                    Không tìm thấy mã dự án nào khớp với "{projectSearch}"
                  </div>
                ) : (
                  filteredProjects.map(({ code, count }) => {
                    const isChecked = filters.selectedProjects.includes(code);
                    return (
                      <label
                        key={code}
                        onClick={() => toggleProject(code)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                          isChecked
                            ? 'bg-amber-100/70 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate font-mono">{code}</span>
                        </div>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                          isChecked
                            ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold'
                            : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {count} ca
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsProjectPopoverOpen(false)}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Xong &amp; Áp Dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. UNIFIED CLASSIFICATION FILTER POPOVER TRIGGER (VIS-Tech, Supplier, Store, Loại POSM, Nhãn) */}
        <div className="relative shrink-0 w-full sm:w-auto" ref={filterPopoverRef}>
          <button
            onClick={() => {
              setIsFilterPopoverOpen(!isFilterPopoverOpen);
              setIsDatePopoverOpen(false);
              setIsProjectPopoverOpen(false);
            }}
            className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              totalActiveClassificationCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                Phân loại: {totalActiveClassificationCount > 0 ? `${totalActiveClassificationCount} mục đang chọn` : 'Tất cả'}
              </span>
            </div>
            {totalActiveClassificationCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                {totalActiveClassificationCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* CLASSIFICATION FILTER POPOVER PANEL */}
          {isFilterPopoverOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 sticky top-0 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <span>Bộ Lọc Phân Loại POSM &amp; Nhân Sự</span>
                </div>
                {totalActiveClassificationCount > 0 && (
                  <button
                    onClick={clearClassificationFilters}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại 5 bộ lọc</span>
                  </button>
                )}
              </div>

              {/* 5 MULTI-SELECT CHECKLIST GROUPS */}
              <div className="space-y-2.5">
                {/* 1. VIS-Tech */}
                <MultiSelectGroup
                  label="1. VIS-Tech (Quản lý POSM)"
                  icon={<UserCheck className="w-3.5 h-3.5 text-indigo-500" />}
                  options={filterOptions.visTechs}
                  selectedValues={filters.selectedVisTechs}
                  onChange={(vals) => onFilterChange({ ...filters, selectedVisTechs: vals })}
                />

                {/* 2. Supplier (Nhà thầu) */}
                <MultiSelectGroup
                  label="2. Supplier (Nhà thầu sản xuất)"
                  icon={<Building2 className="w-3.5 h-3.5 text-sky-500" />}
                  options={filterOptions.suppliers}
                  selectedValues={filters.selectedSuppliers}
                  onChange={(vals) => onFilterChange({ ...filters, selectedSuppliers: vals })}
                />

                {/* 3. Store / Siêu thị */}
                <MultiSelectGroup
                  label="3. Store (Siêu thị / Cửa hàng)"
                  icon={<Store className="w-3.5 h-3.5 text-emerald-500" />}
                  options={filterOptions.stores}
                  selectedValues={filters.selectedStores}
                  onChange={(vals) => onFilterChange({ ...filters, selectedStores: vals })}
                />

                {/* 4. Loại POSM */}
                <MultiSelectGroup
                  label="4. Loại POSM"
                  icon={<Layers className="w-3.5 h-3.5 text-amber-500" />}
                  options={filterOptions.posmTypes}
                  selectedValues={filters.selectedPosmTypes}
                  onChange={(vals) => onFilterChange({ ...filters, selectedPosmTypes: vals })}
                />

                {/* 5. Nhãn / Brand / Cat */}
                <MultiSelectGroup
                  label="5. Nhãn / Brand"
                  icon={<Tag className="w-3.5 h-3.5 text-purple-500" />}
                  options={filterOptions.brands}
                  selectedValues={filters.selectedBrands}
                  onChange={(vals) => onFilterChange({ ...filters, selectedBrands: vals })}
                />
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end sticky bottom-0 bg-white dark:bg-slate-900 z-10">
                <button
                  onClick={() => setIsFilterPopoverOpen(false)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:white text-white dark:text-slate-900 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Xong &amp; Áp Dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. ACTIONS: CLEAR ALL FILTERS */}
        {hasAnyActiveFilters && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={onResetFilters}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}

        {/* 6. SHEET ACTION BUTTONS: REFRESH & SETTINGS */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto ml-auto">
          {onRefreshSheet && (
            <button
              onClick={onRefreshSheet}
              disabled={isRefreshing}
              className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Đồng bộ dữ liệu từ Google Sheet"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Cấu hình Google Sheet URL & Web App API"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
