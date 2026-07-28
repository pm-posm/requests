import React from 'react';
import { Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useDashboardData } from '@/hooks/useDashboardData';

import { useNavigate } from 'react-router-dom';

export function DashboardStoreList() {
  const navigate = useNavigate();
  const { 
    filterRegion, setFilterRegion, 
    filterKA, setFilterKA, 
    filterCustomer, setFilterCustomer, 
    filterMer, setFilterMer, 
    setRequestMenu, setSelectedStore 
  } = useDashboardStore();
  
  const { filterOptions, filteredStoresList, getStoreData } = useDashboardData();

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Danh sách Cửa hàng</h2>
          <p className="text-sm text-slate-500 mt-1">Lọc cửa hàng theo Region, KA, Customer, MER và xem các request của từng cửa hàng.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <select 
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          >
            <option value="all">Tất cả Region</option>
            {filterOptions.regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            value={filterKA}
            onChange={(e) => setFilterKA(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          >
            <option value="all">Tất cả KA</option>
            {filterOptions.kas.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select 
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          >
            <option value="all">Tất cả Customer</option>
            {filterOptions.customers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={filterMer}
            onChange={(e) => setFilterMer(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
          >
            <option value="all">Tất cả MER</option>
            {filterOptions.mers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStoresList.map(store => {
            const storeData = getStoreData(store) || {};
            return (
              <button
                key={store}
                onClick={() => {
                  setSelectedStore(store);
                  navigate('/requests/store/' + encodeURIComponent(store));
                }}
                className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group text-left"
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">{store}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {storeData["REGION"] && storeData["REGION"] !== 'Khác' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 leading-normal border-transparent">{storeData["REGION"]}</Badge>}
                      {storeData["CUSTOMER"] && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 leading-normal border-transparent">{storeData["CUSTOMER"]}</Badge>}
                      {storeData["KA"] && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 leading-normal border-transparent">{storeData["KA"]}</Badge>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredStoresList.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              Không tìm thấy cửa hàng nào
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
