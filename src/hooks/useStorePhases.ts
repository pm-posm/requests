import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StorePhase, PhaseStatus } from '@/types';
import toast from 'react-hot-toast';

/** Tính toán trạng thái của một phase dựa trên ngày kế hoạch và kết quả */
export function computePhaseStatus(phase?: StorePhase | null): { status: PhaseStatus; label: string; isLate: boolean } {
    if (!phase) {
        return { status: 'unscheduled', label: 'Chưa lên lịch', isLate: false };
    }
    if (phase.result === 'pass') {
        return { status: 'completed', label: 'Hoàn tất', isLate: false };
    }
    if (phase.result === 'fail') {
        return { status: 'error', label: 'Lỗi', isLate: false };
    }
    if (phase.result === 'pending_review') {
        return { status: 'pending_review', label: 'Chờ duyệt', isLate: false };
    }
    if (phase.result === 'on_hold') {
        return { status: 'on_hold', label: 'Tạm dừng', isLate: false };
    }
    if (!phase.expected_start) {
        return { status: 'unscheduled', label: 'Chưa lên lịch', isLate: false };
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

/** Trả về danh sách phase hợp lệ dựa theo Quyết định Dự án (Decision Engine) */
export function getValidPhasesForDecision(decisionStatus?: string): StorePhase['phase'][] {
    const status = (decisionStatus || '').toLowerCase();
    if (status.includes('thu hồi hoàn toàn') || status.includes('tháo dỡ')) {
        return ['Brief', 'Khảo sát']; // Rút gọn 2 bước cho việc thu hồi
    }
    return ['Brief', 'Khảo sát', 'NTXX', 'Lắp đặt']; // Full 4 bước
}

/** Tự động tính ngày kết thúc dự kiến theo công thức SLA mặc định */
export function calculateAutoSlaEnd(startDateStr: string, phase: StorePhase['phase']): string {
    if (!startDateStr) return '';
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return '';

    const slaDaysMap: Record<string, number> = {
        'Brief': 2,
        'Khảo sát': 3,
        'NTXX': 5,
        'Lắp đặt': 3
    };
    const addDays = slaDaysMap[phase] || 3;
    date.setDate(date.getDate() + addDays);
    return date.toISOString().split('T')[0];
}

/** Kiểm tra sai lệch kích thước giữa Khảo sát vs Brief Spec (> 5% cảnh báo) */
export function checkDimensionVariance(briefSpec?: string | null, surveySpec?: string | null): { hasVariance: boolean; variancePercent: number; isHighRisk: boolean } {
    if (!briefSpec || !surveySpec) {
        return { hasVariance: false, variancePercent: 0, isHighRisk: false };
    }
    const extractNum = (str: string) => {
        const nums = str.match(/\d+([.,]\d+)?/g);
        return nums ? nums.map(n => parseFloat(n.replace(',', '.'))) : [];
    };
    const briefNums = extractNum(briefSpec);
    const surveyNums = extractNum(surveySpec);
    if (briefNums.length === 0 || surveyNums.length === 0) {
        return { hasVariance: false, variancePercent: 0, isHighRisk: false };
    }
    const bVal = briefNums[0];
    const sVal = surveyNums[0];
    if (bVal === 0) return { hasVariance: false, variancePercent: 0, isHighRisk: false };
    
    const diff = Math.abs(sVal - bVal);
    const percent = Math.round((diff / bVal) * 100);
    const isHighRisk = percent > 5;
    return { hasVariance: isHighRisk, variancePercent: percent, isHighRisk };
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
            // Read existing phase to capture old_value for logging
            const { data: existingData } = await supabase
                .from('project_store_phases')
                .select('*')
                .eq('store_item_id', phase.store_item_id)
                .eq('phase', phase.phase)
                .maybeSingle();

            const oldValStr = existingData 
                ? `Kế hoạch: ${existingData.expected_start || '?'} - ${existingData.expected_end || '?'}, Thực tế: ${existingData.actual_date || '?'}, KQ: ${existingData.result || '?'}`
                : 'Chưa có dữ liệu';

            const payloadWithExtra: any = {
                store_item_id: phase.store_item_id,
                phase: phase.phase,
                expected_start: phase.expected_start || null,
                expected_end: phase.expected_end || null,
                actual_date: phase.actual_date || null,
                result: phase.result || null,
                proof_links: phase.proof_links || [],
                notes: phase.notes || null,
                vis_tech: phase.vis_tech || null,
            };
            if (phase.fail_reason) payloadWithExtra.fail_reason = phase.fail_reason;
            if (phase.updated_by) payloadWithExtra.updated_by = phase.updated_by;

            let { error } = await supabase
                .from('project_store_phases')
                .upsert(payloadWithExtra, { onConflict: 'store_item_id,phase' });

            // If schema cache error occurs because columns don't exist yet on DB, fallback without them
            if (error && error.message?.includes('schema cache')) {
                delete payloadWithExtra.fail_reason;
                delete payloadWithExtra.updated_by;
                const retryRes = await supabase
                    .from('project_store_phases')
                    .upsert(payloadWithExtra, { onConflict: 'store_item_id,phase' });
                error = retryRes.error;
            }

            if (error) throw error;

            // Log this action
            const actionType = 'PHASE_UPDATE';
            const fieldName = phase.phase; 
            let newValue = `Kế hoạch: ${phase.expected_start || '?'} - ${phase.expected_end || '?'}, Thực tế: ${phase.actual_date || '?'}, KQ: ${phase.result || '?'}`;
            if (phase.fail_reason) {
                newValue += `, Lý do lỗi: ${phase.fail_reason}`;
            }
            if (phase.updated_by) {
                newValue += `, Người thực hiện: ${phase.updated_by}`;
            }
            if (phase.proof_links && phase.proof_links.length > 0) {
                newValue += `, Files: ${phase.proof_links.length}`;
            }

            await supabase.from('project_store_logs').insert({
                store_item_id: phase.store_item_id,
                action_type: actionType,
                field_name: fieldName,
                old_value: oldValStr,
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
            // Read existing data for bulk logging
            const storeIds = phases.map(p => p.store_item_id);
            const { data: existingData } = await supabase
                .from('project_store_phases')
                .select('*')
                .in('store_item_id', storeIds);

            const existingMap = new Map<string, StorePhase>();
            (existingData || []).forEach(e => {
                existingMap.set(`${e.store_item_id}_${e.phase}`, e as StorePhase);
            });

            const cleanPhases = phases.map(p => {
                const itemPayload: any = {
                    store_item_id: p.store_item_id,
                    phase: p.phase,
                    expected_start: p.expected_start || null,
                    expected_end: p.expected_end || null,
                    actual_date: p.actual_date || null,
                    result: p.result || null,
                    proof_links: p.proof_links || [],
                    notes: p.notes || null,
                    vis_tech: p.vis_tech || null,
                };
                if (p.fail_reason) itemPayload.fail_reason = p.fail_reason;
                if (p.updated_by) itemPayload.updated_by = p.updated_by;
                return itemPayload;
            });

            let { error } = await supabase
                .from('project_store_phases')
                .upsert(cleanPhases, { onConflict: 'store_item_id,phase' });

            if (error && error.message?.includes('schema cache')) {
                const fallbackPhases = cleanPhases.map(cp => {
                    const { fail_reason, updated_by, ...rest } = cp;
                    return rest;
                });
                const retryRes = await supabase
                    .from('project_store_phases')
                    .upsert(fallbackPhases, { onConflict: 'store_item_id,phase' });
                error = retryRes.error;
            }

            if (error) throw error;

            // Log this action for all phases
            const logs = phases.map(p => {
                const existing = existingMap.get(`${p.store_item_id}_${p.phase}`);
                const oldValStr = existing
                    ? `Kế hoạch: ${existing.expected_start || '?'} - ${existing.expected_end || '?'}, KQ: ${existing.result || '?'}`
                    : 'Chưa có dữ liệu';

                let newValue = `Kế hoạch: ${p.expected_start || '?'} - ${p.expected_end || '?'}, Thực tế: ${p.actual_date || '?'}, KQ: ${p.result || '?'}`;
                if (p.proof_links && p.proof_links.length > 0) {
                    newValue += `, Files: ${p.proof_links.length}`;
                }
                return {
                    store_item_id: p.store_item_id,
                    action_type: 'PHASE_UPDATE',
                    field_name: p.phase,
                    old_value: oldValStr,
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
