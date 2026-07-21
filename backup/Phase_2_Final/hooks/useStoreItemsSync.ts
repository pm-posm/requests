import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoreItem } from '@/types';

export function useStoreItemsSync(finalProject: string, phaseType: string) {
    const queryClient = useQueryClient();

    // Query currently imported store items in database
    const { data: storeItems, isLoading } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', finalProject],
        queryFn: async () => {
            if (!finalProject) return [];
            const { data, error } = await supabase
                .from('project_store_items')
                .select('*')
                .eq('final_project', finalProject)
                .order('store_code', { ascending: true });
            
            if (error) throw error;
            return data as StoreItem[] || [];
        },
        enabled: !!finalProject
    });

    // Import store item mutation (Single/Upsert array)
    const importStoreMutation = useMutation({
        mutationFn: async (payload: Partial<StoreItem> | Partial<StoreItem>[]) => {
            const payloadArray = Array.isArray(payload) ? payload : [payload];
            if (payloadArray.length === 0) return;
            const { error } = await supabase
                .from('project_store_items')
                .upsert(payloadArray, { onConflict: 'final_project,store_code' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
        }
    });

    // Delete store item mutation
    const deleteItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('project_store_items').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', finalProject] });
        }
    });

    // Survey mutation
    const surveyMutation = useMutation({
        mutationFn: async ({ id, surveyData, bulkProject }: { id?: string, surveyData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ survey_data: surveyData }).eq('final_project', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ survey_data: surveyData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    });

    // Install mutation
    const installMutation = useMutation({
        mutationFn: async ({ id, installData, bulkProject }: { id?: string, installData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ installation_data: installData }).eq('final_project', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ installation_data: installData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    });

    // NTXX mutation
    const ntxxMutation = useMutation({
        mutationFn: async ({ id, ntxxData, bulkProject }: { id?: string, ntxxData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ ntxx_data: ntxxData }).eq('final_project', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ ntxx_data: ntxxData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        }
    });

    return {
        storeItems,
        isLoading,
        importStoreMutation,
        deleteItemMutation,
        surveyMutation,
        installMutation,
        ntxxMutation
    };
}
