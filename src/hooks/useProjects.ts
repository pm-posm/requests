import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Project {
  id: string;
  source_key: string;
  request_id: string;
  final_key: string;
  detected_key: string;
  source_project_name: string;
  normalized_project_name: string;
  detected_name_project?: string;
  store_code: string;
  store_name: string;
  status: string;
  progress_note: string;
  final_progress?: string;
  progress_note_source?: string;
  timeline: string;
  plan_option: string;
  data_responser?: string;
  mer?: string;
  sr?: string;
  supplier?: string;
  detected_supplier?: string;
  vis_note?: string;
  sr_note?: string;
  created_at: string;
  sheet_row_index?: number;
  request_date?: string;
}

export function useProjects() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    const channel = supabase.channel('posm-projects-realtime-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posm_projects'
        },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posm_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('posm_projects')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}


