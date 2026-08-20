import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Mail, RefreshCw, Paperclip, ExternalLink, Calendar, 
  User, CheckCircle2, Clock, AlertTriangle, ArrowRight, Eye, 
  Send, Filter, ShieldCheck, ChevronRight, ChevronLeft, Inbox, MessageSquare, 
  Sparkles, Check, Copy, Settings, X, Download, FileText, Image as ImageIcon,
  Plus, Tag, Trash2, Globe, CheckCheck, CheckSquare, Square, Layers,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, ClipboardList
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';

export interface RequestEmailAttachment {
  name: string;
  contentType: string;
  size: string | number;
  url?: string;
  dataUri?: string;
  isImage?: boolean;
  contentId?: string;
}

export interface RequestEmailMessage {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  date: string;
  snippet: string;
  body: string;
  htmlBody?: string;
  attachments: RequestEmailAttachment[];
}

export interface RequestEmailThread {
  threadId: string;
  subject: string;
  from: string;
  fromName?: string;
  lastUpdated: string;
  rawTimestamp?: number;
  snippet: string;
  messagesCount: number;
  hasAttachments: boolean;
  attachmentsCount: number;
  messages: RequestEmailMessage[];
}

// Utility: Format file size cleanly
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

// Sub-component: Clean Email Body Viewer
const EmailBodyViewer = React.memo<{ 
  body: string; 
  htmlBody?: string;
  attachments?: RequestEmailAttachment[];
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
      clean = clean.replace(/src=["']cid:([^"']+)["']/gi, (match, cid) => {
        const found = imageAttachments.find(a => a.contentId === cid || a.name.includes(cid));
        if (found && (found.dataUri || found.url)) {
          return `src="${found.dataUri || found.url}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;"`;
        }
        return match;
      });
    }

    return DOMPurify.sanitize(clean, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 'table', 
        'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'a', 'h1', 
        'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'img'
      ],
      ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'src', 'alt', 'width', 'height', 'align', 'valign']
    });
  }, [htmlBody, viewMode, attachments]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-medium">
          <button
            onClick={() => setViewMode('TEXT')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'TEXT' 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Văn bản thuần
          </button>
          {htmlBody && (
            <button
              onClick={() => setViewMode('RICH')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'RICH' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Định dạng HTML gốc
            </button>
          )}
        </div>
      </div>

      {viewMode === 'TEXT' || !htmlBody ? (
        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap break-words select-text">
          {formattedPlainText}
        </div>
      ) : (
        <div 
          className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto max-w-full [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:p-1.5 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:p-1.5 [&_th]:bg-slate-50 dark:[&_th]:bg-slate-800 [&_a]:text-indigo-600 dark:[&_a]:text-indigo-400 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 select-text"
          dangerouslySetInnerHTML={{ __html: cleanedHtml }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
              const src = (target as HTMLImageElement).src;
              if (src && onImageClick) onImageClick(src);
            }
          }}
        />
      )}
    </div>
  );
});

// Default Official Production Apps Script Gmail Web App URL
const DEFAULT_REQUEST_GMAIL_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzP1tvRQJaSBcZLCODjSNhjNBrTygEBJkQTGgpYHlyX1ssBVl_rzNDKW1IFEZXR4AUGTA/exec';

// Default dynamic search presets for Request
const DEFAULT_KEYWORD_PRESETS = [
  'subject:"request"',
  'subject:"REQUEST"',
  'subject:"yêu cầu"',
  'subject:"POSM"',
  'subject:"YÊU CẦU"'
];

export interface RequestInboxViewProps {
  webAppUrl?: string;
}

export const RequestInboxView: React.FC<RequestInboxViewProps> = ({ webAppUrl }) => {
  const [threads, setThreads] = useState<RequestEmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'NEW' | 'HAS_ATTACHMENT'>('ALL');
  const [newThreadIds, setNewThreadIds] = useState<Set<string>>(new Set());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isKeywordPopoverOpen, setIsKeywordPopoverOpen] = useState(false);
  const keywordPopoverRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef<boolean>(false);
  const readerScrollRef = useRef<HTMLDivElement>(null);

  // Lightbox Image Preview Modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Build combined Gmail query using OR operator
  const buildCombinedQuery = (kws: string[]) => {
    const valid = kws.filter(k => k && k.trim());
    if (valid.length === 0) return 'subject:"request" OR subject:"yêu cầu"';
    return valid.map(k => {
      const clean = k.trim();
      return (clean.startsWith('(') && clean.endsWith(')')) ? clean : `(${clean})`;
    }).join(' OR ');
  };

  // DYNAMIC KEYWORDS ON DASHBOARD
  const [keywords, setKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('REQUEST_GMAIL_KEYWORDS');
      return saved ? JSON.parse(saved) : DEFAULT_KEYWORD_PRESETS;
    } catch {
      return DEFAULT_KEYWORD_PRESETS;
    }
  });

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('REQUEST_GMAIL_SELECTED_KEYWORDS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [DEFAULT_KEYWORD_PRESETS[0], DEFAULT_KEYWORD_PRESETS[1]];
  });

  const [newKeywordInput, setNewKeywordInput] = useState('');

  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('REQUEST_GMAIL_APPS_SCRIPT_URL') || webAppUrl || DEFAULT_REQUEST_GMAIL_APPS_SCRIPT_URL;
  });

  // THREAD MESSAGE NAVIGATION (PAGINATION / NEXT / PREV)
  const [activeMessageIndex, setActiveMessageIndex] = useState<number>(0);
  const [viewAllMessages, setViewAllMessages] = useState<boolean>(false);
  const [isReaderExpanded, setIsReaderExpanded] = useState<boolean>(false);

  // Auto-scroll reader to top when active message or thread changes
  useEffect(() => {
    if (readerScrollRef.current) {
      readerScrollRef.current.scrollTop = 0;
    }
  }, [activeMessageIndex, selectedThreadId, viewAllMessages]);

  useEffect(() => {
    if (webAppUrl && !appsScriptUrl) {
      setAppsScriptUrl(webAppUrl);
    }
  }, [webAppUrl]);

  // Save keywords to localStorage
  useEffect(() => {
    localStorage.setItem('REQUEST_GMAIL_KEYWORDS', JSON.stringify(keywords));
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('REQUEST_GMAIL_SELECTED_KEYWORDS', JSON.stringify(selectedKeywords));
  }, [selectedKeywords]);

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

  // 1. Initial Load & Realtime Sync from Supabase (Independent Subscription)
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('request_emails')
          .select('*')
          .order('last_updated', { ascending: false });

        if (error) {
          console.warn('Supabase request_emails select:', error.message);
          return;
        }

        if (data && data.length > 0) {
          const mappedThreads: RequestEmailThread[] = data.map((item: any) => {
            const rawTime = item.last_updated ? new Date(item.last_updated).getTime() : Date.now();
            const msgs = Array.isArray(item.messages) ? item.messages : [];
            const attCount = msgs.reduce((acc: number, m: any) => acc + (Array.isArray(m.attachments) ? m.attachments.length : 0), 0);

            return {
              threadId: item.thread_id,
              subject: item.subject || 'Không có tiêu đề',
              from: item.from_email || '',
              fromName: item.from_name || (item.from_email ? item.from_email.split('@')[0] : ''),
              lastUpdated: formatEmailDate(item.last_updated),
              rawTimestamp: rawTime,
              snippet: item.snippet || '',
              messagesCount: msgs.length || 1,
              hasAttachments: attCount > 0,
              attachmentsCount: attCount,
              messages: msgs.map((m: any) => ({
                ...m,
                date: formatEmailDate(m.date)
              }))
            };
          });

          setThreads(mappedThreads);
          setSelectedThreadId(prev => prev || mappedThreads[0]?.threadId || '');
          setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
        } else {
          setThreads([]);
          setSelectedThreadId('');
          setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
        }
      } catch (err) {
        console.warn('Supabase initial load error:', err);
      }
    };

    loadFromSupabase();

    // Supabase Realtime Channel Subscription with Debounce to prevent render storms
    let realtimeDebounceTimer: any = null;
    const channel = supabase
      .channel('public:request_emails')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_emails' }, () => {
        if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = setTimeout(() => {
          loadFromSupabase();
        }, 800);
      })
      .subscribe();

    return () => {
      if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch threads directly from Gmail Apps Script & Supabase Cloud
  const fetchLiveGmailThreads = async (queryToSearch: string = buildCombinedQuery(selectedKeywords), isSilent = false) => {
    if (isFetchingRef.current) return;

    const toastId = isSilent ? undefined : toast.loading('Đang gửi lệnh quét tới Gmail Server... (khoảng 3 - 5s)');
    try {
      isFetchingRef.current = true;
      setIsRefreshing(true);

      const activeUrl = (appsScriptUrl || DEFAULT_REQUEST_GMAIL_APPS_SCRIPT_URL).trim();

      // 1. If Apps Script URL is available, trigger live Gmail search & push to Supabase
      if (activeUrl) {
        try {
          const targetUrl = `${activeUrl}${activeUrl.includes('?') ? '&' : '?'}action=request&q=${encodeURIComponent(queryToSearch || buildCombinedQuery(selectedKeywords))}&t=${Date.now()}`;
          await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
          // Cho máy chủ Google 2.5s để hoàn tất bóc tách và Upsert vào Supabase
          await new Promise(r => setTimeout(r, 2500));
        } catch (scriptErr) {
          console.warn('Apps Script trigger warning:', scriptErr);
        }
      }

      // 2. Fetch the latest consolidated data directly from Supabase Cloud
      const { data, error: supaErr } = await supabase
        .from('request_emails')
        .select('*')
        .order('last_updated', { ascending: false });

      if (supaErr) throw supaErr;

      if (data && data.length > 0) {
        const mappedThreads: RequestEmailThread[] = data.map((item: any) => {
          const rawTime = item.last_updated ? new Date(item.last_updated).getTime() : Date.now();
          const msgs = Array.isArray(item.messages) ? item.messages : [];
          const attCount = msgs.reduce((acc: number, m: any) => acc + (Array.isArray(m.attachments) ? m.attachments.length : 0), 0);

          return {
            threadId: item.thread_id,
            subject: item.subject || 'Không có tiêu đề',
            from: item.from_email || '',
            fromName: item.from_name || (item.from_email ? item.from_email.split('@')[0] : ''),
            lastUpdated: formatEmailDate(item.last_updated),
            rawTimestamp: rawTime,
            snippet: item.snippet || '',
            messagesCount: msgs.length || 1,
            hasAttachments: attCount > 0,
            attachmentsCount: attCount,
            messages: msgs.map((m: any) => ({
              ...m,
              date: formatEmailDate(m.date)
            }))
          };
        });

        setThreads(mappedThreads);
        if (mappedThreads[0] && !selectedThreadId) {
          setSelectedThreadId(mappedThreads[0].threadId);
        }
        setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));

        if (!isSilent && toastId) {
          toast.success(`✓ Đã quét Gmail & cập nhật ${mappedThreads.length} email trên Supabase!`, {
            id: toastId,
            icon: '🚀',
            duration: 4000
          });
        }
      } else {
        setThreads([]);
        setSelectedThreadId('');
        if (!isSilent && toastId) {
          toast('Hộp thư trên Supabase đang trống (0 email).', { id: toastId, icon: 'ℹ️' });
        }
      }
    } catch (err: any) {
      // If network fails, pull from Supabase
      const { data: supaData } = await supabase.from('request_emails').select('*').order('last_updated', { ascending: false });
      if (supaData && supaData.length > 0) {
        if (!isSilent && toastId) {
          toast.success(`Đã tải ${supaData.length} email từ Supabase Cloud`, { id: toastId, icon: '☁️', duration: 3500 });
        }
      } else if (!isSilent && toastId) {
        toast.error('Lỗi kết nối Supabase: ' + err.message, { id: toastId });
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const handleToggleKeyword = (kw: string) => {
    setSelectedKeywords(prev => {
      if (prev.includes(kw)) {
        if (prev.length <= 1) {
          toast('Phải giữ ít nhất 1 từ khóa tìm kiếm!', { icon: '⚠️' });
          return prev;
        }
        return prev.filter(k => k !== kw);
      } else {
        return [...prev, kw];
      }
    });
  };

  const handleSelectAllKeywords = () => {
    setSelectedKeywords([...keywords]);
  };

  const handleDeselectAllKeywords = () => {
    if (keywords.length > 0) {
      setSelectedKeywords([keywords[0]]);
    }
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
    setSelectedKeywords(prev => [...prev, trimmed]);
    setNewKeywordInput('');
    toast.success(`Đã thêm keyword: "${trimmed}"`);
  };

  const handleDeleteKeyword = (kwToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (keywords.length <= 1) {
      toast.error('Cần giữ ít nhất 1 keyword trong danh sách!');
      return;
    }
    const updated = keywords.filter(k => k !== kwToDelete);
    setKeywords(updated);
    setSelectedKeywords(prev => {
      const filtered = prev.filter(k => k !== kwToDelete);
      return filtered.length > 0 ? filtered : [updated[0]];
    });
    toast.success('Đã xóa keyword!');
  };

  const handleApplyAndScan = () => {
    setIsKeywordPopoverOpen(false);
    fetchLiveGmailThreads(buildCombinedQuery(selectedKeywords), false);
  };

  // Selected thread object
  const activeThread = useMemo(() => {
    return threads.find(t => t.threadId === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      // 1. Search Query inside current result
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${t.subject} ${t.from} ${t.snippet}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      // 2. Filter Types
      if (filterType === 'NEW') {
        if (!newThreadIds.has(t.threadId)) return false;
      }

      if (filterType === 'HAS_ATTACHMENT' && !t.hasAttachments) return false;

      return true;
    });
  }, [threads, searchQuery, filterType, newThreadIds]);

  const handleSaveConfig = (newUrl: string) => {
    const trimmed = newUrl.trim();
    setAppsScriptUrl(trimmed);
    localStorage.setItem('REQUEST_GMAIL_APPS_SCRIPT_URL', trimmed);
    setShowConfigModal(false);
    toast.success('Đã lưu URL Google Apps Script Gmail Sync!');
    if (trimmed) {
      fetchLiveGmailThreads(buildCombinedQuery(selectedKeywords));
    }
  };

  const handleAttachmentClick = async (msgId: string, attIdx: number, att: RequestEmailAttachment) => {
    const isImg = att.isImage || (att.contentType && att.contentType.startsWith('image/'));
    if (!isImg) {
      toast('Tệp đính kèm: ' + att.name, { icon: '📄' });
      return;
    }

    if (att.dataUri || att.url) {
      setPreviewImageUrl(att.dataUri || att.url || null);
      return;
    }

    const activeUrl = (appsScriptUrl || webAppUrl || DEFAULT_REQUEST_GMAIL_APPS_SCRIPT_URL).trim();
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
    <div className="space-y-3">
      {/* 1. COMPACT TOOLBAR BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Left: Quick Realtime Info */}
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] font-semibold flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Realtime ({threads.length} luồng thư)</span>
          </Badge>
          {lastSyncedTime && (
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              • Cập nhật {lastSyncedTime}
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* KEYWORD POPOVER TRIGGER */}
          <div className="relative" ref={keywordPopoverRef}>
            <button
              onClick={() => setIsKeywordPopoverOpen(!isKeywordPopoverOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                Từ khóa: <strong className="font-mono">{selectedKeywords.length === 1 ? selectedKeywords[0] : `${selectedKeywords.length} đang chọn`}</strong>
              </span>
              <ChevronRight className={`w-3 h-3 text-indigo-500 transition-transform ${isKeywordPopoverOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* KEYWORD POPOVER PANEL */}
            {isKeywordPopoverOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <span>Bộ Lọc Từ Khóa Gmail ({selectedKeywords.length}/{keywords.length})</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={handleSelectAllKeywords}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      onClick={handleDeselectAllKeywords}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Preset List with Multi-select Checkboxes */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {keywords.map((kw) => {
                    const isChecked = selectedKeywords.includes(kw);
                    return (
                      <div
                        key={kw}
                        onClick={() => handleToggleKeyword(kw)}
                        className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer select-none border ${
                          isChecked
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-bold border-indigo-300 dark:border-indigo-800 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{kw}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteKeyword(kw, e)}
                          className="p-1 rounded hover:bg-rose-500 hover:text-white text-slate-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="Xóa keyword này"
                        >
                          <X className="w-3.5 h-3.5" />
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
                      placeholder="VD: subject:request hoặc subject:&quot;yêu cầu&quot;..."
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

                {/* Footer Actions */}
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    onClick={() => setIsKeywordPopoverOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={handleApplyAndScan}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Áp dụng &amp; Quét ({selectedKeywords.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SCAN GMAIL BUTTON */}
          <button
            onClick={() => fetchLiveGmailThreads(buildCombinedQuery(selectedKeywords))}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            title="Quét kiểm tra email request mới từ Gmail"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang quét...' : 'Quét Gmail'}</span>
          </button>

          {/* COMPACT CONFIG ENDPOINT BUTTON */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Cấu hình Google Apps Script Web App Endpoint"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WEBMAIL LAYOUT (MASTER - DETAIL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[640px]">
        
        {/* LEFT COLUMN: THREAD LIST */}
        {!isReaderExpanded && (
          <div className={`lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex-col overflow-hidden ${
            mobileShowDetail ? 'hidden lg:flex' : 'flex'
          }`}>
            
            {/* Search & Filter bar */}
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo người gửi, tiêu đề, nội dung thư..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between gap-1.5 pb-0.5 text-[11px]">
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
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
                    onClick={() => setFilterType(filterType === 'HAS_ATTACHMENT' ? 'ALL' : 'HAS_ATTACHMENT')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                      filterType === 'HAS_ATTACHMENT'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Có tệp</span>
                  </button>
                </div>

                {/* THU GỌN DANH SÁCH */}
                <button
                  onClick={() => setIsReaderExpanded(true)}
                  className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700 shadow-2xs"
                  title="Thu gọn danh sách"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thread Cards Scrollable Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar max-h-[580px]">
              {threads.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Hộp thư Request chưa có email
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Bấm &quot;Quét Gmail&quot; để tìm và đồng bộ các email request POSM mới nhất về Supabase Cloud.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => fetchLiveGmailThreads(buildCombinedQuery(selectedKeywords))}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Quét Gmail Ngay
                    </button>
                    <button
                      onClick={() => setShowConfigModal(true)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cài Đặt URL
                    </button>
                  </div>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy email nào phù hợp với bộ lọc hoặc từ khóa hiện tại.
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
                      {/* Row 1: Sender & Date */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isNew && (
                            <span className="px-1.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500 text-white flex items-center gap-1 shadow-2xs animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-white"></span>
                              <span>Mới</span>
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {thread.fromName || thread.from}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono shrink-0 ${isNew ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {formatEmailDate(thread.lastUpdated)}
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
        )}

        {/* RIGHT COLUMN: THREAD READER & CONVERSATION VIEW */}
        <div className={`${isReaderExpanded ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex-col overflow-hidden ${
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
                    {isReaderExpanded && (
                      <button
                        onClick={() => setIsReaderExpanded(false)}
                        className="hidden lg:flex p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                        title="Mở rộng danh sách"
                      >
                        <PanelLeftOpen className="w-4 h-4" />
                      </button>
                    )}

                    {/* Mode Toggle Button */}
                    {activeThread.messages && activeThread.messages.length > 1 && (
                      <button
                        onClick={() => setViewAllMessages(!viewAllMessages)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                          viewAllMessages
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                        title={viewAllMessages ? 'Chuyển về chế độ xem từng thư một' : 'Xem toàn bộ các thư nối tiếp nhau'}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{viewAllMessages ? 'Xem từng thư' : `Xem tất cả (${activeThread.messages.length})`}</span>
                      </button>
                    )}

                    {/* Direct link to original Gmail Thread */}
                    <button
                      onClick={() => {
                        const gmailUrl = activeThread.threadId
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
                  </div>
                </div>

                {/* THREAD MESSAGE NAVIGATION BAR */}
                {activeThread.messages && activeThread.messages.length > 1 && !viewAllMessages && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Number buttons and Prev/Next */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                      {/* Prev Button */}
                      <button
                        disabled={activeMessageIndex <= 0}
                        onClick={() => setActiveMessageIndex(prev => Math.max(0, prev - 1))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                          activeMessageIndex <= 0
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs'
                        }`}
                        title="Xem thư trước đó"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>

                      {/* Numbered Pills */}
                      <div className="flex items-center gap-1">
                        {activeThread.messages.map((m, idx) => {
                          const isActive = idx === activeMessageIndex;
                          const isFirst = idx === 0;
                          const isLast = idx === activeThread.messages.length - 1;
                          return (
                            <button
                              key={m.id || idx}
                              onClick={() => setActiveMessageIndex(idx)}
                              className={`h-7 px-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-700'
                                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                              title={`Thư #${idx + 1}: ${m.fromName || m.from}`}
                            >
                              <span>#{idx + 1}</span>
                              {isFirst && <span className="text-[9px] opacity-70">🌱</span>}
                              {isLast && <span className="text-[9px] opacity-70">⚡</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Next Button */}
                      <button
                        disabled={activeMessageIndex >= activeThread.messages.length - 1}
                        onClick={() => setActiveMessageIndex(prev => Math.min(activeThread.messages.length - 1, prev + 1))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                          activeMessageIndex >= activeThread.messages.length - 1
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs'
                        }`}
                        title="Xem thư tiếp theo"
                      >
                        <span>Sau</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Jump to first / latest quick links */}
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => setActiveMessageIndex(0)}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          activeMessageIndex === 0 
                            ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-slate-100' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        Đầu tiên (#1)
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        onClick={() => setActiveMessageIndex(activeThread.messages.length - 1)}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          activeMessageIndex === activeThread.messages.length - 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        Mới nhất (#{activeThread.messages.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Timeline or Single Focused Message View */}
              <div ref={readerScrollRef} className="flex-1 p-3 sm:p-4 space-y-5 overflow-y-auto custom-scrollbar max-h-[540px]">
                {(viewAllMessages ? activeThread.messages : [activeThread.messages[activeMessageIndex] || activeThread.messages[0]]).filter(Boolean).map((msg, displayedIdx) => {
                  const actualMsgIdx = viewAllMessages ? displayedIdx : activeMessageIndex;
                  const isLatest = actualMsgIdx === activeThread.messages.length - 1;
                  const isFirst = actualMsgIdx === 0;

                  return (
                    <div 
                      key={msg.id || actualMsgIdx}
                      className={`relative p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
                        isLatest
                          ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/80 ring-2 ring-indigo-500/10'
                          : 'bg-slate-50/90 dark:bg-slate-950/70 border-slate-200/80 dark:border-slate-800/80'
                      }`}
                    >
                      {/* Timeline Connector Line */}
                      {viewAllMessages && actualMsgIdx < activeThread.messages.length - 1 && (
                        <div className="absolute left-6 -bottom-5 w-0.5 h-5 bg-indigo-200 dark:bg-indigo-900 z-0" />
                      )}

                      {/* Header with Numbering Badge & Sender */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                            isLatest 
                              ? 'bg-indigo-600 text-white' 
                              : isFirst 
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            #{actualMsgIdx + 1}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                {msg.fromName || msg.from}
                              </span>
                              {isFirst && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full">
                                  Yêu cầu gốc
                                </span>
                              )}
                              {isLatest && activeThread.messages.length > 1 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
                                  Phản hồi mới nhất
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap font-mono">
                              <span>Từ: <strong className="text-slate-700 dark:text-slate-300">{msg.from}</strong></span>
                              {msg.to && (
                                <>
                                  <span>•</span>
                                  <span>Đến: {msg.to}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatEmailDate(msg.date)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Clean Body Content */}
                      <div className="pt-3">
                        <EmailBodyViewer 
                          body={msg.body} 
                          htmlBody={msg.htmlBody} 
                          attachments={msg.attachments} 
                          onImageClick={(imgUrl) => setPreviewImageUrl(imgUrl)}
                        />
                      </div>

                      {/* Attachments Section */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                            <span>Tệp đính kèm ({msg.attachments.length}):</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {msg.attachments.map((att, attIdx) => {
                              const isImg = att.isImage || (att.contentType && att.contentType.startsWith('image/'));
                              return (
                                <div
                                  key={attIdx}
                                  onClick={() => handleAttachmentClick(msg.id, attIdx, att)}
                                  className="group flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div className={`p-1.5 rounded-lg shrink-0 ${isImg ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                      {isImg ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="truncate">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {att.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        {formatFileSize(att.size)}
                                      </p>
                                    </div>
                                  </div>
                                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Inbox className="w-12 h-12 stroke-[1.5] mb-2 opacity-40 text-indigo-400" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa chọn luồng thư nào</p>
              <p className="text-xs mt-1">Chọn một luồng thư từ danh sách bên trái để đọc chi tiết nội dung.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. LIGHTBOX IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={previewImageUrl} 
              alt="Hình ảnh đính kèm" 
              className="max-w-full max-h-[85vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* 4. CONFIG ENDPOINT MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>Cấu Hình Google Apps Script Gmail Sync</span>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Google Apps Script Web App URL:
                </label>
                <input
                  type="text"
                  defaultValue={appsScriptUrl}
                  id="appsScriptUrlInput"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-mono text-xs focus:border-indigo-500"
                />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Nhập đường dẫn Web App đã Deploy từ Google Apps Script để Dashboard kích hoạt lệnh quét Gmail trực tiếp.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('appsScriptUrlInput') as HTMLInputElement;
                  if (input) handleSaveConfig(input.value);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
