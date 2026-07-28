import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAndSyncSheetData } from '@/services/sheetSyncService';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { queueAutoPush } from '@/services/autoPushService';

export function useRawRequests() {
    const queryClient = useQueryClient();

    // Query to get all raw requests
    const { data: requests = [], isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['raw_requests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('raw_requests')
                .select('*')
                .eq('is_deleted_in_sheet', false)
                .order('sheet_row_index', { ascending: true });

            if (error) throw error;
            
            // Deduplicate by sheet_row_index for strict 1-to-1 sheet row mapping
            const uniqueMap = new Map<number, RawRequestRecord>();
            (data as RawRequestRecord[] || []).forEach(item => {
                if (item.sheet_row_index && !uniqueMap.has(item.sheet_row_index)) {
                    uniqueMap.set(item.sheet_row_index, item);
                }
            });

            return Array.from(uniqueMap.values());
        },
        staleTime: 3 * 60 * 1000, // 3 minutes
    });



    // Mutation to update request workflow fields by Mer
    const updateRequestMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<RawRequestRecord> }) => {
            const { data, error } = await supabase
                .from('raw_requests')
                .update({
                    ...updates,
                    is_mer_modified: true, // Lock field from sheet overwrite
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['raw_requests'] });

            if (data && data.sheet_row_index) {
                queueAutoPush({
                    sheetRowIndex: data.sheet_row_index,
                    phuongAn: data.phuong_an,
                    ngayQuickFix: data.ngay_quick_fix,
                    status: data.status,
                    tienDo: data.tien_do,
                    supplier: data.supplier,
                    requestId: data.request_id,
                    merNote: data.mer_note
                });
            }
        }
    });


    // Mutation to sync from Google Sheet
    const syncSheetMutation = useMutation({
        mutationFn: async () => {
            return await fetchAndSyncSheetData();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['raw_requests'] });
        }
    });

    return {
        requests,
        isLoading,
        isRefetching,
        refetch,
        updateRequest: (id: string, updates: Partial<RawRequestRecord>) => updateRequestMutation.mutateAsync({ id, updates }),
        isUpdating: updateRequestMutation.isPending,
        syncSheet: syncSheetMutation.mutateAsync,
        isSyncing: syncSheetMutation.isPending
    };
}
