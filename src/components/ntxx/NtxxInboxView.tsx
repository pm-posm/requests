import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Mail, RefreshCw, Paperclip, ExternalLink, Calendar, 
  User, CheckCircle2, Clock, AlertTriangle, ArrowRight, Eye, 
  Send, Filter, ShieldCheck, ChevronRight, ChevronLeft, Inbox, MessageSquare, 
  Sparkles, Check, Copy, Settings, X, Download, FileText, Image as ImageIcon,
  Plus, Tag, Trash2, Globe, CheckCheck, CheckSquare, Square, Layers,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { supabase } from '@/lib/supabase';

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

// Default Keywords for NTXX Gmail Search
const DEFAULT_NTXX_KEYWORDS = [
  'subject:"NTXX"',
  'subject:"nghiệm thu xuất xưởng"',
  'subject:"nghiệm thu"',
  'subject:"BBNT"',
  'label:"NTXX"'
];

export const NtxxInboxView: React.FC<{
  initialSearch?: string;
  webAppUrl?: string;
  onSaveWebAppUrl?: (url: string) => void;
}> = ({
  initialSearch = ''
}) => {
  const [threads, setThreads] = useState<NtxxEmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [filterType, setFilterType] = useState<'ALL' | 'NEW' | 'HAS_ATTACHMENT'>('ALL');
  
  // Collapse / expand sidebar list (100% full width reader mode)
  const [isReaderExpanded, setIsReaderExpanded] = useState<boolean>(false);
  const [mobileShowDetail, setMobileShowDetail] = useState<boolean>(false);
  
  // Message stepper inside active thread (1-indexed)
  const [activeMessageIndex, setActiveMessageIndex] = useState<number>(0);

  // Lightbox for image attachments
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Sync state
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [newThreadIds, setNewThreadIds] = useState<Set<string>>(new Set());

  // Keyword Filter State
  const [keywords, setKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('NTXX_GMAIL_KEYWORDS_LIST');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_NTXX_KEYWORDS;
  });

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('NTXX_GMAIL_SELECTED_KEYWORDS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [DEFAULT_NTXX_KEYWORDS[0], DEFAULT_NTXX_KEYWORDS[1]];
  });

  const [isKeywordPopoverOpen, setIsKeywordPopoverOpen] = useState<boolean>(false);
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');
  const keywordPopoverRef = useRef<HTMLDivElement>(null);

  // Apps Script Web App URL configuration
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('NTXX_GMAIL_APPS_SCRIPT_URL') || '';
  });
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>(appsScriptUrl);

  // Save keywords to localStorage
  useEffect(() => {
    localStorage.setItem('NTXX_GMAIL_KEYWORDS_LIST', JSON.stringify(keywords));
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('NTXX_GMAIL_SELECTED_KEYWORDS', JSON.stringify(selectedKeywords));
  }, [selectedKeywords]);

  // Click outside to close Keyword Popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (keywordPopoverRef.current && !keywordPopoverRef.current.contains(e.target as Node)) {
        setIsKeywordPopoverOpen(false);
      }
    };
    if (isKeywordPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isKeywordPopoverOpen]);

  // Build Gmail search query from selected keywords
  const buildCombinedQuery = (kwList: string[]): string => {
    if (!kwList || kwList.length === 0) return DEFAULT_NTXX_KEYWORDS[0];
    if (kwList.length === 1) return kwList[0];
    return '(' + kwList.join(' OR ') + ')';
  };

  // Fetch threads from Supabase or trigger scan via Apps Script
  const fetchThreads = async (queryStr?: string, isSilent = false) => {
    setIsRefreshing(true);
    try {
      // 1. If Apps Script URL is set and manual scan requested, trigger Apps Script sync
      if (appsScriptUrl && !isSilent) {
        const q = encodeURIComponent(queryStr || buildCombinedQuery(selectedKeywords));
        const scanUrl = `${appsScriptUrl}?action=gmail&q=${q}&t=${Date.now()}`;
        try {
          await fetch(scanUrl, { method: 'GET', mode: 'no-cors' });
        } catch {}
      }

      // 2. Fetch directly from Supabase table ntxx_emails (Schema identical to warranty_emails)
      const { data, error } = await supabase
        .from('ntxx_emails')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: NtxxEmailThread[] = data.map((item: any) => {
          const msgs = Array.isArray(item.messages) ? item.messages : [];
          let attCount = 0;
          msgs.forEach((m: any) => {
            if (Array.isArray(m.attachments)) attCount += m.attachments.length;
          });

          return {
            threadId: item.thread_id,
            subject: item.subject || '(Không có tiêu đề)',
            from: item.from_email || '',
            fromName: item.from_name || (item.from_email ? item.from_email.split('@')[0] : ''),
            lastUpdated: formatEmailDate(item.last_updated),
            rawTimestamp: new Date(item.last_updated || item.created_at || Date.now()).getTime(),
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

        setThreads(mapped);
        if (mapped.length > 0 && !selectedThreadId) {
          setSelectedThreadId(mapped[0].threadId);
        }
        setLastSyncedTime(new Date().toLocaleTimeString('vi-VN'));
        if (!isSilent) {
          toast.success(`Đã tải ${mapped.length} luồng thư NTXX từ Supabase Cloud!`);
        }
      } else {
        setThreads([]);
        setSelectedThreadId('');
        if (!isSilent) {
          toast('Hộp thư NTXX trên Supabase hiện chưa có dữ liệu (0 email).', { icon: 'ℹ️' });
        }
      }
    } catch (err: any) {
      console.warn('Lỗi tải email NTXX:', err);
      if (!isSilent) {
        toast.error('Lỗi kết nối Supabase: ' + (err.message || 'Thất bại'));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load & Supabase Realtime Channel
  useEffect(() => {
    fetchThreads(undefined, true);

    const channel = supabase
      .channel('ntxx_emails_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ntxx_emails' },
        () => {
          fetchThreads(undefined, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Keyword management handlers
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
      toast.error('Từ khóa này đã tồn tại trong danh sách!');
      return;
    }
    const updated = [...keywords, trimmed];
    setKeywords(updated);
    setSelectedKeywords(prev => [...prev, trimmed]);
    setNewKeywordInput('');
    toast.success(`Đã thêm từ khóa: "${trimmed}"`);
  };

  const handleDeleteKeyword = (kwToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (keywords.length <= 1) {
      toast.error('Cần giữ ít nhất 1 từ khóa trong danh sách!');
      return;
    }
    const updated = keywords.filter(k => k !== kwToDelete);
    setKeywords(updated);
    setSelectedKeywords(prev => {
      const filtered = prev.filter(k => k !== kwToDelete);
      return filtered.length > 0 ? filtered : [updated[0]];
    });
    toast.success('Đã xóa từ khóa!');
  };

  const handleApplyAndScan = () => {
    setIsKeywordPopoverOpen(false);
    fetchThreads(buildCombinedQuery(selectedKeywords), false);
  };

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${t.subject} ${t.from} ${t.fromName} ${t.snippet}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      if (filterType === 'NEW' && !newThreadIds.has(t.threadId)) return false;
      if (filterType === 'HAS_ATTACHMENT' && !t.hasAttachments) return false;
      return true;
    }).sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
  }, [threads, searchQuery, filterType, newThreadIds]);

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

  // Active message in thread
  const activeMessage = useMemo(() => {
    if (!activeThread || !activeThread.messages || activeThread.messages.length === 0) return null;
    return activeThread.messages[activeMessageIndex] || activeThread.messages[activeThread.messages.length - 1];
  }, [activeThread, activeMessageIndex]);

  return (
    <div className="space-y-3 font-sans pb-8">
      
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
                    <span>Bộ Lọc Từ Khóa NTXX ({selectedKeywords.length}/{keywords.length})</span>
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
                          title="Xóa từ khóa này"
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
                      placeholder="VD: subject:NTXX- hoặc label:NTXX..."
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
            onClick={() => fetchThreads(buildCombinedQuery(selectedKeywords))}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            title="Quét kiểm tra email NTXX mới từ Gmail"
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
        
        {/* LEFT COLUMN: THREAD LIST (Collapsible) */}
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

              {/* Filter Pills & Collapse Button */}
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
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Có đính kèm</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsReaderExpanded(true)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer hidden lg:block"
                  title="Thu gọn danh sách (Phóng to khung đọc mail)"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Thread list scroll */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[640px] custom-scrollbar">
              {filteredThreads.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                  <p className="text-xs">Không tìm thấy luồng thư NTXX nào</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = activeThread?.threadId === thread.threadId;
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
                      className={`p-3.5 transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Sender and Date */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          )}
                          <span className={`text-xs truncate ${isSelected ? 'font-bold text-indigo-950 dark:text-indigo-200' : 'font-semibold text-slate-900 dark:text-slate-100'}`}>
                            {thread.fromName || thread.from}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {thread.lastUpdated.split(' ')[0]}
                        </span>
                      </div>

                      {/* Subject */}
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                        {thread.subject}
                      </div>

                      {/* Snippet */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {thread.snippet}
                      </div>

                      {/* Footer tags */}
                      <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-slate-100/80 dark:border-slate-800/60 text-[10px] text-slate-400">
                        {thread.hasAttachments && (
                          <span className="flex items-center gap-0.5 text-slate-500 font-medium">
                            <Paperclip className="w-3 h-3" />
                            {thread.attachmentsCount || 1}
                          </span>
                        )}
                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {thread.messagesCount || 1} thư
                        </span>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* RIGHT COLUMN: EMAIL READER PANE */}
        <div className={`${isReaderExpanded ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col overflow-hidden ${
          !mobileShowDetail ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {activeThread ? (
            <>
              {/* Reader Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/40 dark:bg-slate-950/40">
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    
                    {/* Back on Mobile */}
                    <button
                      onClick={() => setMobileShowDetail(false)}
                      className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg lg:hidden"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Expand/Collapse sidebar button */}
                    {isReaderExpanded && (
                      <button
                        onClick={() => setIsReaderExpanded(false)}
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs shrink-0"
                        title="Mở lại danh sách thư"
                      >
                        <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                        <span>Mở Danh Sách</span>
                      </button>
                    )}

                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {activeThread.subject}
                    </h2>
                  </div>
                </div>

                {/* Message Stepper if Thread has multiple messages */}
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[600px] custom-scrollbar">
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
                          <span>Tệp đính kèm ({activeMessage.attachments.length}):</span>
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
                                {att.isImage && (att.dataUri || att.url) && (
                                  <button
                                    onClick={() => setLightboxImageUrl(att.dataUri || att.url!)}
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
                Vui lòng chọn một luồng thư từ danh sách bên trái để đọc nội dung trao đổi NTXX.
              </p>
            </div>
          )}

        </div>

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
              alt="Attachment Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                Cài Đặt Google Apps Script (NTXX)
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
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
                URL triển khai Apps Script của bạn từ file <code>google-scripts/NTXX_Gmail_Supabase_Sync.gs</code>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  const trimmed = tempUrl.trim();
                  setAppsScriptUrl(trimmed);
                  localStorage.setItem('NTXX_GMAIL_APPS_SCRIPT_URL', trimmed);
                  setShowConfigModal(false);
                  toast.success('Đã lưu cấu hình Apps Script NTXX!');
                  if (trimmed) {
                    fetchThreads(buildCombinedQuery(selectedKeywords));
                  }
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
