import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MasterStoreDirItem {
    store_code: string;
    store_name: string;
    customer: string | null;
    ka: string | null;
    sr: string | null;
    sr_email: string | null;
    sr_phone: string | null;
    mer_name: string | null;
    region: string | null;
    store_level: string | null;
    province: string | null;
    district: string | null;
}

export function useMasterStoreDirectory(searchCode: string) {
    return useQuery({
        queryKey: ['master_store_directory', searchCode],
        queryFn: async () => {
            if (!searchCode || searchCode.length < 2) return [];
            
            const { data, error } = await supabase
                .from('master_stores_directory')
                .select('*')
                .ilike('store_code', `%${searchCode}%`)
                .limit(10);
                
            if (error) {
                console.error("Error fetching master store directory:", error);
                return [];
            }
            return data as MasterStoreDirItem[];
        },
        enabled: searchCode.length >= 2,
        staleTime: 1000 * 60 * 5, // cache for 5 minutes
    });
}
