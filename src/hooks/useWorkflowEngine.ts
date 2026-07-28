import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface WorkflowStatus {
    id: string;
    name: string;
    category: 'to_do' | 'in_progress' | 'review' | 'done';
    phuong_an_scope: string;
    color: string;
    order_index: number;
}

export const PHUONG_AN_OPTIONS = [
    'Visibility Request',
    'Mer Quick Fix',
    'Đưa vào RQ by Store',
    'Đã đưa vào RQ tuần',
    'Supplier Bảo Hành'
] as const;

export function useWorkflowEngine() {
    const queryClient = useQueryClient();

    const { data: statuses = [], isLoading } = useQuery({
        queryKey: ['workflow_statuses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workflow_statuses')
                .select('*')
                .order('order_index', { ascending: true });

            if (error) throw error;
            return data as WorkflowStatus[];
        }
    });

    const addStatusMutation = useMutation({
        mutationFn: async (newStatus: Omit<WorkflowStatus, 'id'>) => {
            const { data, error } = await supabase
                .from('workflow_statuses')
                .insert([newStatus])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow_statuses'] });
        }
    });

    const deleteStatusMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('workflow_statuses')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow_statuses'] });
        }
    });

    // Dynamic helper: returns progress choices directly from user's custom workflow_statuses in Supabase
    const getProgressChoices = (phuongAn: string): string[] => {
        if (statuses.length > 0) {
            // Filter by phuong_an_scope if specific, or ALL
            const filtered = statuses.filter(s => s.phuong_an_scope === 'ALL' || s.phuong_an_scope === phuongAn);
            if (filtered.length > 0) {
                return filtered.map(s => s.name);
            }
            return statuses.map(s => s.name);
        }

        // Default fallbacks
        if (phuongAn === 'Supplier Bảo Hành') {
            return ['Vis - Đã gửi RQ tới Agency', 'Supplier đã gửi lịch', 'Hoàn Thành', 'Cancelled'];
        }
        if (phuongAn === 'Mer Quick Fix') {
            return ['Mer quick fix', 'Hoàn Thành'];
        }
        return ['Under CSP Review', 'Approved', 'Rejected', 'Not started', 'Hoàn Thành', 'Cancelled'];
    };

    return {
        statuses,
        isLoading,
        addStatus: addStatusMutation.mutateAsync,
        deleteStatus: deleteStatusMutation.mutateAsync,
        getProgressChoices
    };
}
