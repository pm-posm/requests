import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StorePhase, PhaseStatus } from '@/types';
import toast from 'react-hot-toast';

/** Tính toán trạng thái của một phase dựa trên ngày kế hoạch và kết quả */
export function computePhaseStatus(phase?: StorePhase | null): { status: PhaseStatus; label: string; isLate: boolean } {
    if (!phase || !phase.expected_start) {
        return { status: 'unscheduled', label: 'Chưa lên lịch', isLate: false };
    }
    if (phase.result === 'pass') {
        return { status: 'completed', label: 'Hoàn tất', isLate: false };
    }
    if (phase.result === 'fail') {
        return { status: 'error', label: 'Lỗi', isLate: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = phase.expected_end ? new Date(phase.expected_end) : null;
    const startDate = new Date(phase.expected_start);

    if (today < startDate) {
        return { status: 'scheduled', label: 'Đã lên lịch', isLate: false };
    }
    if (endDate && today > endDate) {
        return { status: 'late', label: 'Đang làm (Trễ)', isLate: true };
    }
    return { status: 'in_progress', label: 'Đang thực hiện', isLate: false };
}

/** Hook lấy TẤT CẢ phases của một dự án */
export function useStorePhasesByProject(finalProject: string) {
    return useQuery<StorePhase[]>({
        queryKey: ['store_phases_project', finalProject],
        queryFn: async () => {
            // Lấy store_item_ids từ project
            const { data: items } = await supabase
                .from('project_store_items')
                .select('id')
                .eq('final_project', finalProject);
            if (!items || items.length === 0) return [];
            const ids = items.map(i => i.id);
            const { data, error } = await supabase
                .from('project_store_phases')
                .select('*')
                .in('store_item_id', ids);
            if (error) throw error;
            return (data as StorePhase[]) || [];
        },
        enabled: !!finalProject,
    });
}

/** Hook lấy phases của 1 store item */
export function useStorePhases(storeItemId?: string) {
    return useQuery<StorePhase[]>({
        queryKey: ['store_phases', storeItemId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_store_phases')
                .select('*')
                .eq('store_item_id', storeItemId!)
                .order('created_at');
            if (error) throw error;
            return (data as StorePhase[]) || [];
        },
        enabled: !!storeItemId,
    });
}

/** Hook lấy phases của nhiều store items (dùng cho bulk update) */
export function useStorePhasesBulk(storeItemIds: string[] = []) {
    return useQuery<StorePhase[]>({
        queryKey: ['store_phases_bulk', storeItemIds],
        queryFn: async () => {
            if (storeItemIds.length === 0) return [];
            const { data, error } = await supabase
                .from('project_store_phases')
                .select('*')
                .in('store_item_id', storeItemIds);
            if (error) throw error;
            return (data as StorePhase[]) || [];
        },
        enabled: storeItemIds.length > 0,
    });
}

/** Hook upsert 1 phase */
export function useUpsertStorePhase(finalProject: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (phase: StorePhase) => {
            const { error } = await supabase
                .from('project_store_phases')
                .upsert({
                    store_item_id: phase.store_item_id,
                    phase: phase.phase,
                    expected_start: phase.expected_start || null,
                    expected_end: phase.expected_end || null,
                    actual_date: phase.actual_date || null,
                    result: phase.result || null,
                    proof_links: phase.proof_links || [],
                    notes: phase.notes || null,
                    vis_tech: phase.vis_tech || null,
                }, { onConflict: 'store_item_id,phase' });
            if (error) throw error;

            // Log this action
            const actionType = 'PHASE_UPDATE';
            const fieldName = phase.phase; 
            let newValue = `Kế hoạch: ${phase.expected_start || '?'} - ${phase.expected_end || '?'}, Thực tế: ${phase.actual_date || '?'}, KQ: ${phase.result || '?'}`;
            if (phase.proof_links && phase.proof_links.length > 0) {
                newValue += `, Files: ${phase.proof_links.length}`;
            }

            await supabase.from('project_store_logs').insert({
                store_item_id: phase.store_item_id,
                action_type: actionType,
                field_name: fieldName,
                old_value: 'System Update',
                new_value: newValue,
            });
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['store_phases', vars.store_item_id] });
            queryClient.invalidateQueries({ queryKey: ['store_phases_bulk'] });
            queryClient.invalidateQueries({ queryKey: ['store_phases_project', finalProject] });
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            toast.success('Đã cập nhật tiến độ!');
        },
        onError: (err: any) => toast.error('Lỗi lưu tiến độ: ' + err.message),
    });
}

/** Hook bulk upsert nhiều stores cùng 1 lúc */
export function useBulkUpsertStorePhases(finalProject: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (phases: StorePhase[]) => {
            const { error } = await supabase
                .from('project_store_phases')
                .upsert(phases, { onConflict: 'store_item_id,phase' });
            if (error) throw error;

            // Log this action for all phases
            const logs = phases.map(p => {
                let newValue = `Kế hoạch: ${p.expected_start || '?'} - ${p.expected_end || '?'}, Thực tế: ${p.actual_date || '?'}, KQ: ${p.result || '?'}`;
                if (p.proof_links && p.proof_links.length > 0) {
                    newValue += `, Files: ${p.proof_links.length}`;
                }
                return {
                    store_item_id: p.store_item_id,
                    action_type: 'PHASE_UPDATE',
                    field_name: p.phase,
                    old_value: 'Bulk System Update',
                    new_value: newValue,
                };
            });
            await supabase.from('project_store_logs').insert(logs);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store_phases_project', finalProject] });
            queryClient.invalidateQueries({ queryKey: ['store_phases_bulk'] });
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            toast.success('Đã cập nhật tiến độ hàng loạt!');
        },
        onError: (err: any) => toast.error('Lỗi: ' + err.message),
    });
}
