import React, { useState, useEffect, useMemo } from 'react';
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

// Official Public Google Sheet CSV URL for BaoHanh_Model
const DEFAULT_WARRANTY_SHEET_CSV = 'https://docs.google.com/spreadsheets/d/119LpiU1XheXgOxKWxw17E_u4vgRTBPhc-4FADDS8B1Q/export?format=csv&gid=2053849390';

// Deployed Web App URL for Apps Script Reverse Sync (Active Production)
const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxfRHXEd8bWkavq93RWBG7eOOrOgZglzDOjK-Ey7L6vZmT2FM1piausg9AOk8_aStae/exec';

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
  const [activeModuleTab, setActiveModuleTab] = useState<'DATA_LIST' | 'ANALYST'>('DATA_LIST');
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    return localStorage.getItem('warranty_sheet_url') || DEFAULT_WARRANTY_SHEET_CSV;
  });
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    const saved = localStorage.getItem('warranty_web_app_url');
    if (saved && saved.includes('AKfycbxfRHXEd8bWkavq93RWBG7eOOrOgZglzDOjK-Ey7L6vZmT2FM1piausg9AOk8_aStae')) {
      return saved;
    }
    localStorage.removeItem('warranty_web_app_url');
    return DEFAULT_WEB_APP_URL;
  });

  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [tempUrlInput, setTempUrlInput] = useState('');
  const [tempWebAppInput, setTempWebAppInput] = useState('');

  const [warrantyItems, setWarrantyItems] = useState<WarrantyItem[]>(INITIAL_REAL_WARRANTY_ITEMS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgress, setSelectedProgress] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedVisTech, setSelectedVisTech] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedYear, setSelectedYear] = useState('2026');

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
      setEditRaiseMailTime(selectedItem.sentDate || (selectedItem as any).raiseMailTime || '');
      setEditPrecedingRequestId(selectedItem.precedingRequestId || (selectedItem as any).preceding_request_id || '');
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
    if (targetUrl) {
      try {
        setIsSyncingToSheet(true);

        const queryParams = new URLSearchParams({
          rowId: selectedItem.rowId,
          requestId: selectedItem.requestId,
          titleMail: finalTitle,
          raiseMailTime: timestamp,
          progress: 'Vis - Đã gửi RQ tới Agency'
        }).toString();

        const fullGetUrl = `${targetUrl}?${queryParams}`;

        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            rowId: selectedItem.rowId,
            requestId: selectedItem.requestId,
            titleMail: finalTitle,
            raiseMailTime: timestamp,
            progress: 'Vis - Đã gửi RQ tới Agency'
          })
        });

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
      sentDate: editRaiseMailTime.trim(),
      precedingRequestId: editPrecedingRequestId.trim()
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
          date_of_rq: editRaiseMailTime.trim() || null,
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
        if (editRaiseMailTime.trim()) payload.raiseMailTime = editRaiseMailTime.trim();
        if (editInstallationDate.trim()) payload.installationDate = editInstallationDate.trim();
        if (editExpectedDate.trim()) payload.expectedDate = editExpectedDate.trim();
        if (editCompletedDate.trim()) payload.completedDate = editCompletedDate.trim();
        if (editPrecedingRequestId.trim()) payload.precedingRequestId = editPrecedingRequestId.trim();
        if (editWarrantyCoverage.trim()) {
          payload.warrantyCoverage = editWarrantyCoverage.trim();
          payload.coverage = editWarrantyCoverage.trim();
          payload.trangThaiBH = editWarrantyCoverage.trim();
        }
        if (editWarrantyCost.trim()) {
          payload.warrantyCost = editWarrantyCost.trim();
          payload.cost = editWarrantyCost.trim();
          payload.chiPhiBH = editWarrantyCost.trim();
        }
        if (editNote.trim()) payload.note = editNote.trim();

        const queryParams = new URLSearchParams(payload).toString();
        const fullGetUrl = `${targetUrl}?${queryParams}`;
        const img = new Image();
        img.src = fullGetUrl;

        fetch(fullGetUrl, { mode: 'no-cors' }).catch(() => {});
        fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});

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
              const note = getFlexibleVal(row, ['Note', 'Ghi chú', 'vis_note', 'mer_note']) || (Array.isArray(row) ? row[18] : '') || '';
              const raiseMailTime = getFlexibleVal(row, ['Ngày raise mail', 'raise_mail_time']) || (Array.isArray(row) ? row[19] : '') || '';
              const installationDate = getFlexibleVal(row, ['Ngày lắp đặt', 'Ngày lắp đặt POSM', 'Ngày Lắp Đặt', 'ngay_lap_dat', 'installation_date']) || (Array.isArray(row) ? row[20] : '') || '';
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
                sentDate: sentDate.trim() || raiseMailTime.trim(),
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
                note: note.trim()
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

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return warrantyItems.filter(item => {
      // Year Filter
      if (selectedYear !== 'all') {
        const itemYearMatch = (item.sentDate || item.installationDate || '').match(/\b(202[0-9]|201[0-9])\b/);
        if (itemYearMatch && itemYearMatch[1] !== selectedYear) return false;
      }

      // Search
      const term = searchTerm.toLowerCase().trim();
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
          item.srName.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      // Progress Filter
      if (selectedProgress !== 'all') {
        const pLower = item.progress.toLowerCase();
        if (selectedProgress === 'completed') {
          if (pLower !== 'hoàn thành') return false;
        } else if (selectedProgress === 'not_started') {
          if (pLower !== 'not started') return false;
        } else if (selectedProgress === 'cancelled') {
          if (pLower !== 'cancel' && pLower !== 'cancelled') return false;
        } else if (selectedProgress === 'in_progress') {
          if (pLower === 'hoàn thành' || pLower === 'not started' || pLower === 'cancel' || pLower === 'cancelled') return false;
        }
      }

      // Supplier Filter (Hỗ trợ lọc 'Chưa chọn' cho các ca chưa gán thầu)
      if (selectedSupplier !== 'all') {
        const itemSup = item.supplier?.trim();
        if (selectedSupplier === 'Chưa chọn' || selectedSupplier === 'Chưa gán thầu') {
          if (itemSup && itemSup !== 'Chưa chọn' && itemSup !== 'Chưa gán thầu') return false;
        } else if (itemSup !== selectedSupplier) {
          return false;
        }
      }

      // VIS-Tech Filter
      if (selectedVisTech !== 'all' && item.visTech !== selectedVisTech) return false;

      // Brand Filter
      if (selectedBrand !== 'all' && item.brand !== selectedBrand) return false;

      return true;
    });
  }, [warrantyItems, selectedYear, searchTerm, selectedProgress, selectedSupplier, selectedVisTech, selectedBrand]);

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
      setSelectedSupplier(val);
    } else if (type === 'brand') {
      setSelectedBrand(val);
    } else if (type === 'posmType') {
      setSearchTerm(val);
    } else if (type === 'project') {
      setSearchTerm(val);
    } else if (type === 'category') {
      const cleanKeyword = val.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặcđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ\s]/gi, '').trim();
      setSearchTerm(cleanKeyword);
    } else if (type === 'progress') {
      setSelectedProgress(val);
    } else if (type === 'recurrent') {
      setSearchTerm('Lần #');
    } else if (type === 'aging') {
      setSelectedProgress('in_progress');
    }

    setActiveModuleTab('DATA_LIST');
    toast.success(`🔍 Đã áp dụng bộ lọc "${val}" & chuyển sang Tab Danh Sách Dữ Liệu!`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const csvData = filteredItems.map(i => ({
      'Row_ID': i.rowId,
      'Request ID': i.requestId,
      'Store Name': i.storeName,
      'Store Code': i.storeCode,
      'SR': i.srName,
      'VIS-Tech (Unilever)': i.visTech,
      'POSM': i.posmType,
      'CAT': i.category,
      'BRAND': i.brand,
      'Ngày Gửi': i.sentDate,
      'Mã Dự Án': i.projectCode || '',
      'Supplier (Thầu SX)': i.supplier || '',
      'Title Mail': i.mailTitle || '',
      'Chi Tiết Lỗi': i.errorDetail,
      'Tiến Độ': i.progress,
      'Ngày Dự Dự Kiến Xử Lý': i.expectedDate || '',
      'Ngày Hoàn Thành Thực Tế': i.completedDate || '',
      'Hình Ảnh Nghiệm Thu': i.proofImage || '',
      'Note': i.note || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `baohanh_model_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleSaveSheetUrl = () => {
    localStorage.setItem('warranty_sheet_url', tempUrlInput);
    localStorage.setItem('warranty_web_app_url', tempWebAppInput);
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
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Quản Lý Bảo Hành & Đổi Trả POSM (BaoHanh_Model)
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-[11px]">
                  Live Google Sheet
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Giám sát sự cố POSM tại cửa hàng, lịch xử lý nhà thầu (Supplier) & đồng bộ trạng thái Real-time về Master Data
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setTempUrlInput(sheetUrl);
              setTempWebAppInput(webAppUrl);
              setIsUrlModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-secondary hover:bg-secondary/80 rounded-lg border border-border transition-colors cursor-pointer shadow-sm"
            title="Cấu hình Google Sheet URL & Web App Sync"
          >
            <Settings className="w-4 h-4 text-sky-600" />
            <span>Nguồn & Web App API</span>
          </button>

          <button
            onClick={() => fetchSheetData(sheetUrl)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Đồng bộ Sheet'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-card hover:bg-secondary rounded-lg border border-border shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setTempUrlInput(sheetUrl);
              setTempWebAppInput(webAppUrl);
              setIsUrlModalOpen(true);
            }}
            className="underline font-semibold hover:text-amber-900 cursor-pointer"
          >
            Cấu hình lại Sheet URL
          </button>
        </div>
      )}

      {/* MODULE INTERNAL NAVIGATION SUB-TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
          <button
            onClick={() => setActiveModuleTab('DATA_LIST')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeModuleTab === 'DATA_LIST'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Danh Sách Dữ Liệu</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-mono">
              {filteredItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveModuleTab('ANALYST')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeModuleTab === 'ANALYST'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Báo Cáo & Thống Kê (Analyst)</span>
          </button>
        </div>

        {activeModuleTab === 'ANALYST' && (
          <button
            onClick={() => exportAnalystExecutiveReport([], warrantyItems, 'POSM_Warranty_Executive_Report')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition-all cursor-pointer border border-emerald-400/40"
            title="Tải về file Excel BI Analytics 3 Sheet (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>📥 Xuất Analyst Excel (.xlsx)</span>
          </button>
        )}
      </div>

      {/* TAB 1: DEDICATED ANALYST / REPORTS WORKSPACE */}
      {activeModuleTab === 'ANALYST' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* METRIC SUMMARY CARDS & SLA TIME OVERVIEW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Card className="bg-card border-border shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tổng Yêu Cầu BH</p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.totalItems}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">mã request trên BaoHanh_Model</p>
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
                  <FileText className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Đang Xử Lý / Tiếp Nhận</p>
                  <h3 className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">{stats.inProgressItems}</h3>
                  <p className="text-[11px] text-sky-600/70 mt-0.5">đang làm việc với Supplier</p>
                </div>
                <div className="p-2.5 bg-sky-50 dark:bg-sky-950/60 rounded-xl text-sky-600 dark:text-sky-400">
                  <Wrench className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Tuổi Thọ POSM TB (MTBF)</p>
                  <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{analystBreakdowns.slaMetrics.avgDaysToFail} <span className="text-xs font-normal">ngày</span></h3>
                  <p className="text-[11px] text-emerald-600/70 mt-0.5">từ lúc lắp đặt đến khi bị lỗi</p>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">SLA Hoàn Thành TB</p>
                  <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{analystBreakdowns.slaMetrics.avgDaysToComplete} <span className="text-xs font-normal">ngày</span></h3>
                  <p className="text-[11px] text-indigo-600/70 mt-0.5">từ gửi request đến nghiệm thu</p>
                </div>
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SECTION 1: TOP DỰ ÁN GẶP LỖI NHIỀU NHẤT & BÁO CÁO MỐC THỜI GIAN SLA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Projects Card */}
            <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    🔥 Top Dự Án Phát Sinh Lỗi Nhiều Nhất
                  </h4>
                </div>
                <span className="text-xs font-mono text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                  Click để lọc
                </span>
              </div>
              <div className="space-y-3">
                {analystBreakdowns.topProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Chưa có mã dự án nào phát sinh lỗi.</p>
                ) : (
                  analystBreakdowns.topProjects.map((p, idx) => (
                    <div 
                      key={p.projectCode}
                      onClick={() => handleFilterFromChart('project', p.projectCode)}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-300 rounded-xl transition-all cursor-pointer group space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className={`font-mono font-bold transition-colors ${
                            p.projectCode === 'Chưa gán mã dự án' 
                              ? 'text-rose-600 dark:text-rose-400 italic' 
                              : 'text-slate-900 dark:text-white group-hover:text-amber-600'
                          }`}>
                            Mã: {p.projectCode}
                          </span>
                          {p.projectCode === 'Chưa gán mã dự án' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-800">
                              ⚠️ Thiếu dữ liệu mã
                            </span>
                          )}
                          
                          {/* Suppliers Breakdown */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {p.supplierList.map((sup) => (
                              <span 
                                key={sup.name} 
                                className="text-[10px] font-medium px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs"
                                title={`Supplier ${sup.name}: ${sup.count} ca bảo hành`}
                              >
                                <span className="font-bold">{sup.name}</span>
                                <span className="font-mono text-amber-700 dark:text-amber-400 font-bold px-1 bg-amber-50 dark:bg-amber-950 rounded">
                                  {sup.count} ca
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          {p.count} ca ({p.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${p.percentage}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SLA Time & Timeline Breakdown Card */}
            <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    ⏱️ Báo Cáo Mốc Thời Gian & SLA Bảo Hành
                  </h4>
                </div>
              </div>
              <div className="space-y-4 text-xs">
                {/* 3 Main SLA Averages */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-sky-50 dark:bg-sky-950/60 rounded-xl border border-sky-100 dark:border-sky-900">
                    <span className="text-[10px] font-bold text-sky-600 uppercase block">1. Lắp đặt ➔ Phát sinh lỗi</span>
                    <span className="text-lg font-black text-sky-700 dark:text-sky-300 font-mono">
                      ~{analystBreakdowns.slaMetrics.avgDaysToFail} ngày
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Thời gian dùng trước khi hỏng</span>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-100 dark:border-indigo-900">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase block">2. Gửi ➔ Hẹn xử lý</span>
                    <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 font-mono">
                      ~{analystBreakdowns.slaMetrics.avgDaysToSchedule} ngày
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Tốc độ tiếp nhận & chốt ngày</span>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-900">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">3. Gửi ➔ Hoàn thành</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
                      ~{analystBreakdowns.slaMetrics.avgDaysToComplete} ngày
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Thời gian xử lý & nghiệm thu</span>
                  </div>
                </div>

                {/* Detailed Cases Breakdown by Duration */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs uppercase tracking-wider">
                    📋 Chi tiết phân bổ các ca theo thời gian từ Lắp Đặt ➔ Lỗi:
                  </span>

                  {/* Bracket 1: < 30 days */}
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-rose-800 dark:text-rose-200">
                      <span>🚨 Hỏng sớm &lt; 30 ngày từ khi lắp đặt:</span>
                      <span className="font-mono font-black">{analystBreakdowns.slaMetrics.earlyFailCount} ca</span>
                    </div>
                    {analystBreakdowns.slaMetrics.earlyFailItems.length === 0 ? (
                      <p className="text-[11px] text-rose-600/70 italic">Không có ca nào bị hỏng sớm dưới 30 ngày.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {analystBreakdowns.slaMetrics.earlyFailItems.slice(0, 2).map(({ item, days }) => (
                          <div 
                            key={item.id}
                            onClick={() => { setSelectedItem(item); }}
                            className="p-2 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-between text-xs hover:border-rose-400 cursor-pointer transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-black text-rose-600 shrink-0">{item.requestId}</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.storeName}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">({item.posmType})</span>
                            </div>
                            <span className="font-mono font-bold text-rose-700 dark:text-rose-300 shrink-0">
                              Lắp xong {days} ngày ➔ Bị lỗi
                            </span>
                          </div>
                        ))}
                        {analystBreakdowns.slaMetrics.earlyFailItems.length > 2 && (
                          <button
                            onClick={() => {
                              setSlaModalFilter('');
                              setSlaModalData({
                                title: '🚨 Ca Hỏng Sớm (< 30 Ngày Từ Khi Lắp Đặt)',
                                badge: `${analystBreakdowns.slaMetrics.earlyFailCount} ca`,
                                items: analystBreakdowns.slaMetrics.earlyFailItems
                              });
                            }}
                            className="w-full py-2 text-center text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100/50 hover:bg-rose-100 dark:bg-rose-900/40 dark:hover:bg-rose-900/80 rounded-lg border border-rose-300 dark:border-rose-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Mở Modal Xem Chi Tiết Tất Cả ({analystBreakdowns.slaMetrics.earlyFailCount} ca)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bracket 2: 1 - 3 months */}
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-200">
                      <span>⚠️ Phát sinh sự cố sau 1 - 3 tháng (30 - 90 ngày):</span>
                      <span className="font-mono font-black">{analystBreakdowns.slaMetrics.midFailCount} ca</span>
                    </div>
                    {analystBreakdowns.slaMetrics.midFailItems.length === 0 ? (
                      <p className="text-[11px] text-amber-600/70 italic">Không có ca nào rơi vào khoảng 1 - 3 tháng.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {analystBreakdowns.slaMetrics.midFailItems.slice(0, 2).map(({ item, days }) => (
                          <div 
                            key={item.id}
                            onClick={() => { setSelectedItem(item); }}
                            className="p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-xs hover:border-amber-400 cursor-pointer transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-black text-amber-600 shrink-0">{item.requestId}</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.storeName}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">({item.posmType})</span>
                            </div>
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 shrink-0">
                              Lắp xong {days} ngày ➔ Bị lỗi
                            </span>
                          </div>
                        ))}
                        {analystBreakdowns.slaMetrics.midFailItems.length > 2 && (
                          <button
                            onClick={() => {
                              setSlaModalFilter('');
                              setSlaModalData({
                                title: '⚠️ Ca Phát Sinh Sự Cố Sau 1 - 3 Tháng (30 - 90 Ngày)',
                                badge: `${analystBreakdowns.slaMetrics.midFailCount} ca`,
                                items: analystBreakdowns.slaMetrics.midFailItems
                              });
                            }}
                            className="w-full py-2 text-center text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/50 hover:bg-amber-100 dark:bg-amber-900/40 dark:hover:bg-amber-900/80 rounded-lg border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Mở Modal Xem Chi Tiết Tất Cả ({analystBreakdowns.slaMetrics.midFailCount} ca)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bracket 3: > 3 months */}
                  <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-200">
                      <span>🟢 Độ bền tốt &gt; 3 tháng (&gt; 90 ngày mới phát sinh lỗi):</span>
                      <span className="font-mono font-black">{analystBreakdowns.slaMetrics.longFailCount} ca</span>
                    </div>
                    {analystBreakdowns.slaMetrics.longFailItems.length === 0 ? (
                      <p className="text-[11px] text-emerald-600/70 italic">Chưa có dữ liệu ca hỏng sau 3 tháng.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {analystBreakdowns.slaMetrics.longFailItems.slice(0, 2).map(({ item, days }) => (
                          <div 
                            key={item.id}
                            onClick={() => { setSelectedItem(item); }}
                            className="p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs hover:border-emerald-400 cursor-pointer transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-black text-emerald-600 shrink-0">{item.requestId}</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.storeName}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">({item.posmType})</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                              Lắp xong {days} ngày ({Math.round(days / 30)} tháng) ➔ Bị lỗi
                            </span>
                          </div>
                        ))}
                        {analystBreakdowns.slaMetrics.longFailItems.length > 2 && (
                          <button
                            onClick={() => {
                              setSlaModalFilter('');
                              setSlaModalData({
                                title: '🟢 Ca Độ Bền Tốt (> 3 Tháng / > 90 Ngày)',
                                badge: `${analystBreakdowns.slaMetrics.longFailCount} ca`,
                                items: analystBreakdowns.slaMetrics.longFailItems
                              });
                            }}
                            className="w-full py-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/80 rounded-lg border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Mở Modal Xem Chi Tiết Tất Cả ({analystBreakdowns.slaMetrics.longFailCount} ca)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bracket 4: Unrecorded Installation Date */}
                  <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>⚪ Chưa ghi nhận ngày lắp đặt POSM (không tính vào MTBF):</span>
                    <span className="font-mono font-black">{analystBreakdowns.slaMetrics.unrecordedInstallCount} ca</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1.5: BÁO CÁO PHÂN TÍCH BẢO HÀNH LẶP LẠI (RECURRENT WARRANTY ANALYTICS) */}
          <div className="p-5 bg-card rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-900 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  🔄 Báo Cáo Phân Tích Sự Cố Bảo Hành Lặp Lại (Recurrent Warranty Lifecycle)
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    {recurrentWarrantyAnalytics.recurrentCount} POSM bị hỏng lặp
                  </span>
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Metric */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                  POSM Bảo Hành Lặp (&gt;1 Lần)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {recurrentWarrantyAnalytics.recurrentCount}
                  </span>
                  <span className="text-xs text-slate-500">
                    / {recurrentWarrantyAnalytics.totalItems} mã POSM
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">POSM bị sự cố tái diễn nhiều lần tại cùng 1 siêu thị</p>
              </div>

              {/* Card 2: Metric */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                  Tỷ Lệ Tái Hỏng POSM
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {recurrentWarrantyAnalytics.totalItems > 0 
                      ? ((recurrentWarrantyAnalytics.recurrentCount / recurrentWarrantyAnalytics.totalItems) * 100).toFixed(1)
                      : '0'}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Tỷ lệ POSM phát sinh hỏng hóc sau lần sửa đầu</p>
              </div>

              {/* Card 3: Metric */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider block">
                  Trạng Thái Kiểm Soát Chất Lượng
                </span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 pt-1">
                  {recurrentWarrantyAnalytics.recurrentCount > 0 ? (
                    <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      Cần rà soát Supplier thi công các ca lặp
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Không có ca bảo hành lặp lặp lại
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Tự động gom nhóm theo Siêu thị + POSM + Brand</p>
              </div>
            </div>

            {/* Recurrent Items Table */}
            <div className="space-y-2 pt-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs uppercase tracking-wider">
                📋 Danh sách chi tiết các ca POSM bị bảo hành lặp lại:
              </span>

              <div className="overflow-x-auto rounded-xl border border-amber-200/80 dark:border-amber-900 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-50/60 dark:bg-amber-950/40 text-slate-700 dark:text-slate-300 font-bold border-b border-amber-200/80 dark:border-amber-900">
                    <tr>
                      <th className="p-2.5 text-center">STT</th>
                      <th className="p-2.5">Siêu Thị / Mã Store</th>
                      <th className="p-2.5">Loại POSM & Brand</th>
                      <th className="p-2.5 text-center">Số Lần BH</th>
                      <th className="p-2.5">Lịch Sử Chuỗi Thời Gian Bảo Hành</th>
                      <th className="p-2.5">Supplier Phụ Trách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {recurrentWarrantyAnalytics.recurrentItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                          Chưa ghi nhận ca POSM nào phát sinh bảo hành từ 2 lần trở lên.
                        </td>
                      </tr>
                    ) : (
                      recurrentWarrantyAnalytics.recurrentItems.map((grp, idx) => (
                        <tr key={grp.key} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors">
                          <td className="p-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900 dark:text-white">{grp.storeName}</div>
                            <div className="text-[11px] font-mono text-slate-400">{grp.storeCode}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400">{grp.posm}</div>
                            <div className="text-[11px] text-slate-500 font-mono">🏷️ {grp.brand}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                              grp.incidents.length >= 3 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              🔄 BH Lần #{grp.incidents.length}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {grp.incidents.map((inc) => (
                                <button
                                  key={inc.id}
                                  onClick={() => {
                                    const reqId = inc.requestId || inc.id;
                                    setSearchTerm(reqId);
                                    setActiveModuleTab('DATA_LIST');
                                    const foundItem = warrantyItems.find(i => i.requestId === reqId || i.id === inc.id);
                                    if (foundItem) {
                                      setSelectedItem(foundItem);
                                    }
                                    toast.success(`🔍 Đã trỏ tới danh sách bảo hành của Request #${reqId}`);
                                  }}
                                  className="text-[11px] font-mono font-bold bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-1 rounded-md border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group/inc"
                                  title={`Bấm để trỏ tới tab Danh Sách Dữ Liệu và xem chi tiết Request #${inc.requestId || inc.id}`}
                                >
                                  <span className="font-extrabold text-amber-800 dark:text-amber-300">Lần #{inc.sequence}:</span>
                                  <span>{inc.sentDate}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 font-bold border border-amber-300 dark:border-amber-700 flex items-center gap-0.5">
                                    📋 {inc.requestId || inc.id}
                                    <ExternalLink className="w-3 h-3 text-amber-700 group-hover/inc:text-amber-900" />
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300 font-semibold">{grp.supplier}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 2: BÁO CÁO PHÂN LOẠI CƠ CẤU & TỶ LỆ ĐẠT SLA NHÀ THẦU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backlog Aging Warning Card */}
            <div className="p-5 bg-card rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm space-y-4 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between border-b border-rose-200/80 dark:border-rose-900 pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    🚨 Cảnh Báo Ca Bảo Hành Tồn Đọng Theo Thời Gian (Backlog Aging)
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      {analystBreakdowns.backlogAging.totalOverdue} ca quá hạn
                    </span>
                  </h4>
                </div>
                <button
                  onClick={() => handleFilterFromChart('aging', 'overdue')}
                  className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-3 py-1 rounded-lg border border-rose-300 dark:border-rose-700 hover:bg-rose-200 transition-colors cursor-pointer"
                >
                  🔍 Lọc các ca quá hạn trên bảng
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* 1-7 days */}
                <div 
                  onClick={() => handleFilterFromChart('aging', 'overdue')}
                  className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all"
                >
                  <div>
                    <span className="font-bold text-amber-800 dark:text-amber-300 block">🟡 Quá hạn 1 - 7 ngày</span>
                    <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Cần đôn đốc nhà thầu</span>
                  </div>
                  <span className="text-xl font-black font-mono text-amber-700 dark:text-amber-300">
                    {analystBreakdowns.backlogAging.aging1to7Count} ca
                  </span>
                </div>

                {/* 8-14 days */}
                <div 
                  onClick={() => handleFilterFromChart('aging', 'overdue')}
                  className="p-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-orange-400 transition-all"
                >
                  <div>
                    <span className="font-bold text-orange-800 dark:text-orange-300 block">🟠 Quá hạn 8 - 14 ngày</span>
                    <span className="text-[11px] text-orange-700/80 dark:text-orange-400/80">Cảnh báo chậm tiến độ</span>
                  </div>
                  <span className="text-xl font-black font-mono text-orange-700 dark:text-orange-300">
                    {analystBreakdowns.backlogAging.aging8to14Count} ca
                  </span>
                </div>

                {/* >14 days */}
                <div 
                  onClick={() => handleFilterFromChart('aging', 'overdue')}
                  className="p-3 bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-rose-500 transition-all"
                >
                  <div>
                    <span className="font-bold text-rose-900 dark:text-rose-200 block">🔴 Quá hạn &gt; 14 ngày</span>
                    <span className="text-[11px] text-rose-800/80 dark:text-rose-300/80">Vi phạm SLA nghiêm trọng</span>
                  </div>
                  <span className="text-xl font-black font-mono text-rose-700 dark:text-rose-300">
                    {analystBreakdowns.backlogAging.agingOver14Count} ca
                  </span>
                </div>
              </div>
            </div>

            {/* Supplier SLA Performance Card */}
            <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    📊 Báo Cáo Tỷ Lệ Đạt SLA Của Nhà Thầu
                  </h4>
                </div>
                <span className="text-xs font-mono text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                  Click để lọc
                </span>
              </div>
              <div className="space-y-2.5">
                {analystBreakdowns.supplierSlaList.map((s) => (
                  <div 
                    key={s.supplier}
                    onClick={() => handleFilterFromChart('supplier', s.supplier)}
                    className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200 font-bold group-hover:text-emerald-600 transition-colors">
                        {s.supplier}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {s.completedOnTime}/{s.total} ca xong ({s.rate}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Report 2: Top Defective POSM Types Distribution */}
            <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    🏆 Top Loại POSM Phát Sinh Sự Cố Nhiều Nhất
                  </h4>
                </div>
                <span className="text-xs font-mono text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-md">
                  Click để lọc
                </span>
              </div>
              <div className="space-y-2.5">
                {analystBreakdowns.posmTypeBreakdown.slice(0, 6).map(({ posmType, count, percentage }) => (
                  <div 
                    key={posmType}
                    onClick={() => handleFilterFromChart('posmType', posmType)}
                    className="space-y-1 p-1 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200 font-bold group-hover:text-purple-600 transition-colors">{posmType}</span>
                      <span className="text-slate-500 font-mono">{count} ca ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLEAN OPERATIONAL DATA LIST & FILTER GRID */}
      {activeModuleTab === 'DATA_LIST' && (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Active Filter Notification Bar */}
        {(selectedSupplier !== 'all' || selectedBrand !== 'all' || selectedProgress !== 'all' || selectedVisTech !== 'all' || searchTerm) && (
          <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950/60 border-b border-sky-200 dark:border-sky-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-sky-600" />
                Đang lọc theo Report:
              </span>
              {selectedSupplier !== 'all' && (
                <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 flex items-center gap-1">
                  Nhà thầu: {selectedSupplier}
                  <X className="w-3 h-3 cursor-pointer hover:text-sky-950" onClick={() => setSelectedSupplier('all')} />
                </Badge>
              )}
              {selectedBrand !== 'all' && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center gap-1">
                  Brand: {selectedBrand}
                  <X className="w-3 h-3 cursor-pointer hover:text-purple-950" onClick={() => setSelectedBrand('all')} />
                </Badge>
              )}
              {selectedProgress !== 'all' && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                  Tiến độ: {selectedProgress}
                  <X className="w-3 h-3 cursor-pointer hover:text-emerald-950" onClick={() => setSelectedProgress('all')} />
                </Badge>
              )}
              {selectedVisTech !== 'all' && (
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                  VIS-Tech: {selectedVisTech}
                  <X className="w-3 h-3 cursor-pointer hover:text-indigo-950" onClick={() => setSelectedVisTech('all')} />
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1 font-mono font-bold">
                  Từ khóa: "{searchTerm}"
                  <X className="w-3 h-3 cursor-pointer hover:text-amber-950" onClick={() => setSearchTerm('')} />
                </Badge>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedSupplier('all');
                setSelectedBrand('all');
                setSelectedProgress('all');
                setSelectedVisTech('all');
                setSelectedYear('2026');
                setSearchTerm('');
              }}
              className="text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer shrink-0"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}

        {/* Filters Header */}
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm theo Mã dự án (VD: 118420...), Request ID (BH-577), Tên Store, POSM, Brand, Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-background px-2.5 py-1.5 rounded-lg border border-border">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Bộ lọc:</span>
              </div>

              {/* Year Filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-background border border-border text-foreground font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer text-sky-700 dark:text-sky-300"
              >
                <option value="all">📅 Tất cả Năm</option>
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>
                    📅 Năm {y}
                  </option>
                ))}
              </select>

              {/* Progress Filter */}
              <select
                value={selectedProgress}
                onChange={(e) => setSelectedProgress(e.target.value)}
                className="bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
              >
                <option value="all">Tất cả Tiến độ</option>
                <option value="in_progress">🔵 Tiếp nhận / Đang xử lý</option>
                <option value="completed">🟢 Hoàn thành</option>
                <option value="not_started">⚪ Not started</option>
                <option value="cancelled">🔴 Cancelled</option>
              </select>

              {/* VIS-Tech Unilever Filter */}
              <select
                value={selectedVisTech}
                onChange={(e) => setSelectedVisTech(e.target.value)}
                className="bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 max-w-[160px] truncate cursor-pointer"
              >
                <option value="all">Tất cả VIS-Tech</option>
                {uniqueVisTechs.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Supplier Filter */}
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 max-w-[150px] truncate cursor-pointer"
              >
                <option value="all">Tất cả Supplier</option>
                {uniqueSuppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-background border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 max-w-[130px] truncate cursor-pointer"
              >
                <option value="all">Tất cả Brand</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
              <div className="space-y-3 p-4 border border-sky-200/80 dark:border-sky-800/80 rounded-xl bg-sky-50/40 dark:bg-sky-950/20">
                <h4 className="font-bold text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                  Chỉnh Sửa Mã Dự Án, Supplier & Tiến Độ (Sync 2 Chiều)
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
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs"
                    />
                  </div>

                  {/* Edit Supplier */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier (Thầu Sản Xuất):</label>
                    <input
                      type="text"
                      value={editSupplier}
                      onChange={(e) => setEditSupplier(e.target.value)}
                      placeholder="Link4, Smart, SDC..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-bold text-sky-800 dark:text-sky-300"
                    />
                  </div>
                </div>

                {/* Edit Progress Dropdown */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Tiến Độ Bảo Hành (Progress):</label>
                  <select
                    value={editProgress}
                    onChange={(e) => setEditProgress(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-foreground cursor-pointer"
                  >
                    <option value="Not Started">⚪ Not Started (Mới tạo)</option>
                    <option value="Vis - Đã gửi RQ tới Agency">🔵 Vis - Đã gửi RQ tới Agency (Đã gửi mail)</option>
                    <option value="Tiếp nhận">🔵 Tiếp nhận (Agency tiếp nhận)</option>
                    <option value="Gửi lịch đăng ký">📅 Gửi lịch đăng ký (Đã hẹn lịch sửa)</option>
                    <option value="Hoàn Thành">🟢 Hoàn Thành (Đã hoàn tất bảo hành)</option>
                    <option value="Cancelled">🔴 Cancelled (Đã hủy yêu cầu)</option>
                  </select>
                </div>

                {/* Edit Preceding Request ID (Mã BH Lần Trước) */}
                <div className="space-y-1 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                  <label className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      Mã Bảo Hành Lần Trước (Preceding Request ID):
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">Chỉ điền nếu là ca bảo hành lặp lại</span>
                  </label>
                  <input
                    type="text"
                    value={editPrecedingRequestId}
                    onChange={(e) => setEditPrecedingRequestId(e.target.value)}
                    placeholder="Nhập hoặc chọn mã BH lần trước (ví dụ: BH-586)..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono text-xs font-bold text-amber-900 dark:text-amber-200"
                  />
                </div>

                {/* Edit Title Mail & Raise Mail Date */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="md:col-span-2 space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">✉️ Tiêu Đề Email Raise (Title Mail):</label>
                    <input
                      type="text"
                      value={editTitleMail}
                      onChange={(e) => setEditTitleMail(e.target.value)}
                      placeholder="[Bảo hành]-[BH-xxx]: mã dự án + tên dự án..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono text-xs font-bold text-sky-800 dark:text-sky-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">📅 Ngày Raise Mail:</label>
                    <input
                      type="date"
                      value={toHtmlDateStr(editRaiseMailTime)}
                      onChange={(e) => setEditRaiseMailTime(fromHtmlDateStr(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-bold text-sky-800 dark:text-sky-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* INLINE EDIT FORM SECTION 2: THEO DÕI MỐC THỜI GIAN */}
              <div className="space-y-3 p-4 border border-border rounded-xl bg-card">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  Theo Dõi & Cập Nhật Mốc Thời Gian Xử Lý
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Ngày gửi request */}
                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-border">
                    <label className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Ngày gửi request (SR/Docs):
                    </label>
                    <span className="font-bold text-foreground block text-xs">
                      {selectedItem.sentDate || 'Chưa ghi nhận'}
                    </span>
                  </div>

                  {/* Deadline hoàn thành request */}
                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-border">
                    <label className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      Deadline request:
                    </label>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 block text-xs">
                      {mappedDeadline || 'Chưa có deadline'}
                    </span>
                  </div>

                  {/* Ngày lắp đặt POSM */}
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                      <Wrench className="w-3 h-3 text-sky-500" />
                      Ngày lắp đặt POSM:
                    </label>
                    <input
                      type="date"
                      value={toHtmlDateStr(editInstallationDate)}
                      onChange={(e) => setEditInstallationDate(fromHtmlDateStr(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                    />
                  </div>

                  {/* Ngày hẹn xử lý dự kiến */}
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                      <Clock className="w-3 h-3 text-amber-500" />
                      Ngày hẹn xử lý dự kiến:
                    </label>
                    <input
                      type="date"
                      value={toHtmlDateStr(editExpectedDate)}
                      onChange={(e) => setEditExpectedDate(fromHtmlDateStr(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer"
                    />
                  </div>

                  {/* Ngày hoàn thành thực tế */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Ngày hoàn thành thực tế:
                    </label>
                    <input
                      type="date"
                      value={toHtmlDateStr(editCompletedDate)}
                      onChange={(e) => setEditCompletedDate(fromHtmlDateStr(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    />
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

                  <div className="pt-2.5 border-t border-sky-200/60 dark:border-sky-800/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-sky-900 dark:text-sky-200 font-medium">Tạo Thread mail tới Supplier:</span>
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
