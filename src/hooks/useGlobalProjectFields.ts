import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface GlobalProjectField {
    id: string;
    field_name: string;
    field_key: string;
    field_type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown';
    options?: string[];
    is_required: boolean;
    order_index: number;
}

export const GLOBAL_PROJECT_LIST_ID = 'GLOBAL_PROJECT_LIST';

export function useGlobalProjectFields() {
    const queryClient = useQueryClient();

    const { data: fields = [], isLoading: isLoadingFields } = useQuery({
        queryKey: ['global_project_custom_fields'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_custom_fields')
                .select('*')
                .eq('project_id', GLOBAL_PROJECT_LIST_ID)
                .order('order_index', { ascending: true });
            
            if (error) throw error;
            return data as GlobalProjectField[];
        }
    });

    const addFieldMutation = useMutation({
        mutationFn: async (newField: Omit<GlobalProjectField, 'id' | 'order_index'>) => {
            const { data, error } = await supabase
                .from('project_custom_fields')
                .insert([{
                    ...newField,
                    project_id: GLOBAL_PROJECT_LIST_ID,
                    order_index: fields.length
                }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['global_project_custom_fields'] });
        }
    });

    const deleteFieldMutation = useMutation({
        mutationFn: async (fieldId: string) => {
            const { error } = await supabase
                .from('project_custom_fields')
                .delete()
                .eq('id', fieldId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['global_project_custom_fields'] });
        }
    });

    return {
        fields,
        isLoadingFields,
        addField: addFieldMutation.mutateAsync,
        deleteField: deleteFieldMutation.mutateAsync
    };
}

export function useGlobalProjectCustomData() {
    const queryClient = useQueryClient();

    const { data: customDataMap = {}, isLoading } = useQuery({
        queryKey: ['global_project_custom_data'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('global_project_custom_data')
                .select('*');
            
            if (error) throw error;
            
            const map: Record<string, any> = {};
            data.forEach(item => {
                map[item.final_project] = item.custom_properties || {};
            });
            return map;
        }
    });

    const updateDataMutation = useMutation({
        mutationFn: async ({ finalProject, fieldKey, value }: { finalProject: string, fieldKey: string, value: any }) => {
            // Lấy dữ liệu hiện tại (nếu có)
            const { data: current, error: fetchErr } = await supabase
                .from('global_project_custom_data')
                .select('custom_properties')
                .eq('final_project', finalProject)
                .maybeSingle();

            if (fetchErr) throw fetchErr;

            const newProps = current?.custom_properties ? { ...current.custom_properties } : {};
            newProps[fieldKey] = value;

            const { error: upsertErr } = await supabase
                .from('global_project_custom_data')
                .upsert({
                    final_project: finalProject,
                    custom_properties: newProps,
                    updated_at: new Date().toISOString()
                });

            if (upsertErr) throw upsertErr;
            return { finalProject, newProps };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['global_project_custom_data'] });
        }
    });

    return {
        customDataMap,
        isLoading,
        updateField: updateDataMutation.mutateAsync
    };
}
