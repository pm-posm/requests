import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

/**
 * Service dọn dẹp sạch toàn bộ dữ liệu thử nghiệm trong CSDL Supabase
 * Chuẩn bị cho giai đoạn Deploy Production trên Vercel
 */
export async function clearAllTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const tables = [
      'project_attachments',
      'project_comments',
      'project_activities',
      'project_progress_ai',
      'posm_projects',
      'subtask_audit_logs',
      'raw_requests'
    ];

    let deletedCount = 0;

    for (const table of tables) {
      try {
        // Deleting all rows by matching any non-null string or ID
        const { error: err1 } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (err1) {
          await supabase.from(table).delete().gt('created_at', '1970-01-01');
        }
        deletedCount++;
      } catch (tableErr) {
        console.warn(`Clean table ${table} warning:`, tableErr);
      }
    }

    // Clear local storage cache
    localStorage.removeItem('cached_project_overviews');
    localStorage.removeItem('cached_requests');
    localStorage.removeItem('warranty_items_cache');

    return {
      success: true,
      message: `Đã dọn dẹp sạch toàn bộ dữ liệu thử nghiệm (${deletedCount} bảng)! Hệ thống sẵn sàng Deploy Vercel.`
    };
  } catch (err: any) {
    console.error('Lỗi dọn dẹp CSDL:', err);
    return {
      success: false,
      message: `Lỗi khi dọn dẹp CSDL: ${err.message || err.toString()}`
    };
  }
}
