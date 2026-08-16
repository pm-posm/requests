import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  Search, RefreshCw, ShieldCheck, AlertTriangle, 
  Wrench, Calendar, Building2, FileText, 
  Filter, Download, CheckCircle2, X, Clock, Settings, HelpCircle, UserCheck, Tag, Eye, ExternalLink, Copy, Check, Mail, Image as ImageIcon, Send, AlertCircle, Link as LinkIcon, Edit3, Save, Table, BarChart3
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { WarrantyItem, WarrantyStats } from '@/types/warranty';
import toast from 'react-hot-toast';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { exportAnalystExecutiveReport } from '@/services/excelReportService';
import { WarrantyInboxView } from './warranty/WarrantyInboxView';
import { WarrantyReportPowerBIView } from './warranty/WarrantyReportPowerBIView';
import { WarrantyFilterBar, INITIAL_WARRANTY_FILTER_STATE, type WarrantyFilterState } from './warranty/WarrantyFilterBar';

// Official Public Google Sheet CSV URL for BaoHanh_Model
const DEFAULT_WARRANTY_SHEET_CSV = 'https://docs.google.com/spreadsheets/d/119LpiU1XheXgOxKWxw17E_u4vgRTBPhc-4FADDS8B1Q/export?format=csv&gid=2053849390';

// Deployed Web App URL for Apps Script Reverse Sync & Live Gmail (Active Production)
const DEFAULT_WEB_APP_URL = (import.meta.env.VITE_REQUEST_WEB_APP_URL || '').trim() || 'https://script.google.com/macros/s/AKfycbxztDMOhd6lO6QY_AmF4jMyXUWCP69jlb8XY7f9zIAQVGhXukaa0I_kd_uwqrTce8Y4iA/exec';

// Helper to format Web App URL or raw Deployment ID
const formatWebAppUrl = (rawUrl?: string): string => {
  if (!rawUrl || !rawUrl.trim()) return DEFAULT_WEB_APP_URL;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://script.google.com/macros/s/${trimmed}/exec`;
};

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

// Fallback real historical warranty items matching exact schema
const INITIAL_REAL_WARRANTY_ITEMS: WarrantyItem[] = [
  {
    id: 'w-658',
    rowId: '658',
    requestId: 'BH-658',
    storeName: 'GO! GO VAP',
    storeCode: 'STR-BIG-00468',
    srName: 'TẠ CHÂU LONG',
    visTech: 'Lê Hữu Thắng',
    posmType: 'GE Customize',
    category: 'Oral',
    brand: 'Close Up',
    sentDate: '24/07/2026',
    expectedDate: '',
    completedDate: '',
    projectCode: '118420U01-U10 Dove Hair MT Total Dream Campaign',
    supplier: 'Link4',
    errorDetail: 'Tuýp kem hư hỏng',
    warrantyCoverage: '',
    warrantyCost: '',
    progress: 'Not started',
    note: ''
  },
  {
    id: 'w-635',
    rowId: '635',
    requestId: 'BH-635',
    storeName: 'Coop Xtra Pham Van Dong',
    storeCode: 'STR-COPXT-15660',
    srName: 'PHẠM THỊ ÁNH TUYẾT',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Smart GE',
    category: 'Hair',
    brand: 'Dove',
    sentDate: '15/07/2026',
    expectedDate: '20/07/2026',
    completedDate: '20/07/2026',
    projectCode: '118420U01-U10 Dove Hair MT Total Dream Campaign GE Customize_ Coop Phạm Văn Đồng',
    supplier: 'Link4',
    mailTitle: '[Bảo hành]-[BH-635]: 118420U01-U10 Dove Hair MT Total Dream Campaign GE Customize_ Coop Phạm Văn Đồng',
    errorDetail: 'GE tắt đèn, màn hình vẫn hoạt động',
    warrantyCoverage: '',
    warrantyCost: '',
    progress: 'Hoàn thành',
    note: 'Done 20/7'
  },
  {
    id: 'w-611',
    rowId: '611',
    requestId: 'BH-611',
    storeName: 'Lotte Q7',
    storeCode: 'STR-LOT-00480',
    srName: 'Như',
    visTech: 'Phạm Quang Chính',
    posmType: 'SS Customize',
    category: 'Skin',
    brand: 'Dove',
    sentDate: '24/06/2026',
    expectedDate: '25/06/2026',
    completedDate: '25/06/2026',
    projectCode: '',
    supplier: '',
    errorDetail: 'Lắp đặt chưa vệ sinh POSM, nhiều chỗ trầy xước',
    warrantyCoverage: '',
    warrantyCost: '',
    progress: 'Not started',
    note: 'Đã khắc phục vấn đề vệ sinh, 2 tấm mica bị xước dự tính thay ngày 25/6'
  }
];

export default function TrackingWarranty() {
  const { isAdmin } = useDashboardStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive activeModuleTab directly from URL path (Single Source of Truth)
  const activeModuleTab = useMemo<'DATA_LIST' | 'ANALYST' | 'INBOX'>(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/tracking/warranty/analytics') || path.includes('/tracking/warranty/report')) {
      return 'ANALYST';
    }
    if (path.includes('/tracking/warranty/inbox')) {
      return 'INBOX';
    }
    return 'DATA_LIST';
  }, [location.pathname]);

  const handleTabChange = (tab: 'DATA_LIST' | 'ANALYST' | 'INBOX') => {
    if (tab === 'ANALYST') {
      navigate('/tracking/warranty/analytics');
    } else if (tab === 'INBOX') {
      navigate('/tracking/warranty/inbox');
    } else {
      navigate('/tracking/warranty');
    }
  };

  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    return localStorage.getItem('warranty_sheet_url') || DEFAULT_WARRANTY_SHEET_CSV;
  });
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    const saved = localStorage.getItem('warranty_web_app_url');
    if (saved && saved.trim()) {
      return saved.trim();
    }
    return DEFAULT_WEB_APP_URL;
  });

  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [tempUrlInput, setTempUrlInput] = useState('');
  const [tempWebAppInput, setTempWebAppInput] = useState('');

  const [warrantyItems, setWarrantyItems] = useState<WarrantyItem[]>(INITIAL_REAL_WARRANTY_ITEMS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Unified 2-Group Filter state (Date group + Classification group)
  const [filters, setFilters] = useState<WarrantyFilterState>(INITIAL_WARRANTY_FILTER_STATE);

  // Drawer selected item & Edit Form State
  const [selectedItem, setSelectedItem] = useState<WarrantyItem | null>(null);
  const [editProjectCode, setEditProjectCode] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editProgress, setEditProgress] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editCompletedDate, setEditCompletedDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTitleMail, setEditTitleMail] = useState('');
  const [editRaiseMailTime, setEditRaiseMailTime] = useState('');
  const [editPrecedingRequestId, setEditPrecedingRequestId] = useState('');
  const [editErrorType, setEditErrorType] = useState('');
  const [drawerSaveSuccess, setDrawerSaveSuccess] = useState<string | null>(null);
  const [isDrawerSaving, setIsDrawerSaving] = useState(false);

  // Send Email Modal State
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailCc, setMailCc] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mailSentSuccess, setMailSentSuccess] = useState<string | null>(null);
  const [editInstallationDate, setEditInstallationDate] = useState('');
  const [isSyncingToSheet, setIsSyncingToSheet] = useState(false);

  // Collapse / Expand toggle states for Analyst SLA Duration Breakdown Cards
  const [expandedEarly, setExpandedEarly] = useState(false);
  const [expandedMid, setExpandedMid] = useState(false);
  const [expandedLong, setExpandedLong] = useState(false);

  // Dedicated Popup Modal State for SLA Duration Breakdown
  const [slaModalData, setSlaModalData] = useState<{
    title: string;
    badge: string;
    items: Array<{ item: WarrantyItem; days: number }>;
  } | null>(null);
  const [slaModalFilter, setSlaModalFilter] = useState('');

  // Query raw_requests from Supabase to map Column T (Column 20) Deadline & Request Date 1:1 for all warranty items
  const { data: rawRequestDeadlines } = useQuery({
    queryKey: ['raw_requests_deadlines_map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_requests')
        .select('sheet_row_index, request_id, ess_store_code, deadline, date_of_rq, ngay_quick_fix');
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const mappedDeadline = useMemo(() => {
    if (!selectedItem) return '';

    // 1. Explicit requestDeadline on item
    if (selectedItem.requestDeadline && selectedItem.requestDeadline.trim()) {
      return selectedItem.requestDeadline.trim();
    }

    // 2. Look up in Supabase raw_requests table by rowId, requestId, or storeCode
    if (rawRequestDeadlines && rawRequestDeadlines.length > 0) {
      const rowIdNum = parseInt(String(selectedItem.rowId || selectedItem.requestId || '').replace(/\D/g, ''), 10);
      const matched = rawRequestDeadlines.find(r => 
        (rowIdNum > 0 && r.sheet_row_index === rowIdNum) ||
        (r.request_id && selectedItem.requestId && r.request_id.toLowerCase().trim() === selectedItem.requestId.toLowerCase().trim()) ||
        (r.ess_store_code && selectedItem.storeCode && r.ess_store_code.toLowerCase().trim() === selectedItem.storeCode.toLowerCase().trim())
      );
      if (matched) {
        const found = matched.deadline || matched.ngay_quick_fix || matched.date_of_rq;
        if (found && found.trim()) return found.trim();
      }
    }

    // 3. Fallback to expectedDate or sentDate
    return selectedItem.expectedDate || selectedItem.sentDate || '';
  }, [selectedItem, rawRequestDeadlines]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Sync state to drawer edit form when an item is selected
  useEffect(() => {
    if (selectedItem) {
      setEditProjectCode(selectedItem.projectCode || '');
      setEditSupplier(selectedItem.supplier || '');

      // Normalize progress string to match exact Google Sheet Data Validation rules
      const rawProg = selectedItem.progress || '';
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
      setEditProgress(matchedProg);

      setEditInstallationDate(selectedItem.installationDate || '');
      setEditExpectedDate(selectedItem.expectedDate || '');
      setEditCompletedDate(selectedItem.completedDate || '');
      setEditNote(selectedItem.note || '');
      setEditTitleMail(selectedItem.mailTitle || (selectedItem as any).titleEmail || '');
      setEditRaiseMailTime(selectedItem.raiseMailTime || '');
      setEditPrecedingRequestId(selectedItem.precedingRequestId || (selectedItem as any).preceding_request_id || '');
      setEditErrorType(selectedItem.errorType || '');
      setDrawerSaveSuccess(null);
    }
  }, [selectedItem]);

  // Open Send Mail Modal with Strict Validation & Standard Subject Format
  const handleOpenMailModal = (item: WarrantyItem) => {
    setValidationError(null);
    setMailSentSuccess(null);

    const currentProjectCode = item.projectCode || editProjectCode;
    const currentSupplier = item.supplier || editSupplier;

    const hasProjectCode = currentProjectCode && currentProjectCode.trim() !== '';
    const hasSupplier = currentSupplier && currentSupplier.trim() !== '';

    // Validation check: Required Project Code and Supplier
    if (!hasProjectCode || !hasSupplier) {
      const missingFields = [];
      if (!hasProjectCode) missingFields.push('Mã dự án');
      if (!hasSupplier) missingFields.push('Supplier');
      setValidationError(`⚠️ KHÔNG THỂ GỬI MAIL: Dữ liệu ca bảo hành ${item.requestId} chưa được điền đầy đủ [${missingFields.join(', ')}]. Vui lòng nhập bổ sung thông tin trên Dashboard trước khi gửi mail!`);
    }

    // STRICT SUBJECT FORMAT: [Bảo hành]-[BH-...]: <mã dự án + tên dự án đầy đủ>
    const standardSubject = item.mailTitle || `[Bảo hành]-[${item.requestId}]: ${currentProjectCode || '[Mã + Tên dự án]'}`;

    const defaultTo = currentSupplier ? `${currentSupplier.toLowerCase().replace(/\s+/g, '')}@supplier.com` : '';
    const defaultCc = 'vis.tech@unilever.com';
    
    const body = `Kính gửi Nhà Cung Cấp ${currentSupplier || '[Tên Supplier]'},\n\nHệ thống POSM Unilever gửi thông báo sự cố & yêu cầu khắc phục bảo hành như sau:\n\n📌 THÔNG TIN REQUEST BẢO HÀNH:\n- Mã Request: ${item.requestId}\n- Cửa hàng: ${item.storeName} (Mã Store: ${item.storeCode || 'N/A'})\n- Quản lý POSM (VIS-Tech): ${item.visTech || 'Chưa rõ'}\n- Nhân sự SR: ${item.srName || 'N/A'}\n- Hạng mục POSM: ${item.posmType} - Brand: ${item.brand} (Ngành: ${item.category})\n- Mã dự án: ${currentProjectCode || 'N/A'}\n\n🚨 CHI TIẾT SỰ CỐ:\n${item.errorDetail}\n\nRất mong Quý Nhà Thầu nhanh chóng kiểm tra và phản hồi ngày xử lý dự kiến.\n\nTrân trọng,\nTeam Visibility Unilever.`;

    setMailTo(defaultTo);
    setMailCc(defaultCc);
    setMailSubject(standardSubject);
    setMailBody(body);
    setIsMailModalOpen(true);
  };

  // EXPLICIT CONFIRMATION ONLY: Confirm Email Sent & Trigger Ultra-Reliable Sync
  const handleConfirmMailSent = async () => {
    if (!selectedItem) return;
    const timestamp = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    const finalTitle = mailSubject.trim();

    // 1. Update item in local state
    const updatedItem = {
      ...selectedItem,
      mailTitle: finalTitle,
      progress: selectedItem.progress === 'Not started' ? 'Vis - Đã gửi RQ tới Agency' : selectedItem.progress,
      note: selectedItem.note ? `${selectedItem.note} | Raise mail: ${timestamp}` : `Đã raise mail cho Supplier lúc ${timestamp}`
    };

    setSelectedItem(updatedItem);
    setWarrantyItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));

    // 2. Trigger Multi-channel Sync to Google Sheet
    const targetUrl = formatWebAppUrl(webAppUrl);
    console.log('[MAIL SYNC] webAppUrl state:', webAppUrl);
    console.log('[MAIL SYNC] targetUrl resolved:', targetUrl);
    if (targetUrl) {
      try {
        setIsSyncingToSheet(true);

        const payloadObj = {
          rowId: selectedItem.rowId,
          requestId: selectedItem.requestId,
          titleMail: finalTitle,
          raiseMailTime: timestamp,
          progress: 'Vis - Đã gửi RQ tới Agency'
        };

        const queryParams = new URLSearchParams(payloadObj).toString();
        const fullGetUrl = `${targetUrl}?${queryParams}`;
        console.log('[MAIL SYNC] GET URL:', fullGetUrl);

        await fetch(fullGetUrl, { mode: 'no-cors' })
          .then(() => console.log('[MAIL SYNC] GET sent successfully (no-cors)'))
          .catch((err) => console.error('[MAIL SYNC] GET failed:', err));

        setMailSentSuccess(`🟢 Đã xác nhận gửi mail & tự động đồng bộ Title Mail "${finalTitle}" về BaoHanh_Model & Mer View 2026!`);
      } catch (err: any) {
        console.error('Lỗi sync Web App:', err);
        setMailSentSuccess(`🟢 Đã lưu trên Dashboard lúc ${timestamp}.`);
      } finally {
        setIsSyncingToSheet(false);
      }
    } else {
      setMailSentSuccess(`🟢 Đã lưu Title Mail trên Dashboard lúc ${timestamp}.`);
    }
  };

  // OPEN GMAIL WEB WITHOUT AUTO-CONFIRMING (Pure Link Trigger)
  const handleTriggerGmailWeb = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailTo)}&cc=${encodeURIComponent(mailCc)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.open(url, '_blank');
  };

  // OPEN OUTLOOK APP WITHOUT AUTO-CONFIRMING (Pure Link Trigger)
  const handleTriggerMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(mailTo)}?cc=${encodeURIComponent(mailCc)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
    window.location.href = mailtoUrl;
  };

  // Save Direct Edits from Drawer & Sync to Google Sheet
  const handleSaveDrawerEdits = async () => {
    if (!selectedItem) return;
    setIsDrawerSaving(true);
    setDrawerSaveSuccess(null);

    const updatedItem: WarrantyItem = {
      ...selectedItem,
      projectCode: editProjectCode.trim(),
      supplier: editSupplier.trim(),
      progress: editProgress.trim(),
      installationDate: editInstallationDate.trim(),
      expectedDate: editExpectedDate.trim(),
      completedDate: editCompletedDate.trim(),
      note: editNote.trim(),
      mailTitle: editTitleMail.trim(),
      raiseMailTime: editRaiseMailTime.trim(),
      precedingRequestId: editPrecedingRequestId.trim(),
      errorType: editErrorType.trim()
    };

    // Update local state
    setSelectedItem(updatedItem);
    setWarrantyItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));

    // Update Supabase raw_requests table directly
    try {
      const rowIdNum = parseInt(String(selectedItem.rowId || selectedItem.requestId || '').replace(/\D/g, ''), 10);
      if (rowIdNum > 0 || selectedItem.requestId) {
        await supabase.from('raw_requests').update({
          ma_du_an: editProjectCode.trim() || null,
          supplier: editSupplier.trim() || null,
          tien_do: editProgress.trim(),
          title_email_request: editTitleMail.trim() || null,
          raise_mail_time: editRaiseMailTime.trim() || null,
          ngay_quick_fix: editExpectedDate.trim() || null,
          expected_date: editExpectedDate.trim() || null,
          completed_date: editCompletedDate.trim() || null,
          mer_note: editNote.trim() || null,
          preceding_request_id: editPrecedingRequestId.trim() || null
        }).or(`request_id.eq.${selectedItem.requestId},sheet_row_index.eq.${rowIdNum}`);
      }
    } catch (spErr) {
      console.warn('Supabase update notice:', spErr);
    }

    // Multi-channel reverse sync to Google Sheet via Web App
    const targetUrl = formatWebAppUrl(webAppUrl);
    console.log('[WARRANTY SYNC] webAppUrl state:', webAppUrl);
    console.log('[WARRANTY SYNC] targetUrl resolved:', targetUrl);
    if (targetUrl) {
      try {
        const payload: Record<string, string> = {
          rowId: selectedItem.rowId,
          requestId: selectedItem.requestId,
        };
        if (editProjectCode.trim()) payload.projectCode = editProjectCode.trim();
        if (editSupplier.trim()) payload.supplier = editSupplier.trim();
        if (editProgress.trim()) payload.progress = editProgress.trim();
        if (editTitleMail.trim()) payload.titleMail = editTitleMail.trim();
        payload.raiseMailTime = editRaiseMailTime.trim();
        if (editInstallationDate.trim()) payload.installationDate = editInstallationDate.trim();
        if (editExpectedDate.trim()) payload.expectedDate = editExpectedDate.trim();
        if (editCompletedDate.trim()) payload.completedDate = editCompletedDate.trim();
        if (editPrecedingRequestId.trim()) payload.precedingRequestId = editPrecedingRequestId.trim();
        if (editErrorType.trim()) {
          payload.errorType = editErrorType.trim();
          payload.loaiLoi = editErrorType.trim();
        }
        if (editNote.trim()) payload.note = editNote.trim();

        const queryParams = new URLSearchParams(payload).toString();
        const fullGetUrl = `${targetUrl}?${queryParams}`;
        console.log('[WARRANTY SYNC] GET URL:', fullGetUrl);
        console.log('[WARRANTY SYNC] Payload:', payload);

        // Primary: GET request (most reliable with Google Apps Script)
        fetch(fullGetUrl, { mode: 'no-cors' })
          .then(() => console.log('[WARRANTY SYNC] GET sent (no-cors, opaque response)'))
          .catch((err) => console.error('[WARRANTY SYNC] GET failed:', err));

        // Fallback: POST request
        fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        })
          .then(() => console.log('[WARRANTY SYNC] POST sent (no-cors, opaque response)'))
          .catch((err) => console.error('[WARRANTY SYNC] POST failed:', err));

        toast.success(`🟢 Đã lưu dữ liệu ca ${selectedItem.requestId} & đồng bộ 2 chiều về Google Sheet!`);
        setDrawerSaveSuccess('🟢 Đã lưu thay đổi & đồng bộ tự động về BaoHanh_Model và Mer View 2026!');
      } catch (err) {
        toast.success('🟢 Đã lưu thay đổi trên Dashboard!');
        setDrawerSaveSuccess('🟢 Đã lưu thay đổi trên Dashboard!');
      } finally {
        setIsDrawerSaving(false);
      }
    } else {
      toast.success('🟢 Đã lưu trên Dashboard!');
      setDrawerSaveSuccess('🟢 Đã lưu trên Dashboard!');
      setIsDrawerSaving(false);
    }
  };

  // Fetch CSV from Google Sheet
  const fetchSheetData = async (url: string) => {
    if (!url.trim()) return;
    try {
      setIsRefreshing(true);
      setError(null);

      const targetCsvUrl = url.includes('?') 
        ? `${url}&_cachebust=${Date.now()}` 
        : `${url}?_cachebust=${Date.now()}`;

      Papa.parse(targetCsvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const getFlexibleVal = (rowObj: any, keys: string[]): string => {
              if (!rowObj || typeof rowObj !== 'object') return '';
              const objKeys = Object.keys(rowObj);
              const cleanNormalize = (s: string) => s.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
              
              for (const targetKey of keys) {
                const cleanTarget = cleanNormalize(targetKey);
                const foundKey = objKeys.find(k => {
                  const cleanK = cleanNormalize(k);
                  return cleanK === cleanTarget || cleanK.includes(cleanTarget);
                });
                if (foundKey && rowObj[foundKey] !== undefined && rowObj[foundKey] !== null) {
                  const val = String(rowObj[foundKey]).trim();
                  if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
                    return val;
                  }
                }
              }
              return '';
            };

            const parsedItems: WarrantyItem[] = results.data.map((row: any, idx: number) => {
              const rawRowId = getFlexibleVal(row, ['Row_ID', 'STT', 'row_id']) || String(idx + 2);
              const rowId = String(rawRowId).replace(/\D/g, '') || String(idx + 2);
              const requestId = getFlexibleVal(row, ['Request ID', 'Mã Request', 'request_id']) || `BH-${rowId}`;
              const storeName = getFlexibleVal(row, ['Store name', 'Tên Store', 'Cửa Hàng', 'store_name']) || 'Cửa Hàng';
              const storeCode = getFlexibleVal(row, ['Store code', 'Mã Store', 'store_code', 'ess_store_code']) || '';
              const srName = getFlexibleVal(row, ['SR', 'sr_name']) || '';
              const visTech = getFlexibleVal(row, ['VIS-Tech', 'vis_tech', 'VISTech']) || '';
              const posmType = getFlexibleVal(row, ['POSM', 'Loại POSM', 'posm_type']) || 'POSM';
              const category = getFlexibleVal(row, ['CAT', 'Category', 'cat']) || '';
              const brand = getFlexibleVal(row, ['BRAND', 'Brand', 'brand']) || '';
              const sentDate = getFlexibleVal(row, ['Ngày gửi', 'Ngày YC', 'sent_date', 'date_of_rq']) || '';
              const projectCode = getFlexibleVal(row, ['Mã dự án', 'Mã Dự Án', 'ma_du_an', 'project_code']) || '';
              const supplier = getFlexibleVal(row, ['Supplier', 'Nhà Cung Cấp', 'supplier']) || '';
              const mailTitle = getFlexibleVal(row, ['Title mail', 'title_mail', 'title_email_request']) || '';
              const errorDetail = getFlexibleVal(row, ['Chi tiết lỗi', 'Lỗi', 'error_detail', 'sr_note']) || '';
              const progress = getFlexibleVal(row, ['Tiến độ', 'Trạng thái', 'progress', 'status', 'tien_do']) || (Array.isArray(row) ? row[14] : '') || 'Not started';
              const expectedDate = getFlexibleVal(row, ['Ngày xử lý dự kiến', 'expected_date']) || (Array.isArray(row) ? row[15] : '') || '';
              const completedDate = getFlexibleVal(row, ['Ngày hoàn thành thực tế', 'completed_date']) || (Array.isArray(row) ? row[16] : '') || '';
              const proofImage = getFlexibleVal(row, ['Hình ảnh nghiệm thu', 'proof_image']) || (Array.isArray(row) ? row[17] : '') || '';
              const objVals = typeof row === 'object' && row ? Object.values(row) : [];
              const col19Val = (objVals[19] !== undefined && objVals[19] !== null) ? String(objVals[19]).trim() : '';
              const col20Val = (objVals[20] !== undefined && objVals[20] !== null) ? String(objVals[20]).trim() : '';
              const col21Val = (objVals[21] !== undefined && objVals[21] !== null) ? String(objVals[21]).trim() : '';
              const col22Val = (objVals[22] !== undefined && objVals[22] !== null) ? String(objVals[22]).trim() : '';

              const raiseMailTime = getFlexibleVal(row, [
                'Ngày Rasie Mail',
                'Ngày raise mail', 
                'Ngày Raise Mail', 
                'raise_mail_time', 
                'rasie_mail_time', 
                'Raise Mail', 
                'Rasie Mail',
                'raiseMailTime'
              ]) || (Array.isArray(row) ? row[19] : '') || col19Val || '';

              const installationDate = getFlexibleVal(row, [
                'Ngày lắp đặt', 
                'Ngày lắp đặt POSM', 
                'Ngày Lắp Đặt', 
                'ngay_lap_dat', 
                'installation_date'
              ]) || (Array.isArray(row) ? row[20] : '') || col20Val || '';

              const precedingRequestId = getFlexibleVal(row, [
                'Mã bảo hành lần trước', 
                'preceding_request_id', 
                'precedingRequestId'
              ]) || (Array.isArray(row) ? row[21] : '') || col21Val || '';

              const errorType = getFlexibleVal(row, [
                'Loại lỗi',
                'Loại Lỗi',
                'loai_loi',
                'loaiLoi',
                'Loại Lỗi (Cột W)',
                'Error Type',
                'error_type',
                'errorType',
                'Phân loại lỗi',
                'Nhóm lỗi'
              ]) || (Array.isArray(row) ? row[22] : '') || col22Val || '';

              const note = getFlexibleVal(row, ['Note', 'Ghi chú', 'vis_note', 'mer_note']) || (Array.isArray(row) ? row[18] : '') || '';
              const requestDeadline = getFlexibleVal(row, ['Deadline', 'Deadline request', 'Deadline RQ', 'deadline']) || '';

              return {
                id: `sheet-${rowId}-${idx}`,
                rowId,
                requestId: requestId.trim() || `BH-${rowId}`,
                storeName: storeName.trim(),
                storeCode: storeCode.trim(),
                srName: srName.trim(),
                visTech: visTech.trim(),
                posmType: posmType.trim(),
                category: category.trim(),
                brand: brand.trim(),
                sentDate: sentDate.trim(),
                raiseMailTime: raiseMailTime.trim(),
                requestDeadline: requestDeadline.trim(),
                installationDate: installationDate.trim(),
                projectCode: projectCode.trim(),
                supplier: supplier.trim(),
                mailTitle: mailTitle.trim(),
                errorDetail: errorDetail.trim(),
                progress: progress.trim() || 'Not started',
                expectedDate: expectedDate.trim(),
                completedDate: completedDate.trim(),
                proofImage: proofImage.trim(),
                note: note.trim(),
                precedingRequestId: precedingRequestId.trim(),
                errorType: errorType.trim()
              };
            });
            setWarrantyItems(parsedItems);
          }
          setIsRefreshing(false);
        },
        error: (err) => {
          console.error('Error parsing Google Sheet CSV:', err);
          setError('Không thể tự động tải CSV từ Google Sheet URL. Đang dùng dữ liệu sẵn có.');
          setIsRefreshing(false);
        }
      });
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối đến Google Sheet.');
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSheetData(sheetUrl);
  }, [sheetUrl]);

  // Unique filter lists
  const uniqueSuppliers = useMemo(() => {
    const list = Array.from(new Set(warrantyItems.map(i => i.supplier?.trim()).filter(Boolean))).sort();
    const hasUnassigned = warrantyItems.some(i => !i.supplier || !i.supplier.trim() || i.supplier.trim() === 'Chưa chọn' || i.supplier.trim() === 'Chưa gán thầu');
    if (hasUnassigned) {
      return ['Chưa chọn', ...list.filter(s => s !== 'Chưa chọn' && s !== 'Chưa gán thầu')];
    }
    return list;
  }, [warrantyItems]);

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    warrantyItems.forEach(i => {
      const match = (i.sentDate || i.installationDate || '').match(/\b(202[0-9]|201[0-9])\b/);
      if (match) set.add(match[1]);
    });
    if (set.size === 0) set.add('2026');
    return Array.from(set).sort().reverse();
  }, [warrantyItems]);

  const uniqueVisTechs = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => i.visTech).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(warrantyItems.map(i => i.brand).filter(Boolean))).sort();
  }, [warrantyItems]);

  const uniqueProjects = useMemo(() => {
    const map = new Map<string, number>();
    warrantyItems.forEach(i => {
      const prj = i.projectCode?.trim();
      if (prj) {
        map.set(prj, (map.get(prj) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [warrantyItems]);

  // Helper for parsing date components from warranty items
  const parseItemDate = (item: WarrantyItem) => {
    const raw = item.sentDate || item.installationDate || item.raiseMailTime || '';
    if (!raw) return null;
    const trimmed = raw.trim();
    let d: Date | null = null;

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      }
    } else if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    }

    if (!d || isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    // ISO week
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    return { year, month, quarter, week, time: d.getTime() };
  };

  // Filtered dataset using unified 2-Group filter state
  const filteredItems = useMemo(() => {
    return warrantyItems.filter(item => {
      // 1. Search text filter
      const term = filters.searchTerm.toLowerCase().trim();
      if (term) {
        const matchSearch = 
          item.requestId.toLowerCase().includes(term) ||
          item.storeName.toLowerCase().includes(term) ||
          item.storeCode.toLowerCase().includes(term) ||
          item.posmType.toLowerCase().includes(term) ||
          item.brand.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          item.supplier.toLowerCase().includes(term) ||
          (item.projectCode && item.projectCode.toLowerCase().includes(term)) ||
          item.errorDetail.toLowerCase().includes(term) ||
          (item.mailTitle && item.mailTitle.toLowerCase().includes(term)) ||
          item.visTech.toLowerCase().includes(term) ||
          item.srName.toLowerCase().includes(term) ||
          (item.errorType && item.errorType.toLowerCase().includes(term));
        if (!matchSearch) return false;
      }

      // 2. Date filters (Năm, Quý, Tháng, Tuần, Khoảng ngày Từ -> Đến)
      const dateObj = parseItemDate(item);
      if (filters.selectedYear !== 'all') {
        if (!dateObj || String(dateObj.year) !== filters.selectedYear) return false;
      }
      if (filters.selectedQuarter !== 'all') {
        if (!dateObj || String(dateObj.quarter) !== filters.selectedQuarter) return false;
      }
      if (filters.selectedMonth !== 'all') {
        if (!dateObj || String(dateObj.month) !== filters.selectedMonth) return false;
      }
      if (filters.selectedWeek !== 'all') {
        if (!dateObj || String(dateObj.week) !== filters.selectedWeek) return false;
      }
      if (filters.dateFrom) {
        const fromMs = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
        if (!dateObj || dateObj.time < fromMs) return false;
      }
      if (filters.dateTo) {
        const toMs = new Date(filters.dateTo).setHours(23, 59, 59, 999);
        if (!dateObj || dateObj.time > toMs) return false;
      }

      // 3. Project Code filter (Multi-select)
      const selectedProjects = filters.selectedProjects || [];
      if (selectedProjects.length > 0) {
        const itemPrj = (item.projectCode || '').trim();
        if (!selectedProjects.includes(itemPrj)) return false;
      }

      // 4. Classification filters (VIS-Tech, Supplier, Store, Loại POSM, Nhãn)
      const selectedVisTechs = filters.selectedVisTechs || [];
      if (selectedVisTechs.length > 0) {
        if (!selectedVisTechs.includes(item.visTech?.trim())) return false;
      }
      const selectedSuppliers = filters.selectedSuppliers || [];
      if (selectedSuppliers.length > 0) {
        if (!selectedSuppliers.includes(item.supplier?.trim())) return false;
      }
      const selectedStores = filters.selectedStores || [];
      if (selectedStores.length > 0) {
        if (!selectedStores.includes(item.storeName?.trim())) return false;
      }
      const selectedPosmTypes = filters.selectedPosmTypes || [];
      if (selectedPosmTypes.length > 0) {
        if (!selectedPosmTypes.includes(item.posmType?.trim())) return false;
      }
      const selectedBrands = filters.selectedBrands || [];
      if (selectedBrands.length > 0) {
        if (!selectedBrands.includes(item.brand?.trim())) return false;
      }

      return true;
    });
  }, [warrantyItems, filters]);

  // Metrics (tính trên dataset đã lọc theo Năm & Filters để Analyst phản ánh dữ liệu thực tế)
  const stats: WarrantyStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;

    filteredItems.forEach(item => {
      const pLower = item.progress.toLowerCase();
      if (pLower === 'hoàn thành') completed++;
      else if (pLower === 'not started') notStarted++;
      else if (pLower !== 'cancel' && pLower !== 'cancelled') inProgress++;
    });

    return {
      totalItems: filteredItems.length,
      completedItems: completed,
      inProgressItems: inProgress,
      notStartedItems: notStarted,
    };
  }, [filteredItems]);

  // Analyst Tab Breakdown Statistics
  const analystBreakdowns = useMemo(() => {
    const parseDateToMs = (str?: string): number | null => {
      if (!str || !str.trim()) return null;
      const trimmed = str.trim();
      
      // Excel serial date number (VD: 45495)
      if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
        const serial = parseFloat(trimmed);
        return Math.floor(serial - 25569) * 86400 * 1000;
      }
      
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parts = trimmed.split(/[-T ]/)[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return isNaN(d.getTime()) ? null : d.getTime();
      }

      const parts = trimmed.split(/[/ -]/);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          return isNaN(d.getTime()) ? null : d.getTime();
        } else {
          const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          return isNaN(d.getTime()) ? null : d.getTime();
        }
      }
      
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    const supplierMap: Record<string, number> = {};
    const posmTypeMap: Record<string, number> = {};
    const projectMap: Record<string, { count: number; suppliers: Record<string, number> }> = {};

    let totalDaysToFail = 0;
    let countFailDate = 0;
    let earlyFailCount = 0; // < 30 days
    let midFailCount = 0;   // 30 - 90 days
    let longFailCount = 0;  // > 90 days
    let unrecordedInstallCount = 0; // Chưa ghi nhận ngày lắp đặt

    const earlyFailItems: Array<{ item: WarrantyItem; days: number }> = [];
    const midFailItems: Array<{ item: WarrantyItem; days: number }> = [];
    const longFailItems: Array<{ item: WarrantyItem; days: number }> = [];

    let totalDaysToSchedule = 0;
    let countScheduleDate = 0;

    let totalDaysToComplete = 0;
    let countCompleteDate = 0;

    // Backlog Aging Buckets
    let aging1to7Count = 0;
    let aging8to14Count = 0;
    let agingOver14Count = 0;

    const supplierSlaMap: Record<string, { total: number; completedOnTime: number; overdue: number }> = {};

    filteredItems.forEach(item => {
      // 1. Supplier breakdown
      const sup = item.supplier?.trim() || 'Chưa chọn';
      supplierMap[sup] = (supplierMap[sup] || 0) + 1;

      // 2. POSM Type breakdown
      const posm = item.posmType?.trim() || 'POSM Khác';
      posmTypeMap[posm] = (posmTypeMap[posm] || 0) + 1;

      // 3. Top Projects breakdown
      const prj = item.projectCode?.trim() || 'Chưa gán mã dự án';
      if (!projectMap[prj]) {
        projectMap[prj] = { count: 0, suppliers: {} };
      }
      projectMap[prj].count += 1;
      const supName = sup || 'Chưa gán thầu';
      projectMap[prj].suppliers[supName] = (projectMap[prj].suppliers[supName] || 0) + 1;

      // 4. Time & SLA Metrics Calculation (Ưu tiên mốc chính Cột T Deadline từ Mer View 2026)
      const installMs = parseDateToMs(item.installationDate);
      const sentMs = parseDateToMs(item.sentDate);
      const expectedMs = parseDateToMs(item.requestDeadline || item.expectedDate);
      const completedMs = parseDateToMs(item.completedDate);

      // Duration: Installation ➔ Issue (MTBF - Chỉ tính khi thực sự có Ngày Lắp Đặt)
      if (installMs) {
        const diffDays = sentMs ? Math.abs(Math.round((sentMs - installMs) / (1000 * 60 * 60 * 24))) : 0;
        totalDaysToFail += diffDays;
        countFailDate += 1;
        if (diffDays < 30) {
          earlyFailCount += 1;
          earlyFailItems.push({ item, days: diffDays });
        } else if (diffDays <= 90) {
          midFailCount += 1;
          midFailItems.push({ item, days: diffDays });
        } else {
          longFailCount += 1;
          longFailItems.push({ item, days: diffDays });
        }
      } else {
        unrecordedInstallCount += 1;
      }

      // Duration: Issue ➔ Expected schedule date
      if (sentMs && expectedMs && expectedMs >= sentMs) {
        const diffDays = Math.round((expectedMs - sentMs) / (1000 * 60 * 60 * 24));
        totalDaysToSchedule += diffDays;
        countScheduleDate += 1;
      }

      // Duration: Issue ➔ Completed date
      if (sentMs && completedMs && completedMs >= sentMs) {
        const diffDays = Math.round((completedMs - sentMs) / (1000 * 60 * 60 * 24));
        totalDaysToComplete += diffDays;
        countCompleteDate += 1;
      }

      // Backlog Aging (Ca chưa hoàn thành bị trễ deadline)
      const pLower = item.progress.toLowerCase();
      const isDone = pLower.includes('hoàn thành') || pLower.includes('cancel');
      if (!isDone && expectedMs) {
        if (Date.now() > expectedMs) {
          const overdueDays = Math.ceil((Date.now() - expectedMs) / (1000 * 60 * 60 * 24));
          if (overdueDays >= 1 && overdueDays <= 7) aging1to7Count++;
          else if (overdueDays >= 8 && overdueDays <= 14) aging8to14Count++;
          else if (overdueDays > 14) agingOver14Count++;
        }
      }

      // Supplier SLA Tracking
      if (!supplierSlaMap[sup]) {
        supplierSlaMap[sup] = { total: 0, completedOnTime: 0, overdue: 0 };
      }
      supplierSlaMap[sup].total += 1;

      let isOverdueSla = false;
      if (isDone && completedMs && expectedMs && completedMs > expectedMs) {
        isOverdueSla = true;
      } else if (!isDone && expectedMs && Date.now() > expectedMs) {
        isOverdueSla = true;
      }

      if (isOverdueSla) {
        supplierSlaMap[sup].overdue += 1;
      } else if (isDone && pLower.includes('hoàn thành')) {
        supplierSlaMap[sup].completedOnTime += 1;
      }
    });

    const topProjects = Object.entries(projectMap)
      .filter(([_, data]) => data.count > 1)
      .map(([projectCode, data]) => {
        const supplierList = Object.entries(data.suppliers)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return {
          projectCode,
          count: data.count,
          percentage: Math.round((data.count / (filteredItems.length || 1)) * 100),
          supplierList
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const posmTypeBreakdown = Object.entries(posmTypeMap)
      .map(([posmType, count]) => ({
        posmType,
        count,
        percentage: Math.round((count / (filteredItems.length || 1)) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    const avgDaysToFail = countFailDate > 0 ? Math.round(totalDaysToFail / countFailDate) : 0;
    const avgDaysToSchedule = countScheduleDate > 0 ? Math.round(totalDaysToSchedule / countScheduleDate) : 0;
    const avgDaysToComplete = countCompleteDate > 0 ? Math.round(totalDaysToComplete / countCompleteDate) : 0;

    return {
      supplierBreakdown: Object.entries(supplierMap).sort((a, b) => b[1] - a[1]),
      posmTypeBreakdown,
      topProjects,
      backlogAging: {
        aging1to7Count,
        aging8to14Count,
        agingOver14Count,
        totalOverdue: aging1to7Count + aging8to14Count + agingOver14Count
      },
      slaMetrics: {
        avgDaysToFail,
        avgDaysToSchedule,
        avgDaysToComplete,
        earlyFailCount,
        midFailCount,
        longFailCount,
        unrecordedInstallCount,
        earlyFailItems,
        midFailItems,
        longFailItems
      },
      supplierSlaList: Object.entries(supplierSlaMap).map(([supplier, stats]) => {
        const slaCompliantCount = stats.total - stats.overdue;
        const rate = stats.total > 0 ? Math.round((slaCompliantCount / stats.total) * 100) : 100;
        return {
          supplier,
          total: stats.total,
          completedOnTime: stats.completedOnTime,
          overdue: stats.overdue,
          rate
        };
      }).sort((a, b) => b.total - a.total)
    };
  }, [filteredItems]);

  // Recurrent Warranty Analysis Engine for TrackingWarranty (Nguồn sự thật: Ưu tiên Mã BH Lần Trước + Mã Dự Án)
  const recurrentWarrantyAnalytics = useMemo(() => {
    const groupMap = new Map<string, {
      key: string;
      storeName: string;
      storeCode: string;
      posm: string;
      brand: string;
      supplier: string;
      customer: string;
      incidents: Array<{
        sequence: number;
        id: string;
        requestId: string;
        sentDate: string;
        status: string;
        errorDetail: string;
        precedingRequestId?: string;
      }>;
    }>();

    // Map parent precedingRequestId links
    const parentChildMap = new Map<string, string>(); // childRequestId -> parentRequestId
    filteredItems.forEach(item => {
      const precId = (item.precedingRequestId || (item as any).preceding_request_id || '').trim();
      const currentReqId = (item.requestId || `BH-${item.rowId}`).trim();
      if (precId && currentReqId && precId !== currentReqId) {
        parentChildMap.set(currentReqId, precId);
      }
    });

    filteredItems.forEach(item => {
      const currentReqId = (item.requestId || `BH-${item.rowId}`).trim();
      const storeKey = item.storeCode?.trim() || item.storeName?.trim() || 'STORE_UNKNOWN';
      const posmKey = item.posmType?.trim() || 'POSM_UNKNOWN';
      const brandKey = item.brand?.trim() || item.category?.trim() || 'BRAND_UNKNOWN';
      const projectKey = item.projectCode?.trim() || '';

      // Determine grouping key
      let compositeKey = '';
      if (parentChildMap.has(currentReqId)) {
        // Linked explicitly via preceding_request_id
        const parentId = parentChildMap.get(currentReqId)!;
        compositeKey = `PREC_PARENT__${parentId}`;
      } else if (Array.from(parentChildMap.values()).includes(currentReqId)) {
        // Is parent of another request
        compositeKey = `PREC_PARENT__${currentReqId}`;
      } else if (projectKey) {
        // Linked via Store + Project Code (Mã dự án)
        compositeKey = `${storeKey}__PROJ__${projectKey}`;
      } else {
        // Fallback: Store + POSM + Brand
        compositeKey = `${storeKey}__${posmKey}__${brandKey}`;
      }

      if (!groupMap.has(compositeKey)) {
        groupMap.set(compositeKey, {
          key: compositeKey,
          storeName: item.storeName || '-',
          storeCode: item.storeCode || '-',
          posm: item.posmType || '-',
          brand: item.brand || item.category || '-',
          customer: (item as any).customer || '-',
          supplier: item.supplier || 'Chưa gán',
          incidents: []
        });
      }

      const grp = groupMap.get(compositeKey)!;
      grp.incidents.push({
        sequence: 0,
        id: item.id,
        requestId: currentReqId,
        sentDate: item.sentDate || '-',
        status: item.progress || 'Not started',
        errorDetail: item.errorDetail || '',
        precedingRequestId: item.precedingRequestId
      });
    });

    const groups = Array.from(groupMap.values());
    let recurrentCount = 0;
    groups.forEach(grp => {
      grp.incidents.forEach((inc, idx) => {
        inc.sequence = idx + 1;
      });
      if (grp.incidents.length > 1) {
        recurrentCount++;
      }
    });

    const recurrentItems = groups
      .filter(g => g.incidents.length > 1)
      .sort((a, b) => b.incidents.length - a.incidents.length);

    return {
      totalItems: groups.length,
      recurrentCount,
      recurrentItems
    };
  }, [filteredItems]);

  // Interactive Click-Chart to Filter & Switch Tab
  const handleFilterFromChart = (
    type: 'supplier' | 'brand' | 'posmType' | 'project' | 'category' | 'progress' | 'recurrent' | 'aging',
    val: string
  ) => {
    if (type === 'supplier') {
      setFilters(prev => ({ ...prev, selectedSuppliers: [val] }));
    } else if (type === 'brand') {
      setFilters(prev => ({ ...prev, selectedBrands: [val] }));
    } else if (type === 'posmType') {
      setFilters(prev => ({ ...prev, selectedPosmTypes: [val] }));
    } else if (type === 'project') {
      setFilters(prev => ({ ...prev, searchTerm: val }));
    } else if (type === 'category') {
      const cleanKeyword = val.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặcđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ\s]/gi, '').trim();
      setFilters(prev => ({ ...prev, searchTerm: cleanKeyword }));
    } else if (type === 'progress') {
      setFilters(prev => ({ ...prev, searchTerm: val }));
    } else if (type === 'recurrent') {
      setFilters(prev => ({ ...prev, searchTerm: 'Lần #' }));
    } else if (type === 'aging') {
      setFilters(prev => ({ ...prev, searchTerm: '' }));
    }

    setActiveModuleTab('DATA_LIST');
    toast.success(`🔍 Đã áp dụng bộ lọc "${val}" & chuyển sang Tab Danh Sách Dữ Liệu!`);
  };

  // Export Excel 3-Tab BI Workbook (.xlsx) with Project Code Filter Support
  const handleExportExcel = (targetProjCode?: string) => {
    if (targetProjCode) {
      exportAnalystExecutiveReport([], warrantyItems, `POSM_Warranty_Report_${targetProjCode}`, targetProjCode);
      const count = warrantyItems.filter(i => (i.projectCode || '').trim().toLowerCase().includes(targetProjCode.toLowerCase())).length;
      toast.success(`🟢 Đã xuất Báo Cáo Excel DỰ ÁN "${targetProjCode}" thành công! (${count} ca)`);
    } else {
      exportAnalystExecutiveReport([], filteredItems, 'POSM_Warranty_Executive_Report');
      toast.success(`🟢 Đã xuất Báo Cáo Excel 3-Tab toàn bộ hệ thống! (${filteredItems.length} ca)`);
    }
  };

  const handleSaveSheetUrl = () => {
    localStorage.setItem('warranty_sheet_url', tempUrlInput);
    localStorage.setItem('warranty_web_app_url', tempWebAppInput);
    localStorage.setItem('WARRANTY_GMAIL_APPS_SCRIPT_URL', tempWebAppInput);
    setSheetUrl(tempUrlInput);
    setWebAppUrl(tempWebAppInput);
    setIsUrlModalOpen(false);
  };

  // Helper for progress badge
  const renderProgressBadge = (progress: string) => {
    const pLower = progress.toLowerCase();
    if (pLower === 'hoàn thành') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[11px] shadow-sm">
          🟢 Hoàn thành
        </Badge>
      );
    }
    if (pLower === 'not started') {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-[11px]">
          ⚪ Not started
        </Badge>
      );
    }
    if (pLower === 'cancel' || pLower === 'cancelled') {
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 text-[11px]">
          🔴 Cancelled
        </Badge>
      );
    }
    return (
      <Badge className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] shadow-sm">
        🔵 {progress}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION - UNIFIED WITH MODERN CLEAN DESIGN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Bảo Hành &amp; Đổi Trả POSM
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeModuleTab === 'INBOX' 
                ? 'Hộp Thư & Luồng Email Trao Đổi • Supabase Cloud Realtime' 
                : activeModuleTab === 'ANALYST'
                  ? `Báo Cáo Phân Tích Sự Cố & Tiến Độ • ${warrantyItems.length} Ca Bảo Hành`
                  : `Danh Sách Quản Lý Ca Bảo Hành • ${filteredItems.length}/${warrantyItems.length} Ca`}
            </p>
          </div>
        </div>

        {/* TOP MODULE TABS & QUICK CONTROLS */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap self-start xl:self-auto">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-700 shrink-0">
            <button
              onClick={() => handleTabChange('DATA_LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeModuleTab === 'DATA_LIST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Danh Sách Ca</span>
            </button>

            <button
              onClick={() => handleTabChange('ANALYST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeModuleTab === 'ANALYST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Báo Cáo Phân Tích</span>
            </button>

            <button
              onClick={() => handleTabChange('INBOX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeModuleTab === 'INBOX'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Hộp Thư Gmail</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                Live
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: DEDICATED POWER BI ANALYST & WEEKLY REPORT WORKSPACE */}
      {activeModuleTab === 'ANALYST' && (
        <WarrantyReportPowerBIView
          warrantyItems={warrantyItems}
          onOpenWarrantyDrawer={(item) => setSelectedItem(item)}
          onExportExcel={(projectCode) => handleExportExcel(projectCode)}
        />
      )}

      {/* TAB 3: DEDICATED WARRANTY GMAIL INBOX WORKSPACE */}
      {activeModuleTab === 'INBOX' && (
        <div className="animate-in fade-in duration-200">
          <WarrantyInboxView
            warrantyItems={warrantyItems}
            onOpenWarrantyDrawer={(item) => setSelectedItem(item)}
          />
        </div>
      )}

      {/* TAB 2: CLEAN OPERATIONAL DATA LIST & UNIFIED 2-GROUP FILTER BAR */}
      {activeModuleTab === 'DATA_LIST' && (
        <div className="space-y-4">
          <WarrantyFilterBar
            warrantyItems={warrantyItems}
            filters={filters}
            onFilterChange={setFilters}
            onResetFilters={() => setFilters(INITIAL_WARRANTY_FILTER_STATE)}
            onRefreshSheet={() => fetchSheetData(sheetUrl)}
            isRefreshing={isRefreshing}
            onOpenSettings={() => {
              setTempUrlInput(sheetUrl);
              setTempWebAppInput(webAppUrl);
              setIsUrlModalOpen(true);
            }}
          />

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">

        {/* DATA TABLE WITH STICKY HEADER & ALWAYS VISIBLE SCROLLBAR */}
        <div className="w-full max-h-[calc(100vh-210px)] overflow-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-border uppercase tracking-wider text-[11px] sticky top-0 z-20 shadow-2xs">
              <tr>
                <th className="py-3 px-4">Request ID / Cửa Hàng</th>
                <th className="py-3 px-4 text-indigo-700 dark:text-indigo-400 font-black">Mã Dự Án</th>
                <th className="py-3 px-4">POSM & Brand</th>
                <th className="py-3 px-4">VIS-Tech (Unilever)</th>
                <th className="py-3 px-4">Supplier (Thầu SX)</th>
                <th className="py-3 px-4 max-w-[220px]">Chi Tiết Sự Cố</th>
                <th className="py-3 px-4">Ngày Yêu Cầu</th>
                <th className="py-3 px-4">Tiến Độ & Trạng Thái</th>
                <th className="py-3 px-4 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HelpCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-sm">Không tìm thấy bản ghi bảo hành phù hợp</p>
                      <p className="text-xs text-slate-400">Thử kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Request ID & Store */}
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 rounded font-bold shrink-0 mt-0.5">
                          {item.requestId}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                            {item.storeName}
                          </p>
                          <span className="text-[11px] text-muted-foreground">{item.storeCode || 'Store'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Mã Dự Án (Project Code) Highlighted Badge Column */}
                    <td className="py-3.5 px-4">
                      {item.projectCode ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs max-w-[180px] truncate" title={item.projectCode}>
                          🏷️ {item.projectCode}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chưa liên kết</span>
                      )}
                    </td>

                    {/* POSM & Brand */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.posmType}</span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {item.brand && <span className="font-semibold text-sky-700 dark:text-sky-300">{item.brand}</span>}
                          {item.category && <span>({item.category})</span>}
                        </div>
                      </div>
                    </td>

                    {/* VIS-Tech (Unilever POSM Manager) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {item.visTech || 'Chưa phân công'}
                          </span>
                          <span className="text-[10px] text-slate-400">SR: {item.srName || 'N/A'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Supplier (Thầu Sản Xuất) */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.supplier || 'Chưa chọn'}
                        </span>
                      </div>
                    </td>

                    {/* Error Details */}
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-2 text-[11.5px] leading-relaxed">
                        {item.errorDetail || 'Chưa cập nhật chi tiết lỗi'}
                      </p>
                    </td>

                    {/* DEDICATED SENT DATE COLUMN */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.sentDate || 'Chưa rõ'}</span>
                      </div>
                    </td>

                    {/* Progress Badge & Warranty Coverage */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-start gap-1">
                        {renderProgressBadge(item.progress)}

                        {item.warrantyCoverage && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                            {item.warrantyCoverage}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action Cell - View Detail */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer"
                        title="Xem & Chỉnh sửa hồ sơ bảo hành"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Sửa / Chi tiết</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Hiển thị {filteredItems.length} trên tổng số {warrantyItems.length} bản ghi trên BaoHanh_Model</span>
          <span>Google Sheet Connected</span>
        </div>
      </div>
    </div>
    )}

      {/* SLIDE-OVER DRAWER FOR ITEM DETAILS & DIRECT INLINE EDITING */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-card h-full shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 text-sky-600 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {selectedItem.requestId}
                    {renderProgressBadge(editProgress || selectedItem.progress)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedItem.storeName} ({selectedItem.storeCode || 'Store'})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DRAWER SAVE SUCCESS NOTIFICATION */}
            {drawerSaveSuccess && (
              <div className="mx-5 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{drawerSaveSuccess}</span>
              </div>
            )}

            {/* Drawer Content - Interactive Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
              {/* Store & Location */}
              <div className="p-4 bg-secondary/50 rounded-xl space-y-2 border border-border">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {selectedItem.storeName}
                  </h4>
                  <button
                    onClick={() => handleCopy(selectedItem.requestId, 'requestId')}
                    className="flex items-center gap-1 text-[11px] text-sky-600 hover:underline cursor-pointer"
                  >
                    {copiedText === 'requestId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'requestId' ? 'Đã chép' : 'Sao chép mã'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Mã Cửa Hàng</span>
                    <span className="font-medium font-mono text-foreground">{selectedItem.storeCode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-slate-400">Nhân viên SR</span>
                    <span className="font-medium text-foreground">{selectedItem.srName || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* INLINE EDIT FORM SECTION 1: DỰ ÁN & NHÀ THẦU & TIẾN ĐỘ */}
              <div className="space-y-3 p-4 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Edit3 className="w-3.5 h-3.5 text-sky-500" />
                  Chỉnh Sửa Thông Tin Bảo Hành
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Edit Project Code */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Mã Dự Án:</label>
                    <input
                      type="text"
                      value={editProjectCode}
                      onChange={(e) => setEditProjectCode(e.target.value)}
                      placeholder="Nhập mã dự án đầy đủ..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Edit Supplier */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier:</label>
                    <input
                      type="text"
                      value={editSupplier}
                      onChange={(e) => setEditSupplier(e.target.value)}
                      placeholder="Link4, Smart, SDC..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Edit Progress Dropdown */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Tiến Độ Bảo Hành:</label>
                  <select
                    value={editProgress}
                    onChange={(e) => setEditProgress(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer outline-none focus:border-sky-500"
                  >
                    <option value="Not Started">⚪ Not Started (Mới tạo)</option>
                    <option value="Vis - Đã gửi RQ tới Agency">🔵 Vis - Đã gửi RQ tới Agency</option>
                    <option value="Tiếp nhận">🔵 Tiếp nhận</option>
                    <option value="Gửi lịch đăng ký">📅 Gửi lịch đăng ký</option>
                    <option value="Hoàn Thành">🟢 Hoàn Thành</option>
                    <option value="Cancelled">🔴 Cancelled</option>
                  </select>
                </div>

                {/* Edit Preceding Request ID (Mã BH Lần Trước) */}
                <div className="space-y-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="font-semibold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      Mã Bảo Hành Lần Trước:
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editPrecedingRequestId}
                    onChange={(e) => setEditPrecedingRequestId(e.target.value)}
                    placeholder="Nhập mã BH lần trước (ví dụ: BH-586)..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Edit Error Type / Loại Lỗi */}
                <div className="space-y-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="font-semibold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Loại Lỗi:
                  </label>
                  <select
                    value={editErrorType}
                    onChange={(e) => setEditErrorType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-none focus:border-sky-500"
                  >
                    <option value="">-- Chọn loại lỗi --</option>
                    {Array.from(new Set(warrantyItems.map(i => (i.errorType || '').trim()).filter(Boolean))).sort().map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {editErrorType && !Array.from(new Set(warrantyItems.map(i => (i.errorType || '').trim()).filter(Boolean))).includes(editErrorType) && (
                      <option value={editErrorType}>{editErrorType}</option>
                    )}
                  </select>
                </div>

                {/* Edit Title Mail & Raise Mail Date (DD/MM/YYYY FORMAT) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="md:col-span-2 space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">✉️ Tiêu Đề Email Raise (Title Mail):</label>
                    <input
                      type="text"
                      value={editTitleMail}
                      onChange={(e) => setEditTitleMail(e.target.value)}
                      placeholder="[Bảo hành]-[BH-xxx]: mã dự án + tên dự án..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>📅 Ngày Raise Mail:</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={editRaiseMailTime || ''}
                        onChange={(e) => setEditRaiseMailTime(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                      />
                      <input
                        type="date"
                        id="hidden-raise-mail-picker"
                        value={toHtmlDateStr(editRaiseMailTime)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditRaiseMailTime(fromHtmlDateStr(e.target.value));
                          }
                        }}
                        className="opacity-0 absolute w-0 h-0 pointer-events-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('hidden-raise-mail-picker') as HTMLInputElement;
                          if (el) {
                            if ('showPicker' in el) (el as any).showPicker();
                            else { el.focus(); el.click(); }
                          }
                        }}
                        className="absolute right-2 p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                        title="Bấm để chọn ngày"
                      >
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* INLINE EDIT FORM SECTION 2: THEO DÕI MỐC THỜI GIAN (STRICT DD/MM/YYYY FORMAT) */}
              <div className="space-y-3 p-4 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  Theo Dõi & Cập Nhật Mốc Thời Gian Xử Lý
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Ngày gửi request (Read-only) */}
                  <div className="space-y-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="text-slate-500 flex items-center gap-1 font-semibold text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Ngày gửi request (SR/Docs):
                    </label>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs font-mono">
                      {selectedItem.sentDate || 'Chưa ghi nhận'}
                    </span>
                  </div>

                  {/* Deadline hoàn thành request (Read-only) */}
                  <div className="space-y-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="text-slate-500 flex items-center gap-1 font-semibold text-[11px]">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      Deadline request:
                    </label>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 block text-xs font-mono">
                      {mappedDeadline || 'Chưa có deadline'}
                    </span>
                  </div>

                  {/* Ngày lắp đặt POSM (Format dd/mm/yyyy) */}
                  <div className="space-y-1">
                    <label className="text-slate-600 dark:text-slate-300 flex items-center justify-between font-semibold text-[11px]">
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-sky-500" />
                        Ngày lắp đặt POSM:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">dd/mm/yyyy</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy (VD: 15/05/2025)"
                        value={editInstallationDate || ''}
                        onChange={(e) => setEditInstallationDate(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                      />
                      <input
                        type="date"
                        id="hidden-installation-date-picker"
                        value={toHtmlDateStr(editInstallationDate)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditInstallationDate(fromHtmlDateStr(e.target.value));
                          }
                        }}
                        className="opacity-0 absolute w-0 h-0 pointer-events-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('hidden-installation-date-picker') as HTMLInputElement;
                          if (el) {
                            if ('showPicker' in el) (el as any).showPicker();
                            else { el.focus(); el.click(); }
                          }
                        }}
                        className="absolute right-2 p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                        title="Bấm để chọn ngày"
                      >
                        <Calendar className="w-3.5 h-3.5 text-sky-500" />
                      </button>
                    </div>
                  </div>

                  {/* Ngày hẹn xử lý dự kiến (Format dd/mm/yyyy) */}
                  <div className="space-y-1">
                    <label className="text-slate-600 dark:text-slate-300 flex items-center justify-between font-semibold text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Ngày hẹn xử lý dự kiến:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">dd/mm/yyyy</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy (VD: 20/07/2026)"
                        value={editExpectedDate || ''}
                        onChange={(e) => setEditExpectedDate(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-amber-600 dark:text-amber-400 font-bold outline-none focus:border-sky-500"
                      />
                      <input
                        type="date"
                        id="hidden-expected-date-picker"
                        value={toHtmlDateStr(editExpectedDate)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditExpectedDate(fromHtmlDateStr(e.target.value));
                          }
                        }}
                        className="opacity-0 absolute w-0 h-0 pointer-events-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('hidden-expected-date-picker') as HTMLInputElement;
                          if (el) {
                            if ('showPicker' in el) (el as any).showPicker();
                            else { el.focus(); el.click(); }
                          }
                        }}
                        className="absolute right-2 p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                        title="Bấm để chọn ngày"
                      >
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                    </div>
                  </div>

                  {/* Ngày hoàn thành thực tế (Format dd/mm/yyyy) */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-slate-600 dark:text-slate-300 flex items-center justify-between font-semibold text-[11px]">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Ngày hoàn thành thực tế:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">dd/mm/yyyy</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy (VD: 25/07/2026)"
                        value={editCompletedDate || ''}
                        onChange={(e) => setEditCompletedDate(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-sky-500"
                      />
                      <input
                        type="date"
                        id="hidden-completed-date-picker"
                        value={toHtmlDateStr(editCompletedDate)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditCompletedDate(fromHtmlDateStr(e.target.value));
                          }
                        }}
                        className="opacity-0 absolute w-0 h-0 pointer-events-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('hidden-completed-date-picker') as HTMLInputElement;
                          if (el) {
                            if ('showPicker' in el) (el as any).showPicker();
                            else { el.focus(); el.click(); }
                          }
                        }}
                        className="absolute right-2 p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                        title="Bấm để chọn ngày"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>


              {/* POSM & Technical Details (Read-only Info) */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-500" />
                  Thông Tin Hạng Mục POSM
                </h4>
                <div className="p-4 border border-border rounded-xl space-y-3 bg-card">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Loại POSM:</span>
                    <span className="font-semibold text-foreground">{selectedItem.posmType}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Brand / Ngành hàng:</span>
                    <span className="font-semibold text-sky-600">{selectedItem.brand} ({selectedItem.category})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">VIS-Tech (Quản lý POSM):</span>
                    <span className="font-bold text-sky-700 dark:text-sky-300">{selectedItem.visTech || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* CHI TIẾT SỰ CỐ BẢO HÀNH */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Chi Tiết Sự Cố POSM
                </h4>
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium text-xs">
                    {selectedItem.errorDetail || 'Chưa cập nhật chi tiết sự cố'}
                  </p>
                </div>
              </div>

              {/* EMAIL RAISE SECTION */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-500" />
                    Email Raise & Thread Mail Supplier
                  </span>
                  {selectedItem.mailTitle ? (
                    <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 text-[10px]">
                      Đã raise mail
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                      Chưa raise mail
                    </Badge>
                  )}
                </h4>
                <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-sky-800 dark:text-sky-300 block mb-1">
                      Tiêu đề email (Subject Title):
                    </span>
                    {selectedItem.mailTitle ? (
                      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-sky-200 dark:border-sky-800">
                        <p className="text-[11px] font-mono text-slate-800 dark:text-slate-200 truncate flex-1">
                          {selectedItem.mailTitle}
                        </p>
                        <button
                          onClick={() => handleCopy(selectedItem.mailTitle || '', 'mailTitle')}
                          className="p-1 text-sky-600 hover:bg-sky-50 rounded transition-colors cursor-pointer shrink-0"
                          title="Sao chép tiêu đề mail"
                        >
                          {copiedText === 'mailTitle' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-[11px] bg-white/50 dark:bg-slate-900/50 p-2.5 rounded border border-dashed border-sky-200 dark:border-sky-800">
                        Chưa nhập tiêu đề email raise cho Supplier trên BaoHanh_Model.
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-sky-200/60 dark:border-sky-800/60 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-sky-900 dark:text-sky-200 font-medium">Hành động Thread mail:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(selectedItem.mailTitle || selectedItem.requestId) && (
                        <button
                          type="button"
                          onClick={() => {
                            const q = selectedItem.mailTitle || selectedItem.requestId;
                            window.open(`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`, '_blank');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg font-semibold text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
                          title="Tìm và mở luồng email này trong Gmail Web"
                        >
                          <Mail className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Xem trên Gmail ↗</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenMailModal(selectedItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi Mail Supplier</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* EDIT NOTE */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú tiến độ / Note:</label>
                <textarea
                  rows={3}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Nhập ghi chú chi tiết..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs leading-relaxed"
                />
              </div>
            </div>

            {/* Drawer Footer - Action Save & Sync */}
            <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 font-mono">Row_ID: {selectedItem.rowId}</span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="py-2 px-3.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  onClick={handleSaveDrawerEdits}
                  disabled={isDrawerSaving}
                  className="flex items-center gap-1.5 py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  title="Lưu tất cả thông tin vừa chỉnh sửa và tự động đồng bộ về Google Sheet"
                >
                  <Save className={`w-4 h-4 ${isDrawerSaving ? 'animate-spin' : ''}`} />
                  <span>{isDrawerSaving ? 'Đang lưu & Sync Sheet...' : '💾 Lưu & Sync Trực Tiếp Về Google Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE SEND EMAIL ACTION MODAL WITH STRICT VALIDATION & RECORDING */}
      {isMailModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 text-sky-600 rounded-lg">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Tạo Email Raise Bảo Hành Cho Supplier
                  </h3>
                  <p className="text-xs text-muted-foreground">Chuẩn hóa tiêu đề & ghi nhận thời gian raise mail tự động</p>
                </div>
              </div>
              <button
                onClick={() => setIsMailModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* VALIDATION WARNING BANNER */}
            {validationError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-sm block">Thiếu Thông Tin Bắt Buộc!</span>
                  <p className="leading-relaxed">{validationError}</p>
                </div>
              </div>
            )}

            {/* SUCCESS BANNER */}
            {mailSentSuccess && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{mailSentSuccess}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Gửi đến (To):</label>
                  <input
                    type="email"
                    value={mailTo}
                    onChange={(e) => setMailTo(e.target.value)}
                    placeholder="email.supplier@domain.com"
                    disabled={!!validationError}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Đồng kính gửi (CC):</label>
                  <input
                    type="email"
                    value={mailCc}
                    onChange={(e) => setMailCc(e.target.value)}
                    placeholder="vis.tech@unilever.com"
                    disabled={!!validationError}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              {/* STRICT SUBJECT FORMAT DISPLAY */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tiêu đề Email Chuẩn (Subject Format):</span>
                  <span className="text-[10px] text-slate-400 font-mono">[Bảo hành]-[BH-xxx]: mã dự án + tên dự án</span>
                </label>
                <input
                  type="text"
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  disabled={!!validationError}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs font-bold text-sky-800 dark:text-sky-300 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Nội dung Email (Body):</label>
                <textarea
                  rows={7}
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  disabled={!!validationError}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs leading-relaxed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(mailSubject, 'subjectOnly')}
                  disabled={!!validationError}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
                >
                  {copiedText === 'subjectOnly' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>Chép Tiêu Đề</span>
                </button>

                {/* EXPLICIT CONFIRMATION BUTTON ONLY - TRIGGERS SYNC */}
                <button
                  onClick={handleConfirmMailSent}
                  disabled={!!validationError || isSyncingToSheet}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                  title="Bấm nút này sau khi đã gửi mail thực tế để lưu & sync Sheet"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingToSheet ? 'animate-spin' : ''}`} />
                  <span>{isSyncingToSheet ? 'Đang sync Sheet...' : 'Xác Nhận Đã Gửi Mail (Lưu & Sync Sheet)'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* PURE ACTION TRIPPERS (NO AUTO-SAVE) */}
                <button
                  onClick={handleTriggerMailto}
                  disabled={!!validationError}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50"
                  title="Chỉ mở ứng dụng Outlook để soạn mail (không tự động lưu)"
                >
                  <Mail className="w-4 h-4 text-sky-600" />
                  <span>Mở Outlook App</span>
                </button>

                <button
                  onClick={handleTriggerGmailWeb}
                  disabled={!!validationError}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  title="Chỉ mở tab Gmail Web để soạn mail (không tự động lưu)"
                >
                  <Send className="w-4 h-4" />
                  <span>Mở Gmail Web</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL CONFIG MODAL */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-sky-500" />
                Cấu Hình Nguồn Google Sheet & Web App Sync API
              </h3>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cấu hình liên kết xuất CSV của tab <strong>BaoHanh_Model</strong> và URL Web App để tự động sync dữ liệu từ Dashboard về Sheet.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Google Sheet CSV Export URL:
                </label>
                <input
                  type="text"
                  value={tempUrlInput}
                  onChange={(e) => setTempUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=2053849390"
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-sky-500" />
                  Google Apps Script Web App URL (Đồng bộ 2 chiều ngầm):
                </label>
                <input
                  type="text"
                  value={tempWebAppInput}
                  onChange={(e) => setTempWebAppInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
                <span className="text-[10px] text-muted-foreground">
                  URL sau khi triển khai Web App trên Google Apps Script (Thực thi: Me, Quyền: Anyone).
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-secondary rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSheetUrl}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm cursor-pointer"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL FOR DEDICATED SLA DURATION BREAKDOWN LIST */}
      {slaModalData && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-sky-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {slaModalData.title}
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-mono text-xs">
                      {slaModalData.badge}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bấm vào bất kỳ ca nào để mở bảng chỉnh sửa chi tiết.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSlaModalData(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Search & Filter Bar */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={slaModalFilter}
                onChange={(e) => setSlaModalFilter(e.target.value)}
                placeholder="Tìm kiếm mã request, tên cửa hàng, loại POSM..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-medium"
              />
            </div>

            {/* Scrollable Cases List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-0">
              {slaModalData.items
                .filter(({ item }) => {
                  if (!slaModalFilter.trim()) return true;
                  const q = slaModalFilter.toLowerCase().trim();
                  return (
                    item.requestId.toLowerCase().includes(q) ||
                    item.storeName.toLowerCase().includes(q) ||
                    item.storeCode.toLowerCase().includes(q) ||
                    item.posmType.toLowerCase().includes(q)
                  );
                })
                .map(({ item, days }) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSlaModalData(null);
                      setSelectedItem(item);
                    }}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-slate-200 dark:border-slate-800 hover:border-sky-300 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-mono font-black text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded shrink-0">
                        {item.requestId}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                          {item.storeName}
                        </span>
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {item.storeCode ? `${item.storeCode} • ` : ''}{item.posmType} {item.brand ? `(${item.brand})` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                        Lắp xong {days} ngày ➔ Bị lỗi
                      </span>
                      <button className="px-2.5 py-1 text-[11px] font-bold text-sky-600 bg-sky-100 dark:bg-sky-950 rounded-lg group-hover:bg-sky-600 group-hover:text-white transition-colors cursor-pointer flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>Xem</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-3 shrink-0">
              <span className="text-xs text-muted-foreground font-mono">
                Tổng số: <strong>{slaModalData.items.length}</strong> ca trong nhóm
              </span>
              <button
                onClick={() => setSlaModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                Đóng Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
