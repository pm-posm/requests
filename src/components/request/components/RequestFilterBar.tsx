import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Calendar, ChevronDown, RotateCcw, MoveHorizontal, SlidersHorizontal, X, Check } from 'lucide-react';

interface FilterOptions {
  planOptions: string[];
  statuses: string[];
  progressOptions: string[];
  mers: string[];
  suppliers: string[];
  years: string[];
  weeks: string[];
}

interface RequestFilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedPlanOptions: string[];
  setSelectedPlanOptions: (v: string[]) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (v: string[]) => void;
  selectedProgresses: string[];
  setSelectedProgresses: (v: string[]) => void;
  selectedMers: string[];
  setSelectedMers: (v: string[]) => void;
  selectedSuppliers: string[];
  setSelectedSuppliers: (v: string[]) => void;
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedWeek: string;
  setSelectedWeek: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  filterOptions: FilterOptions;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  onResetColumns: () => void;
}

interface MultiSelectGroupProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

const MultiSelectGroup: React.FC<MultiSelectGroupProps> = ({
  label,
  options,
  selectedValues,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase().trim())
  );

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([...options]);
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
          <span>{label}</span>
          {selectedValues.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
              {selectedValues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[11px] font-normal truncate max-w-[130px]">
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
                Bỏ chọn
              </button>
            )}
          </div>

          {/* Search box if options > 5 */}
          {options.length > 5 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-slate-400 text-center py-2 text-[11px]">Không có kết quả</div>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                      isChecked
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 cursor-pointer pointer-events-none"
                    />
                    <span className="truncate flex-1">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const RequestFilterBar: React.FC<RequestFilterBarProps> = ({
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
  filterOptions,
  hasActiveFilters,
  clearAllFilters,
  onResetColumns,
}) => {
  // Popover 1: Thời gian
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);

  // Popover 2: Bộ lọc chuyên sâu
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  const isDateFiltered = Boolean(
    selectedYear !== 'all' || 
    selectedMonth !== 'all' || 
    selectedWeek !== 'all' || 
    dateFrom || 
    dateTo
  );

  const totalActiveValuesCount = (
    selectedPlanOptions.length +
    selectedStatuses.length +
    selectedProgresses.length +
    selectedMers.length +
    selectedSuppliers.length
  );

  const getDateFilterLabel = () => {
    const parts: string[] = [];
    if (selectedYear !== 'all') parts.push(`Năm ${selectedYear}`);
    if (selectedMonth !== 'all') parts.push(`Tháng ${selectedMonth}`);
    if (selectedWeek !== 'all') parts.push(`Tuần ${selectedWeek}`);
    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) parts.push(`${dateFrom} ➔ ${dateTo}`);
      else if (dateFrom) parts.push(`Từ ${dateFrom}`);
      else if (dateTo) parts.push(`Đến ${dateTo}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'Tất cả thời gian';
  };

  const clearDateFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedWeek('all');
    setDateFrom('');
    setDateTo('');
  };

  const clearAdvancedFilters = () => {
    setSelectedPlanOptions([]);
    setSelectedStatuses([]);
    setSelectedProgresses([]);
    setSelectedMers([]);
    setSelectedSuppliers([]);
  };

  // Đóng popover khi click ngoài hoặc ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setIsDatePopoverOpen(false);
      }
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDatePopoverOpen(false);
        setIsFilterPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
      <div className="flex flex-col md:flex-row items-center gap-3">
        
        {/* 1. SEARCH INPUT */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo cửa hàng, SR, Mer, mã dự án, POSM, tiêu đề mail, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-sky-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
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
                      setSelectedYear(String(now.getFullYear()));
                      setSelectedMonth('all');
                      setSelectedWeek('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedYear === String(new Date().getFullYear()) && selectedMonth === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Năm nay ({new Date().getFullYear()})
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedYear(String(now.getFullYear()));
                      setSelectedMonth(String(now.getMonth() + 1));
                      setSelectedWeek('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedMonth === String(new Date().getMonth() + 1)
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Tháng này (T{new Date().getMonth() + 1})
                  </button>
                </div>
              </div>

              {/* Grid Selectors */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Năm</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Năm</option>
                    {filterOptions.years.map(y => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Tháng</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
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
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer font-semibold"
                  >
                    <option value="all">Tất cả Tuần</option>
                    {filterOptions.weeks.map(w => (
                      <option key={w} value={w}>Tuần {w}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date Range */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khoảng ngày tùy chỉnh:</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Từ ngày:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Đến ngày:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Popover Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsDatePopoverOpen(false)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. UNIFIED ADVANCED MULTI-SELECT FILTER POPOVER (Phương án, Status, Tiến độ, Mer, Supplier) */}
        <div className="relative shrink-0 w-full sm:w-auto" ref={filterPopoverRef}>
          <button
            onClick={() => {
              setIsFilterPopoverOpen(!isFilterPopoverOpen);
              setIsDatePopoverOpen(false);
            }}
            className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              totalActiveValuesCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                Bộ lọc: {totalActiveValuesCount > 0 ? `${totalActiveValuesCount} giá trị đang chọn` : 'Tất cả'}
              </span>
            </div>
            {totalActiveValuesCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                {totalActiveValuesCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* ADVANCED FILTER POPOVER PANEL */}
          {isFilterPopoverOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 sticky top-0 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <span>Bộ Lọc Chuyên Sâu (Chọn nhiều giá trị)</span>
                </div>
                {totalActiveValuesCount > 0 && (
                  <button
                    onClick={clearAdvancedFilters}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại 5 bộ lọc</span>
                  </button>
                )}
              </div>

              {/* 5 MULTI-SELECT CHECKLIST GROUPS */}
              <div className="space-y-2.5">
                {/* 1. Phương án */}
                <MultiSelectGroup
                  label="1. Phương Án (Cột U)"
                  options={filterOptions.planOptions}
                  selectedValues={selectedPlanOptions}
                  onChange={setSelectedPlanOptions}
                />

                {/* 2. Status (Trạng thái) */}
                <MultiSelectGroup
                  label="2. Trạng Thái (Status - Cột X)"
                  options={filterOptions.statuses}
                  selectedValues={selectedStatuses}
                  onChange={setSelectedStatuses}
                />

                {/* 3. Tiến độ dự án */}
                <MultiSelectGroup
                  label="3. Tiến Độ Dự Án (Cột Y)"
                  options={filterOptions.progressOptions}
                  selectedValues={selectedProgresses}
                  onChange={setSelectedProgresses}
                />

                {/* 4. Mer (Phụ trách) */}
                <MultiSelectGroup
                  label="4. Phụ Trách Mer (Cột AG / E)"
                  options={filterOptions.mers}
                  selectedValues={selectedMers}
                  onChange={setSelectedMers}
                />

                {/* 5. Supplier (Nhà thầu) */}
                <MultiSelectGroup
                  label="5. Nhà Thầu / Supplier (Cột AC)"
                  options={filterOptions.suppliers}
                  selectedValues={selectedSuppliers}
                  onChange={setSelectedSuppliers}
                />
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end sticky bottom-0 bg-white dark:bg-slate-900 z-10">
                <button
                  onClick={() => setIsFilterPopoverOpen(false)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Xong &amp; Áp Dụng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. ACTIONS: CLEAR & RESET COLUMNS */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
          <button
            onClick={onResetColumns}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700"
            title="Đặt lại độ rộng các cột về mặc định"
          >
            <MoveHorizontal className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
