import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CustomField {
  id: string;
  project_id: string;
  field_name: string;
  field_key: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown';
  options?: any;
  is_required: boolean;
  order_index: number;
}

export function useCustomFields(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['custom-fields', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_custom_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as CustomField[];
    },
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (newField: Omit<CustomField, 'id'>) => {
      const { data, error } = await supabase
        .from('project_custom_fields')
        .insert(newField)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', projectId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (update: Partial<CustomField> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_custom_fields')
        .update(update)
        .eq('id', update.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_custom_fields')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', projectId] });
    },
  });

  return {
    fields: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createField: createMutation.mutateAsync,
    updateField: updateMutation.mutateAsync,
    deleteField: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
