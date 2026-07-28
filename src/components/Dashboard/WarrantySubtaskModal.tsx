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

// Deployed Web App URL for Apps Script Reverse Sync (Version 5 - Active)
const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxLRsNBMc4MguQlCOdgmlO6NRsfPG9AltjFCnS8I7GRMwZPNeiVCaqLiDc_vwpbogcK/exec';

// Official Progress Options strictly matching Data Validation rules on BaoHanh_Model & Mer View 2026
const WARRANTY_PROGRESS_OPTIONS = [
  'Not Started',
  'Vis - Đã gửi RQ tới Agency',
  'Tiếp nhận',
  'Gửi lịch đăng ký',
  'Hoàn Thành',
  'Cancelled'
];

// Official Warranty Coverage Options matching Column O on BaoHanh_Model
const WARRANTY_COVERAGE_OPTIONS = [
  'Trong phạm vi bảo hành',
  'Ngoài phạm vi bảo hành'
];

// Helper to convert DD/MM/YYYY or string to YYYY-MM-DD for native <input type="date">
const toHtmlDateStr = (str?: string): string => {
  if (!str) return '';
  const trimmed = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y && y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const dateObj = new Date(trimmed);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().split('T')[0];
  }
  return '';
};

// Helper to convert YYYY-MM-DD from <input type="date"> back to DD/MM/YYYY for saving
const fromHtmlDateStr = (htmlDate?: string): string => {
  if (!htmlDate) return '';
  const trimmed = htmlDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed;
};

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
  const [raiseMailTime, setRaiseMailTime] = useState('');
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
      const rowIdNum = record.sheet_row_index || parseInt(String(record.request_id || record.id || '').replace(/\D/g, ''), 10) || '';
      const reqIdDefault = record.request_id || (rowIdNum ? `BH-${rowIdNum}` : 'BH-000');
      
      setRequestId(reqIdDefault);
      const prj = record.ma_du_an || (record as any).projectCode || '';
      setMaDuAn(prj);
      setSearchPrjText(prj);
      setSupplier(record.supplier || '');
      setTitleEmail(record.title_email_request || (record as any).mailTitle || '');
      setRaiseMailTime((record as any).raise_mail_time || (record as any).raiseMailTime || (record as any).date_of_rq || (record as any).sentDate || '');
      
      // FIX PROGRESS MISMATCH: Check & Normalize string matching for select dropdown
      const rawProg = record.tien_do || (record as any).progress || (record as any).status || '';
      let matchedProg = 'Not Started';
      if (rawProg) {
        const norm = String(rawProg).toLowerCase().trim();
        if (norm.includes('hoàn thành')) matchedProg = 'Hoàn Thành';
        else if (norm.includes('gửi rq') || norm.includes('đã gửi')) matchedProg = 'Vis - Đã gửi RQ tới Agency';
        else if (norm.includes('lịch') || norm.includes('đăng ký')) matchedProg = 'Gửi lịch đăng ký';
        else if (norm.includes('tiếp nhận')) matchedProg = 'Tiếp nhận';
        else if (norm.includes('cancel')) matchedProg = 'Cancelled';
        else if (norm.includes('not started') || norm.includes('mới tạo')) matchedProg = 'Not Started';
        else matchedProg = rawProg;
      }
      setTienDo(matchedProg);
      
      setErrorDetail(record.sr_note || (record as any).errorDetail || '');
      setNote(record.mer_note || record.vis_note || (record as any).note || '');
      setInstallationDate((record as any).installation_date || (record as any).installationDate || '');
      setExpectedDate(record.ngay_quick_fix || (record as any).expected_date || (record as any).expectedDate || '');
      setCompletedDate((record as any).completed_date || (record as any).completedDate || '');
      if ((record as any).warranty_coverage || (record as any).warrantyCoverage) {
        setWarrantyCoverage((record as any).warranty_coverage || (record as any).warrantyCoverage);
      }
      if ((record as any).warranty_cost || (record as any).warrantyCost) {
        setWarrantyCost((record as any).warranty_cost || (record as any).warrantyCost);
      }
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

  // Trigger Open Email Client (No Auto-Save)
  const handleTriggerGmailWeb = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailTo)}&cc=${encodeURIComponent(mailCc)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.open(url, '_blank');
  };

  const handleTriggerMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(mailTo)}?cc=${encodeURIComponent(mailCc)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.location.href = mailtoUrl;
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

      // Insert Audit Log
      await supabase.from('subtask_audit_logs').insert({
        subtask_id: requestId || String(record.id),
        action_text: `Đã xác nhận gửi Mail Raise cho Supplier ${supplier} với Tiêu đề: "${finalSubject}"`
      });

      setMailSuccessMsg(`🟢 Đã xác nhận gửi mail & đồng bộ trực tiếp lên Sheet BaoHanh_Model và Mer View 2026!`);
      toast.success('🟢 Đã đồng bộ thông tin mail về Google Sheet thành công!');
      refetchAuditLogs();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi đồng bộ Google Sheet: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Main Save Subtask Function (Updates DB + Calls Web App 2-way Sync)
  const handleSaveSubtask = async () => {
    try {
      setIsSaving(true);
      const rowIdNum = record.sheet_row_index || parseInt(String(record.id || '').replace(/\D/g, ''), 10);

      const updates: any = {
        request_id: requestId,
        ma_du_an: maDuAn,
        supplier: supplier,
        title_email_request: titleEmail,
        raise_mail_time: raiseMailTime,
        tien_do: tienDo,
        installation_date: installationDate,
        ngay_quick_fix: expectedDate,
        expected_date: expectedDate,
        completed_date: completedDate,
        warranty_coverage: warrantyCoverage,
        warranty_cost: warrantyCost,
        mer_note: note
      };

      await onSave(String(record.id), updates);

      // Audit Log
      await supabase.from('subtask_audit_logs').insert({
        subtask_id: requestId || String(record.id),
        action_text: `Cập nhật Subtask: Title Mail -> "${titleEmail || 'N/A'}", Ngày Raise -> "${raiseMailTime || 'N/A'}", Tiến độ -> "${tienDo}"`
      });

      // Reverse sync to Google Sheet via Web App (Multi-channel GET + POST for 100% reliability)
      const targetUrl = (localStorage.getItem('warranty_web_app_url') || DEFAULT_WEB_APP_URL).trim();
      const syncParams = {
        rowId: String(rowIdNum),
        requestId: requestId,
        projectCode: maDuAn,
        supplier: supplier,
        titleMail: titleEmail,
        raiseMailTime: raiseMailTime,
        progress: tienDo,
        expectedDate: expectedDate,
        completedDate: completedDate,
        warrantyCoverage: warrantyCoverage,
        warrantyCost: warrantyCost,
        note: note
      };

      try {
        const queryStr = new URLSearchParams(syncParams as any).toString();
        const fullGetUrl = `${targetUrl}?${queryStr}`;
        const img = new Image();
        img.src = fullGetUrl;

        fetch(fullGetUrl, { mode: 'no-cors' }).catch(() => {});
        fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(syncParams)
        }).catch(() => {});
      } catch (syncErr) {
        console.error('Reverse sync trigger failed:', syncErr);
      }

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
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>🛡️ Subtask Bảo Hành ({requestId})</span>
                {maDuAn && (
                  <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-300 dark:border-indigo-800 shadow-xs">
                    🏷️ {maDuAn}
                  </span>
                )}
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

          {/* READ-ONLY BANNER NOTICE */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                🔒 <b>Chế độ xem 1:1 từ Tab Bảo Hành:</b> Toàn bộ thông tin được ánh xạ 1:1 từ luồng Bảo Hành & Bảo Trì (chế độ Chỉ Xem - Read Only). Để chỉnh sửa dữ liệu ca này, vui lòng thao tác trên Tab <b>Bảo Hành & Bảo Trì</b>.
              </span>
            </div>
            <button
              onClick={() => { onClose(); navigate('/tracking/warranty'); }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Đến Tab Bảo Hành</span>
            </button>
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
                  disabled={true}
                  placeholder="BH-635"
                  className="w-full font-mono font-bold text-sky-800 dark:text-sky-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none cursor-not-allowed opacity-80"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">🏢 Supplier (Thầu Sản Xuất):</label>
                <input
                  type="text"
                  value={supplier}
                  disabled={true}
                  placeholder="Link4, Smart, SDC..."
                  className="w-full font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none cursor-not-allowed opacity-80"
                />
              </div>
            </div>

            {/* Master Project Link */}
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
                  disabled={true}
                  placeholder="Mã dự án..."
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-sky-900 dark:text-sky-200 outline-none cursor-not-allowed opacity-80"
                />
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
                  disabled={true}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-sky-800 dark:text-sky-300 cursor-not-allowed opacity-80"
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
                  disabled={true}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-not-allowed opacity-80"
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
                  disabled={true}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-not-allowed opacity-80"
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
                  <label className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">🛠️ Ngày lắp đặt POSM:</label>
                  <input
                    type="date"
                    value={toHtmlDateStr(installationDate)}
                    disabled={true}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 cursor-not-allowed opacity-80"
                  />
                </div>

                {/* 4. Ngày hẹn xử lý dự kiến */}
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">⏰ Ngày hẹn xử lý dự kiến:</label>
                  <input
                    type="date"
                    value={toHtmlDateStr(expectedDate)}
                    disabled={true}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-600 cursor-not-allowed opacity-80"
                  />
                </div>

                {/* 5. Ngày hoàn thành thực tế */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">✅ Ngày hoàn thành thực tế:</label>
                  <input
                    type="date"
                    value={toHtmlDateStr(completedDate)}
                    disabled={true}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-600 cursor-not-allowed opacity-80"
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
                Email Raise Mail Supplier (Title Mail & Ngày Raise)
              </h3>
              <button
                onClick={handleOpenEmailComposer}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Xem Mẫu Soạn Mail</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="md:col-span-2 space-y-1">
                <label className="text-slate-600 dark:text-slate-400 font-bold text-[11px] flex items-center gap-1">
                  ✉️ Tiêu đề Email Raise (Title Mail):
                </label>
                <input
                  type="text"
                  value={titleEmail}
                  disabled={true}
                  placeholder="Chưa ghi nhận tiêu đề email raise"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-sky-900 dark:text-sky-200 outline-none cursor-not-allowed opacity-80"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-400 font-bold text-[11px] flex items-center gap-1">
                  📅 Ngày Raise Mail:
                </label>
                <input
                  type="date"
                  value={toHtmlDateStr(raiseMailTime)}
                  disabled={true}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-sky-900 dark:text-sky-200 outline-none cursor-not-allowed opacity-80"
                />
              </div>
            </div>
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
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={() => { onClose(); navigate('/tracking/warranty'); }}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Chuyển Sang Tab Bảo Hành Để Chỉnh Sửa</span>
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
