import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StoreItem } from '@/types';

function useDebounce<T>(value: T, delay: number): [T] {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return [debouncedValue];
}

interface StoreSearchInputProps {
    onSelectStore: (store: any) => void;
}

export function StoreSearchInput({ onSelectStore }: StoreSearchInputProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 300);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) {
            setSearchResults([]);
            return;
        }

        const fetchResults = async () => {
            setIsSearching(true);
            try {
                const { data } = await supabase
                    .from('master_stores_directory')
                    .select('*')
                    .or(`store_code.ilike.%${debouncedSearch}%,store_name.ilike.%${debouncedSearch}%`)
                    .limit(10);
                setSearchResults(data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        };
        fetchResults();
    }, [debouncedSearch]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (store: any) => {
        onSelectStore(store);
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                    placeholder="Tìm mã hoặc tên cửa hàng từ Master..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>
            
            {isOpen && searchTerm.length >= 2 && (
                <div className="absolute z-[100] left-0 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl">
                    {isSearching && (
                        <div className="p-3 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tìm kiếm...
                        </div>
                    )}
                    {!isSearching && searchResults.length === 0 && (
                        <div className="p-3 text-center text-sm text-slate-500">
                            Không tìm thấy cửa hàng nào khớp.
                        </div>
                    )}
                    {!isSearching && searchResults.length > 0 && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 shadow-sm">
                                <tr>
                                    <th className="p-2 font-semibold border-b border-slate-100 dark:border-slate-800">Mã CH</th>
                                    <th className="p-2 font-semibold border-b border-slate-100 dark:border-slate-800">Tên CH</th>
                                    <th className="p-2 font-semibold border-b border-slate-100 dark:border-slate-800 hidden sm:table-cell">Kênh</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map((res, i) => (
                                    <tr 
                                        key={i} 
                                        className="hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                                        onClick={() => handleSelect(res)}
                                    >
                                        <td className="p-2 font-mono text-indigo-600 dark:text-indigo-400 font-medium">{res.store_code}</td>
                                        <td className="p-2 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{res.store_name}</td>
                                        <td className="p-2 text-slate-500 hidden sm:table-cell">{res.customer}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
