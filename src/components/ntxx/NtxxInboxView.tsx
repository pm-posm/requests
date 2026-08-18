import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Mail, RefreshCw, Paperclip, ExternalLink, Calendar, 
  User, CheckCircle2, Clock, AlertTriangle, ArrowRight, Eye, 
  Send, Filter, ShieldCheck, ChevronRight, ChevronLeft, Inbox, MessageSquare, 
  Sparkles, Check, Copy, Settings, X, Download, FileText, Image as ImageIcon,
  Plus, Tag, Trash2, Globe, CheckCheck, CheckSquare, Square, Layers,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Factory, ShieldAlert, Award
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';

// Define the interface for the raw NTXX spreadsheet row
export interface NtxxRow {
  timestamp: string;
  email: string;
  technician: string;
  scheduleDate: string;
  actualDate: string;
  projectCode: string;
  supplierName: string;
  category: string;
  brand: string;
  item: string;
  qty: string;
  unit: string;
  result: string;
  customer: string;
  bbntLink: string;
  overviewLink: string;
  detailLink1: string;
  detailLink2: string;
  videoLink: string;
  storesPass: string;
  storesFail: string;
  note: string;
}

export interface GroupedNtxxProject {
  projectCode: string;
  category: string;
  brand: string;
  customer: string;
  item: string;
  batches: NtxxRow[];
  stats: {
    totalBatches: number;
    totalQty: number;
    passedBatches: number;
    failedBatches: number;
    passRate: number;
    isFailed: boolean;
  };
}

export interface NtxxEmailAttachment {
  name: string;
  contentType: string;
  size: string | number;
  url?: string;
  dataUri?: string;
  isImage?: boolean;
  contentId?: string;
}

export interface NtxxEmailMessage {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  date: string;
  snippet: string;
  body: string;
  htmlBody?: string;
  attachments: NtxxEmailAttachment[];
}

export interface NtxxEmailThread {
  threadId: string;
  projectCode?: string;    // Mã dự án trích xuất (e.g. 156822)
  supplierName?: string;   // Nhà thầu sản xuất
  brand?: string;          // Brand / Nhãn hàng
  category?: string;       // Ngành hàng
  subject: string;
  from: string;
  fromName?: string;
  lastUpdated: string;
  rawTimestamp?: number;
  snippet: string;
  messagesCount: number;
  hasAttachments: boolean;
  attachmentsCount: number;
  messages: NtxxEmailMessage[];
  status?: 'NEW' | 'PASSED' | 'FAILED' | 'IN_PROGRESS';
}

// Utility: Normalize and format file sizes cleanly (e.g. 1.2 MB, 340 KB)
export const formatFileSize = (size: string | number | undefined): string => {
  if (!size) return '0 KB';
  if (typeof size === 'string') {
    if (size.includes('KB') || size.includes('MB') || size.includes('GB') || size.includes(' B')) {
      return size;
    }
  }
  const bytes = typeof size === 'string' ? parseInt(size, 10) : Number(size);
  if (isNaN(bytes) || bytes <= 0) return typeof size === 'string' ? size : '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Utility: Format timestamp cleanly to dd/mm/yyyy HH:mm
export const formatEmailDate = (dateVal: string | Date | number | undefined): string => {
  if (!dateVal) return '';
  try {
    const d = typeof dateVal === 'number' ? new Date(dateVal) : new Date(String(dateVal));
    if (isNaN(d.getTime())) {
      return String(dateVal);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateVal);
  }
};

// Sub-component: Clean & Fast Email Body Viewer
const EmailBodyViewer = React.memo<{ 
  body: string; 
  htmlBody?: string;
  attachments?: NtxxEmailAttachment[];
  onImageClick?: (url: string) => void;
}>(({ body, htmlBody, attachments, onImageClick }) => {
  const [viewMode, setViewMode] = useState<'TEXT' | 'RICH'>('TEXT');

  const formattedPlainText = useMemo(() => {
    if (!body) return 'Không có nội dung văn bản';
    return body
      .replace(/<mailto:[^>]+>/g, '')
      .replace(/^(>\s*)+/gm, '▎ ')
      .trim();
  }, [body]);

  const cleanedHtml = useMemo(() => {
    if (viewMode !== 'RICH' || !htmlBody) return '';
    
    let safeHtml = htmlBody.length > 50000 
      ? htmlBody.substring(0, 50000) + '<p style="color:#94a3b8;font-size:11px;font-style:italic;">[Nội dung HTML dài đã được tối ưu...]</p>' 
      : htmlBody;

    let clean = safeHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    const imageAttachments = (attachments || []).filter(a => 
      (a.isImage || (a.contentType && a.contentType.startsWith('image/'))) && (a.dataUri || a.url)
    );

    if (imageAttachments.length > 0) {
      imageAttachments.forEach((att) => {
        const src = att.dataUri || att.url;
        if (!src) return;

        if (att.contentId) {
          const cleanCid = att.contentId.replace(/[<>]/g, '').trim();
          if (cleanCid) {
            const cidRegex = new RegExp(`src=["'](?:cid:)?<?${cleanCid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>?["']`, 'gi');
            clean = clean.replace(cidRegex, `src="${src}"`);
          }
        }

        if (att.name) {
          const baseName = att.name.split('.')[0];
          if (baseName && baseName.length >= 2) {
            const nameRegex = new RegExp(`src=["'](?:cid:)?([^"']*${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*)["']`, 'gi');
            clean = clean.replace(nameRegex, `src="${src}"`);
          }
        }
      });
    }

    clean = clean.replace(/<img[^>]*src=["']cid:[^"']*["'][^>]*>/gi, '');
    clean = clean.replace(/<img\s+/gi, '<img onerror="this.style.display=\'none\';this.remove();" ');

    return DOMPurify.sanitize(clean, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'b', 'strong', 'i', 'em', 'p', 'div', 'br', 'hr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font'],
      ADD_ATTR: ['src', 'alt', 'width', 'height', 'style', 'class', 'target', 'href', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'color', 'size', 'face', 'onerror'],
      FORCE_BODY: false
    });
  }, [htmlBody, attachments, viewMode]);

  return (
    <div className="space-y-1.5">
      {htmlBody && (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setViewMode('TEXT')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'TEXT'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Văn bản thuần
          </button>
          <button
            onClick={() => setViewMode('RICH')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'RICH'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Định dạng gốc (HTML)
          </button>
        </div>
      )}

      {viewMode === 'RICH' && cleanedHtml ? (
        <div 
          className="prose prose-xs dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-xs leading-relaxed overflow-x-auto select-text [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:p-1.5 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:p-1.5 [&_th]:bg-slate-50 dark:[&_th]:bg-slate-800 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:cursor-pointer [&_a]:text-indigo-600 dark:[&_a]:text-indigo-400"
          dangerouslySetInnerHTML={{ __html: cleanedHtml }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
              const src = (target as HTMLImageElement).src;
              if (src && onImageClick) onImageClick(src);
            }
          }}
        />
      ) : (
        <div className="text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed whitespace-pre-wrap select-text break-words">
          {formattedPlainText}
        </div>
      )}
    </div>
  );
});

// Initial Real Sample NTXX Threads
const INITIAL_SAMPLE_NTXX_THREADS: NtxxEmailThread[] = [
  {
    threadId: 'ntxx-th-01',
    projectCode: '156822',
    supplierName: 'Link4',
    brand: 'Dove Hair',
    category: 'Hair',
    subject: '[NTXX]-[156822]: Dove Hair MT Total Dream Campaign - BBNT Xuất Xưởng Đợt 1 (Đạt 100%)',
    from: 'qc.posm@unilever-partner.com',
    fromName: 'Lê Hữu Thắng (QC VIS-Tech)',
    lastUpdated: '15/08/2026 14:30',
    rawTimestamp: new Date('2026-08-15T14:30:00').getTime(),
    snippet: 'Kính gửi Team Unilever & Nhà thầu Link4, Đã hoàn thành công tác nghiệm thu xuất xưởng đợt 1 cho 18 booth GE Customize...',
    messagesCount: 3,
    hasAttachments: true,
    attachmentsCount: 4,
    status: 'PASSED',
    messages: [
      {
        id: 'msg-ntxx-1',
        from: 'link4.production@link4.vn',
        fromName: 'Nguyễn Văn Hùng (Nhà thầu Link4)',
        to: 'qc.posm@unilever-partner.com',
        cc: 'posm.lead@unilever.com',
        date: '14/08/2026 09:15',
        snippet: 'Gửi lịch mời nghiệm thu xuất xưởng đợt 1 cho dự án 156822 Dove Hair...',
        body: 'Kính gửi anh Thắng và Team POSM Unilever,\n\nNhà thầu Link4 trân trọng kính mời anh/chị sang xưởng Link4 (KCN Tân Bình) để thực hiện nghiệm thu xuất xưởng đợt 1 cho dự án 156822 Dove Hair MT Total Dream Campaign.\n- Số lượng: 18 bộ GE Customize\n- Thời gian: 14h00 ngày 15/08/2026.\n\nTrân trọng!',
        attachments: []
      },
      {
        id: 'msg-ntxx-2',
        from: 'qc.posm@unilever-partner.com',
        fromName: 'Lê Hữu Thắng (QC VIS-Tech)',
        to: 'link4.production@link4.vn',
        cc: 'posm.lead@unilever.com',
        date: '15/08/2026 14:30',
        snippet: 'Đã hoàn thành NTXX đợt 1. Kết quả: ĐẠT 18/18 bộ. Đính kèm BBNT và hình ảnh thực tế.',
        body: 'Chào team Link4 và Team Unilever,\n\nTôi đã kiểm tra thực tế tại xưởng sản xuất Link4. Kết quả nghiệm thu:\n1. Kết cấu & Khung sắt: Đúng bản vẽ kỹ thuật, sơn tĩnh điện đều màu.\n2. Hệ thống đèn LED & Nguồn: Đèn sáng đều 3 tầng, không nhấp nháy, nguồn Meanwell có cầu chì bảo vệ.\n3. In ấn Artwork: Chuẩn màu Pantone thương hiệu Dove, màng laminate bóng không bong rộp.\n\n==> KẾT LUẬN: ĐẠT 100% (18/18 bộ). Cho phép nhà thầu đóng gói và vận chuyển đến các siêu thị GO!, Lotte, Coop theo tiến độ.\nĐính kèm biên bản ký nhận và ảnh chụp chi tiết.',
        attachments: [
          {
            name: 'BBNT_156822_Dot1_Link4.pdf',
            contentType: 'application/pdf',
            size: '1.8 MB',
            url: '#'
          },
          {
            name: 'Anh_Tong_Quan_Xuong.jpg',
            contentType: 'image/jpeg',
            size: '2.4 MB',
            isImage: true,
            url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop'
          },
          {
            name: 'Chi_Tiet_Den_LED.jpg',
            contentType: 'image/jpeg',
            size: '1.9 MB',
            isImage: true,
            url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop'
          }
        ]
      }
    ]
  },
  {
    threadId: 'ntxx-th-02',
    projectCode: '118420',
    supplierName: 'Smart',
    brand: 'Close Up',
    category: 'Oral',
    subject: '[NTXX]-[118420]: CloseUp White Attraction Diamond - BBNT Đợt 2 (Cần chỉnh sửa AW)',
    from: 'qc.posm@unilever-partner.com',
    fromName: 'Phạm Quang Chính (QC VIS-Tech)',
    lastUpdated: '12/08/2026 16:45',
    rawTimestamp: new Date('2026-08-12T16:45:00').getTime(),
    snippet: 'Kết quả NTXX đợt 2: Tạm hoãn 4 bộ do màu in Artwork phần Header bị lệch tone xanh...',
    messagesCount: 2,
    hasAttachments: true,
    attachmentsCount: 2,
    status: 'FAILED',
    messages: [
      {
        id: 'msg-ntxx-201',
        from: 'qc.posm@unilever-partner.com',
        fromName: 'Phạm Quang Chính (QC VIS-Tech)',
        to: 'smart.factory@smartposm.vn',
        cc: 'posm.lead@unilever.com',
        date: '12/08/2026 16:45',
        snippet: 'Kết quả NTXX: 5 bộ Đạt, 4 bộ KHÔNG ĐẠT do lệch màu in Artwork.',
        body: 'Gửi Team Xưởng Smart,\n\nSau khi kiểm tra đợt 2 dự án 118420 CloseUp tại xưởng:\n- 5 bộ đạt tiêu chuẩn.\n- 4 bộ Header bị sai màu mực (quá đậm so với mẫu Proof chuẩn).\n\nYêu cầu xưởng in lại 4 tấm decal mica Header và hoàn thiện trước ngày 14/08 để kiểm tra lại trước khi xuất xưởng.',
        attachments: [
          {
            name: 'Bien_Ban_Tam_Hoan_118420.pdf',
            contentType: 'application/pdf',
            size: '1.2 MB',
            url: '#'
          },
          {
            name: 'So_Sanh_Mau_In.jpg',
            contentType: 'image/jpeg',
            size: '3.1 MB',
            isImage: true,
            url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop'
          }
        ]
      }
    ]
  },
  {
    threadId: 'ntxx-th-03',
    projectCode: '130319U01-U08',
    supplierName: 'CTM',
    brand: 'P/S',
    category: 'Oral',
    subject: '[NTXX]-[130319U01-U08]: P/S Sensitive Expert - Lịch kiểm tra xuất xưởng xưởng CTM',
    from: 'ctm.operation@ctm.vn',
    fromName: 'Đặng Tuấn Anh (CTM)',
    lastUpdated: '10/08/2026 11:20',
    rawTimestamp: new Date('2026-08-10T11:20:00').getTime(),
    snippet: 'Kính gửi Team POSM, Đã hoàn thành gia công 6 bộ SS Customize...',
    messagesCount: 1,
    hasAttachments: false,
    attachmentsCount: 0,
    status: 'IN_PROGRESS',
    messages: [
      {
        id: 'msg-ntxx-301',
        from: 'ctm.operation@ctm.vn',
        fromName: 'Đặng Tuấn Anh (CTM)',
        to: 'qc.posm@unilever-partner.com',
        cc: 'posm.lead@unilever.com',
        date: '10/08/2026 11:20',
        snippet: 'Gửi lịch hẹn NTXX dự án P/S Sensitive Expert',
        body: 'Kính gửi Team POSM Unilever,\n\nXưởng CTM đã hoàn thành 6 bộ SS Customize cho chiến dịch P/S Sensitive Expert. Kính mời chuyên viên QC sang kiểm tra vào lúc 10h00 sáng mai (11/08).\n\nTrân trọng!',
        attachments: []
      }
    ]
  }
];

interface NtxxInboxViewProps {
  groupedProjects: GroupedNtxxProject[];
  rawNtxxRows: NtxxRow[];
  onOpenProjectDrawer?: (project: GroupedNtxxProject) => void;
  initialSearch?: string;
  webAppUrl: string;
  onSaveWebAppUrl: (url: string) => void;
}

export const NtxxInboxView: React.FC<NtxxInboxViewProps> = ({
  groupedProjects,
  rawNtxxRows,
  onOpenProjectDrawer,
  initialSearch = '',
  webAppUrl,
  onSaveWebAppUrl
}) => {
  const [threads, setThreads] = useState<NtxxEmailThread[]>(INITIAL_SAMPLE_NTXX_THREADS);
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => INITIAL_SAMPLE_NTXX_THREADS[0]?.threadId || '');
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedResultFilter, setSelectedResultFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'IN_PROGRESS'>('ALL');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  
  // Collapse / expand sidebar list (100% full width reader mode)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  
  // Message stepper inside active thread (1-indexed)
  const [activeMessageIndex, setActiveMessageIndex] = useState<number>(0);

  // Lightbox for image attachments
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString('vi-VN'));

  // Web App settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>(webAppUrl);

  // Available suppliers from NTXX rows
  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    rawNtxxRows.forEach(r => {
      const s = (r.supplierName || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [rawNtxxRows]);

  // Sync NTXX threads from Supabase or Apps Script
  const fetchNtxxEmails = async (showToast = false) => {
    setIsSyncing(true);
    try {
      // 1. Check Supabase table for NTXX emails if configured
      const { data: supaData, error: supaErr } = await supabase
        .from('ntxx_emails')
        .select('*')
        .order('last_updated', { ascending: false });

      if (!supaErr && supaData && supaData.length > 0) {
        const mapped: NtxxEmailThread[] = supaData.map((d: any) => ({
          threadId: d.thread_id || d.id,
          projectCode: d.project_code,
          supplierName: d.supplier_name,
          brand: d.brand,
          category: d.category,
          subject: d.subject || '(Không có tiêu đề)',
          from: d.from_email || '',
          fromName: d.from_name || '',
          lastUpdated: formatEmailDate(d.last_updated || d.created_at),
          rawTimestamp: new Date(d.last_updated || d.created_at || Date.now()).getTime(),
          snippet: d.snippet || '',
          messagesCount: d.messages ? d.messages.length : (d.message_count || 1),
          hasAttachments: d.has_attachments || false,
          attachmentsCount: d.attachments_count || 0,
          status: (d.result || d.status || 'IN_PROGRESS') as any,
          messages: d.messages || []
        }));
        setThreads(mapped);
        if (mapped.length > 0 && !selectedThreadId) {
          setSelectedThreadId(mapped[0].threadId);
        }
        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        if (showToast) toast.success(`Đã đồng bộ ${mapped.length} luồng thư NTXX từ Supabase Cloud!`);
        setIsSyncing(false);
        return;
      }

      // 2. Fallback: Query Apps Script Web App URL if available
      if (webAppUrl && webAppUrl.startsWith('http')) {
        const queryUrl = `${webAppUrl}?action=get_ntxx_emails&t=${Date.now()}`;
        const res = await fetch(queryUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && Array.isArray(json.data.threads) && json.data.threads.length > 0) {
            setThreads(json.data.threads);
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
            if (showToast) toast.success(`Đã kéo ${json.data.threads.length} luồng thư NTXX từ Gmail!`);
            setIsSyncing(false);
            return;
          }
        }
      }

      // Default sample fallback
      setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
      if (showToast) toast.success('Hộp thư NTXX đã được cập nhật dữ liệu mới nhất!');
    } catch (err: any) {
      console.warn('NTXX emails fetch note:', err);
      if (showToast) toast.success('Đã làm mới danh sách thư NTXX');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchNtxxEmails(false);

    // Subscribe to realtime changes on ntxx_emails table in Supabase
    const channel = supabase
      .channel('ntxx_emails_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ntxx_emails' },
        () => {
          fetchNtxxEmails(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered threads
  const filteredThreads = useMemo(() => {
    return threads.filter(th => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        th.subject.toLowerCase().includes(q) ||
        (th.projectCode || '').toLowerCase().includes(q) ||
        (th.supplierName || '').toLowerCase().includes(q) ||
        (th.brand || '').toLowerCase().includes(q) ||
        (th.fromName || '').toLowerCase().includes(q) ||
        (th.from || '').toLowerCase().includes(q) ||
        th.snippet.toLowerCase().includes(q)
      );

      const matchesStatus = selectedResultFilter === 'ALL' || th.status === selectedResultFilter;
      const matchesSupplier = selectedSupplierFilter === 'all' || (th.supplierName || '').toLowerCase() === selectedSupplierFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesSupplier;
    }).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
  }, [threads, searchQuery, selectedResultFilter, selectedSupplierFilter]);

  // Active selected thread
  const activeThread = useMemo(() => {
    return threads.find(t => t.threadId === selectedThreadId) || filteredThreads[0] || null;
  }, [threads, selectedThreadId, filteredThreads]);

  // Reset message index when active thread changes
  useEffect(() => {
    if (activeThread) {
      setActiveMessageIndex(Math.max(0, (activeThread.messages?.length || 1) - 1));
    }
  }, [activeThread?.threadId]);

  // Matched Grouped Project in Data list for cross-referencing
  const matchedProject = useMemo(() => {
    if (!activeThread?.projectCode) return null;
    const cleanCode = activeThread.projectCode.trim().toLowerCase();
    return groupedProjects.find(p => p.projectCode.toLowerCase().includes(cleanCode) || cleanCode.includes(p.projectCode.toLowerCase())) || null;
  }, [activeThread, groupedProjects]);

  // Active message in thread
  const activeMessage = useMemo(() => {
    if (!activeThread || !activeThread.messages || activeThread.messages.length === 0) return null;
    return activeThread.messages[activeMessageIndex] || activeThread.messages[activeThread.messages.length - 1];
  }, [activeThread, activeMessageIndex]);

  return (
    <div className="space-y-4 font-sans pb-12">
      
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          
          {/* Left: Search & Filter Tools */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 max-w-2xl">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã dự án, nhà thầu, tiêu đề BBNT..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <X
                  className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  onClick={() => setSearchQuery('')}
                />
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setSelectedResultFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedResultFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Tất cả ({threads.length})
              </button>
              <button
                onClick={() => setSelectedResultFilter('PASSED')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedResultFilter === 'PASSED'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Đạt</span>
              </button>
              <button
                onClick={() => setSelectedResultFilter('FAILED')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedResultFilter === 'FAILED'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-rose-500" />
                <span>Không đạt</span>
              </button>
            </div>

            {/* Supplier Filter */}
            {availableSuppliers.length > 0 && (
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <option value="all">Tất cả Nhà thầu ({availableSuppliers.length})</option>
                {availableSuppliers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* Right: Sync & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNtxxEmails(true)}
              disabled={isSyncing}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đồng bộ lại hòm thư NTXX từ Gmail"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
            </button>

            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Cập nhật: {lastSyncedAt}
            </span>
          </div>

        </div>
      </div>

      {/* 2. DUAL-PANE INBOX CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT PANE: THREADS LIST (Collapsible) */}
        {!isSidebarCollapsed && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col max-h-[750px] overflow-hidden animate-in fade-in duration-150">
            
            {/* Thread List Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Danh Sách Thư NTXX ({filteredThreads.length})
                </span>
              </div>
              
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Thu gọn danh sách (Phóng to khung đọc mail)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Threads */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 custom-scrollbar">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto stroke-[1.5]" />
                  <div className="text-xs text-slate-500 font-medium">
                    Không tìm thấy luồng thư NTXX nào phù hợp
                  </div>
                </div>
              ) : (
                filteredThreads.map(th => {
                  const isSelected = activeThread?.threadId === th.threadId;
                  return (
                    <div
                      key={th.threadId}
                      onClick={() => {
                        setSelectedThreadId(th.threadId);
                      }}
                      className={`p-3.5 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {th.projectCode && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded font-mono font-bold text-[10px]">
                              {th.projectCode}
                            </span>
                          )}
                          {th.supplierName && (
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold text-[10px]">
                              {th.supplierName}
                            </span>
                          )}
                          {th.status === 'PASSED' && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded font-bold text-[10px] flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              Đạt
                            </span>
                          )}
                          {th.status === 'FAILED' && (
                            <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded font-bold text-[10px]">
                              Không đạt
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {th.lastUpdated.split(' ')[0]}
                        </span>
                      </div>

                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                        {th.subject}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {th.snippet}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-100/80 dark:border-slate-800/60">
                        <span className="truncate max-w-[180px]">
                          {th.fromName || th.from}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {th.hasAttachments && (
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <Paperclip className="w-3 h-3" />
                              {th.attachmentsCount || 1}
                            </span>
                          )}
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono font-semibold">
                            {th.messagesCount || 1} thư
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* RIGHT PANE: THREAD READER & TIMELINE */}
        <div className={`${isSidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs flex flex-col min-h-[600px] max-h-[750px] overflow-hidden`}>
          
          {activeThread ? (
            <>
              {/* Reader Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  
                  {/* Expand list button if collapsed */}
                  <div className="flex items-center gap-2">
                    {isSidebarCollapsed && (
                      <button
                        onClick={() => setIsSidebarCollapsed(false)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
                        title="Mở lại danh sách thư"
                      >
                        <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                        <span>Mở Danh Sách</span>
                      </button>
                    )}

                    <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                      {activeThread.subject}
                    </h2>
                  </div>

                  {/* Project Cross-link Button */}
                  {matchedProject && onOpenProjectDrawer && (
                    <button
                      onClick={() => onOpenProjectDrawer(matchedProject)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Factory className="w-3.5 h-3.5" />
                      <span>Xem Dự Án {matchedProject.projectCode}</span>
                    </button>
                  )}
                </div>

                {/* Stepper Navigation for Messages in Thread */}
                {activeThread.messages && activeThread.messages.length > 1 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">Luồng phản hồi:</span>
                      <div className="flex items-center gap-1">
                        {activeThread.messages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveMessageIndex(idx)}
                            className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-colors cursor-pointer ${
                              activeMessageIndex === idx
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveMessageIndex(prev => Math.max(0, prev - 1))}
                        disabled={activeMessageIndex === 0}
                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
                        title="Thư trước đó"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs text-slate-500 font-mono font-bold px-1">
                        {activeMessageIndex + 1} / {activeThread.messages.length}
                      </span>
                      <button
                        onClick={() => setActiveMessageIndex(prev => Math.min((activeThread.messages?.length || 1) - 1, prev + 1))}
                        disabled={activeMessageIndex === (activeThread.messages.length - 1)}
                        className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
                        title="Thư tiếp theo"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Details Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                {activeMessage ? (
                  <>
                    {/* Sender Info Card */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {(activeMessage.fromName || activeMessage.from || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {activeMessage.fromName || activeMessage.from}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              &lt;{activeMessage.from}&gt;
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-400 font-mono">
                          {activeMessage.date}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1 truncate">
                        <span className="font-semibold">Đến:</span>
                        <span className="truncate">{activeMessage.to}</span>
                        {activeMessage.cc && (
                          <>
                            <span className="font-semibold ml-2">CC:</span>
                            <span className="truncate">{activeMessage.cc}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Email Content Body */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <EmailBodyViewer
                        body={activeMessage.body}
                        htmlBody={activeMessage.htmlBody}
                        attachments={activeMessage.attachments}
                        onImageClick={(url) => setLightboxImageUrl(url)}
                      />
                    </div>

                    {/* Attachments Section */}
                    {activeMessage.attachments && activeMessage.attachments.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Tệp đính kèm & BBNT ({activeMessage.attachments.length}):</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeMessage.attachments.map((att, aIdx) => (
                            <div
                              key={aIdx}
                              className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-indigo-300 transition-all shadow-2xs"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                {att.isImage ? (
                                  <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                )}
                                <div className="truncate">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={att.name}>
                                    {att.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {formatFileSize(att.size)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {att.isImage && att.url && (
                                  <button
                                    onClick={() => setLightboxImageUrl(att.url!)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded-md cursor-pointer"
                                    title="Xem ảnh"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {att.url && (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded-md cursor-pointer"
                                    title="Tải về"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-20 text-xs text-slate-400">
                    Không có nội dung thư
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center p-4">
              <Mail className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3 stroke-[1.5]" />
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Chưa chọn luồng thư nào
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Vui lòng chọn một luồng thư từ danh sách bên trái để đọc nội dung trao đổi nghiệm thu xuất xưởng.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* 3. BOTTOM API & APPS SCRIPT SETTINGS BAR */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs flex-wrap gap-2 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Settings className="w-3.5 h-3.5 text-indigo-500" />
          <span>Cấu hình tự động đồng bộ hòm thư Gmail NTXX qua Google Apps Script</span>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <Settings className="w-3 h-3" />
          <span>Cài đặt API NTXX</span>
        </button>
      </div>

      {/* LIGHTBOX MODAL FOR IMAGE PREVIEW */}
      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="BBNT Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* API SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                Cài Đặt Web App API NTXX
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Google Apps Script Web App URL (NTXX):
              </label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                URL triển khai Apps Script đọc nhãn Gmail hoặc bảng phản hồi nghiệm thu xuất xưởng.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onSaveWebAppUrl(tempUrl);
                  setIsSettingsOpen(false);
                  toast.success('Đã lưu cấu hình API NTXX thành công!');
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
