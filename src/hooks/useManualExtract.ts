import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { ProjectGroup } from '@/types';

export function useManualExtract(
    projectGroup: ProjectGroup,
    selectedFile: { id: string; file_name: string; phase: string; drive_url?: string } | null,
    lastAddedStore: any,
    isExcel: boolean
) {
    const queryClient = useQueryClient();
    const [manualStores, setManualStores] = useState<any[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isSavingManual, setIsSavingManual] = useState(false);

    // Sync newly added manual store
    useEffect(() => {
        if (lastAddedStore && !isExcel) {
            setManualStores(prev => {
                const existingIdx = prev.findIndex(s => s.store_code === lastAddedStore.store_code);
                if (existingIdx === -1) {
                    setSelectedRows(r => new Set(r).add(prev.length));
                    return [...prev, lastAddedStore];
                }
                setSelectedRows(r => new Set(r).add(existingIdx));
                return prev;
            });
        }
    }, [lastAddedStore, isExcel, setSelectedRows]);

    const toggleRow = (idx: number) => {
        const next = new Set(selectedRows);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        setSelectedRows(next);
    };

    const handleSaveManual = async (overridePhase?: string) => {
        const validStores = manualStores.filter((_, i) => selectedRows.has(i));
        if (validStores.length === 0) {
            toast.error("Vui lòng chọn ít nhất 1 cửa hàng để lưu!");
            return;
        }

        setIsSavingManual(true);
        try {
            const phaseType = selectedFile?.phase || 'BRIEF';
            const phaseStr = overridePhase || (phaseType === 'SURVEY' ? 'Khảo sát' : phaseType === 'INSTALLATION' || phaseType === 'INSTALL' ? 'Lắp đặt' : phaseType === 'NTXX' ? 'NTXX' : 'Brief');
            
            const storeItemsToInsert = validStores.map(s => ({
                store_code: s.store_code,
                store_name: s.store_name,
                customer: s.customer || '',
                region: s.province || s.region || ''
            }));

            // Call the new RPC transaction
            const { error: rpcError } = await supabase.rpc('upsert_store_phases_transaction', {
                p_final_project: projectGroup.final_project,
                p_phase_type: phaseStr,
                p_proof_link: selectedFile?.drive_url || null,
                p_stores: storeItemsToInsert
            });

            if (rpcError) throw rpcError;

            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            queryClient.invalidateQueries({ queryKey: ['project_manual_files_phase'] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs_phase'] });
            
            toast.success(`Đã lưu và công bố thành công ${validStores.length} cửa hàng!`);
            setManualStores([]);
            setSelectedRows(new Set());
        } catch (err: any) {
            console.error(err);
            toast.error("Lỗi khi lưu dữ liệu: " + err.message);
        } finally {
            setIsSavingManual(false);
        }
    };

    return {
        manualStores,
        setManualStores,
        selectedRows,
        setSelectedRows,
        toggleRow,
        isSavingManual,
        handleSaveManual
    };
}
