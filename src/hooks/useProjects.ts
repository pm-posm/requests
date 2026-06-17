import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Project {
  id: string;
  source_key: string;
  request_id: string;
  final_key: string;
  detected_key: string;
  progress_note: string; // The backend uses progress_note
  timeline: string;
  store_name: string;
  store_code: string;
  mer: string;
  sr: string;
  normalized_project_name: string;
  plan_option: string;
  status: string;
  data_responser: string;
  created_at: string;
}

export function useProjects() {
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
    refetchInterval: 10000, // Tự động refetch mỗi 10s để hiển thị real-time giả lập
  });
}



export function useUpdateProjectProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, progress_note }: { id: string; progress_note: string }) => {
      const { data, error } = await supabase
        .from('posm_projects')
        .update({ progress_note })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Làm mới dữ liệu projects sau khi update
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
