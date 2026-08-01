import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { normalizeDataResponser, getLiveMasterContactMap, SHEET_TIEN_DO_OPTIONS } from '@/services/sheetSyncService';
import { PHUONG_AN_OPTIONS, useWorkflowEngine } from '@/hooks/useWorkflowEngine';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { 
    Search, ExternalLink, Image as ImageIcon, Calendar, Building2, User, Clock, Tag, 
    CheckCircle2, Clock4, XCircle, AlertCircle, Hash, Copy, Check, Eye, WrapText, AlignLeft, X, MessageSquare, Briefcase, Mail, ShieldCheck, Save, Table, BarChart3
} from 'lucide-react';
import { ManageStatusModal } from './ManageStatusModal';
import { SubtaskModal } from './SubtaskModal';
import { WarrantySubtaskModal } from './WarrantySubtaskModal';
import { ImageLightboxModal, type LightboxImage } from '@/components/ui/ImageLightboxModal';
import { BulkActionBar } from './BulkActionBar';
import { ColumnVisibilityModal, DEFAULT_VISIBLE_KEYS } from './ColumnVisibilityModal';
import { CommandCenterHeader } from './CommandCenterHeader';
import { RequestAnalyticsView } from './RequestAnalyticsView';
import { RequestTableRow } from './RequestTableRow';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MerRequestsTableProps {
    requests: RawRequestRecord[];
    onUpdateRequest: (id: string, updates: Partial<RawRequestRecord>) => Promise<any>;
    isUpdating: boolean;
}

export interface ParsedResponserItem {
    email?: string;
    title?: string;
    response?: string;
    comment?: string;
    timeResponse?: string;
    rawText?: string;
}

export function parseResponserItems(rawText: string): ParsedResponserItem[] {
    if (!rawText) return [];
    const text = rawText.trim();
    if (!text || text === 'null' || text === 'undefined') return [];

    // Case 1: JSON format
    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            return list.map(item => {
                if (typeof item !== 'object' || !item) return { rawText: String(item) };
                
                const getCase = (keys: string[]) => {
                    for (const k of Object.keys(item)) {
                        if (keys.map(x => x.toLowerCase()).includes(k.toLowerCase())) {
                            return String(item[k] || '').trim();
                        }
                    }
                    return '';
                };

                return {
                    email: getCase(['email', 'mail', 'approver', 'user', 'person', 'name', 'nguoiduyet']),
                    title: getCase(['title', 'role', 'position', 'chucvu', 'phongban', 'job']),
                    response: getCase(['response', 'status', 'action', 'result', 'decision', 'duyet', 'phanhoi']),
                    comment: getCase(['comment', 'note', 'reason', 'notes', 'ykien', 'ghichu', 'y_kien']),
                    timeResponse: getCase(['time_response', 'time', 'date', 'timestamp', 'created', 'luc', 'ngay']),
                    rawText: JSON.stringify(item)
                };
            });
        } catch (e) {
            // fallback to string parsing below
        }
    }

    // Case 2: Plain text or formatted string (e.g. separated by | or newlines or •)
    const blocks = text.split(/\||\n/).map(b => b.trim()).filter(Boolean);
    const results: ParsedResponserItem[] = [];

    for (const block of blocks) {
        let email = '';
        let title = '';
        let response = '';
        let comment = '';
        let timeResponse = '';

        const parts = block.split(/•|\s+-\s+/).map(p => p.trim());
        let matchedKey = false;

        for (const part of parts) {
            const lower = part.toLowerCase();
            if (lower.startsWith('email:')) {
                email = part.replace(/^email:/i, '').trim();
                matchedKey = true;
            } else if (lower.startsWith('chức vụ:') || lower.startsWith('title:')) {
                title = part.replace(/^(chức vụ|title):/i, '').trim();
                matchedKey = true;
            } else if (lower.startsWith('duyệt:') || lower.startsWith('duyet:') || lower.startsWith('response:')) {
                response = part.replace(/^(duyệt|duyet|response):/i, '').trim();
                matchedKey = true;
            } else if (lower.startsWith('comment:') || lower.startsWith('ý kiến:') || lower.startsWith('note:')) {
                comment = part.replace(/^(comment|ý kiến|note):/i, '').trim();
                matchedKey = true;
            } else if (lower.startsWith('lúc:') || lower.startsWith('thời gian:') || lower.startsWith('date:')) {
                timeResponse = part.replace(/^(lúc|thời gian|date):/i, '').trim();
                matchedKey = true;
            }
        }

        if (matchedKey) {
            results.push({ email, title, response, comment, timeResponse, rawText: block });
        } else {
            const emailMatch = block.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            results.push({
                email: emailMatch ? emailMatch[1] : '',
                comment: block,
                rawText: block
            });
        }
    }

    return results;
}

export const STATUS_COLUMN_PRESETS = [
    'New',
    'Under CSP Review',
    'Sent to CSP',
    'Approved',
    'Rejected',
    'Cancelled',
    'Supplier Bảo Hành',
    'Mer quick fix'
];

export function MerRequestsTable({ requests, onUpdateRequest, isUpdating }: MerRequestsTableProps) {
    const { statuses } = useWorkflowEngine();
    const { isAdmin } = useDashboardStore();
    const [activeModuleTab, setActiveModuleTab] = useState<'DATA_LIST' | 'ANALYST'>('DATA_LIST');

    const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);

    const handleGuardedUpdate = useCallback(async (recordId: string, updates: Partial<RawRequestRecord>) => {
        if (!isAdmin) {
            toast.error('🔒 Quyền bị từ chối: Vui lòng đăng nhập tài khoản Admin để chỉnh sửa!');
            return;
        }
        setUpdatingRowId(recordId);
        try {
            await onUpdateRequest(recordId, updates);
        } finally {
            setUpdatingRowId(null);
        }
    }, [isAdmin, onUpdateRequest]);

    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
    const [activeQuickFilter, setActiveQuickFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE'>('ALL');
    const [isColumnVisibilityOpen, setIsColumnVisibilityOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('posm_visible_columns');
            return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_KEYS;
        } catch {
            return DEFAULT_VISIBLE_KEYS;
        }
    });

    // Image Lightbox state
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
    const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

    const handleOpenLightbox = useCallback((imgs: LightboxImage[], index = 0) => {
        setLightboxImages(imgs);
        setLightboxInitialIndex(index);
        setIsLightboxOpen(true);
    }, []);

    const handleSaveVisibleColumns = useCallback((cols: string[]) => {
        setVisibleColumns(cols);
        localStorage.setItem('posm_visible_columns', JSON.stringify(cols));
    }, []);

    const handleBulkUpdate = useCallback(async (updates: { phuong_an?: string; status?: string; tien_do?: string; supplier?: string }) => {
        for (const recordId of selectedRowIds) {
            await onUpdateRequest(recordId, updates);
        }
        setSelectedRowIds([]);
    }, [selectedRowIds, onUpdateRequest]);

    const globalSearchTerm = useDashboardStore(s => s.searchTerm);
    const [searchTerm, setSearchTerm] = useState(globalSearchTerm);

    React.useEffect(() => {
        setSearchTerm(globalSearchTerm);
    }, [globalSearchTerm]);
    const [filterPhuongAn, setFilterPhuongAn] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterTienDo, setFilterTienDo] = useState('ALL');
    const [filterMer, setFilterMer] = useState('ALL');
    const [filterSupplier, setFilterSupplier] = useState('ALL');
    const [filterYear, setFilterYear] = useState('2026');
    const [activeStatusCategory, setActiveStatusCategory] = useState<'ALL' | 'to_do' | 'in_progress' | 'review' | 'done'>('ALL');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isWrapText, setIsWrapText] = useState(false);
    const [selectedDetailRequest, setSelectedDetailRequest] = useState<RawRequestRecord | null>(null);
    const [selectedNotesRecord, setSelectedNotesRecord] = useState<RawRequestRecord | null>(null);
    const [subtaskModalRecord, setSubtaskModalRecord] = useState<RawRequestRecord | null>(null);
    const [warrantySubtaskRecord, setWarrantySubtaskRecord] = useState<RawRequestRecord | null>(null);

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    // Client-side Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Reset page to 1 whenever search or filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterPhuongAn, filterStatus, filterTienDo, filterMer, filterYear, activeStatusCategory, activeQuickFilter]);

    // Fetch Live Master Store Contact map to get SR phone numbers
    const { data: contactMap } = useQuery({
        queryKey: ['live_master_contact_map_table'],
        queryFn: () => getLiveMasterContactMap(),
        staleTime: 5 * 60 * 1000
    });
    // DYNAMIC Categorization Engine reading directly from Supabase workflow_statuses
    const getRequestCategory = (r: RawRequestRecord): 'to_do' | 'in_progress' | 'review' | 'done' => {
        const tienDoVal = (r.tien_do || '').trim().toLowerCase();
        const statusVal = (r.status || '').trim().toLowerCase();

        // 1. Prioritize matching r.tien_do (Tiến độ configured in workflow_statuses modal)
        if (tienDoVal) {
            const matchedTienDo = statuses.find(s => s.name.trim().toLowerCase() === tienDoVal);
            if (matchedTienDo) {
                return matchedTienDo.category;
            }
        }

        // 2. Secondary check matching r.status
        if (statusVal) {
            const matchedStatus = statuses.find(s => s.name.trim().toLowerCase() === statusVal);
            if (matchedStatus) {
                return matchedStatus.category;
            }
        }

        // 3. Fallbacks
        if (tienDoVal.includes('hoàn thành') || tienDoVal.includes('cancel') || tienDoVal.includes('done') || statusVal.includes('cancel') || statusVal.includes('reject')) {
            return 'done';
        }
        if (tienDoVal.includes('vis') || tienDoVal.includes('supplier') || tienDoVal.includes('quick fix') || statusVal.includes('bảo hành') || statusVal.includes('approve')) {
            return 'in_progress';
        }
        if (statusVal.includes('review') || statusVal.includes('sent') || r.phuong_an?.includes('RQ')) {
            return 'review';
        }

        return 'to_do';
    };

    // Memoized base unique list for Status (computed ONCE per requests update)
    const baseDynamicStatusOptions = useMemo(() => {
        const set = new Set<string>();
        STATUS_COLUMN_PRESETS.forEach(s => set.add(s));
        requests.forEach(r => {
            if (r.status?.trim()) set.add(r.status.trim());
        });
        return Array.from(set);
    }, [requests]);

    const getDynamicStatusOptions = (currentVal?: string) => {
        if (!currentVal?.trim() || baseDynamicStatusOptions.includes(currentVal.trim())) {
            return baseDynamicStatusOptions;
        }
        return [...baseDynamicStatusOptions, currentVal.trim()];
    };

    // Memoized base unique list for Tiến độ (computed ONCE per requests/statuses update)
    const baseDynamicProgressList = useMemo(() => {
        const set = new Set<string>();
        SHEET_TIEN_DO_OPTIONS.forEach(s => set.add(s));
        statuses.forEach(s => set.add(s.name));

        requests.forEach(r => {
            if (r.tien_do?.trim()) set.add(r.tien_do.trim());
        });
        return Array.from(set);
    }, [requests, statuses]);

    const getDynamicProgressList = (currentVal?: string) => {
        if (!currentVal?.trim() || baseDynamicProgressList.includes(currentVal.trim())) {
            return baseDynamicProgressList;
        }
        return [...baseDynamicProgressList, currentVal.trim()];
    };

    // Single-pass memoized category counts calculation
    const categoryCounts = useMemo(() => {
        let toDo = 0, inProgress = 0, review = 0, done = 0;
        requests.forEach(r => {
            const cat = getRequestCategory(r);
            if (cat === 'to_do') toDo++;
            else if (cat === 'in_progress') inProgress++;
            else if (cat === 'review') review++;
            else if (cat === 'done') done++;
        });
        return { toDo, inProgress, review, done };
    }, [requests]);

    const toDoCount = categoryCounts.toDo;
    const inProgressCount = categoryCounts.inProgress;
    const reviewCount = categoryCounts.review;
    const doneCount = categoryCounts.done;

    // Helper to extract 4-digit year strictly from request date strings (date_of_rq, ngay_quick_fix, deadline)
    const getYearFromStr = (str?: string): string | null => {
        if (!str) return null;
        const s = str.trim();
        if (!s) return null;
        const match = s.match(/\b(202[0-9]|201[0-9])\b/);
        return match ? match[1] : null;
    };

    // Unique list of Mer / VIS-Tech values
    const uniqueMerList = useMemo(() => {
        const set = new Set<string>();
        requests.forEach(r => {
            if (r.mer?.trim()) set.add(r.mer.trim());
        });
        return Array.from(set).sort();
    }, [requests]);

    // Unique list of Supplier values
    const uniqueSupplierList = useMemo(() => {
        const set = new Set<string>();
        requests.forEach(r => {
            if (r.supplier?.trim()) set.add(r.supplier.trim());
        });
        return Array.from(set).sort();
    }, [requests]);

    // Unique list of Years extracted from date_of_rq / deadline
    const uniqueYearList = useMemo(() => {
        const set = new Set<string>();
        requests.forEach(r => {
            const y1 = getYearFromStr(r.date_of_rq);
            const y2 = getYearFromStr(r.ngay_quick_fix || r.deadline);
            if (y1) set.add(y1);
            if (y2) set.add(y2);
        });
        if (set.size === 0) set.add('2026');
        return Array.from(set).sort().reverse();
    }, [requests]);

    // Memoized filtered requests (re-computes ONLY when filter state actually changes)
    const filteredRequests = useMemo(() => {
        const cleanSearch = searchTerm.trim().toLowerCase().replace(/\s+/g, '');
        const rawLower = searchTerm.trim().toLowerCase();

        return requests.filter(r => {
            const reqId = (r.request_id || '').toLowerCase();
            const rowIdx = (r.sheet_row_index ? `row ${r.sheet_row_index}` : '').toLowerCase();
            const supplierLower = (r.supplier || '').toLowerCase();
            const supplierClean = supplierLower.replace(/\s+/g, '');

            const matchesSearch = !searchTerm.trim() || 
                (r.store_name || '').toLowerCase().includes(rawLower) ||
                (r.ess_store_code || '').toLowerCase().includes(rawLower) ||
                (r.sr || '').toLowerCase().includes(rawLower) ||
                (r.posm || '').toLowerCase().includes(rawLower) ||
                (r.brand || '').toLowerCase().includes(rawLower) ||
                (r.mer || '').toLowerCase().includes(rawLower) ||
                supplierLower.includes(rawLower) ||
                supplierClean.includes(cleanSearch) ||
                reqId.includes(rawLower) ||
                rowIdx.includes(rawLower);
            
            const matchesPhuongAn = filterPhuongAn === 'ALL' || (
                filterPhuongAn === 'UNASSIGNED' 
                    ? !r.phuong_an?.trim() 
                    : (r.phuong_an || '').toLowerCase().trim() === filterPhuongAn.toLowerCase().trim()
            );
            const matchesStatus = filterStatus === 'ALL' || (r.status || '').toLowerCase().trim() === filterStatus.toLowerCase().trim();
            const matchesTienDo = filterTienDo === 'ALL' || (r.tien_do || '').toLowerCase().trim() === filterTienDo.toLowerCase().trim();
            const matchesMer = filterMer === 'ALL' || (r.mer || '').toLowerCase().trim() === filterMer.toLowerCase().trim();
            const matchesSupplier = filterSupplier === 'ALL' || (
                filterSupplier === 'NO_SUPPLIER' || filterSupplier === 'UNASSIGNED'
                    ? !r.supplier?.trim() 
                    : (r.supplier || '').toLowerCase().trim() === filterSupplier.toLowerCase().trim()
            );
            
            // Year filter matching strictly date_of_rq or deadline (ignoring created_at insertion metadata)
            const matchesYear = filterYear === 'ALL' || (() => {
                const reqYear = getYearFromStr(r.date_of_rq) || getYearFromStr(r.ngay_quick_fix) || getYearFromStr(r.deadline);
                return reqYear === filterYear;
            })();
            const matchesStatusTab = activeStatusCategory === 'ALL' || getRequestCategory(r) === activeStatusCategory;

            const matchesQuickFilter = (() => {
                if (activeQuickFilter === 'ALL') return true;
                const statusLower = (r.status || '').toLowerCase();
                const tienDoLower = (r.tien_do || '').toLowerCase();
                const titleLower = (r.title_email_request || '').toLowerCase();
                const isDone = statusLower.includes('done') || tienDoLower.includes('hoàn thành');
                const dl = (r.deadline || '').trim();

                if (activeQuickFilter === 'NEW_PHASE') {
                    return !isDone && (
                        tienDoLower.includes('lắp đặt') || 
                        tienDoLower.includes('gửi lịch') || 
                        tienDoLower.includes('ntxx') || 
                        titleLower.includes('lắp đặt') || 
                        titleLower.includes('nghiệm thu')
                    );
                }

                if (activeQuickFilter === 'NO_SUPPLIER') {
                    return !r.supplier?.trim() && !isDone;
                }

                if (dl && !isDone) {
                    let dDate: Date | null = null;
                    if (dl.includes('/')) {
                        const parts = dl.split('/');
                        if (parts.length === 3) dDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    } else if (dl.includes('-')) {
                        dDate = new Date(dl);
                    }

                    if (dDate && !isNaN(dDate.getTime())) {
                        const todayDate = new Date();
                        const dOnly = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
                        const tOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

                        if (activeQuickFilter === 'OVERDUE') return dOnly < tOnly;
                        if (activeQuickFilter === 'DUE_TODAY') return dOnly.getTime() === tOnly.getTime();
                    }
                }
                return false;
            })();

            return matchesSearch && matchesPhuongAn && matchesStatus && matchesTienDo && matchesMer && matchesSupplier && matchesYear && matchesStatusTab && matchesQuickFilter;
        });
    }, [requests, searchTerm, filterPhuongAn, filterStatus, filterTienDo, filterMer, filterSupplier, filterYear, activeStatusCategory, activeQuickFilter]);

    // Calculate total pages & paginated items slice
    const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRequests.slice(start, start + pageSize);
    }, [filteredRequests, currentPage, pageSize]);

    const getSlaOverdueBadge = (_deadlineStr?: string, _statusStr?: string, _tienDoStr?: string) => {
        // Tạm thời tắt logic báo trễ hạn bao nhiêu ngày theo yêu cầu của user
        return null;
    };

    const isAllFilteredSelected = filteredRequests.length > 0 && filteredRequests.every(r => selectedRowIds.includes(r.id!));

    const handleToggleSelectAll = () => {
        if (isAllFilteredSelected) {
            setSelectedRowIds([]);
        } else {
            setSelectedRowIds(filteredRequests.map(r => r.id!).filter(Boolean));
        }
    };

    const handleToggleSelectRow = useCallback((id: string) => {
        setSelectedRowIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, []);

    const handleFilterAndNavigate = useCallback((params: {
        category?: 'ALL' | 'to_do' | 'in_progress' | 'review' | 'done';
        quickFilter?: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'NO_SUPPLIER' | 'NEW_PHASE';
        tienDo?: string;
        phuongAn?: string;
        mer?: string;
        supplier?: string;
        searchTerm?: string;
    }) => {
        if (params.category !== undefined) setActiveStatusCategory(params.category);

        if (params.quickFilter !== undefined) {
            setActiveQuickFilter(params.quickFilter);
            if (params.quickFilter === 'NO_SUPPLIER') {
                setFilterSupplier('NO_SUPPLIER');
            }
        } else {
            if (params.supplier || params.phuongAn || params.tienDo || params.mer) {
                setActiveQuickFilter('ALL');
                if (params.searchTerm === undefined) setSearchTerm('');
            }
        }

        if (params.tienDo !== undefined) setFilterTienDo(params.tienDo);
        if (params.phuongAn !== undefined) setFilterPhuongAn(params.phuongAn);
        if (params.mer !== undefined) setFilterMer(params.mer);
        if (params.supplier !== undefined) setFilterSupplier(params.supplier);
        if (params.searchTerm !== undefined) setSearchTerm(params.searchTerm);

        setActiveModuleTab('DATA_LIST');
    }, []);

    return (
        <div className="space-y-3">
            {/* MODULE INTERNAL NAVIGATION SUB-TABS */}
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
                        {filteredRequests.length}
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

            {/* TAB 1: DEDICATED ANALYST / REPORTS WORKSPACE */}
            {activeModuleTab === 'ANALYST' && (
                <RequestAnalyticsView
                    requests={filteredRequests}
                    activeQuickFilter={activeQuickFilter}
                    onSelectQuickFilter={setActiveQuickFilter}
                    getRequestCategory={getRequestCategory}
                    onFilterAndNavigate={handleFilterAndNavigate}
                />
            )}

            {/* TAB 2: CLEAN OPERATIONAL DATA LIST WORKSPACE */}
            {activeModuleTab === 'DATA_LIST' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                
                {/* 🎯 4 Big Status Category Tabs Bar */}
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 px-4 pt-3 pb-0 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <button
                        onClick={() => setActiveStatusCategory('ALL')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs border-t-2 transition-colors duration-150 ${
                            activeStatusCategory === 'ALL'
                                ? 'bg-white dark:bg-slate-900 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>Tất Cả Request</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {requests.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveStatusCategory('to_do')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs border-t-2 transition-colors duration-150 ${
                            activeStatusCategory === 'to_do'
                                ? 'bg-white dark:bg-slate-900 border-slate-500 text-slate-800 dark:text-white'
                                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <span>1. TO DO (Giao việc mới)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            {toDoCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveStatusCategory('in_progress')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs border-t-2 transition-colors duration-150 ${
                            activeStatusCategory === 'in_progress'
                                ? 'bg-white dark:bg-slate-900 border-sky-600 text-sky-600 dark:text-sky-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                        <span>2. IN PROGRESS (Đang làm)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-bold">
                            {inProgressCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveStatusCategory('review')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs border-t-2 transition-colors duration-150 ${
                            activeStatusCategory === 'review'
                                ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span>3. REVIEW (Chờ duyệt)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold">
                            {reviewCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveStatusCategory('done')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs border-t-2 transition-colors duration-150 ${
                            activeStatusCategory === 'done'
                                ? 'bg-white dark:bg-slate-900 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>4. CLOSE / DONE (Đã xong)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                            {doneCount}
                        </span>
                    </button>
                </div>

                {/* Filter & Search Bar + Clean Professional Dropdown Filters */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo Siêu thị, Mã Store, Request ID, Dòng Sheet, SR, POSM..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Column Visibility Toggle */}
                        <button
                            onClick={() => setIsColumnVisibilityOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer transition-colors"
                            title="Tùy chỉnh ẩn/hiện cột"
                        >
                            <Eye className="w-3.5 h-3.5 text-sky-600" />
                            <span>Cột Hiển Thị ({visibleColumns.length})</span>
                        </button>

                        {/* Wrap Text Toggle */}
                        <button
                            onClick={() => setIsWrapText(!isWrapText)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isWrapText
                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            }`}
                            title="Bật/Tắt chế độ xuống dòng đầy đủ nội dung"
                        >
                            <WrapText className="w-3.5 h-3.5" />
                            <span>{isWrapText ? 'Thu gọn dòng' : 'Xem đầy đủ chữ'}</span>
                        </button>

                    {/* Filter Phương Án */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Phương án:</span>
                        <select
                            value={filterPhuongAn}
                            onChange={e => setFilterPhuongAn(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                        >
                            <option value="ALL">Tất cả phương án</option>
                            <option value="UNASSIGNED">⚪ Chưa phân loại phương án</option>
                            {Array.from(new Set([
                                ...PHUONG_AN_OPTIONS,
                                ...requests.map(r => {
                                    const pa = (r.phuong_an || '').trim();
                                    if (pa.toLowerCase().includes('bảo hành')) return 'Supplier Bảo Hành';
                                    if (pa.toLowerCase().includes('visibility')) return 'Visibility Request';
                                    return pa;
                                }).filter(Boolean)
                            ])).sort().map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Trạng thái */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Trạng thái:</span>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {getDynamicStatusOptions().map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Mer / VIS-Tech */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mer/VIS-Tech:</span>
                        <select
                            value={filterMer}
                            onChange={e => setFilterMer(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer max-w-[160px] truncate"
                        >
                            <option value="ALL">Tất cả Mer / VIS-Tech</option>
                            {uniqueMerList.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Nhà thầu / Supplier */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nhà thầu:</span>
                        <select
                            value={filterSupplier}
                            onChange={e => setFilterSupplier(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer max-w-[160px] truncate"
                        >
                            <option value="ALL">Tất cả nhà thầu</option>
                            <option value="NO_SUPPLIER">⚠️ Chưa gán nhà thầu</option>
                            {uniqueSupplierList.filter(x => x !== 'NO_SUPPLIER').map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Tiến độ */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tiến độ:</span>
                        <select
                            value={filterTienDo}
                            onChange={e => setFilterTienDo(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                        >
                            <option value="ALL">Tất cả tiến độ</option>
                            {getDynamicProgressList().map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Năm */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Năm:</span>
                        <select
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer"
                        >
                            <option value="ALL">Tất cả các năm</option>
                            {uniqueYearList.map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Reset Filters Button */}
                    {(filterPhuongAn !== 'ALL' || filterStatus !== 'ALL' || filterTienDo !== 'ALL' || filterMer !== 'ALL' || filterSupplier !== 'ALL' || filterYear !== 'ALL' || searchTerm.trim() !== '') && (
                        <button
                            onClick={() => {
                                setFilterPhuongAn('ALL');
                                setFilterStatus('ALL');
                                setFilterTienDo('ALL');
                                setFilterMer('ALL');
                                setFilterSupplier('ALL');
                                setFilterYear('ALL');
                                setSearchTerm('');
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                            title="Xóa tất cả các bộ lọc đang chọn"
                        >
                            ✕ Xóa lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Table with Clean Minimalist Unilever Blue Style */}
            <div className="w-full max-h-[calc(100vh-220px)] overflow-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-800">
                <table className={`w-full text-left text-xs ${isWrapText ? 'align-top' : 'whitespace-nowrap'}`}>
                    <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider sticky top-0 z-20 shadow-2xs">
                        <tr>
                            <th className="p-3 w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={isAllFilteredSelected}
                                    onChange={handleToggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                    title="Chọn / Bỏ chọn tất cả dòng đang hiển thị"
                                />
                            </th>
                            <th className="p-3 w-14">Dòng Sheet</th>
                            {visibleColumns.includes('request_id') && <th className="p-3 min-w-[120px]">Request ID</th>}
                            {visibleColumns.includes('store_info') && <th className="p-3 min-w-[180px]">Thông Tin Siêu Thị</th>}
                            {visibleColumns.includes('posm_info') && <th className="p-3 min-w-[150px]">POSM</th>}
                            {visibleColumns.includes('date_of_rq') && <th className="p-3 min-w-[130px]">Ngày Gửi Request</th>}
                            {visibleColumns.includes('sr_info') && <th className="p-3 min-w-[140px]">SR Yêu Cầu</th>}
                            {visibleColumns.includes('phuong_an') && <th className="p-3 min-w-[150px]">Phương Án</th>}
                            {visibleColumns.includes('status') && <th className="p-3 min-w-[150px]">Trạng Thái</th>}
                            {visibleColumns.includes('tien_do') && <th className="p-3 min-w-[160px]">Tiến Độ</th>}
                            {visibleColumns.includes('category') && <th className="p-3 min-w-[130px]">Trạng Thái Nhóm</th>}
                            {visibleColumns.includes('data_responser') && <th className="p-3 min-w-[180px]">Data Responser</th>}
                            {visibleColumns.includes('supplier') && <th className="p-3 min-w-[130px]">Supplier</th>}
                            {visibleColumns.includes('deadline') && <th className="p-3 min-w-[150px]">Ngày Cần Hoàn Thành</th>}
                            {visibleColumns.includes('notes') && <th className="p-3 min-w-[130px]">Ghi Chú</th>}
                            <th className="p-3 w-24">Hình Ảnh</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {filteredRequests.length === 0 ? (
                            <tr>
                                <td colSpan={16} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                                            🔍
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Không tìm thấy Request nào phù hợp với các bộ lọc đang chọn</h4>
                                        
                                        {/* Active Filters Diagnostic Badges */}
                                        <div className="flex flex-wrap items-center justify-center gap-1.5 py-1">
                                            {activeQuickFilter !== 'ALL' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                    Quick Filter: {activeQuickFilter}
                                                </span>
                                            )}
                                            {filterSupplier !== 'ALL' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                    Nhà thầu: {filterSupplier === 'NO_SUPPLIER' ? 'Chưa gán nhà thầu' : filterSupplier}
                                                </span>
                                            )}
                                            {filterPhuongAn !== 'ALL' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                                    Phương án: {filterPhuongAn === 'UNASSIGNED' ? 'Chưa phân loại' : filterPhuongAn}
                                                </span>
                                            )}
                                            {filterMer !== 'ALL' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                    Mer: {filterMer}
                                                </span>
                                            )}
                                            {filterTienDo !== 'ALL' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                    Tiến độ: {filterTienDo}
                                                </span>
                                            )}
                                            {searchTerm.trim() !== '' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    Từ khóa: "{searchTerm}"
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setFilterPhuongAn('ALL');
                                                setFilterStatus('ALL');
                                                setFilterTienDo('ALL');
                                                setFilterMer('ALL');
                                                setFilterSupplier('ALL');
                                                setFilterYear('ALL');
                                                setActiveStatusCategory('ALL');
                                                setActiveQuickFilter('ALL');
                                            }}
                                            className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                                        >
                                            <span>🔄 Xóa Tất Cả Bộ Lọc Để Xem Lại Toàn Bộ {requests.length} Requests</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRequests.map((r, idx) => {
                                const dynamicStatusList = getDynamicStatusOptions(r.status);
                                const dynamicProgressList = getDynamicProgressList(r.tien_do);
                                const category = getRequestCategory(r);
                                const isRowSelected = selectedRowIds.includes(r.id!);
                                const slaBadge = getSlaOverdueBadge(r.ngay_quick_fix || r.deadline, r.status, r.tien_do);
                                const globalIdx = (currentPage - 1) * pageSize + idx;

                                return (
                                    <RequestTableRow
                                        key={r.id || r.request_key || `row-${globalIdx}`}
                                        r={r}
                                        idx={globalIdx}
                                        visibleColumns={visibleColumns}
                                        isRowSelected={isRowSelected}
                                        isAdmin={isAdmin}
                                        copiedId={copiedId}
                                        isWrapText={isWrapText}
                                        contactMap={contactMap}
                                        dynamicStatusList={dynamicStatusList}
                                        dynamicProgressList={dynamicProgressList}
                                        category={category}
                                        slaBadge={slaBadge}
                                        handleToggleSelectRow={handleToggleSelectRow}
                                        handleGuardedUpdate={handleGuardedUpdate}
                                        onUpdateRequest={onUpdateRequest}
                                        handleCopy={handleCopy}
                                        setWarrantySubtaskRecord={setWarrantySubtaskRecord}
                                        setSubtaskModalRecord={setSubtaskModalRecord}
                                        setSelectedDetailRequest={setSelectedDetailRequest}
                                        setSelectedNotesRecord={setSelectedNotesRecord}
                                        handleOpenLightbox={handleOpenLightbox}
                                    />
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 📄 Client-side Pagination Controls Bar */}
            {filteredRequests.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        <span>Hiển thị</span>
                        <select 
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                            {[10, 25, 50, 100].map(size => (
                                <option key={size} value={size}>{size} dòng / trang</option>
                            ))}
                        </select>
                        <span>trên tổng số <strong className="text-slate-900 dark:text-white font-mono">{filteredRequests.length}</strong> Request</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs font-semibold"
                        >
                            Đầu
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs font-semibold"
                        >
                            Trước
                        </button>
                        <span className="px-3 py-1.5 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/80 rounded border border-sky-200 dark:border-sky-800">
                            Trang {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs font-semibold"
                        >
                            Sau
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-white cursor-pointer text-xs font-semibold"
                        >
                            Cuối
                        </button>
                    </div>
                </div>
                )}
            </div>
            )}

            {/* 🛠️ FLOATING BULK ACTION BAR */}
            <BulkActionBar
                selectedCount={selectedRowIds.length}
                onClearSelection={() => setSelectedRowIds([])}
                onBulkUpdate={handleBulkUpdate}
                statusOptions={getDynamicStatusOptions()}
                progressOptions={getDynamicProgressList()}
                isAdmin={isAdmin}
            />

            {/* 👁️ COLUMN VISIBILITY MODAL */}
            <ColumnVisibilityModal
                isOpen={isColumnVisibilityOpen}
                onClose={() => setIsColumnVisibilityOpen(false)}
                visibleColumns={visibleColumns}
                onChangeVisibleColumns={handleSaveVisibleColumns}
            />

            {/* 🖼️ IMAGE LIGHTBOX MODAL */}
            <ImageLightboxModal
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                images={lightboxImages}
                initialIndex={lightboxInitialIndex}
            />

            {/* 🔍 MODAL CHI TIẾT DATA RESPONSER */}
            {selectedDetailRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-amber-500" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                    Chi Tiết Người Phản Hồi (Data Responser)
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedDetailRequest(null)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                            
                            {/* Executive Approvers Cards */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                                    <MessageSquare className="w-4 h-4 text-amber-500" />
                                    <span>Danh Sách Người Duyệt / Phản Hồi Từ SharePoint:</span>
                                </h4>

                                {parseResponserItems(selectedDetailRequest.data_responser).map((item, i) => {
                                    const isApprove = item.response?.toLowerCase().includes('approve');
                                    const isReject = item.response?.toLowerCase().includes('reject');

                                    return (
                                        <div 
                                            key={i} 
                                            className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 space-y-3"
                                        >
                                            {/* Header Row: Response Status Badge & Date */}
                                            <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                        isApprove 
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                            : isReject 
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                    }`}>
                                                        {item.response || 'Đã Phản Hồi'}
                                                    </span>
                                                    {item.timeResponse && (
                                                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {item.timeResponse}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Grid Details */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                {/* Email */}
                                                <div className="flex items-start gap-2">
                                                    <Mail className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Email Người Duyệt:</span>
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">
                                                            {item.email || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Title (Chức vụ) */}
                                                <div className="flex items-start gap-2">
                                                    <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Chức Vụ / Phòng Ban (Title):</span>
                                                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                                            {item.title || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Comment */}
                                            <div className="pt-2 border-t border-amber-200/40 dark:border-amber-800/30">
                                                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-0.5">Ý Kiến / Phản Hồi (Comment):</span>
                                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 select-all">
                                                    {item.comment || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* JSON Raw Source Code toggle */}
                                <details className="pt-2">
                                    <summary className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer font-mono">
                                        ▶ Xem chuỗi JSON gốc từ SharePoint
                                    </summary>
                                    <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] break-all mt-2 select-all overflow-x-auto">
                                        {selectedDetailRequest.data_responser}
                                    </div>
                                </details>
                            </div>

                            {/* Request Info Summary */}
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Siêu Thị:</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedDetailRequest.store_name} ({selectedDetailRequest.ess_store_code})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Request ID (VIS-ID):</span>
                                    <span className="font-bold font-mono text-purple-600 dark:text-purple-400 text-xs">{selectedDetailRequest.request_id || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Dòng Sheet:</span>
                                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200 text-xs">#{selectedDetailRequest.sheet_row_index}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">SR Yêu Cầu:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">{selectedDetailRequest.sr} ({selectedDetailRequest.date_of_rq})</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Hạng Mục POSM:</span>
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400 text-xs">{selectedDetailRequest.posm} - Brand: {selectedDetailRequest.brand}</span>
                                </div>
                                {selectedDetailRequest.sr_note && (
                                    <div className="col-span-2">
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Ghi chú SR:</span>
                                        <span className="text-slate-700 dark:text-slate-300 text-xs italic">{selectedDetailRequest.sr_note}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
                            <button
                                onClick={() => setSelectedDetailRequest(null)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Viewer Modal (Hiển thị đầy đủ 3 Cột Note & Nút Lưu Ghi Chú Auto-Push) */}
            {selectedNotesRecord && (
                <MerNotesModal
                    record={selectedNotesRecord}
                    onClose={() => setSelectedNotesRecord(null)}
                    onUpdateRequest={onUpdateRequest}
                />
            )}


            {/* Subtask Request ID Modal */}
            <SubtaskModal
                isOpen={!!subtaskModalRecord}
                onClose={() => setSubtaskModalRecord(null)}
                record={subtaskModalRecord}
                onSave={(id, updates) => onUpdateRequest(id, updates)}
            />

            {/* Subtask Bảo Hành / Đổi Trả Modal */}
            <WarrantySubtaskModal
                isOpen={!!warrantySubtaskRecord}
                onClose={() => setWarrantySubtaskRecord(null)}
                record={warrantySubtaskRecord}
                onSave={(id, updates) => onUpdateRequest(id, updates)}
            />
        </div>
    );
}

interface MerNotesModalProps {
    record: RawRequestRecord;
    onClose: () => void;
    onUpdateRequest: (id: string, updates: Partial<RawRequestRecord>) => Promise<any>;
}

function MerNotesModal({ record, onClose, onUpdateRequest }: MerNotesModalProps) {
    const [noteText, setNoteText] = useState(record.mer_note || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!record.id) return;
        setIsSaving(true);
        try {
            await onUpdateRequest(record.id, { mer_note: noteText.trim() });
            toast.success('💾 Đã lưu Mer Note và tự động đẩy lên Google Sheet thành công!');
            onClose();
        } catch (err: any) {
            toast.error('Lỗi khi lưu ghi chú: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                Chi Tiết Ghi Chú
                            </h3>
                            <p className="text-[11px] text-slate-500 font-mono">
                                Store: {record.store_name} ({record.ess_store_code})
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
                    {/* 1. SR Note */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] flex items-center gap-1.5">
                            📌 SR Note:
                        </span>
                        <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {record.sr_note ? (
                                record.sr_note
                            ) : (
                                <span className="text-slate-400 italic font-normal">Chưa có ghi chú lỗi chi tiết từ SR</span>
                            )}
                        </div>
                    </div>

                    {/* 2. Vis Note */}
                    <div className="p-3 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                        <span className="font-bold text-sky-900 dark:text-sky-200 block text-[11px] flex items-center gap-1.5">
                            🏢 Vis Note:
                        </span>
                        <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {record.vis_note ? (
                                record.vis_note
                            ) : (
                                <span className="text-slate-400 italic font-normal">Chưa có phản hồi từ Team Vis văn phòng</span>
                            )}
                        </div>
                    </div>

                    {/* 3. Mer Note */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] flex items-center gap-1.5">
                                🛠️ Mer Note (Ghi chú xử lý):
                            </span>
                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                                ✍️ Auto-Push Google Sheet
                            </span>
                        </div>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Nhập ghi chú xử lý của Mer tại đây..."
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500 outline-none resize-y min-h-[90px]"
                        />
                        <p className="text-[10px] text-slate-500 italic">
                            💡 Ghi chú sẽ được tự động lưu trên Dashboard & Auto-push về Google Sheet Source khi bấm <b>Lưu Ghi Chú</b>!
                        </p>
                    </div>
                </div>

                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs cursor-pointer"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{isSaving ? 'Đang lưu...' : '💾 Lưu Ghi Chú & Push Sheet'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

