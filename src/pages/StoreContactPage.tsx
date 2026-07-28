import React from 'react';
import { supabase } from '@/lib/supabase';
import { Search, RefreshCw, BookUser, ExternalLink, Filter, Store, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { syncMasterStoreDirectoryFromCSV, getLiveMasterContactMap } from '@/services/sheetSyncService';

export function StoreContactPage() {
    const [search, setSearch] = React.useState('');
    const [searchInput, setSearchInput] = React.useState(''); // For debounce
    const [regionFilter, setRegionFilter] = React.useState('');
    const [customerFilter, setCustomerFilter] = React.useState('');
    const [merFilter, setMerFilter] = React.useState('');
    const [page, setPage] = React.useState(0);
    const pageSize = 50;

    const [isSyncing, setIsSyncing] = React.useState(false);

    // STRICT CHECK: Only active when user typed a search term OR selected at least 1 filter dropdown!
    const hasActiveFilter = Boolean(search.trim() || regionFilter || customerFilter || merFilter);

    // Debounce search input
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(0); // Reset page on new search
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset page on filter change
    React.useEffect(() => {
        setPage(0);
    }, [regionFilter, customerFilter, merFilter]);

    // Fetch master filter dropdown options
    const { data: filterOptions } = useQuery({
        queryKey: ['master_filters'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_master_filters');
            if (error) {
                console.error("Filter fetch error:", error);
                return { regions: [], customers: [], mers: [] };
            }
            return data as { regions: string[], customers: string[], mers: string[] };
        },
        staleTime: 5 * 60 * 1000
    });

    // Fetch store directory (STRICTLY ENABLED ONLY WHEN FILTERS ARE ACTIVE)
    const { data: storesData, isLoading, refetch } = useQuery({
        queryKey: ['master_stores_directory', search, regionFilter, customerFilter, merFilter, page],
        queryFn: async () => {
            let query = supabase
                .from('master_stores_directory')
                .select('*', { count: 'exact' });

            if (search) {
                query = query.or(`store_code.ilike.%${search}%,store_name.ilike.%${search}%`);
            }
            if (regionFilter) {
                query = query.eq('region', regionFilter);
            }
            if (customerFilter) {
                query = query.eq('customer', customerFilter);
            }
            if (merFilter) {
                query = query.eq('mer_name', merFilter);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) throw error;

            // Enrich with live map from Google Sheet Contact (01.13.2025)
            const liveMap = await getLiveMasterContactMap();
            const enrichedStores = (data || []).map(s => {
                const live = s.store_code ? liveMap.get(s.store_code.toUpperCase().trim()) : null;
                return {
                    ...s,
                    sr_name: live?.sr_name || s.sr_name || s.sr,
                    sr_email: live?.sr_email || s.sr_email,
                    sr_phone: live?.sr_phone || s.sr_phone,
                    sr_phone_2: live?.sr_phone_2 || s.sr_phone_2,
                    opsup_name: live?.opsup_name || s.opsup_name,
                    opsup_email: live?.opsup_email || s.opsup_email,
                    opsup_phone: live?.opsup_phone || s.opsup_phone,
                    mer_name: live?.mer_name || s.mer_name
                };
            });

            return { data: enrichedStores, count: count || 0 };
        },
        enabled: hasActiveFilter // STRICT REQUIREMENT: DO NOT QUERY WHEN NO FILTER/SEARCH IS ACTIVE
    });

    const stores = storesData?.data || [];
    const totalStores = storesData?.count || 0;
    const totalPages = Math.ceil(totalStores / pageSize);

    const handleSync = async () => {
        setIsSyncing(true);
        const loadingToast = toast.loading('Đang đồng bộ dữ liệu trực tiếp từ Google Sheet Contact (01.13.2025)...');
        try {
            await getLiveMasterContactMap(true);
            const res = await syncMasterStoreDirectoryFromCSV();
            toast.success(res.message, { id: loadingToast });
            if (hasActiveFilter) refetch();
        } catch (err: any) {
            console.error("Sync error:", err);
            toast.error(err.message || 'Có lỗi xảy ra khi đồng bộ', { id: loadingToast });
        } finally {
            setIsSyncing(false);
        }
    };



    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                            <BookUser className="w-8 h-8 text-indigo-600" />
                            Store Contact
                        </h1>
                        <p className="text-slate-500 mt-1">Danh bạ cửa hàng Master (Chỉ hiển thị khi có Bộ lọc hoặc Tìm kiếm)</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <a 
                            href="https://docs.google.com/spreadsheets/d/1Lct6U-pSOCpGUEGG_uDrjS5joQCJA4UvC66-QrkDKgE" 
                            target="_blank" rel="noreferrer"
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Mở Google Sheet
                        </a>
                        <button 
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}
                        </button>
                    </div>
                </div>

                {/* Search & Filters Bar */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative w-full max-w-md">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Gõ Mã CH hoặc Tên CH để tìm kiếm..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
                            />
                        </div>

                        {/* Pagination indicator */}
                        {hasActiveFilter && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                <span>Đang xem: {stores.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, totalStores)} / {totalStores} cửa hàng</span>
                                <div className="flex items-center gap-1 ml-2">
                                    <button 
                                        disabled={page === 0}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 font-bold text-xs"
                                    >
                                        Trước
                                    </button>
                                    <span className="px-2 font-mono text-xs">{page + 1} / {totalPages || 1}</span>
                                    <button 
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 font-bold text-xs"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter Selects */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <select 
                            value={regionFilter}
                            onChange={(e) => setRegionFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">Tất cả Vùng miền</option>
                            {filterOptions?.regions?.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        <select 
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">Tất cả Hệ thống</option>
                            {filterOptions?.customers?.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select 
                            value={merFilter}
                            onChange={(e) => setMerFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="">Tất cả Merchandiser</option>
                            {filterOptions?.mers?.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>

                        {hasActiveFilter && (
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setSearchInput('');
                                    setRegionFilter('');
                                    setCustomerFilter('');
                                    setMerFilter('');
                                }}
                                className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </div>

                {/* Conditional Rendering */}
                {!hasActiveFilter ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center space-y-4 shadow-sm my-6">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <Search className="w-10 h-10 animate-bounce" />
                        </div>
                        <div className="max-w-md space-y-1">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                Vui lòng nhập từ khóa hoặc chọn Bộ lọc để hiển thị
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Để chống giật lag và tối ưu hiệu năng, hệ thống mặc định **không hiển thị toàn bộ 11,000+ cửa hàng**. Hãy chọn Vùng miền, Hệ thống, Merchandiser hoặc gõ Tên/Mã CH để tìm kiếm.
                            </p>
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 font-medium border border-slate-100 dark:border-slate-700">
                        Đang tìm kiếm cửa hàng...
                    </div>
                ) : stores.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 font-medium border border-slate-100 dark:border-slate-700">
                        Không tìm thấy cửa hàng nào phù hợp với từ khóa / bộ lọc hiện tại.
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4">Mã CH</th>
                                        <th className="p-4">Cửa hàng</th>
                                        <th className="p-4">Hệ thống (KA/Customer)</th>
                                        <th className="p-4">Địa chỉ & Vùng</th>
                                        <th className="p-4">Sales Rep (SR)</th>
                                        <th className="p-4">Ops Supervisor (OPSUP)</th>
                                        <th className="p-4">Merchandiser</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                    {stores.map((s: any, idx: number) => {
                                        const srNameVal = s.sr_name && isNaN(Number(s.sr_name)) ? s.sr_name : s.sr && isNaN(Number(s.sr)) ? s.sr : '';
                                        const srPhone1 = s.sr_phone || (s.sr_name && !isNaN(Number(s.sr_name)) ? s.sr_name : '');
                                        const srPhone2 = s.sr_phone_2 || '';

                                        return (
                                            <tr key={s.id || `${s.store_code}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="p-4">
                                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800">
                                                        {s.store_code}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-900 dark:text-white">
                                                    {s.store_name}
                                                </td>
                                                <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">
                                                    {s.customer ? `${s.customer}${s.ka ? ` / ${s.ka}` : ''}` : '-'}
                                                </td>
                                                <td className="p-4">
                                                    <div>{s.address || '-'}</div>
                                                    <div className="text-[10px] text-slate-400">{s.district}, {s.province} ({s.region})</div>
                                                </td>

                                                {/* Sales Rep (SR) (Tên Cột O, Email Cột Q, SĐT 1 Cột R, SĐT 2 Cột S) */}
                                                <td className="p-4 space-y-0.5">
                                                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                                                        {srNameVal || <span className="text-slate-400 font-normal">Chưa có tên SR</span>}
                                                    </div>
                                                    {s.sr_email && (
                                                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono truncate max-w-[160px]">
                                                            ✉️ {s.sr_email}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-1">
                                                        {srPhone1 && <span>📞 SĐT 1: {srPhone1}</span>}
                                                        {srPhone2 && <span>• SĐT 2: {srPhone2}</span>}
                                                    </div>
                                                </td>

                                                {/* Ops Supervisor (OPSUP) (Tên Cột V, Email Cột W) */}
                                                <td className="p-4 space-y-0.5">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                        {s.opsup_name || <span className="text-slate-400 font-normal">-</span>}
                                                    </div>
                                                    {s.opsup_email && (
                                                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate max-w-[160px]">
                                                            ✉️ {s.opsup_email}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Merchandiser (Cột AA) */}
                                                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                                    {s.mer_name || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
