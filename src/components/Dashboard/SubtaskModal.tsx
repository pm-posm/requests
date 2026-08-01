import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { SHEET_TIEN_DO_OPTIONS } from '@/services/sheetSyncService';
import { X, Check, ExternalLink, Calendar, Layers, Tag, ShieldCheck, Link2, Search, FileText, PlusCircle, CheckCircle2, Info, Loader2, History, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDashboardStore } from '@/stores/useDashboardStore';

interface SubtaskModalProps {
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

// Helper to safely format and resolve Drive URLs (handles raw folder text like "W24/2026 - CAT F.Sol" by opening Drive Search)
export function resolveDriveUrl(rawLink: string | null | undefined): string {
    if (!rawLink || !rawLink.trim()) return '#';
    const trimmed = rawLink.trim();
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (/^(drive|docs)\.google\.com/i.test(trimmed) || (trimmed.includes('.com/') && !trimmed.includes(' '))) {
        return `https://${trimmed}`;
    }
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(trimmed)}`;
}

export function SubtaskModal({ isOpen, onClose, record, onSave }: SubtaskModalProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAdmin } = useDashboardStore();

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const [requestId, setRequestId] = useState('');
    const [maDuAn, setMaDuAn] = useState('');
    const [titleEmail, setTitleEmail] = useState('');
    const [linkRq, setLinkRq] = useState('');
    const [phuongAn, setPhuongAn] = useState('');
    const [status, setStatus] = useState('');
    const [tienDo, setTienDo] = useState('');
    const [dateOfRq, setDateOfRq] = useState('');
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // State for Autocomplete Search
    const [searchPrjText, setSearchPrjText] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Query master project overviews to populate autocomplete suggestions
    const { data: projectOverviews = [] } = useQuery({
        queryKey: ['project_overviews_rpc_subtask'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_project_overviews');
            if (error) return [];
            return data || [];
        }
    });

    // REQ 2: Query Master Project Store Item Timeline mapped directly for maDuAn
    const { data: projectStoreItemTimeline } = useQuery({
        queryKey: ['project_store_item_timeline', maDuAn],
        queryFn: async () => {
            if (!maDuAn) return null;
            const { data } = await supabase
                .from('project_store_items')
                .select('id, current_phase, expected_start, expected_end, final_project')
                .eq('final_project', maDuAn)
                .limit(1);
            return data && data.length > 0 ? data[0] : null;
        },
        enabled: !!maDuAn
    });

    // Query Audit Logs for this Subtask
    const { data: auditLogs = [], refetch: refetchAuditLogs } = useQuery<AuditLogEntry[]>({
        queryKey: ['subtask_audit_logs', record?.id || record?.request_id],
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
            setRequestId(record.request_id || '');
            const initialPrj = record.ma_du_an || '';
            setMaDuAn(initialPrj);
            setSearchPrjText(initialPrj);
            setTitleEmail(record.title_email_request || '');
            setLinkRq(record.link_rq || '');
            
            // Standardize phuong_an
            let pa = record.phuong_an || 'Visibility Request';
            if (pa.toLowerCase().includes('bảo hành')) pa = 'Supplier Bảo Hành';
            setPhuongAn(pa);

            setStatus(record.status || 'To Do');
            setTienDo(record.tien_do || 'Mới tiếp nhận');
            setDateOfRq(record.date_of_rq || '');
        }
    }, [record]);

    // Close suggestions dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter project suggestions ONLY when user types 1 or more characters!
    const projectSuggestions = useMemo(() => {
        if (!searchPrjText.trim()) return [];
        const term = searchPrjText.toLowerCase().trim();
        return projectOverviews.filter((p: any) => 
            (p.final_project || '').toLowerCase().includes(term)
        ).slice(0, 10);
    }, [projectOverviews, searchPrjText]);

    // Check if current maDuAn matches a Master Project in "Tổng hợp dự án"
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

    // Helper to create a new Master Project in Tổng hợp dự án if it doesn't exist yet
    const handleCreateMasterProject = async () => {
        if (!maDuAn.trim()) {
            toast.error('Vui lòng nhập Tên/Mã Dự Án trước khi tạo!');
            return;
        }

        setIsCreatingProject(true);
        try {
            const newProjectName = maDuAn.trim();
            const { error } = await supabase.from('project_activities').insert({
                final_project: newProjectName,
                name_project: titleEmail.trim() || newProjectName,
                key_project: newProjectName,
                phase_type: 'BRIEF',
                title_mail: `Khởi tạo dự án ${newProjectName} từ Request ID ${requestId || record.id}`
            });

            if (error) throw error;

            // Record Audit Log
            await supabase.from('subtask_audit_logs').insert({
                subtask_id: requestId || record.id || '',
                action_text: `Đã khởi tạo Dự Án Master mới "${newProjectName}" vào Tổng Hợp Dự Án`
            });

            toast.success(`Đã tạo thành công Dự án "${newProjectName}" vào Tổng Hợp Dự Án!`);
            setMaDuAn(newProjectName);
            setSearchPrjText(newProjectName);
            setShowSuggestions(false);
            await queryClient.invalidateQueries({ queryKey: ['project_overviews_rpc_subtask'] });
            await queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
            await queryClient.invalidateQueries({ queryKey: ['project_overviews_rpc'] });
            refetchAuditLogs();
        } catch (err: any) {
            console.error(err);
            toast.error(`Lỗi khi tạo dự án: ${err.message}`);
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleSave = async () => {
        if (!isAdmin) {
            toast.error('🔒 Quyền bị từ chối: Vui lòng đăng nhập tài khoản Admin để lưu thay đổi!');
            return;
        }
        setIsSaving(true);
        try {
            // Track changes for Audit Log
            const changesList: string[] = [];
            if (record.status !== status) changesList.push(`Đổi trạng thái: ${record.status || 'To Do'} ➔ ${status}`);
            if (record.phuong_an !== phuongAn) changesList.push(`Đổi phương án: ${record.phuong_an || '-'} ➔ ${phuongAn}`);
            if (record.ma_du_an !== maDuAn) changesList.push(`Đổi Mã dự án: ${record.ma_du_an || '-'} ➔ ${maDuAn}`);
            if (record.link_rq !== linkRq) changesList.push(`Cập nhật Link Drive Request`);

            await onSave(record.id!, {
                request_id: requestId.trim() || undefined,
                ma_du_an: maDuAn.trim() || undefined,
                title_email_request: titleEmail.trim() || undefined,
                link_rq: linkRq.trim() || undefined,
                phuong_an: phuongAn,
                status: status,
                tien_do: tienDo,
                date_of_rq: dateOfRq
            });

            // Save Audit Log if there were changes
            if (changesList.length > 0) {
                const subtaskId = requestId || record.id || '';
                await supabase.from('subtask_audit_logs').insert({
                    subtask_id: subtaskId,
                    action_text: changesList.join('; ')
                });
            }

            toast.success('Đã lưu Subtask thành công!');
            onClose();
        } catch (err: any) {
            console.error('Error saving subtask:', err);
            toast.error('Lỗi khi lưu: ' + (err.message || 'Thao tác thất bại'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleNavigateToProject = () => {
        if (maDuAn) {
            onClose();
            navigate(`/project/${encodeURIComponent(maDuAn)}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">
                                Quản Lý Subtask Request ID
                            </h2>
                            <p className="text-xs text-slate-500">
                                Cửa hàng: {record.store_name} ({record.ess_store_code})
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Fields Body */}
                <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
                    
                    {/* 1. Request ID Subtask Code */}
                    <div className="space-y-1">
                        <label className="font-bold text-slate-700 dark:text-slate-300 block">
                            📋 Request ID (Mã Subtask):
                        </label>
                        <input
                            type="text"
                            value={requestId}
                            onChange={e => setRequestId(e.target.value)}
                            placeholder="Ví dụ: VIS-2026-001"
                            className="w-full font-mono font-bold text-purple-700 bg-purple-50/50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    {/* 2. Autocomplete Search Input for Khóa / Tên Dự Án & Title Email Request */}
                    <div className="space-y-2.5 p-3.5 bg-indigo-50/40 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 relative" ref={dropdownRef}>
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-indigo-900 dark:text-indigo-200 block flex items-center gap-1.5">
                                <Link2 className="w-4 h-4 text-indigo-600" />
                                Khóa / Tên Dự Án (Liên kết Tổng Hợp Dự Án):
                            </label>
                            {matchedMasterProject && (
                                <button
                                    onClick={handleNavigateToProject}
                                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Mở trang Dự án
                                </button>
                            )}
                        </div>

                        {/* Search Autocomplete Box */}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                            <input
                                type="text"
                                value={searchPrjText}
                                onFocus={() => setShowSuggestions(true)}
                                onChange={e => {
                                    setSearchPrjText(e.target.value);
                                    setMaDuAn(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                placeholder="Nhập mã (VD: 165422, VIS-124) hoặc dán Tên dự án..."
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500"
                            />

                            {/* Dropdown Suggestions List */}
                            {showSuggestions && searchPrjText.trim() !== '' && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                    {projectSuggestions.length === 0 ? (
                                        <div className="p-3 text-slate-400 text-center italic text-xs">
                                            Chưa tìm thấy dự án sẵn có. Mã này sẽ được lưu như một Subtask Độc Lập!
                                        </div>
                                    ) : (
                                        projectSuggestions.map((p: any) => (
                                            <div
                                                key={p.final_project}
                                                onClick={() => handleSelectSuggestion(p.final_project)}
                                                className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                                            >
                                                <div className="font-bold text-indigo-700 dark:text-indigo-300 truncate text-xs">
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

                        {/* REQ 2: Mốc Thời Gian Dự Án Master (Ánh Xạ Trực Tiếp) */}
                        <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/50 rounded-xl border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                Mốc Thời Gian Dự Án Master:
                            </span>
                            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                {projectStoreItemTimeline?.expected_start ? (
                                    `${projectStoreItemTimeline.expected_start} ➔ ${projectStoreItemTimeline.expected_end || 'Đang triển khai'}`
                                ) : (
                                    <span className="text-slate-400 italic font-normal text-[11px]">Chưa lên mốc thời gian kế hoạch</span>
                                )}
                            </span>
                        </div>

                        {/* Status Indicator for Project Linkage */}
                        <div className="pt-1">
                            {matchedMasterProject ? (
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Đã liên kết thành công với Dự án Master
                                    </span>
                                </div>
                            ) : maDuAn.trim() ? (
                                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-amber-900 dark:text-amber-300 font-medium text-[11px]">
                                    <span className="flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-amber-600" />
                                        Mã dự án chưa nằm trong "Tổng hợp dự án" (Subtask Độc Lập)
                                    </span>
                                    <button
                                        onClick={handleCreateMasterProject}
                                        disabled={isCreatingProject}
                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[10px] flex items-center gap-1 cursor-pointer"
                                    >
                                        <PlusCircle className="w-3 h-3" />
                                        {isCreatingProject ? 'Đang tạo...' : '+ Tạo vào Tổng Hợp Dự Án'}
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {/* Title Email Request (Cột AA trên Sheet Source) */}
                        <div className="space-y-1 pt-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                Title Email Request (Cột AA trên Sheet Source):
                            </label>
                            <input
                                type="text"
                                value={titleEmail}
                                onChange={e => setTitleEmail(e.target.value)}
                                placeholder="Nội dung Cột AA Title Email Request..."
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium outline-none"
                            />
                        </div>
                    </div>

                    {/* 3. Link RQ (Cột W Drive Link cho CSP/KA Review) */}
                    <div className="space-y-1.5 p-3.5 bg-blue-50/40 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900">
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-blue-900 dark:text-blue-200 block flex items-center gap-1.5">
                                🔗 Link RQ (Cột W - Link Drive gửi CSP/KA Review):
                            </label>
                            {linkRq && (
                                <a
                                    href={resolveDriveUrl(linkRq)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Mở liên kết Drive hoặc tìm kiếm thư mục Drive trên tab mới"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Mở Drive Request
                                </a>
                            )}
                        </div>
                        <input
                            type="text"
                            value={linkRq}
                            onChange={e => setLinkRq(e.target.value)}
                            placeholder="Dán đường link Drive làm request tại đây (VD: https://drive.google.com/...)..."
                            className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 text-xs font-mono text-blue-900 dark:text-blue-200 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* 4. Giai đoạn & Trạng thái */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 dark:text-slate-300 block">
                                Phương Án:
                            </label>
                            <select
                                value={phuongAn}
                                onChange={e => setPhuongAn(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                            >
                                <option value="Visibility Request">Visibility Request</option>
                                <option value="Supplier Bảo Hành">Supplier Bảo Hành</option>
                                <option value="Mer Quick Fix">Mer Quick Fix</option>
                                <option value="Đưa vào RQ by Store">Đưa vào RQ by Store</option>
                                <option value="Đã đưa vào RQ tuần">Đã đưa vào RQ tuần</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 dark:text-slate-300 block">
                                Trạng Thái (Status):
                            </label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                            >
                                <option value="To Do">To Do (Cần xử lý)</option>
                                <option value="In Progress">In Progress (Đang làm)</option>
                                <option value="Under Review">Under Review (Chờ duyệt)</option>
                                <option value="Approved">Approved (Đã duyệt)</option>
                                <option value="Completed">Completed (Hoàn thành)</option>
                                <option value="Cancelled">Cancelled (Đã hủy)</option>
                            </select>
                        </div>
                    </div>

                    {/* 5. Tiến độ & Thời gian */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 dark:text-slate-300 block">
                                Tiến Độ Dự Án (Cột Y trên Sheet Source):
                            </label>
                            <select
                                value={tienDo}
                                onChange={e => setTienDo(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                            >
                                {tienDo && !SHEET_TIEN_DO_OPTIONS.includes(tienDo as any) && (
                                    <option value={tienDo}>{tienDo}</option>
                                )}
                                {SHEET_TIEN_DO_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Thời Gian Yêu Cầu:
                            </label>
                            <input
                                type="text"
                                value={dateOfRq}
                                onChange={e => setDateOfRq(e.target.value)}
                                placeholder="VD: 14/02/2025"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none"
                            />
                        </div>
                    </div>

                    {/* HẠNG MỤC 4: AUDIT LOG (📜 NHẬT KÝ THAY ĐỔI / THAO TÁC SUBTASK) */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
                            <History className="w-4 h-4 text-purple-600" />
                            📜 Nhật Ký Thao Tác (Audit Log Trail):
                        </label>
                        {auditLogs.length === 0 ? (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-slate-400 text-[11px] italic text-center">
                                Chưa có lịch sử thay đổi nào cho Subtask này.
                            </div>
                        ) : (
                            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {auditLogs.map((log, lIdx) => (
                                    <div key={log.id || lIdx} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2 text-[11px]">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {log.action_text}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !isAdmin}
                        title={!isAdmin ? 'Vui lòng đăng nhập tài khoản Admin để lưu thay đổi' : ''}
                        className={`px-5 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all ${
                            !isAdmin 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700' 
                                : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : !isAdmin ? (
                            <>
                                🔒 Khóa (Cần Admin)
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Lưu Subtask Request ID
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
