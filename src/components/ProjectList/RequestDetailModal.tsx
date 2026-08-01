import React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { X, FileText, Calendar, Building2, Tag, Truck, User, Copy, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestDetailModalProps {
  requestId: string | null;
  onClose: () => void;
}

export function RequestDetailModal({ requestId, onClose }: RequestDetailModalProps) {
  const isOpen = Boolean(requestId);

  // Fetch full details of the clicked Request from Supabase raw_requests table
  const { data: requestDetails = [], isLoading } = useQuery({
    queryKey: ['request_detail_by_id', requestId],
    enabled: Boolean(requestId),
    queryFn: async () => {
      if (!requestId) return [];
      
      // Query raw_requests or posm_projects by request_id
      const { data, error } = await supabase
        .from('raw_requests')
        .select('*')
        .or(`request_id.eq.${requestId},sheet_row_index.eq.${requestId}`)
        .eq('is_deleted_in_sheet', false);

      if (error || !data || data.length === 0) {
        // Fallback search in posm_projects
        const { data: posmData } = await supabase
          .from('posm_projects')
          .select('*')
          .eq('request_id', requestId);
        return posmData || [];
      }
      return data || [];
    }
  });

  if (!isOpen || !requestId) return null;

  const mainRequest = requestDetails[0] || null;

  const copyRequestId = () => {
    navigator.clipboard.writeText(requestId);
    toast.success(`Đã sao chép Request ID: ${requestId}`);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        
        {/* MODAL HEADER */}
        <div className="p-5 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 border-b border-purple-100 dark:border-purple-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-950/80 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  Chi tiết Subtask / Request ID
                </span>
                <button
                  onClick={copyRequestId}
                  className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Sao chép Mã Request"
                >
                  <Copy className="w-3 h-3" />
                  <span>#{requestId}</span>
                </button>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {mainRequest?.project_name || mainRequest?.normalized_project_name || `Request ID #${requestId}`}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <span className="text-xs font-semibold">Đang tải thông tin chi tiết Request #{requestId}...</span>
            </div>
          ) : !mainRequest ? (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-slate-500 text-xs">
              Không tìm thấy thông tin chi tiết của Request ID <strong>#{requestId}</strong> trong cơ sở dữ liệu.
            </div>
          ) : (
            <>
              {/* METRICS CARD GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                
                {/* Ngày Request */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-500" /> Ngày Request
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {mainRequest.request_date || mainRequest.created_at ? new Date(mainRequest.request_date || mainRequest.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </span>
                </div>

                {/* Khách hàng / Hệ thống */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-500" /> Hệ thống / Khách
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {mainRequest.customer || mainRequest.system || 'N/A'}
                  </span>
                </div>

                {/* Loại hình POSM */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Tag className="w-3 h-3 text-violet-500" /> Loại POSM
                  </span>
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                    {mainRequest.posm_type || mainRequest.plan_option || 'N/A'}
                  </span>
                </div>

                {/* Supplier */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Truck className="w-3 h-3 text-emerald-500" /> Supplier
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {mainRequest.supplier || mainRequest.detected_supplier || 'N/A'}
                  </span>
                </div>

                {/* Phụ trách MER */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <User className="w-3 h-3 text-sky-500" /> Phụ trách MER
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {mainRequest.mer || 'N/A'}
                  </span>
                </div>

                {/* Phụ trách SR */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-500" /> Phụ trách SR
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {mainRequest.sr || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Ghi chú & Phản hồi Data Responser */}
              {mainRequest.data_responser && (
                <div className="p-4 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1">
                  <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                    💬 Ghi Chú Phản Hồi Dữ Liệu (Data Responser):
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {mainRequest.data_responser}
                  </p>
                </div>
              )}

              {/* Danh Sách Cửa Hàng Liên Quan Đến Request Này */}
              {requestDetails.length > 1 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Danh Sách Cửa Hàng Thuộc Request ({requestDetails.length} store):
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {requestDetails.map((req, idx) => (
                      <div key={req.id || idx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{req.store_code || `Store #${idx + 1}`}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{req.store_name || ''}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">{req.supplier || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={copyRequestId}
            className="px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao chép ID</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
