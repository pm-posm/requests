import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoreItem } from '@/types';
import toast from 'react-hot-toast';

export function useStoreItemsData(finalProjectName: string, onlyPublished: boolean, activeTab: 'stores' | 'logs') {
    const queryClient = useQueryClient();

    // 1. Fetch Store Items
    const { data: storeItems, isLoading } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', finalProjectName, onlyPublished],
        queryFn: async () => {
            const query = supabase
                .from('project_store_items')
                .select('*')
                .eq('final_project', finalProjectName);
            
            if (onlyPublished) {
                query.eq('is_published', true);
            }
            const { data, error } = await query.order('store_code', { ascending: true });
            if (error) {
                toast.error('Lỗi khi tải danh sách cửa hàng: ' + error.message);
                throw error;
            }
            return data as StoreItem[] || [];
        }
    });

    // 2. Fetch Suppliers
    const { data: suppliers = [] } = useQuery<any[]>({
        queryKey: ['project_suppliers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_suppliers')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            return data || [];
        }
    });

    // 3. Fetch VIS-techs
    const { data: visTechs = [] } = useQuery<any[]>({
        queryKey: ['project_vis_techs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_vis_techs')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            return data || [];
        }
    });

    // 4. Fetch Logs
    const { data: logs = [], isLoading: isLoadingLogs } = useQuery<any[]>({
        queryKey: ['project_store_logs', finalProjectName],
        queryFn: async () => {
            const storeItemIds = storeItems?.map(s => s.id) || [];
            if (storeItemIds.length === 0) return [];
            
            const { data, error } = await supabase
                .from('project_store_logs')
                .select('*')
                .in('store_item_id', storeItemIds)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: activeTab === 'logs' && !!storeItems && storeItems.length > 0
    });

    // --- MUTATIONS ---
    const updateFieldMutation = useMutation({
        mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
            const { error } = await supabase
                .from('project_store_items')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProjectName] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs', finalProjectName] });
            toast.success('Cập nhật thành công');
        },
        onError: (err: any) => {
            toast.error('Cập nhật thất bại: ' + err.message);
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('project_store_items')
                .delete()
                .eq('id', id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Không thể xóa. Có thể do ràng buộc dữ liệu hoặc cửa hàng không tồn tại.');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProjectName] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs', finalProjectName] });
            toast.success('Đã xóa cửa hàng');
        },
        onError: (err: any) => {
            toast.error('Lỗi khi xóa: ' + err.message);
        }
    });

    // Master data manipulation mutations
    const addSupplierMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.from('project_suppliers').insert({ name });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_suppliers'] });
            toast.success('Đã thêm Nhà thầu');
        },
        onError: (err: any) => toast.error('Lỗi thêm Nhà thầu: ' + err.message)
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('project_suppliers').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_suppliers'] });
            toast.success('Đã xóa Nhà thầu');
        },
        onError: (err: any) => toast.error('Lỗi xóa Nhà thầu: ' + err.message)
    });

    const addVisTechMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.from('project_vis_techs').insert({ name });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_vis_techs'] });
            toast.success('Đã thêm Kỹ thuật viên');
        },
        onError: (err: any) => toast.error('Lỗi thêm Kỹ thuật viên: ' + err.message)
    });

    const deleteVisTechMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('project_vis_techs').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_vis_techs'] });
            toast.success('Đã xóa Kỹ thuật viên');
        },
        onError: (err: any) => toast.error('Lỗi xóa Kỹ thuật viên: ' + err.message)
    });

    // --- BULK ACTIONS ---
    const handleBulkVisTech = async (val: string) => {
        if (!val || !confirm(`Áp dụng Kỹ thuật viên "${val}" cho TẤT CẢ store?`)) return;
        const ids = (storeItems || []).map(i => i.id);
        const { error } = await supabase.from('project_store_items').update({ vis_tech: val }).in('id', ids);
        if (error) {
            toast.error('Lỗi: ' + error.message);
        } else {
            toast.success('Cập nhật loạt thành công');
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    };

    const handleBulkPhase = async (val: string) => {
        if (!val || !confirm(`Chuyển tiến độ TẤT CẢ store sang "${val}"?`)) return;
        const ids = (storeItems || []).map(i => i.id);
        
        toast.promise(
            Promise.all(ids.map(async id => {
                const item = (storeItems || []).find(i => i.id === id);
                if (item) {
                    await supabase
                        .from('project_store_items')
                        .update({ survey_data: { ...(item.survey_data || {}), current_phase: val }, updated_at: new Date().toISOString() })
                        .eq('id', id);
                        
                    await supabase.from('project_store_logs').insert({
                        store_item_id: item.id,
                        store_code: item.store_code,
                        action_type: 'PHASE_UPDATE',
                        field_name: val,
                        new_value: 'Cập nhật hàng loạt qua Header'
                    });
                }
            })),
            {
                loading: 'Đang cập nhật loạt tiến độ...',
                success: 'Cập nhật tiến độ thành công!',
                error: 'Cập nhật loạt thất bại'
            }
        ).then(() => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs'] });
        });
    };

    const handleBulkCategory = async (val: string) => {
        if (!val || !confirm(`Áp dụng SR (Hạng mục) "${val}" cho TẤT CẢ store?`)) return;
        const ids = (storeItems || []).map(i => i.id);
        const { error } = await supabase.from('project_store_items').update({ category: val }).in('id', ids);
        if (error) {
            toast.error('Lỗi: ' + error.message);
        } else {
            toast.success('Cập nhật loạt SR thành công');
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    };

    const handleBulkSupplier = async (supplierName: string) => {
        if (!supplierName) return;
        if (!confirm(`Áp dụng nhà thầu "${supplierName}" cho TẤT CẢ store?`)) return;
        
        const ids = (storeItems || []).map(item => item.id);
        const { error } = await supabase.from('project_store_items').update({ supplier_name: supplierName }).in('id', ids);
        if (error) {
            toast.error('Lỗi: ' + error.message);
        } else {
            toast.success('Cập nhật nhà thầu hàng loạt thành công');
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    };

    return {
        storeItems,
        isLoading,
        suppliers,
        visTechs,
        logs,
        isLoadingLogs,
        updateFieldMutation,
        deleteItemMutation,
        addSupplierMutation,
        deleteSupplierMutation,
        addVisTechMutation,
        deleteVisTechMutation,
        handleBulkVisTech,
        handleBulkPhase,
        handleBulkCategory,
        handleBulkSupplier
    };
}
