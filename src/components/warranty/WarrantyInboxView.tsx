import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Mail, RefreshCw, Paperclip, ExternalLink, Calendar, 
  User, CheckCircle2, Clock, AlertTriangle, ArrowRight, Eye, 
  Send, Filter, ShieldCheck, ChevronRight, Inbox, MessageSquare, 
  Sparkles, Check, Copy, Settings, X, Download, FileText, Image as ImageIcon,
  Plus, Tag, Trash2, Globe, CheckCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WarrantyItem } from '@/types/warranty';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';

export interface WarrantyEmailAttachment {
  name: string;
  contentType: string;
  size: string | number;
  url?: string;
  dataUri?: string;
  isImage?: boolean;
  contentId?: string;
}

export interface WarrantyEmailMessage {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  date: string;
  snippet: string;
  body: string;
  htmlBody?: string;
  attachments: WarrantyEmailAttachment[];
}

export interface WarrantyEmailThread {
  threadId: string;
  requestId?: string;      // Trích xuất mã BH-xxx
  storeCode?: string;      // Mã cửa hàng nếu tìm thấy
  storeName?: string;      // Tên cửa hàng
  projectCode?: string;    // Mã dự án
  subject: string;
  from: string;
  fromName?: string;
  lastUpdated: string;
  rawTimestamp?: number;   // Timestamp chuẩn để sort chính xác tuyệt đối
  snippet: string;
  messagesCount: number;
  hasAttachments: boolean;
  attachmentsCount: number;
  messages: WarrantyEmailMessage[];
  status?: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
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

// Sub-component: Clean & Beautiful Email Body Viewer with Precise Image Resolution & DOMPurify Sanitization
const EmailBodyViewer: React.FC<{ 
  body: string; 
  htmlBody?: string;
  attachments?: WarrantyEmailAttachment[];
  onImageClick?: (url: string) => void;
}> = ({ body, htmlBody, attachments, onImageClick }) => {
  const [viewMode, setViewMode] = useState<'RICH' | 'TEXT'>(htmlBody ? 'RICH' : 'TEXT');

  // Format plain text
  const formattedPlainText = useMemo(() => {
    if (!body) return '';
    return body
      .replace(/<mailto:[^>]+>/g, '')
      .replace(/^(>\s*)+/gm, '▎ ')
      .trim();
  }, [body]);

  // Clean HTML, inject Base64 Data URIs with multi-strategy CID matching, and sanitize with DOMPurify
  const cleanedHtml = useMemo(() => {
    if (!htmlBody) return '';
    let clean = htmlBody
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    const imageAttachments = (attachments || []).filter(a => 
      (a.isImage || (a.contentType && a.contentType.startsWith('image/'))) && (a.dataUri || a.url)
    );

    if (imageAttachments.length > 0) {
      imageAttachments.forEach((att, idx) => {
        const src = att.dataUri || att.url;
        if (!src) return;

        // Strategy 1: Match by exact contentId if provided (e.g. cid:part1.xxx or cid:<part1.xxx>)
        if (att.contentId) {
          const cleanCid = att.contentId.replace(/[<>]/g, '').trim();
          if (cleanCid) {
            const cidRegex = new RegExp(`src=["'](?:cid:)?<?${cleanCid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>?["']`, 'gi');
            clean = clean.replace(cidRegex, `src="${src}"`);
          }
        }

        // Strategy 2: Match by base filename inside cid
        if (att.name) {
          const baseName = att.name.split('.')[0];
          if (baseName && baseName.length >= 2) {
            const nameRegex = new RegExp(`src=["'](?:cid:)?([^"']*${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*)["']`, 'gi');
            clean = clean.replace(nameRegex, `src="${src}"`);
          }
        }
      });
    }

    // Remove unresolvable cid: tags so they NEVER render ugly broken box frames
    clean = clean.replace(/<img[^>]*src=["']cid:[^"']*["'][^>]*>/gi, '');
    
    // Add onerror auto-removal to any broken external/inline img tags
    clean = clean.replace(/<img\s+/gi, '<img onerror="this.style.display=\'none\';this.remove();" ');

    // Sanitize with DOMPurify against XSS while allowing rich email formatting
    return DOMPurify.sanitize(clean, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'style', 'img', 'span', 'b', 'strong', 'i', 'em', 'p', 'div', 'br', 'hr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font'],
      ADD_ATTR: ['src', 'alt', 'width', 'height', 'style', 'class', 'target', 'href', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'color', 'size', 'face', 'onerror'],
      FORCE_BODY: false
    });
  }, [htmlBody, attachments]);

  return (
    <div className="space-y-1">
      {/* Mode Switcher */}
      {htmlBody && (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setViewMode('RICH')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'RICH'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Định dạng gốc
          </button>
          <button
            onClick={() => setViewMode('TEXT')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'TEXT'
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Văn bản thuần
          </button>
        </div>
      )}

      {viewMode === 'RICH' && cleanedHtml ? (
        <div 
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG' && onImageClick) {
              const src = (target as HTMLImageElement).src;
              if (src) onImageClick(src);
            }
          }}
          className="email-rich-content text-slate-800 dark:text-slate-200 text-[11px] leading-relaxed overflow-x-auto custom-scrollbar p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800"
          dangerouslySetInnerHTML={{ __html: cleanedHtml }}
        />
      ) : (
        <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-text break-words bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          {formattedPlainText}
        </div>
      )}
    </div>
  );
};

// Default Official Production Apps Script Web App URL
const DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL = (import.meta.env.VITE_REQUEST_WEB_APP_URL || '').trim() || 'https://script.google.com/macros/s/AKfycbxztDMOhd6lO6QY_AmF4jMyXUWCP69jlb8XY7f9zIAQVGhXukaa0I_kd_uwqrTce8Y4iA/exec';

// Default dynamic search presets for Warranty
const DEFAULT_KEYWORD_PRESETS = [
  'subject:"bảo hành"',
  'subject:"BẢO HÀNH"',
  'subject:BH-',
  '"bảo hành"',
  'subject:"ĐĂNG KÝ LỊCH BẢO HÀNH"'
];

// Sample fallback dataset matching real operations
const SAMPLE_WARRANTY_THREADS: WarrantyEmailThread[] = [
  {
    threadId: 'th-001',
    requestId: 'BH-635',
    storeName: 'Coop Xtra Pham Van Dong',
    storeCode: 'STR-COPXT-15660',
    projectCode: '118420U01-U10 Dove Hair MT Total Dream Campaign',
    subject: '[Bảo hành]-[BH-635]: 118420U01-U10 Dove Hair MT Total Dream Campaign GE Customize_ Coop Phạm Văn Đồng',
    from: 'long.tc@fieldforce.vn',
    fromName: 'Tạ Châu Long (SR)',
    lastUpdated: '15/07/2026 14:35',
    snippet: 'Kính gửi Team VIS & Supplier Link4, cửa hàng báo GE bị tắt đèn led khung viền, màn hình vẫn hoạt động bình thường...',
    messagesCount: 3,
    hasAttachments: true,
    attachmentsCount: 2,
    status: 'DONE',
    messages: [
      {
        id: 'msg-01',
        from: 'long.tc@fieldforce.vn',
        fromName: 'Tạ Châu Long (SR)',
        to: 'thanglh9@gmail.com, supplier@link4.vn',
        cc: 'mer.manager@unilever.com',
        date: '15/07/2026 09:15',
        snippet: 'Gửi yêu cầu bảo hành GE Customize tại Coop Phạm Văn Đồng...',
        body: 'Kính gửi Team VIS & Supplier Link4,\n\nTại siêu thị Coop Xtra Phạm Văn Đồng, quầy GE Customize của Dove Hair đang bị lỗi: Toàn bộ đèn led viền hộp đèn bị tắt, màn hình quảng cáo vẫn chạy.\n\nNhờ team kiểm tra nguồn adapter hoặc dây led giúp cửa hàng trước ngày 20/07/2026.\n\nTrân trọng,\nTạ Châu Long - SR Phụ trách',
        attachments: [
          { name: 'anh_loi_den_ge_01.jpg', contentType: 'image/jpeg', size: '2.1 MB', isImage: true },
          { name: 'anh_loi_den_ge_02.jpg', contentType: 'image/jpeg', size: '1.8 MB', isImage: true }
        ]
      },
      {
        id: 'msg-02',
        from: 'thang.lh@unilever.com',
        fromName: 'Lê Hữu Thắng (VIS Tech)',
        to: 'supplier@link4.vn',
        cc: 'long.tc@fieldforce.vn',
        date: '15/07/2026 10:30',
        snippet: 'Team Link4 sắp xếp kỹ thuật viên đi kiểm tra trong ngày mai...',
        body: 'Dear Team Link4,\n\nNhờ bên bạn sắp xếp kỹ thuật viên ghé Coop Xtra Phạm Văn Đồng xử lý gấp nguồn đèn led trước 20/07/2026 nhé. Khi đi mang sẵn nguồn 12V/10A thay thế dự phòng.\n\nThanks,\nThắng Lê',
        attachments: []
      },
      {
        id: 'msg-03',
        from: 'supplier@link4.vn',
        fromName: 'Kỹ Thuật Link4',
        to: 'thang.lh@unilever.com',
        cc: 'long.tc@fieldforce.vn',
        date: '20/07/2026 14:35',
        snippet: 'Đã hoàn tất thay nguồn led tại Coop Phạm Văn Đồng, gửi biên bản nghiệm thu...',
        body: 'Dear Anh Thắng & Anh Long,\n\nLink4 đã xử lý xong sự cố đứt dây nguồn cấp led tại quầy GE Coop Xtra Phạm Văn Đồng. Đèn led đã sáng đều và ổn định.\n\nĐính kèm biên bản nghiệm thu có ký nhận của siêu thị.\n\nTrân trọng,\nĐội thi công Link4',
        attachments: [
          { name: 'bien_ban_nghiem_thu_sua_chua.pdf', contentType: 'application/pdf', size: '1.2 MB', isImage: false },
          { name: 'anh_nghiem_thu_sau_fix.jpg', contentType: 'image/jpeg', size: '3.4 MB', isImage: true }
        ]
      }
    ]
  },
  {
    threadId: 'th-002',
    requestId: 'BH-658',
    storeName: 'GO! GO VAP',
    storeCode: 'STR-BIG-00468',
    projectCode: '118420U01-U10 Dove Hair MT Total Dream Campaign',
    subject: '[Bảo hành]-[BH-658]: 118420U01-U10 Dove Hair MT - Tuýp kem hư hỏng tại GO! Gò Vấp',
    from: 'long.tc@fieldforce.vn',
    fromName: 'Tạ Châu Long (SR)',
    lastUpdated: '24/07/2026 11:20',
    snippet: 'Tuýp kem mô hình trưng bày tại đầu kệ bị gãy pát mica giữ phía sau...',
    messagesCount: 1,
    hasAttachments: true,
    attachmentsCount: 1,
    status: 'IN_PROGRESS',
    messages: [
      {
        id: 'msg-04',
        from: 'long.tc@fieldforce.vn',
        fromName: 'Tạ Châu Long (SR)',
        to: 'thanglh9@gmail.com, supplier@link4.vn',
        cc: '',
        date: '24/07/2026 11:20',
        snippet: 'Gửi hình ảnh tuýp kem mô hình bị hư hỏng...',
        body: 'Kính gửi Team VIS,\n\nTại GO! Gò Vấp, tuýp kem mô hình Dove bị khách va quẹt làm nứt pát giữ mica. Cần sản xuất lại pát giữ để gắn lại chắc chắn.\n\nNhờ team hỗ trợ.',
        attachments: [
          { name: 'anh_pat_kem_nut.jpg', contentType: 'image/jpeg', size: '1.5 MB', isImage: true }
        ]
      }
    ]
  },
  {
    threadId: 'th-003',
    requestId: 'BH-611',
    storeName: 'Lotte Q7',
    storeCode: 'STR-LOT-00480',
    projectCode: '118420 - Dove Skin Lotte',
    subject: '[Bảo hành]-[BH-611]: SS Customize Lotte Q7 trầy xước mica',
    from: 'nhu.sr@fieldforce.vn',
    fromName: 'Như (SR Lotte)',
    lastUpdated: '24/06/2026 16:40',
    snippet: 'Lắp đặt xong chưa vệ sinh sạch, tấm mica mặt trước bị trầy xước nhẹ...',
    messagesCount: 2,
    hasAttachments: true,
    attachmentsCount: 2,
    status: 'DONE',
    messages: [
      {
        id: 'msg-05',
        from: 'nhu.sr@fieldforce.vn',
        fromName: 'Như (SR Lotte)',
        to: 'chinh.pq@unilever.com',
        cc: '',
        date: '24/06/2026 10:10',
        snippet: 'Báo cáo hiện trạng quầy SS Customize tại Lotte Q7...',
        body: 'Anh Chính ơi, quầy SS Customize Dove tại Lotte Q7 hôm qua thi công xong nhưng 2 tấm mica bị xước đường dài. Quản lý siêu thị yêu cầu thay mới.',
        attachments: [
          { name: 'vet_xuoc_mica.png', contentType: 'image/png', size: '1.2 MB', isImage: true }
        ]
      },
      {
        id: 'msg-06',
        from: 'chinh.pq@unilever.com',
        fromName: 'Phạm Quang Chính (VIS Tech)',
        to: 'nhu.sr@fieldforce.vn',
        cc: '',
        date: '25/06/2026 16:40',
        snippet: 'Đã thay mới 2 tấm mica trong sáng nay...',
        body: 'Hi Như, bên anh đã cho kỹ thuật mang 2 tấm mica mới tới thay và lau chùi sạch sẽ rồi nhé. Quản lý đã ký nhận OK.',
        attachments: [
          { name: 'nghiem_thu_mica_moi.jpg', contentType: 'image/jpeg', size: '2.7 MB', isImage: true }
        ]
      }
    ]
  }
];

interface WarrantyInboxViewProps {
  warrantyItems: WarrantyItem[];
  webAppUrl?: string;
  onOpenWarrantyDrawer?: (item: WarrantyItem) => void;
  onUpdateWebAppUrl?: (url: string) => void;
}

export const WarrantyInboxView: React.FC<WarrantyInboxViewProps> = ({
  warrantyItems = [],
  webAppUrl = '',
  onOpenWarrantyDrawer,
  onUpdateWebAppUrl
}) => {
  const [threads, setThreads] = useState<WarrantyEmailThread[]>(() => {
    try {
      const saved = localStorage.getItem('WARRANTY_GMAIL_SAVED_THREADS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return SAMPLE_WARRANTY_THREADS;
  });
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => {
    return threads[0]?.threadId || '';
  });
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'NEW' | 'MATCHED' | 'HAS_ATTACHMENT' | 'IN_PROGRESS'>('ALL');
  const [newThreadIds, setNewThreadIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // KEYWORD POPOVER STATE
  const [isKeywordPopoverOpen, setIsKeywordPopoverOpen] = useState(false);
  const keywordPopoverRef = useRef<HTMLDivElement>(null);

  // DYNAMIC KEYWORDS ON DASHBOARD
  const [keywords, setKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('WARRANTY_GMAIL_KEYWORDS');
      return saved ? JSON.parse(saved) : DEFAULT_KEYWORD_PRESETS;
    } catch {
      return DEFAULT_KEYWORD_PRESETS;
    }
  });

  const [activeKeyword, setActiveKeyword] = useState<string>(() => {
    return localStorage.getItem('WARRANTY_GMAIL_ACTIVE_KEYWORD') || keywords[0] || 'subject:"bảo hành"';
  });

  const [newKeywordInput, setNewKeywordInput] = useState('');

  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('WARRANTY_GMAIL_APPS_SCRIPT_URL') || webAppUrl || DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL;
  });

  useEffect(() => {
    if (webAppUrl && !appsScriptUrl) {
      setAppsScriptUrl(webAppUrl);
    }
  }, [webAppUrl]);

  // Save keywords to localStorage
  useEffect(() => {
    localStorage.setItem('WARRANTY_GMAIL_KEYWORDS', JSON.stringify(keywords));
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('WARRANTY_GMAIL_ACTIVE_KEYWORD', activeKeyword);
  }, [activeKeyword]);

  // Click outside to close Keyword Popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (keywordPopoverRef.current && !keywordPopoverRef.current.contains(e.target as Node)) {
        setIsKeywordPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // 1. Initial Load & Realtime Sync from Supabase (Persistent Cloud Database for all viewers)
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('warranty_emails')
          .select('*')
          .order('last_updated', { ascending: false });

        if (error) {
          console.warn('Supabase warranty_emails select:', error.message);
          return;
        }

        if (data && data.length > 0) {
          const mappedThreads: WarrantyEmailThread[] = data.map((item: any) => {
            const fullSubject = item.subject || '';
            const reqMatch = fullSubject.match(/BH-\d+/i);
            const reqId = reqMatch ? reqMatch[0].toUpperCase() : '';
            const prjMatch = fullSubject.match(/\b\d{6}\b/);
            const prjCode = prjMatch ? prjMatch[0] : '';

            const matchedSheetItem = warrantyItems.find(w => {
              if (reqId && (w.requestId || '').toUpperCase() === reqId) return true;
              if (prjCode && (w.projectCode || '').includes(prjCode)) return true;
              return false;
            });

            const rawTime = item.last_updated ? new Date(item.last_updated).getTime() : Date.now();
            const msgs = Array.isArray(item.messages) ? item.messages : [];
            const attCount = msgs.reduce((acc: number, m: any) => acc + (Array.isArray(m.attachments) ? m.attachments.length : 0), 0);

            return {
              threadId: item.thread_id,
              requestId: reqId || (matchedSheetItem ? matchedSheetItem.requestId : ''),
              storeName: matchedSheetItem?.storeName || '',
              storeCode: matchedSheetItem?.storeCode || '',
              projectCode: prjCode || matchedSheetItem?.projectCode || '',
              subject: item.subject || 'Không có tiêu đề',
              from: item.from_email || '',
              fromName: item.from_name || (item.from_email ? item.from_email.split('@')[0] : ''),
              lastUpdated: item.last_updated ? new Date(item.last_updated).toLocaleString('vi-VN') : '',
              rawTimestamp: rawTime,
              snippet: item.snippet || '',
              messagesCount: msgs.length || 1,
              hasAttachments: attCount > 0,
              attachmentsCount: attCount,
              messages: msgs
            };
          });

          setThreads(mappedThreads);
          setSelectedThreadId(prev => prev || mappedThreads[0]?.threadId || '');
          setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
        }
      } catch (err) {
        console.warn('Supabase initial load error:', err);
      }
    };

    loadFromSupabase();

    // Supabase Realtime Channel Subscription
    const channel = supabase
      .channel('public:warranty_emails')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranty_emails' }, () => {
        loadFromSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [warrantyItems]);

  // Auto-fetch live Gmail threads on Component Mount & Active Keyword change
  useEffect(() => {
    const activeUrl = (appsScriptUrl || webAppUrl || DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL).trim();
    if (activeUrl && activeKeyword) {
      // First mount / keyword switch: Fetch up to 20 threads to build base dataset
      fetchLiveGmailThreads(activeKeyword, true, 20);
    }
  }, [activeKeyword, appsScriptUrl, webAppUrl]);

  // Periodic background auto-sync every 60 seconds (Delta Scan: only top 5 newest threads to respond in < 1s)
  useEffect(() => {
    const activeUrl = (appsScriptUrl || webAppUrl || DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL).trim();
    if (!activeUrl || !activeKeyword) return;
    const interval = setInterval(() => {
      // Only poll when the user is actively viewing this browser tab
      if (document.visibilityState === 'visible') {
        fetchLiveGmailThreads(activeKeyword, true, 5);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [appsScriptUrl, activeKeyword, webAppUrl]);

  // Fetch threads from live Apps Script with Smart Incremental / Delta Merge
  const fetchLiveGmailThreads = async (queryToSearch: string, isSilent = false, customLimit?: number) => {
    // Chặn gọi song song nếu đang quét dở (chống spam click)
    if (isFetchingRef.current) return;

    const activeUrl = (appsScriptUrl || webAppUrl || DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL).trim();
    if (!activeUrl) {
      if (!isSilent) {
        setIsRefreshing(true);
        setTimeout(() => {
          setIsRefreshing(false);
          toast('Đang hiển thị dữ liệu mẫu. Hãy nhập URL Apps Script để tải trực tiếp từ Gmail thật.', {
            icon: 'ℹ️'
          });
        }, 500);
      }
      return;
    }

    // Smart Delta Limit:
    // When threads already exist in Dashboard, we only need to fetch the top 6-8 newest threads.
    // Gmail sorts threads by latest update, so any incoming mail or reply is guaranteed to be in the top results!
    const effectiveLimit = customLimit || (threads.length >= 10 ? 8 : 25);

    try {
      isFetchingRef.current = true;
      setIsRefreshing(true);
      const targetUrl = `${activeUrl}${activeUrl.includes('?') ? '&' : '?'}action=gmail&q=${encodeURIComponent(queryToSearch)}&limit=${effectiveLimit}`;
      const res = await fetch(targetUrl);
      const json = await res.json();

      if (json.status === 'success' && Array.isArray(json.data)) {
        // Map raw threads into WarrantyEmailThread with smart sheet linking
        const incoming: WarrantyEmailThread[] = json.data.map((item: any, idx: number) => {
          const fullSubject = item.subject || '';
          const reqMatch = fullSubject.match(/BH-\d+/i);
          const reqId = reqMatch ? reqMatch[0].toUpperCase() : '';

          // Match 6-digit project code (e.g. 131220, 118420, 129594)
          const prjMatch = fullSubject.match(/\b\d{6}\b/);
          const prjCode = prjMatch ? prjMatch[0] : '';

          // Look up matched warranty item from sheet strictly by requestId (BH-xxx) or projectCode
          const matchedSheetItem = warrantyItems.find(w => {
            if (reqId && (w.requestId || '').toUpperCase() === reqId) return true;
            if (prjCode && (w.projectCode || '').includes(prjCode)) return true;
            return false;
          });

          const rawTime = item.lastUpdated ? new Date(item.lastUpdated).getTime() : Date.now();

          return {
            threadId: item.threadId || `live-${idx}`,
            requestId: reqId || (matchedSheetItem ? matchedSheetItem.requestId : ''),
            storeName: matchedSheetItem?.storeName || '',
            storeCode: matchedSheetItem?.storeCode || '',
            projectCode: prjCode || matchedSheetItem?.projectCode || '',
            subject: fullSubject || 'Không có tiêu đề',
            from: item.from || '',
            fromName: item.from ? item.from.split('<')[0].replace(/"/g, '').trim() : '',
            lastUpdated: item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('vi-VN') : '',
            rawTimestamp: rawTime,
            snippet: item.snippet || '',
            messagesCount: item.messageCount || 1,
            hasAttachments: Boolean(item.hasAttachments),
            attachmentsCount: Array.isArray(item.attachments) ? item.attachments.length : 0,
            messages: (item.messages || []).map((m: any, mIdx: number) => ({
              id: m.id || `m-${idx}-${mIdx}`,
              from: m.from || '',
              fromName: m.from ? m.from.split('<')[0].replace(/"/g, '').trim() : '',
              to: m.to || '',
              cc: m.cc || '',
              date: m.date ? new Date(m.date).toLocaleString('vi-VN') : '',
              snippet: m.snippet || '',
              body: m.body || m.snippet || '',
              htmlBody: m.htmlBody || '',
              attachments: (m.attachments || []).map((att: any) => ({
                name: att.name || 'Tệp đính kèm',
                contentType: att.contentType || 'application/octet-stream',
                size: formatFileSize(att.size || att.bytes),
                url: att.url || att.dataUri || '',
                dataUri: att.dataUri || '',
                contentId: att.contentId || att.cid || '',
                isImage: (att.contentType || '').startsWith('image/') || Boolean(att.isImage)
              }))
            }))
          };
        });

        // Smart merge with existing threads by threadId (detects new emails + replies to existing threads)
        setThreads(prevThreads => {
          // If incoming contains real threads from Gmail, purge initial mock sample threads
          const isMockSample = (t: WarrantyEmailThread) => t.threadId.startsWith('th-00');
          const realPrev = incoming.length > 0 ? prevThreads.filter(t => !isMockSample(t)) : prevThreads;
          const prevMap = new Map(realPrev.map(t => [t.threadId, t]));

          let newIncomingCount = 0;
          let updatedRepliesCount = 0;
          const newlyDiscoveredIds: string[] = [];

          incoming.forEach(t => {
            const prev = prevMap.get(t.threadId);
            if (!prev) {
              newIncomingCount++;
              newlyDiscoveredIds.push(t.threadId);
            } else if ((t.messagesCount || 1) > (prev.messagesCount || 1)) {
              updatedRepliesCount++;
              newlyDiscoveredIds.push(t.threadId);
            }
            prevMap.set(t.threadId, t);
          });

          // Sort strictly by timestamp descending (newest activity at the top)
          const merged = Array.from(prevMap.values()).sort((a, b) => {
            const timeA = typeof a.rawTimestamp === 'number' && !isNaN(a.rawTimestamp) ? a.rawTimestamp : 0;
            const timeB = typeof b.rawTimestamp === 'number' && !isNaN(b.rawTimestamp) ? b.rawTimestamp : 0;
            return timeB - timeA;
          });

          // Auto-mark newly discovered threads
          if (newlyDiscoveredIds.length > 0) {
            setNewThreadIds(prev => {
              const next = new Set(prev);
              newlyDiscoveredIds.forEach(id => next.add(id));
              return next;
            });
            // Auto focus to newest incoming thread
            if (merged[0]) {
              setSelectedThreadId(merged[0].threadId);
            }
          }

          // Save lightweight version to LocalStorage: preserves small image thumbnails (<45KB) for seamless F5 reload
          try {
            const lightweight = merged.map(t => ({
              ...t,
              rawTimestamp: t.rawTimestamp || (t.lastUpdated ? new Date(t.lastUpdated).getTime() : Date.now()),
              messages: (t.messages || []).map(m => ({
                id: m.id,
                from: m.from,
                fromName: m.fromName,
                to: m.to,
                cc: m.cc,
                date: m.date,
                snippet: m.snippet,
                body: m.body,
                htmlBody: (m.htmlBody && m.htmlBody.length < 35000) ? m.htmlBody : '',
                attachments: (m.attachments || []).map(a => ({
                  name: a.name,
                  contentType: a.contentType,
                  size: a.size,
                  isImage: a.isImage,
                  contentId: a.contentId,
                  url: a.url && a.url.startsWith('http') ? a.url : '',
                  // Keep small dataUri (< 45KB) so thumbnails survive F5 without exceeding 5MB quota
                  dataUri: (a.dataUri && a.dataUri.length < 45000) ? a.dataUri : undefined
                }))
              }))
            }));
            localStorage.setItem('WARRANTY_GMAIL_SAVED_THREADS', JSON.stringify(lightweight));
          } catch (e) {
            console.warn('LocalStorage quota issue', e);
          }

          // Persist incoming threads to Supabase so ANY viewer on ANY device sees the live emails!
          try {
            const payload = incoming.map(t => ({
              thread_id: t.threadId,
              subject: t.subject,
              from_email: t.from,
              from_name: t.fromName,
              last_updated: t.rawTimestamp ? new Date(t.rawTimestamp).toISOString() : new Date().toISOString(),
              snippet: t.snippet,
              messages: t.messages,
              updated_at: new Date().toISOString()
            }));

            if (payload.length > 0) {
              supabase.from('warranty_emails').upsert(payload, { onConflict: 'thread_id' }).then(({ error }) => {
                if (error) console.warn('Supabase warranty_emails upsert warning:', error.message);
              });
            }
          } catch (supErr) {
            console.warn('Supabase sync error:', supErr);
          }

          // Thông báo vận hành chính xác: Phân biệt rõ Có mail mới / Có reply mới / Đã mới nhất
          if (newIncomingCount > 0 && updatedRepliesCount > 0) {
            toast.success(`🔔 Nhận ${newIncomingCount} email bảo hành mới & ${updatedRepliesCount} phản hồi mới!`, { duration: 4500 });
          } else if (newIncomingCount > 0) {
            toast.success(`🔔 Nhận ${newIncomingCount} email bảo hành mới từ Gmail!`, { duration: 4000 });
          } else if (updatedRepliesCount > 0) {
            toast.success(`🔔 Có ${updatedRepliesCount} ca bảo hành vừa nhận phản hồi mới!`, { duration: 4000 });
          } else if (!isSilent) {
            toast.success('✓ Hộp thư đã được đồng bộ mới nhất (Không có email mới)', {
              icon: '🟢',
              duration: 3500
            });
          }

          return merged;
        });

        setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
      } else {
        if (!isSilent) {
          toast.error('Lỗi phản hồi từ Apps Script: ' + (json.message || 'Không có dữ liệu'));
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        toast.error('Không thể kết nối tới Apps Script: ' + err.message);
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const handleSelectKeyword = (kw: string) => {
    setActiveKeyword(kw);
    setIsKeywordPopoverOpen(false);
    fetchLiveGmailThreads(kw, false);
  };

  const handleAddKeyword = () => {
    const trimmed = newKeywordInput.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      toast.error('Keyword này đã tồn tại trong danh sách!');
      return;
    }
    const updated = [...keywords, trimmed];
    setKeywords(updated);
    setActiveKeyword(trimmed);
    setNewKeywordInput('');
    toast.success(`Đã thêm keyword: "${trimmed}"`);
    fetchLiveGmailThreads(trimmed);
  };

  const handleDeleteKeyword = (kwToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (keywords.length <= 1) {
      toast.error('Cần giữ ít nhất 1 keyword tìm kiếm!');
      return;
    }
    const updated = keywords.filter(k => k !== kwToDelete);
    setKeywords(updated);
    if (activeKeyword === kwToDelete) {
      setActiveKeyword(updated[0]);
      fetchLiveGmailThreads(updated[0]);
    }
    toast.success('Đã xóa keyword!');
  };

  // Selected thread object
  const activeThread = useMemo(() => {
    return threads.find(t => t.threadId === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  // Match with warrantyItem from Google Sheet strictly by requestId
  const matchedWarrantyItem = useMemo(() => {
    if (!activeThread || !activeThread.requestId) return null;
    const reqClean = activeThread.requestId.toLowerCase().trim();
    return warrantyItems.find(w => 
      (w.requestId && w.requestId.toLowerCase().trim() === reqClean) ||
      (w.rowId && `bh-${w.rowId}`.toLowerCase() === reqClean)
    ) || null;
  }, [activeThread, warrantyItems]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      // 1. Search Query inside current result
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${t.subject} ${t.requestId} ${t.storeName} ${t.from} ${t.snippet}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      // 2. Filter Types
      if (filterType === 'NEW') {
        if (!newThreadIds.has(t.threadId)) return false;
      }

      if (filterType === 'MATCHED') {
        const hasMatch = warrantyItems.some(w => 
          (w.requestId && t.requestId && w.requestId.toLowerCase().trim() === t.requestId.toLowerCase().trim())
        );
        if (!hasMatch) return false;
      }

      if (filterType === 'HAS_ATTACHMENT' && !t.hasAttachments) return false;
      if (filterType === 'IN_PROGRESS' && t.status !== 'IN_PROGRESS') return false;

      return true;
    });
  }, [threads, searchQuery, filterType, newThreadIds, warrantyItems]);

  const handleSaveConfig = (newUrl: string) => {
    const trimmed = newUrl.trim();
    setAppsScriptUrl(trimmed);
    localStorage.setItem('WARRANTY_GMAIL_APPS_SCRIPT_URL', trimmed);
    localStorage.setItem('warranty_web_app_url', trimmed);
    if (onUpdateWebAppUrl) {
      onUpdateWebAppUrl(trimmed);
    }
    setShowConfigModal(false);
    toast.success('Đã lưu Google Apps Script Web App Endpoint & Đồng bộ toàn hệ thống!');
    if (trimmed) {
      fetchLiveGmailThreads(activeKeyword);
    }
  };

  const appsScriptCodeSnippet = `/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - LIGHTWEIGHT & LIGHTNING FAST GMAIL SEARCH API (< 1 GIÂY)
 * ==============================================================================
 */

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = params.action || 'search';
  
  var result;
  if (action === 'getAttachmentData') {
    result = getAttachmentData(params.msgId, parseInt(params.attIdx || '0', 10));
  } else {
    result = processGmailSearch(params);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 1. Quét Gmail siêu tốc độ: Chỉ lấy metadata và nội dung text/HTML, KHÔNG tải hàng loạt Base64 nặng
function processGmailSearch(params) {
  var query = params.q ? decodeURIComponent(params.q) : 'subject:"bảo hành"';
  var limit = parseInt(params.limit || '8', 10);
  
  // Tối ưu index tìm kiếm với GmailApp
  var threads = GmailApp.search(query, 0, Math.min(limit, 25));
  var results = [];

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    if (!messages || messages.length === 0) continue;
    
    var lastMsg = messages[messages.length - 1];
    var msgsData = [];
    var totalAttachments = [];

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var atts = msg.getAttachments();
      var attsData = [];

      if (atts && atts.length > 0) {
        for (var k = 0; k < atts.length; k++) {
          var att = atts[k];
          var attType = att.getContentType() || 'application/octet-stream';
          var attObj = {
            name: att.getName() || ('attachment_' + (k + 1)),
            contentType: attType,
            size: Math.round(att.getSize() / 1024) + ' KB',
            isImage: attType.indexOf('image/') === 0
          };
          attsData.push(attObj);
          totalAttachments.push(attObj);
        }
      }

      var msgPlain = msg.getPlainBody() || '';
      var msgHtml = msg.getBody() || '';

      msgsData.push({
        id: msg.getId(),
        from: msg.getFrom(),
        to: msg.getTo(),
        cc: msg.getCc(),
        date: msg.getDate().toISOString(),
        snippet: msgPlain.substring(0, 150),
        body: msgPlain.substring(0, 3500),
        htmlBody: msgHtml,
        attachments: attsData
      });
    }

    var lastPlain = lastMsg.getPlainBody() || '';
    results.push({
      threadId: thread.getId(),
      subject: thread.getFirstMessageSubject() || 'Không có tiêu đề',
      messageCount: thread.getMessageCount(),
      lastUpdated: lastMsg.getDate().toISOString(),
      from: lastMsg.getFrom(),
      snippet: lastPlain.substring(0, 150),
      hasAttachments: totalAttachments.length > 0,
      attachments: totalAttachments,
      messages: msgsData
    });
  }

  return {
    status: 'success',
    query: query,
    total: results.length,
    data: results
  };
}

// 2. Tải ảnh chất lượng cao theo nhu cầu (On-Demand) khi người dùng bấm vào ảnh
function getAttachmentData(msgId, attIdx) {
  try {
    var msg = GmailApp.getMessageById(msgId);
    var atts = msg.getAttachments();
    if (!atts || attIdx >= atts.length) {
      return { status: 'error', message: 'Không tìm thấy tệp đính kèm' };
    }
    var att = atts[attIdx];
    var b64 = Utilities.base64Encode(att.getBytes());
    return {
      status: 'success',
      name: att.getName(),
      dataUri: 'data:' + att.getContentType() + ';base64,' + b64
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}`;

  const handleAttachmentClick = async (msgId: string, attIdx: number, att: WarrantyEmailAttachment) => {
    const isImg = att.isImage || att.contentType.startsWith('image/');
    if (!isImg) {
      toast('Tệp đính kèm: ' + att.name, { icon: '📄' });
      return;
    }

    if (att.dataUri || att.url) {
      setPreviewImageUrl(att.dataUri || att.url || null);
      return;
    }

    const activeUrl = (appsScriptUrl || webAppUrl || DEFAULT_WARRANTY_GMAIL_APPS_SCRIPT_URL).trim();
    if (activeUrl) {
      const toastId = toast.loading('Đang tải hình ảnh chất lượng cao...');
      try {
        const targetUrl = `${activeUrl}${activeUrl.includes('?') ? '&' : '?'}action=getAttachmentData&msgId=${encodeURIComponent(msgId)}&attIdx=${attIdx}`;
        const res = await fetch(targetUrl);
        const json = await res.json();
        if (json.status === 'success' && json.dataUri) {
          att.dataUri = json.dataUri;
          att.url = json.dataUri;
          setPreviewImageUrl(json.dataUri);
          toast.dismiss(toastId);
        } else {
          toast.dismiss(toastId);
          toast.error('Không thể tải ảnh: ' + (json.message || 'Lỗi'));
        }
      } catch (err: any) {
        toast.dismiss(toastId);
        toast.error('Lỗi kết nối tải ảnh: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL BAR */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Title & Live Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Hộp Thư &amp; Luồng Trao Đổi Bảo Hành
              </h2>
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Realtime</span>
              </Badge>
              {lastSyncedTime && (
                <span className="text-[10px] text-slate-400 font-mono">
                  (Cập nhật lúc {lastSyncedTime})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đọc email theo luồng <strong className="font-semibold text-slate-700 dark:text-slate-300">[BH-xxx]</strong> trực tiếp từ Gmail qua Apps Script.
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          
          {/* KEYWORD POPOVER TRIGGER */}
          <div className="relative" ref={keywordPopoverRef}>
            <button
              onClick={() => setIsKeywordPopoverOpen(!isKeywordPopoverOpen)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Keyword: <strong className="font-mono">{activeKeyword}</strong></span>
              <ChevronRight className={`w-3.5 h-3.5 text-indigo-500 transition-transform ${isKeywordPopoverOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* KEYWORD POPOVER PANEL */}
            {isKeywordPopoverOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <span>Bộ Lọc Từ Khóa Gmail ({keywords.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Bấm để quét ngay</span>
                </div>

                {/* Preset List */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {keywords.map((kw) => {
                    const isActive = kw === activeKeyword;
                    return (
                      <div
                        key={kw}
                        onClick={() => handleSelectKeyword(kw)}
                        className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer select-none border ${
                          isActive
                            ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5 text-white shrink-0" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 group-hover:bg-indigo-500" />
                          )}
                          <span className="truncate">{kw}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteKeyword(kw, e)}
                          className={`p-1 rounded hover:bg-rose-500 hover:text-white transition-colors cursor-pointer ${
                            isActive ? 'text-white/80' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                          }`}
                          title="Xóa keyword này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Keyword Input */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Thêm từ khóa tìm kiếm mới:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="VD: subject:BH- hoặc subject:&quot;bảo hành&quot;..."
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddKeyword();
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none font-mono focus:border-indigo-500"
                    />
                    <button
                      onClick={handleAddKeyword}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Thêm
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => setIsKeywordPopoverOpen(false)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SCAN GMAIL BUTTON */}
          <button
            onClick={() => fetchLiveGmailThreads(activeKeyword)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-indigo-200/80 dark:border-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Quét kiểm tra email bảo hành mới từ Gmail"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
            <span>{isRefreshing ? 'Đang quét...' : 'Quét Gmail'}</span>
          </button>

          {/* COMPACT CONFIG ENDPOINT BUTTON */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Cấu hình Google Apps Script Web App Endpoint & Mã Code.gs"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WEBMAIL LAYOUT (MASTER - DETAIL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[640px]">
        
        {/* LEFT COLUMN: THREAD LIST (5 cols) */}
        <div className={`lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex-col overflow-hidden ${
          mobileShowDetail ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Search & Filter bar */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã BH-xxx, mã dự án, tiêu đề, người gửi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-[11px]">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Tất cả ({threads.length})
              </button>
              {newThreadIds.size > 0 && (
                <button
                  onClick={() => setFilterType('NEW')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                    filterType === 'NEW'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Mới nhận ({newThreadIds.size})</span>
                </button>
              )}
              <button
                onClick={() => setFilterType('MATCHED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterType === 'MATCHED'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                }`}
              >
                Khớp Sheet BH
              </button>
              <button
                onClick={() => setFilterType('HAS_ATTACHMENT')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterType === 'HAS_ATTACHMENT'
                    ? 'bg-sky-600 text-white'
                    : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
                }`}
              >
                Có File/Ảnh
              </button>
              <button
                onClick={() => setFilterType('IN_PROGRESS')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterType === 'IN_PROGRESS'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                Đang xử lý
              </button>
            </div>
          </div>

          {/* Thread Cards Scrollable Container */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar max-h-[580px]">
            {filteredThreads.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Không tìm thấy email nào phù hợp với bộ lọc hoặc keyword hiện tại.
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isSelected = thread.threadId === selectedThreadId;
                const isNew = newThreadIds.has(thread.threadId);
                return (
                  <div
                    key={thread.threadId}
                    onClick={() => {
                      setSelectedThreadId(thread.threadId);
                      setMobileShowDetail(true);
                      if (isNew) {
                        setNewThreadIds(prev => {
                          const next = new Set(prev);
                          next.delete(thread.threadId);
                          return next;
                        });
                      }
                    }}
                    className={`p-3.5 transition-all cursor-pointer select-none relative ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600'
                        : isNew
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Row 1: Badges & Date */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500 text-white flex items-center gap-1 shadow-2xs animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-white"></span>
                            <span>Mới</span>
                          </span>
                        )}
                        {thread.requestId ? (
                          <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {thread.requestId}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                            Chưa gán mã
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                          {thread.fromName || thread.from}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono shrink-0 ${isNew ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                        {thread.lastUpdated ? (
                          thread.lastUpdated.includes(':') && thread.rawTimestamp && (Date.now() - thread.rawTimestamp < 86400000)
                            ? thread.lastUpdated.split(' ')[0]
                            : thread.lastUpdated.split(' ')[0]
                        ) : ''}
                      </span>
                    </div>

                    {/* Row 2: Subject */}
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                      {thread.subject}
                    </h3>

                    {/* Row 3: Snippet */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {thread.snippet}
                    </p>

                    {/* Row 4: Footer Meta (Attachments & Messages Count) */}
                    <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100/60 dark:border-slate-800/60 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-2 shrink-0">
                        {thread.hasAttachments && (
                          <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-medium">
                            <Paperclip className="w-3 h-3" />
                            <span>{thread.attachmentsCount}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-300">
                          <MessageSquare className="w-2.5 h-2.5" />
                          <span>{thread.messagesCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: THREAD READER & CONVERSATION VIEW (7 cols) */}
        <div className={`lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex-col overflow-hidden ${
          !mobileShowDetail ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeThread ? (
            <div className="flex flex-col h-full">
              
              {/* Reader Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {/* Mobile Back Button */}
                    <button
                      onClick={() => setMobileShowDetail(false)}
                      className="lg:hidden mb-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <span>← Quay lại danh sách</span>
                    </button>

                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {activeThread.requestId && (
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-600 text-white shadow-2xs">
                          {activeThread.requestId}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Chuỗi gồm {activeThread.messagesCount} email trao đổi
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                      {activeThread.subject}
                    </h2>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Direct link to original Gmail Thread */}
                    <button
                      onClick={() => {
                        const gmailUrl = activeThread.threadId && !activeThread.threadId.startsWith('th-00')
                          ? `https://mail.google.com/mail/u/0/#all/${activeThread.threadId}`
                          : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(activeThread.subject)}`;
                        window.open(gmailUrl, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 shrink-0 shadow-2xs"
                      title="Mở thẳng luồng email gốc này trên Gmail Web"
                    >
                      <Mail className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Mở trên Gmail</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>

                    {matchedWarrantyItem && onOpenWarrantyDrawer && (
                      <button
                        onClick={() => onOpenWarrantyDrawer(matchedWarrantyItem)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800 shrink-0 shadow-2xs"
                        title="Mở Drawer chỉnh sửa ca bảo hành này trên Sheet"
                      >
                        <span>Mở Ca #{matchedWarrantyItem.rowId || matchedWarrantyItem.requestId}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sheet Metadata Card if matched */}
                {matchedWarrantyItem && (
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Cửa hàng:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">{matchedWarrantyItem.storeName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Nhà thầu:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-mono">{matchedWarrantyItem.supplier || 'Chưa gán'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Tiến độ:</span>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {matchedWarrantyItem.progress || 'Chưa cập nhật'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Timeline */}
              <div className="flex-1 p-3 sm:p-4 space-y-5 overflow-y-auto custom-scrollbar max-h-[520px]">
                {activeThread.messages.map((msg, msgIdx) => {
                  const isLatest = msgIdx === activeThread.messages.length - 1;
                  const isFirst = msgIdx === 0;

                  return (
                    <div 
                      key={msg.id}
                      className={`relative p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
                        isLatest
                          ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/80 ring-2 ring-indigo-500/10'
                          : 'bg-slate-50/90 dark:bg-slate-950/70 border-slate-200/80 dark:border-slate-800/80'
                      }`}
                    >
                      {/* Timeline Connector Line (if not last) */}
                      {msgIdx < activeThread.messages.length - 1 && (
                        <div className="absolute left-6 -bottom-5 w-0.5 h-5 bg-indigo-200 dark:bg-indigo-900 z-0" />
                      )}

                      {/* Header with Numbering Badge & Sender */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                        <div className="flex items-center gap-3">
                          {/* Number Badge */}
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                            isLatest 
                              ? 'bg-indigo-600 text-white' 
                              : isFirst 
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            #{msgIdx + 1}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                {msg.fromName || msg.from}
                              </span>
                              {isFirst && (
                                <Badge className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 text-[10px] py-0 px-1.5">
                                  Yêu cầu gốc
                                </Badge>
                              )}
                              {isLatest && activeThread.messages.length > 1 && (
                                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 text-[10px] py-0 px-1.5">
                                  Phản hồi mới nhất
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Đến: <span className="font-mono text-slate-600 dark:text-slate-300">{msg.to}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-400 shrink-0 self-start sm:self-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const msgGmailUrl = activeThread.threadId && !activeThread.threadId.startsWith('th-00')
                                ? `https://mail.google.com/mail/u/0/#all/${activeThread.threadId}`
                                : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(activeThread.subject)}`;
                              window.open(msgGmailUrl, '_blank');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline cursor-pointer font-sans font-semibold"
                            title="Mở thư này trên Gmail"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Gmail ↗</span>
                          </button>
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{msg.date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Rich Message Body */}
                      <div className="pt-2">
                        <EmailBodyViewer 
                          body={msg.body} 
                          htmlBody={msg.htmlBody} 
                          attachments={msg.attachments} 
                          onImageClick={(url) => setPreviewImageUrl(url)} 
                        />
                      </div>

                      {/* Attachments Section with Image Previews */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                            <span>File &amp; Hình ảnh đính kèm ({msg.attachments.length}):</span>
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {msg.attachments.map((att, attIdx) => {
                              const isImg = att.isImage || att.contentType.startsWith('image/');
                              const imgSource = att.dataUri || att.url || '';

                              return (
                                <div
                                  key={attIdx}
                                  onClick={() => handleAttachmentClick(msg.id, attIdx, att)}
                                  className="group p-2 bg-slate-50 dark:bg-slate-950/80 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-2xs space-y-1.5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700"
                                >
                                  {/* Image Thumbnail if image */}
                                  {isImg && imgSource ? (
                                    <div 
                                      className="relative w-full h-24 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden group-hover:opacity-95"
                                    >
                                      <img 
                                        src={imgSource} 
                                        alt={att.name} 
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Eye className="w-5 h-5 text-white" />
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isImg ? (
                                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                      )}
                                      <span className="truncate font-medium text-slate-800 dark:text-slate-200 text-[11px]" title={att.name}>
                                        {att.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      {formatFileSize(att.size)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-12 text-slate-400 text-xs">
              Chọn một email từ danh sách bên trái để đọc chi tiết.
            </div>
          )}
        </div>

      </div>

      {/* IMAGE PREVIEW LIGHTBOX MODAL */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={previewImageUrl} 
              alt="Ảnh phóng to" 
              className="max-h-[85vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Cấu hình Google Apps Script Gmail Web App
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Web App URL Endpoint (Sau khi Deploy Web App trên Apps Script):
              </label>
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none font-mono focus:border-indigo-500"
              />
            </div>

            {/* Script Code Template with Copy Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  2. Mã Code.gs Mẫu (Đã hỗ trợ nhận Query động từ Dashboard):
                </label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(appsScriptCodeSnippet);
                    setCopiedCode(true);
                    toast.success('Đã sao chép toàn bộ mã Apps Script!');
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedCode ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Đã chép mã!' : 'Sao chép mã Apps Script'}</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[11px] font-mono max-h-56 overflow-y-auto border border-slate-800 custom-scrollbar leading-relaxed">
                {appsScriptCodeSnippet}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => handleSaveConfig(appsScriptUrl)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                Lưu cấu hình &amp; Quét mail ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
