import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoreItem, ProjectGroup } from '@/types';
import toast from 'react-hot-toast';

export function useStoreManager(projectGroup: ProjectGroup) {
    const queryClient = useQueryClient();
    const finalProject = projectGroup.final_project;

    // Store items query (all — includes draft)
    const { data: storeItems = [], isLoading } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', finalProject],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_store_items')
                .select('*')
                .eq('final_project', finalProject)
                .order('created_at');
            if (error) throw error;
            return (data as StoreItem[]) || [];
        },
    });

    // Lookup tables
    const { data: suppliers = [] } = useQuery<any[]>({
        queryKey: ['project_suppliers'],
        queryFn: async () => {
            const { data } = await supabase.from('project_suppliers').select('*').order('name');
            return data || [];
        },
    });

    const { data: visTechs = [] } = useQuery<any[]>({
        queryKey: ['project_vis_techs'],
        queryFn: async () => {
            const { data } = await supabase.from('project_vis_techs').select('*').order('name');
            return data || [];
        },
    });

    // Update single field mutation
    const updateFieldMutation = useMutation({
        mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
            const { error } = await supabase
                .from('project_store_items')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project_store_items'] }),
        onError: (err: any) => toast.error('Lỗi cập nhật: ' + err.message),
    });

    // Delete mutation
    const deleteItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase.from('project_store_items').delete().eq('id', id).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Không thể xóa. Có thể do ràng buộc dữ liệu hoặc cửa hàng không tồn tại.');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
            toast.success('Đã xóa cửa hàng!');
        },
        onError: (err: any) => toast.error('Lỗi xóa: ' + err.message),
    });

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            if (ids.length === 0) return;
            const { error } = await supabase.from('project_store_items').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
            toast.success('Đã xóa các cửa hàng được chọn!');
        },
        onError: (err: any) => toast.error('Lỗi xóa: ' + err.message),
    });

    // Add store manually
    const addStoreMutation = useMutation({
        mutationFn: async (store: Partial<StoreItem>) => {
            const { data, error } = await supabase.from('project_store_items').insert({
                ...store,
                final_project: finalProject,
                is_published: false,
            }).select();
            if (error) throw error;
            return data as StoreItem[];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
            toast.success('Đã thêm cửa hàng mới!');
        },
        onError: (err: any) => toast.error('Lỗi thêm store: ' + err.message),
    });

    // Publish all unpublished stores
    const publishAllMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('project_store_items')
                .update({ is_published: true })
                .eq('final_project', finalProject)
                .eq('is_published', false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
            toast.success('Đã công bố tất cả dữ liệu!');
        },
        onError: (err: any) => toast.error('Lỗi công bố: ' + err.message),
    });

    // Bulk assign helpers
    const bulkUpdate = async (field: string, value: any) => {
        if (!storeItems.length) return;
        await Promise.all(storeItems.map(item =>
            supabase.from('project_store_items').update({ [field]: value }).eq('id', item.id)
        ));
        queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        toast.success(`Đã gán ${field} hàng loạt!`);
    };

    const bulkUpdateSpecific = async (field: string, value: any, ids: string[]) => {
        if (!ids.length) return;
        const { error } = await supabase
            .from('project_store_items')
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .in('id', ids);
        
        if (error) {
            toast.error('Lỗi: ' + error.message);
            throw error;
        }
        
        queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        toast.success(`Đã cập nhật ${field} hàng loạt!`);
    };

    return {
        storeItems, isLoading,
        suppliers, visTechs,
        updateFieldMutation,        deleteItemMutation,
        bulkDeleteMutation,
        addStoreMutation, publishAllMutation,
        bulkUpdate, bulkUpdateSpecific
    };
}
