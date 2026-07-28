import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { 
  X, Check, ExternalLink, Calendar, Layers, Tag, ShieldCheck, Link2, 
  Search, FileText, CheckCircle2, Info, Loader2, Clock, Mail, Send, 
  Building2, User, AlertTriangle, Copy, Wrench, Save, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDashboardStore } from '@/stores/useDashboardStore';

// Deployed Web App URL for Apps Script Reverse Sync
const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx9o84Ow7r9XmvUJ1pv9hYCdZFMOXFljPDTP9Snbf4N0pyEhel-GSvSVuHJ8mt-p8pc/exec';

// Official Progress Options strictly matching Column Q on BaoHanh_Model & Column Y on Mer View 2026
const WARRANTY_PROGRESS_OPTIONS = [
  'Not started',
  'Vis - Đã gửi RQ tới Agency',
  'Tiếp nhận / Đang xử lý',
  'Hoàn thành',
  'Cancelled'
];

// Official Warranty Coverage Options matching Column O on BaoHanh_Model
const WARRANTY_COVERAGE_OPTIONS = [
  'Trong phạm vi bảo hành',
  'Ngoài phạm vi bảo hành'
];

interface WarrantySubtaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RawRequestRecord | null;
  onSave: (recordId: string, updates: Partial<RawRequestRecord>) => Promise<any> | void;
}

interface AuditLogEntry {
  id?: string;
  subtask_id: string;
  action_text: string;
  created_at: string;
}

export function WarrantySubtaskModal({ isOpen, onClose, record, onSave }: WarrantySubtaskModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [requestId, setRequestId] = useState('');
  const [maDuAn, setMaDuAn] = useState('');
  const [supplier, setSupplier] = useState('');
  const [titleEmail, setTitleEmail] = useState('');
  const [tienDo, setTienDo] = useState('Not started');
  const [installationDate, setInstallationDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [note, setNote] = useState('');
  const [warrantyCoverage, setWarrantyCoverage] = useState('Trong phạm vi bảo hành');
  const [warrantyCost, setWarrantyCost] = useState('Miễn phí');

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Email Modal States inside Warranty Subtask
  const [isMailDrawerOpen, setIsMailDrawerOpen] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailCc, setMailCc] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailValidationErr, setMailValidationErr] = useState<string | null>(null);
  const [mailSuccessMsg, setMailSuccessMsg] = useState<string | null>(null);

  // Search Autocomplete State for Master Project
  const [searchPrjText, setSearchPrjText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Query Master Project Overviews for Autocomplete
  const { data: projectOverviews = [] } = useQuery({
    queryKey: ['project_overviews_rpc_warranty_subtask'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_overviews');
      if (error) return [];
      return data || [];
    }
  });

  // Query Audit Logs for this Warranty Subtask
  const { data: auditLogs = [], refetch: refetchAuditLogs } = useQuery<AuditLogEntry[]>({
    queryKey: ['warranty_subtask_audit_logs', record?.id || record?.request_id],
    queryFn: async () => {
      if (!record?.id && !record?.request_id) return [];
      const subtaskId = record.request_id || record.id || '';
      const { data, error } = await supabase
        .from('subtask_audit_logs')
        .select('*')
        .eq('subtask_id', subtaskId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!record
  });

  useEffect(() => {
    if (record) {
      const rowIdNum = record.sheet_row_index || parseInt(String(record.id || '').replace(/\D/g, ''), 10) || '';
      const reqIdDefault = record.request_id || (rowIdNum ? `BH-${rowIdNum}` : 'BH-000');
      
      setRequestId(reqIdDefault);
      const prj = record.ma_du_an || '';
      setMaDuAn(prj);
      setSearchPrjText(prj);
      setSupplier(record.supplier || '');
      setTitleEmail(record.title_email_request || '');
      setTienDo(record.tien_do || 'Not started');
      setErrorDetail(record.sr_note || '');
      setNote(record.mer_note || record.vis_note || '');
    }
  }, [record]);

  // Dynamic dropdown list for Tiến Độ (Progress) matching Sheet BaoHanh_Model Column Q
  const dynamicProgressOptions = useMemo(() => {
    const set = new Set<string>();
    WARRANTY_PROGRESS_OPTIONS.forEach(s => set.add(s));
    if (tienDo) set.add(tienDo);
    return Array.from(set);
  }, [tienDo]);

  // Dynamic dropdown list for Phạm Vi Bảo Hành matching Sheet BaoHanh_Model Column O
  const dynamicCoverageOptions = useMemo(() => {
    const set = new Set<string>();
    WARRANTY_COVERAGE_OPTIONS.forEach(c => set.add(c));
    if (warrantyCoverage) set.add(warrantyCoverage);
    return Array.from(set);
  }, [warrantyCoverage]);

  // Click outside listener for project suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const projectSuggestions = useMemo(() => {
    if (!searchPrjText.trim()) return [];
    const term = searchPrjText.toLowerCase().trim();
    return projectOverviews.filter((p: any) => 
      (p.final_project || '').toLowerCase().includes(term)
    ).slice(0, 8);
  }, [projectOverviews, searchPrjText]);

  const matchedMasterProject = useMemo(() => {
    if (!maDuAn.trim()) return null;
    return projectOverviews.find((p: any) => p.final_project.toLowerCase().trim() === maDuAn.toLowerCase().trim()) || null;
  }, [projectOverviews, maDuAn]);

  if (!isOpen || !record) return null;

  const handleSelectSuggestion = (prjCode: string) => {
    setMaDuAn(prjCode);
    setSearchPrjText(prjCode);
    setShowSuggestions(false);
  };

  // Open Email Draft Form inside Subtask
  const handleOpenEmailComposer = () => {
    setMailValidationErr(null);
    setMailSuccessMsg(null);

    const hasProjectCode = maDuAn && maDuAn.trim() !== '';
    const hasSupplier = supplier && supplier.trim() !== '';

    if (!hasProjectCode || !hasSupplier) {
      const missing = [];
      if (!hasProjectCode) missing.push('Mã dự án');
      if (!hasSupplier) missing.push('Supplier');
      setMailValidationErr(`⚠️ Vui lòng nhập đầy đủ [${missing.join(', ')}] trên Subtask trước khi gửi mail!`);
    }

    const standardSubject = titleEmail || `[Bảo hành]-[${requestId}]: ${maDuAn || '[Mã + Tên dự án]'}`;
    const defaultTo = supplier ? `${supplier.toLowerCase().replace(/\s+/g, '')}@supplier.com` : '';
    const defaultCc = 'vis.tech@unilever.com';

    const body = `Kính gửi Nhà Cung Cấp ${supplier || '[Tên Supplier]'},\n\nHệ thống POSM Unilever gửi thông báo sự cố & yêu cầu khắc phục bảo hành như sau:\n\n📌 THÔNG TIN SUBTASK BẢO HÀNH:\n- Mã Request: ${requestId}\n- Cửa hàng: ${record.store_name} (Mã Store: ${record.ess_store_code || 'N/A'})\n- Quản lý POSM (VIS-Tech): ${record.mer || 'Chưa rõ'}\n- Nhân sự SR: ${record.sr || 'N/A'}\n- Hạng mục POSM: ${record.posm} - Brand: ${record.brand} (Ngành: ${record.cat})\n- Mã dự án: ${maDuAn || 'N/A'}\n\n🚨 CHI TIẾT SỰ CỐ:\n${errorDetail || record.sr_note || 'Chưa có mô tả'}\n\nRất mong Quý Nhà Thầu nhanh chóng kiểm tra và phản hồi ngày xử lý dự kiến.\n\nTrân trọng,\nTeam Visibility Unilever.`;

    setMailTo(defaultTo);
    setMailCc(defaultCc);
    setMailSubject(standardSubject);
    setMailBody(body);
    setIsMailDrawerOpen(true);
  };

  // Trigger Open Email Client (No Auto-Save)
  const handleTriggerGmailWeb = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailTo)}&cc=${encodeURIComponent(mailCc)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.open(url, '_blank');
  };

  const handleTriggerMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(mailTo)}?cc=${encodeURIComponent(mailCc)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.location.href = mailtoUrl;
  };

  // Explicit Confirm Mail Sent & Trigger Sync
  const handleConfirmMailSent = async () => {
    const timestamp = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    const finalSubject = mailSubject.trim();
    setTitleEmail(finalSubject);
    setTienDo('Vis - Đã gửi RQ tới Agency');

    // Trigger multi-channel HTTP GET/POST to Web App API
    const targetUrl = localStorage.getItem('warranty_web_app_url') || DEFAULT_WEB_APP_URL;
    try {
      setIsSyncingSheet(true);
      const rowIdNum = record.sheet_row_index || record.id;
      const queryParams = new URLSearchParams({
        rowId: String(rowIdNum),
        requestId: requestId,
        titleMail: finalSubject,
        raiseMailTime: timestamp,
        projectCode: maDuAn,
        supplier: supplier,
        progress: 'Vis - Đã gửi RQ tới Agency'
      }).toString();

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          rowId: rowIdNum,
          requestId: requestId,
          titleMail: finalSubject,
          raiseMailTime: timestamp,
          projectCode: maDuAn,
          supplier: supplier,
          progress: 'Vis - Đã gửi RQ tới Agency'
        })
      });

      setMailSuccessMsg(`🟢 Đã ghi nhận Title Mail & tự động bắn dữ liệu sang BaoHanh_Model & Mer View 2026!`);
      toast.success('Đã xác nhận gửi mail & đồng bộ Sheet!');
    } catch (err: any) {
      toast.error('Lỗi khi sync Sheet: ' + err.message);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Main Save Subtask Function (Updates DB + Calls Web App 2-way Sync)
  const handleSaveSubtask = async () => {
    const { isAdmin } = useDashboardStore.getState();
    if (!isAdmin) {
      toast.error('🔒 Quyền bị từ chối: Vui lòng đăng nhập tài khoản Admin để lưu thay đổi!');
      return;
    }
    setIsSaving(true);
    try {
      const updates: Partial<RawRequestRecord> = {
        request_id: requestId.trim() || undefined,
        ma_du_an: maDuAn.trim() || undefined,
        supplier: supplier.trim() || undefined,
        title_email_request: titleEmail.trim() || undefined,
        phuong_an: 'Supplier Bảo Hành',
        status: tienDo.toLowerCase() === 'cancelled' ? 'Cancelled' : 'Supplier Bảo Hành',
        tien_do: tienDo,
        mer_note: note.trim() || undefined
      };

      await onSave(record.id!, updates);

      // Audit Log
      const subtaskId = requestId || record.id || '';
      await supabase.from('subtask_audit_logs').insert({
        subtask_id: subtaskId,
        action_text: `Cập nhật Subtask Bảo hành: Tiến độ -> ${tienDo}, Supplier -> ${supplier || 'N/A'}, Mã PJ -> ${maDuAn || 'N/A'}`
      });

      // 2-way Web App Sync to Google Sheets
      const targetUrl = localStorage.getItem('warranty_web_app_url') || DEFAULT_WEB_APP_URL;
      const rowIdNum = record.sheet_row_index || record.id;

      const queryParams = new URLSearchParams({
        rowId: String(rowIdNum),
        requestId: requestId,
        projectCode: maDuAn,
        supplier: supplier,
        progress: tienDo,
        titleMail: titleEmail,
        expectedDate: expectedDate,
        completedDate: completedDate,
        warrantyCoverage: warrantyCoverage,
        warrantyCost: warrantyCost,
        note: note
      }).toString();

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          rowId: rowIdNum,
          requestId: requestId,
          projectCode: maDuAn,
          supplier: supplier,
          progress: tienDo,
          titleMail: titleEmail,
          expectedDate: expectedDate,
          completedDate: completedDate,
          warrantyCoverage: warrantyCoverage,
          warrantyCost: warrantyCost,
          note: note
        })
      });

      toast.success(`🟢 Đã lưu Subtask Bảo hành ${requestId} & đồng bộ 2 chiều về BaoHanh_Model và Mer View 2026!`);
      refetchAuditLogs();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-sky-50/50 dark:bg-sky-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                🛡️ Subtask Bảo Hành / Đổi Trả ({requestId})
              </h2>
              <p className="text-xs text-slate-500">
                {record.store_name} ({record.ess_store_code}) • VIS-Tech: {record.mer || 'N/A'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto custom-scrollbar">
          
          {/* SECTION 1: STORE & POSM OVERVIEW (READONLY) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-700 dark:text-slate-300">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cửa hàng</span>
                <span className="font-semibold">{record.store_name}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Hạng mục POSM</span>
                <span className="font-semibold text-sky-700 dark:text-sky-300">{record.posm}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Brand / CAT</span>
                <span className="font-semibold">{record.brand} ({record.cat})</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ngày Yêu Cầu</span>
                <span className="font-semibold">{record.date_of_rq || 'Chưa rõ'}</span>
              </div>
            </div>
            {record.sr_note && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <span className="text-[10px] uppercase font-bold text-amber-600 block">🚨 Chi tiết sự cố POSM:</span>
                <p className="italic">{record.sr_note}</p>
              </div>
            )}
          </div>

          {/* SECTION 2: EDITABLE SUBTASK FIELDS & MASTER PROJECT LINK */}
          <div className="space-y-3 p-4 bg-sky-50/30 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900">
            <h3 className="font-bold text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-sky-600" />
              Thông Tin Subtask Bảo Hành & Liên Kết Dự Án
            </h3>

            {/* Subtask Request ID & Supplier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">📋 Request ID Subtask (BH-xxx):</label>
                <input
                  type="text"
                  value={requestId}
                  onChange={e => setRequestId(e.target.value)}
                  placeholder="BH-635"
                  className="w-full font-mono font-bold text-sky-800 dark:text-sky-300 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">🏢 Supplier (Thầu Sản Xuất):</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="Link4, Smart, SDC..."
                  className="w-full font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Master Project Autocomplete Search */}
            <div className="space-y-1.5 relative" ref={dropdownRef}>
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-sky-600" />
                  Mã Dự Án / Tên Dự Án (Liên kết Master Project):
                </label>
                {matchedMasterProject && (
                  <button
                    onClick={() => { onClose(); navigate(`/project/${encodeURIComponent(maDuAn)}`); }}
                    className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Mở trang Dự án
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchPrjText}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={e => {
                    setSearchPrjText(e.target.value);
                    setMaDuAn(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Nhập Mã dự án (VD: 118420U01-U10) hoặc dán Tên dự án..."
                  className="w-full bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-sky-900 dark:text-sky-200 outline-none focus:ring-2 focus:ring-sky-500"
                />

                {showSuggestions && searchPrjText.trim() !== '' && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {projectSuggestions.length === 0 ? (
                      <div className="p-3 text-slate-400 text-center italic text-xs">
                        Chưa tìm thấy dự án sẵn có. Mã này sẽ được lưu trực tiếp trên Subtask!
                      </div>
                    ) : (
                      projectSuggestions.map((p: any) => (
                        <div
                          key={p.final_project}
                          onClick={() => handleSelectSuggestion(p.final_project)}
                          className="p-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/60 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="font-bold text-sky-700 dark:text-sky-300 truncate text-xs">
                            🏷️ {p.final_project}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                            {p.store_count || 0} stores
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tiến Độ Bảo Hành:
                </label>
                <select
                  value={tienDo}
                  onChange={e => setTienDo(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 text-xs font-bold text-sky-800 dark:text-sky-300 cursor-pointer"
                >
                  {dynamicProgressOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Phạm Vi Bảo Hành:
                </label>
                <select
                  value={warrantyCoverage}
                  onChange={e => setWarrantyCoverage(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                >
                  {dynamicCoverageOptions.map(cov => (
                    <option key={cov} value={cov}>{cov}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Chi Phí Bảo Hành:
                </label>
                <select
                  value={warrantyCost}
                  onChange={e => setWarrantyCost(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="Miễn phí">Miễn phí (Theo hợp đồng)</option>
                  <option value="Có tính phí">Có tính phí phát sinh</option>
                </select>
              </div>
            </div>

            {/* Dates & Timeline Section */}
            <div className="space-y-2 pt-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                Theo Dõi Mốc Thời Gian Xử Lý:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Ngày gửi request */}
                <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="text-slate-500 font-semibold text-[11px] block">📅 Ngày gửi request:</label>
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">
                    {record.date_of_rq || 'Chưa ghi nhận'}
                  </span>
                </div>

                {/* 2. Deadline hoàn thành request */}
                <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="text-slate-500 font-semibold text-[11px] block">⏳ Deadline request:</label>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 block text-xs">
                    {record.deadline || record.ngay_quick_fix || 'Chưa có deadline'}
                  </span>
                </div>

                {/* 3. Ngày lắp đặt POSM */}
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">🛠️ Ngày lắp đặt POSM:</label>
                  <input
                    type="text"
                    value={installationDate}
                    onChange={e => setInstallationDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300"
                  />
                </div>

                {/* 4. Ngày hẹn xử lý dự kiến */}
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">⏰ Ngày hẹn xử lý dự kiến:</label>
                  <input
                    type="text"
                    value={expectedDate}
                    onChange={e => setExpectedDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-amber-600"
                  />
                </div>

                {/* 5. Ngày hoàn thành thực tế */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">✅ Ngày hoàn thành thực tế:</label>
                  <input
                    type="text"
                    value={completedDate}
                    onChange={e => setCompletedDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: EMAIL RAISE FOR SUPPLIER */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-600" />
                Email Raise Mail Supplier (Title Mail)
              </h3>
              <button
                onClick={handleOpenEmailComposer}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Soạn Mail Raise</span>
              </button>
            </div>

            {titleEmail ? (
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center justify-between gap-2">
                <p className="font-mono text-slate-800 dark:text-slate-200 font-semibold truncate flex-1">{titleEmail}</p>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded shrink-0">
                  Đã ghi nhận Title Mail
                </span>
              </div>
            ) : (
              <p className="text-slate-400 italic text-[11px]">Chưa nhập tiêu đề email raise cho Supplier trên Subtask.</p>
            )}
          </div>

          {/* SECTION 4: AUDIT LOGS */}
          {auditLogs.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Lịch sử thay đổi Subtask ({auditLogs.length})
              </h4>
              <div className="max-h-28 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id || log.created_at} className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] flex items-start justify-between gap-2">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{log.action_text}</span>
                    <span className="text-slate-400 whitespace-nowrap text-[10px] font-mono">
                      {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">ID: {record.id || record.request_key}</span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Đóng
            </button>
            
            <button
              onClick={handleSaveSubtask}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Đang lưu & Sync Sheet...' : '💾 Lưu & Sync Trực Tiếp Về Google Sheet'}</span>
            </button>
          </div>
        </div>

        {/* EMAIL COMPOSER DRAWER INSIDE SUBTASK MODAL */}
        {isMailDrawerOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-600" />
                  Gửi Email Raise Bảo Hành Cho Supplier
                </h3>
                <button onClick={() => setIsMailDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {mailValidationErr && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{mailValidationErr}</span>
                </div>
              )}

              {mailSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{mailSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tiêu đề Email Chuẩn (Subject Format):</label>
                  <input
                    type="text"
                    value={mailSubject}
                    onChange={e => setMailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-sky-800 dark:text-sky-300 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nội dung Mail (Body):</label>
                  <textarea
                    rows={6}
                    value={mailBody}
                    onChange={e => setMailBody(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleConfirmMailSent}
                  disabled={!!mailValidationErr || isSyncingSheet}
                  className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSheet ? 'Đang sync Sheet...' : 'Xác Nhận Đã Gửi Mail'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerMailto}
                    disabled={!!mailValidationErr}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5 text-sky-600" />
                    <span>Outlook</span>
                  </button>
                  <button
                    onClick={handleTriggerGmailWeb}
                    disabled={!!mailValidationErr}
                    className="px-3.5 py-2 bg-sky-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gmail Web</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
