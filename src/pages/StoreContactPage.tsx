import React from 'react';
import { supabase } from '@/lib/supabase';
import { Search, RefreshCw, BookUser, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';

export function StoreContactPage() {
    const [search, setSearch] = React.useState('');
    const [searchInput, setSearchInput] = React.useState(''); // For debounce
    const [regionFilter, setRegionFilter] = React.useState('');
    const [customerFilter, setCustomerFilter] = React.useState('');
    const [merFilter, setMerFilter] = React.useState('');
    const [page, setPage] = React.useState(0);
    const pageSize = 50;
    
    const [isSyncing, setIsSyncing] = React.useState(false);

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(0); // Reset page on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Reset page on filter change
    React.useEffect(() => {
        setPage(0);
    }, [regionFilter, customerFilter, merFilter]);

    // Fetch filters options
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

    // Fetch store directory (Paginated & Filtered)
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
            return { data: data || [], count: count || 0 };
        }
    });

    const stores = storesData?.data || [];
    const totalStores = storesData?.count || 0;
    const totalPages = Math.ceil(totalStores / pageSize);

    const handleSync = async () => {
        setIsSyncing(true);
        const loadingToast = toast.loading('Đang đồng bộ dữ liệu từ Google Sheet...');
        try {
            const { data, error } = await supabase.functions.invoke('sync-master-directory');
            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Lỗi không xác định');
            
            toast.success(data.message || 'Đồng bộ thành công!', { id: loadingToast });
            refetch();
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
                        <p className="text-slate-500 mt-1">Danh bạ cửa hàng Master (Đồng bộ từ Google Sheet)</p>
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

                {/* Search & Filters */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative w-full max-w-md">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Tìm kiếm theo mã CH hoặc tên CH..."
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition-colors text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                                Đang xem: <span className="text-indigo-600 dark:text-indigo-400">{Math.min(page * pageSize + 1, totalStores)} - {Math.min((page + 1) * pageSize, totalStores)}</span> / {totalStores}
                            </span>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button 
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0 || isLoading}
                                    className="px-3 py-1.5 text-xs font-bold rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                >
                                    Trước
                                </button>
                                <span className="text-xs font-bold px-2">{page + 1} / {Math.max(1, totalPages)}</span>
                                <button 
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= totalPages - 1 || isLoading}
                                    className="px-3 py-1.5 text-xs font-bold rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <select 
                            value={regionFilter} 
                            onChange={e => setRegionFilter(e.target.value)}
                            className="text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 cursor-pointer min-w-[150px]"
                        >
                            <option value="">Tất cả Vùng miền</option>
                            {filterOptions?.regions?.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <select 
                            value={customerFilter} 
                            onChange={e => setCustomerFilter(e.target.value)}
                            className="text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 cursor-pointer min-w-[150px]"
                        >
                            <option value="">Tất cả Khách hàng</option>
                            {filterOptions?.customers?.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select 
                            value={merFilter} 
                            onChange={e => setMerFilter(e.target.value)}
                            className="text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 cursor-pointer min-w-[150px]"
                        >
                            <option value="">Tất cả Merchandiser</option>
                            {filterOptions?.mers?.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 z-10">
                                <tr>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Mã CH</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Cửa hàng</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Khách hàng</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Địa chỉ & Vùng</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Sales Rep (SR)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase whitespace-nowrap">Merchandiser</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : stores.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">Không tìm thấy cửa hàng nào</td>
                                    </tr>
                                ) : (
                                    stores.map((store: any) => (
                                        <tr key={store.store_code} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4">
                                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">
                                                    {store.store_code}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                {store.store_name}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{store.customer || '-'}</span>
                                                    {store.ka && <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">{store.ka}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    {store.region && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded w-max uppercase tracking-wider">{store.region}</span>}
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {[store.district, store.province].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{store.sr || '-'}</span>
                                                    {store.sr_phone && <span className="text-[11px] text-slate-500">{store.sr_phone}</span>}
                                                    {store.sr_email && <span className="text-[10px] text-indigo-500 hover:underline">{store.sr_email}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-400">{store.mer_name || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
