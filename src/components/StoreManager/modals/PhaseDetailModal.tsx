import React from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { 
    X, Save, CheckCircle2, XCircle, Calendar, Link2, FileText, User, 
    Upload, Loader2, ExternalLink, Trash2, ArrowRight, AlertTriangle, 
    Clock, ShieldAlert, History, MapPin, Building2, Truck, Check, RefreshCw, AlertCircle, ChevronRight
} from 'lucide-react';
import type { StoreItem, StorePhase } from '@/types';
import { computePhaseStatus, calculateAutoSlaEnd } from '@/hooks/useStorePhases';
import { useStorePhases, useStorePhasesBulk, useUpsertStorePhase, useBulkUpsertStorePhases } from '@/hooks/useStorePhases';
import { supabase } from '@/lib/supabase';
import { useDashboardStore } from '@/stores/useDashboardStore';

const PHASES: StorePhase['phase'][] = ['Brief', 'Khảo sát', 'NTXX', 'Lắp đặt'];

const PHASE_COLORS: Record<string, string> = {
    'Brief': 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
    'Khảo sát': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    'NTXX': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    'Lắp đặt': 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
};

interface PhaseDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: StoreItem[];
    defaultPhase?: StorePhase['phase'];
    visTechs?: any[];
    finalProject: string;
    validPhases?: StorePhase['phase'][];
    onPhaseSaved?: (phase: StorePhase['phase'], itemIds: string[]) => void;
}

export function PhaseDetailModal({ 
    isOpen, 
    onClose, 
    items, 
    defaultPhase = 'Khảo sát', 
    visTechs = [], 
    finalProject, 
    validPhases = PHASES, 
    onPhaseSaved 
}: PhaseDetailModalProps) {
    const { authUser } = useDashboardStore();
    const currentUserEmail = authUser?.email || 'Admin / Operator';

    const isBulk = items.length > 1;
    const item = items[0]; // Reference item for single store mode

    const [activePhase, setActivePhase] = React.useState<StorePhase['phase']>(defaultPhase);
    const [activeTab, setActiveTab] = React.useState<'form' | 'logs'>('form');

    const { data: singlePhases = [], isLoading: isSingleLoading } = useStorePhases((isOpen && !isBulk) ? item?.id : undefined);
    const { data: bulkPhases = [], isLoading: isBulkLoading } = useStorePhasesBulk((isOpen && isBulk) ? items.map(i => i.id) : []);
    
    const phases = isBulk ? bulkPhases : singlePhases;
    const isLoading = isBulk ? isBulkLoading : isSingleLoading;
    
    const upsertPhase = useUpsertStorePhase(finalProject);
    const bulkUpsertPhases = useBulkUpsertStorePhases(finalProject);

    // Form states
    const [form, setForm] = React.useState<Partial<StorePhase>>({});
    const [brandInput, setBrandInput] = React.useState<string>('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
    const [hasFormChanged, setHasFormChanged] = React.useState(false);
    const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);
    const [confirmAction, setConfirmAction] = React.useState<{ show: boolean; targetResult: 'pass' | 'fail' | null; proceedToNext?: boolean }>({ show: false, targetResult: null });

    // Drag and drop state
    const [isDragging, setIsDragging] = React.useState(false);

    // Audit logs state
    const [logs, setLogs] = React.useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = React.useState(false);

    const initializedRef = React.useRef(false);

    // Reset when modal closes or opens
    React.useEffect(() => {
        if (!isOpen) {
            initializedRef.current = false;
            setPendingFiles([]);
            setHasFormChanged(false);
            setConfirmAction({ show: false, targetResult: null });
            setActiveTab('form');
        } else {
            initializedRef.current = false;
            setBrandInput(item?.brand || item?.brand_name || '');
        }
    }, [activePhase, isBulk ? 'bulk' : item?.id, isOpen, item?.brand, item?.brand_name]);

    // Handle ESC key
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Initialize active phase on open
    React.useEffect(() => {
        if (isOpen) setActivePhase(defaultPhase);
    }, [isOpen, defaultPhase]);

    // Load phase data into form
    React.useEffect(() => {
        if (!isOpen || isLoading) return;
        
        if (isBulk) {
            if (!initializedRef.current) {
                const activeBulkPhases = phases.filter(p => p.phase === activePhase);
                const commonValues: Partial<StorePhase> = { phase: activePhase };
                
                if (activeBulkPhases.length === items.length && items.length > 0) {
                    const checkCommon = (field: keyof StorePhase) => {
                        const firstVal = activeBulkPhases[0][field];
                        if (firstVal !== undefined && firstVal !== null && activeBulkPhases.every(p => p[field] === firstVal)) {
                            return firstVal;
                        }
                        return undefined;
                    };
                    
                    const commonStart = checkCommon('expected_start');
                    if (commonStart) commonValues.expected_start = commonStart as string;
                    
                    const commonEnd = checkCommon('expected_end');
                    if (commonEnd) commonValues.expected_end = commonEnd as string;
                    
                    const commonActual = checkCommon('actual_date');
                    if (commonActual) commonValues.actual_date = commonActual as string;
                    
                    const commonResult = checkCommon('result');
                    if (commonResult) commonValues.result = commonResult as any;

                    const commonFailReason = checkCommon('fail_reason');
                    if (commonFailReason) commonValues.fail_reason = commonFailReason as string;

                    const commonVisTech = checkCommon('vis_tech');
                    if (commonVisTech) commonValues.vis_tech = commonVisTech as string;
                }
                
                setForm(commonValues);
                initializedRef.current = true;
            }
            return;
        }

        if (initializedRef.current) return;
        
        const existing = phases.find(p => p.phase === activePhase);
        setForm(existing ? { ...existing } : { store_item_id: item?.id, phase: activePhase });
        initializedRef.current = true;
    }, [activePhase, phases, item?.id, isLoading, isBulk, isOpen]);

    // Fetch Audit logs when switching to logs tab
    React.useEffect(() => {
        if (isOpen && activeTab === 'logs' && !isBulk && item?.id) {
            setIsLoadingLogs(true);
            supabase
                .from('project_store_logs')
                .select('*')
                .eq('store_item_id', item.id)
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (!error && data) {
                        setLogs(data);
                    }
                    setIsLoadingLogs(false);
                });
        }
    }, [isOpen, activeTab, isBulk, item?.id]);

    if (!isOpen || items.length === 0) return null;

    const currentStatus = computePhaseStatus(form as StorePhase);

    // SLA Calculation
    const getSlaInfo = () => {
        if (!form.expected_end) return null;
        const endDate = new Date(form.expected_end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (form.result === 'pass') {
            return { type: 'success', text: '✅ Giai đoạn đã hoàn tất' };
        }
        if (diffDays < 0) {
            return { type: 'danger', text: `🔴 Quá hạn ${Math.abs(diffDays)} ngày!` };
        }
        if (diffDays === 0) {
            return { type: 'warning', text: `⚠️ Hôm nay là Hạn chót SLA` };
        }
        return { type: 'info', text: `⏳ Còn ${diffDays} ngày SLA` };
    };

    const slaInfo = getSlaInfo();

    // Confirm & Save Handler
    const executeSave = async (proceedToNextPhase: boolean = false) => {
        try {
            setIsSaving(true);
            setConfirmAction({ show: false, targetResult: null });

            // Validation
            if (form.expected_start && form.expected_end) {
                const start = new Date(form.expected_start);
                const end = new Date(form.expected_end);
                if (end < start) {
                    toast.error('Ngày kết thúc không được nhỏ hơn ngày bắt đầu');
                    setIsSaving(false);
                    return;
                }
            }
            if (form.result === 'pass' && !form.actual_date) {
                toast.error('Vui lòng nhập Ngày thực tế khi đánh giá kết quả là Đạt');
                setIsSaving(false);
                return;
            }
            if (form.result === 'fail' && !form.fail_reason && !form.notes?.trim()) {
                toast.error('⚠️ Vui lòng chọn hoặc nhập Lý do lỗi khi đánh giá kết quả là Lỗi!');
                setIsSaving(false);
                return;
            }
            if (form.result === 'on_hold' && !form.notes?.trim()) {
                toast.error('⚠️ Vui lòng nhập lý do tạm dừng vào ô Ghi chú!');
                setIsSaving(false);
                return;
            }

            const uploadedUrls: string[] = [];
            
            // Upload pending files in parallel
            if (pendingFiles.length > 0) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const subfolder = `Giai đoạn ${activePhase} / Uploads`;

                const uploadPromises = pendingFiles.map(async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('final_project', finalProject || 'General');
                    formData.append('subfolder_name', subfolder);

                    const res = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.drive_url) {
                            const { data: actData } = await supabase.from('project_activities').insert({
                                final_project: finalProject,
                                activity_type: 'MANUAL_UPLOAD',
                                phase_type: activePhase === 'Khảo sát' ? 'SURVEY' : 
                                            activePhase === 'Lắp đặt' ? 'INSTALLATION' : 
                                            activePhase === 'NTXX' ? 'NTXX' : 'BRIEF',
                                content: `Tải lên tài liệu thủ công: ${file.name}`,
                                nguoi_gui: currentUserEmail,
                                activity_subtype: 'REPORT'
                            }).select('id').single();

                            if (actData) {
                                await supabase.from('activity_attachments').insert({
                                    activity_id: actData.id,
                                    file_name: file.name,
                                    drive_file_id: data.drive_file_id || 'unknown',
                                    drive_url: data.drive_url,
                                    is_manual_upload: true,
                                    uploaded_by: currentUserEmail
                                });
                            }
                            return data.drive_url as string;
                        }
                    }
                    return null;
                });

                const results = await Promise.all(uploadPromises);
                results.forEach(url => { if (url) uploadedUrls.push(url); });
            }

            const proofLinks = typeof form.proof_links === 'string'
                ? (form.proof_links as string).split('\n').filter(l => l.trim())
                : (form.proof_links || []);
                
            const finalProofLinks = [...proofLinks, ...uploadedUrls];

            if (form.result === 'pass' && finalProofLinks.length === 0) {
                toast('💡 Mẹo: Nên đính kèm ít nhất 1 ảnh minh chứng khi xác nhận Đạt!', { icon: '📸' });
            }

            if (isBulk) {
                const updates = items.map(store => {
                    const existingPhase = phases.find(p => p.store_item_id === store.id && p.phase === activePhase);
                    const updateObj: any = existingPhase ? { ...existingPhase } : { store_item_id: store.id, phase: activePhase };

                    if (form.expected_start !== undefined) updateObj.expected_start = form.expected_start || null;
                    if (form.expected_end !== undefined) updateObj.expected_end = form.expected_end || null;
                    if (form.actual_date !== undefined) updateObj.actual_date = form.actual_date || null;
                    if (form.result !== undefined) updateObj.result = form.result || null;
                    if (form.fail_reason !== undefined) updateObj.fail_reason = form.result === 'fail' ? (form.fail_reason || null) : null;
                    if (form.notes !== undefined) updateObj.notes = form.notes || null;
                    if (form.vis_tech !== undefined) updateObj.vis_tech = form.vis_tech || null;
                    updateObj.updated_by = currentUserEmail;
                    
                    if (uploadedUrls.length > 0) {
                        updateObj.proof_links = [...(updateObj.proof_links || []), ...uploadedUrls];
                    }
                    return updateObj;
                });
                await bulkUpsertPhases.mutateAsync(updates);
                await supabase.from('project_store_items')
                    .update({ current_phase: activePhase, brand: brandInput, brand_name: brandInput })
                    .in('id', items.map(i => i.id));
                if (onPhaseSaved) onPhaseSaved(activePhase, items.map(i => i.id));
            } else {
                await upsertPhase.mutateAsync({
                    ...form,
                    store_item_id: item.id,
                    phase: activePhase,
                    proof_links: finalProofLinks,
                    fail_reason: form.result === 'fail' ? (form.fail_reason || null) : null,
                    updated_by: currentUserEmail,
                } as StorePhase);
                await supabase.from('project_store_items')
                    .update({ current_phase: activePhase, brand: brandInput, brand_name: brandInput })
                    .eq('id', item.id);
                if (onPhaseSaved) onPhaseSaved(activePhase, [item.id]);
            }

            // Sync Brand mapping to main project table
            if (finalProject && brandInput) {
                try {
                    const customDataRaw = localStorage.getItem('POSM_PROJECT_CUSTOM_DATA') || '{}';
                    const parsedData = JSON.parse(customDataRaw);
                    parsedData[finalProject] = { ...(parsedData[finalProject] || {}), brand: brandInput, nhan_hang: brandInput };
                    localStorage.setItem('POSM_PROJECT_CUSTOM_DATA', JSON.stringify(parsedData));
                    window.dispatchEvent(new Event('storage'));
                } catch (e) {
                    console.warn('Local brand map warning:', e);
                }
            }
            
            toast.success(isBulk ? `Cập nhật ${items.length} cửa hàng thành công!` : 'Đã lưu tiến độ thành công!');
            setPendingFiles([]);
            setHasFormChanged(false);

            // Handle proceed to next phase if requested
            if (proceedToNextPhase) {
                const currentIndex = validPhases.indexOf(activePhase);
                if (currentIndex >= 0 && currentIndex < validPhases.length - 1) {
                    const nextPhase = validPhases[currentIndex + 1];
                    setActivePhase(nextPhase);
                    toast.success(`Đã tự động chuyển sang giai đoạn tiếp theo: ${nextPhase}`);
                    return;
                }
            }

            onClose();
        } catch (err: any) {
            toast.error('Lỗi khi lưu: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveButtonClick = (proceedNext: boolean = false) => {
        // Triggers confirmation if result is pass or fail
        if (form.result === 'pass' || form.result === 'fail') {
            setConfirmAction({ show: true, targetResult: form.result, proceedToNext: proceedNext });
        } else {
            executeSave(proceedNext);
        }
    };

    // File Upload Handling
    const handleFilesSelected = (files: FileList | File[]) => {
        const newFiles = Array.from(files);
        if (newFiles.length === 0) return;
        setPendingFiles(prev => [...prev, ...newFiles]);
        setHasFormChanged(true);
        toast.success(`Đã thêm ${newFiles.length} file. Bấm Lưu tiến độ để tải lên.`);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelected(e.dataTransfer.files);
        }
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const proofLinksList = typeof form.proof_links === 'string'
        ? (form.proof_links as string).split('\n').filter(l => l.trim())
        : (form.proof_links || []);

    const removeLink = (indexToRemove: number) => {
        const currentLinks = Array.isArray(form.proof_links) ? form.proof_links : (typeof form.proof_links === 'string' ? (form.proof_links as string).split('\n').filter(Boolean) : []);
        setForm(f => ({ ...f, proof_links: currentLinks.filter((_, idx) => idx !== indexToRemove) }));
        setHasFormChanged(true);
    };

    // Status Colors Map
    const statusColors: Record<string, string> = {
        'unscheduled': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        'scheduled': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        'in_progress': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        'pending_review': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        'on_hold': 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        'late': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        'completed': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        'error': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    };

    const currentPhaseIndex = validPhases.indexOf(activePhase);
    const hasNextPhase = currentPhaseIndex >= 0 && currentPhaseIndex < validPhases.length - 1;
    const nextPhaseName = hasNextPhase ? validPhases[currentPhaseIndex + 1] : null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[92vh] border border-slate-200 dark:border-slate-800">
                
                {/* 1. HEADER WITH EXPANDED STORE CONTEXT */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                    Chi tiết Giai đoạn POSM
                                </span>
                                {isBulk && (
                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                        Cập nhật {items.length} cửa hàng
                                    </span>
                                )}
                                {slaInfo && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                        slaInfo.type === 'danger' ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300' :
                                        slaInfo.type === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300' :
                                        slaInfo.type === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                                        'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                                    }`}>
                                        {slaInfo.text}
                                    </span>
                                )}
                            </div>

                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                {isBulk ? `Đang chọn hàng loạt (${items.length} Cửa Hàng)` : (
                                    <>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-mono">{item.store_code}</span>
                                        {item.store_name && <span className="text-slate-600 dark:text-slate-300 font-bold">— {item.store_name}</span>}
                                    </>
                                )}
                            </h3>

                            {/* Store Context Metadata Bar */}
                            {!isBulk && (
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1 flex-wrap font-medium">
                                    {item.region && (
                                        <span className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                            <MapPin className="w-3 h-3 text-indigo-500" /> {item.region}
                                        </span>
                                    )}
                                    {item.customer && (
                                        <span className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                            <Building2 className="w-3 h-3 text-purple-500" /> {item.customer}
                                        </span>
                                    )}
                                    {item.supplier_name && (
                                        <span className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                            <Truck className="w-3 h-3 text-emerald-500" /> {item.supplier_name}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/80 px-2.5 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                                        <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 shrink-0">🏷️ Nhãn hàng:</span>
                                        <input
                                            type="text"
                                            placeholder="Nhập nhãn hàng (VD: P/S, OMO...)"
                                            value={brandInput}
                                            onChange={(e) => {
                                                setBrandInput(e.target.value);
                                                setHasFormChanged(true);
                                            }}
                                            className="bg-transparent border-b border-sky-300 dark:border-sky-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none px-1 py-0.5 w-36 focus:border-sky-500"
                                        />
                                    </div>
                                    {form.updated_by && (
                                        <span className="text-[11px] text-slate-400">
                                            Cập nhật bởi: <strong className="text-slate-600 dark:text-slate-300">{form.updated_by}</strong>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Top Tab Controls: Form vs Audit Log */}
                        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/70 p-1 rounded-xl shrink-0">
                            <button
                                onClick={() => setActiveTab('form')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === 'form' 
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Thao Tác
                            </button>
                            {!isBulk && (
                                <button
                                    onClick={() => setActiveTab('logs')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'logs' 
                                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    <History className="w-3.5 h-3.5" /> Lịch Sử Log
                                </button>
                            )}
                            <button 
                                onClick={onClose} 
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 rounded-lg transition-all ml-1 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. PHASE PIPELINE STEPPER NAVIGATION */}
                <div className="bg-slate-50/80 dark:bg-slate-950/60 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar">
                        {validPhases.map((ph, idx) => {
                            let phaseStatusObj = { status: 'unscheduled', label: 'Chưa lên lịch', isLate: false };
                            let hasData = false;
                            
                            if (isBulk) {
                                const activeBulkPhases = phases.filter(p => p.phase === ph);
                                if (activeBulkPhases.length > 0) hasData = true;
                            } else {
                                const phaseData = phases.find(p => p.phase === ph);
                                phaseStatusObj = computePhaseStatus(phaseData);
                                hasData = phaseData && phaseStatusObj.status !== 'unscheduled';
                            }

                            const isActive = activePhase === ph;
                            const isPass = phaseStatusObj.status === 'completed';
                            const isFail = phaseStatusObj.status === 'error' || phaseStatusObj.status === 'late';
                            const isPending = phaseStatusObj.status === 'pending_review';

                            const handleStepClick = () => {
                                if (ph === activePhase) return;
                                if (hasFormChanged) {
                                    if (!window.confirm('⚠️ Bạn có thay đổi chưa lưu tại giai đoạn này. Bạn có chắc chắn muốn chuyển tab?')) {
                                        return;
                                    }
                                }
                                setActivePhase(ph);
                                setHasFormChanged(false);
                                setConfirmAction({ show: false, targetResult: null });
                            };

                            return (
                                <React.Fragment key={ph}>
                                    <button
                                        onClick={handleStepClick}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 ${
                                            isActive
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-[1.02]'
                                                : isPass
                                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                                : isFail
                                                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                                                : isPending
                                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                            isActive ? 'bg-white/20 text-white' :
                                            isPass ? 'bg-emerald-500 text-white' :
                                            isFail ? 'bg-rose-500 text-white' :
                                            'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {isPass ? <Check className="w-3 h-3 stroke-[3]" /> : (idx + 1)}
                                        </span>

                                        <span>{ph}</span>

                                        {/* Status Dot */}
                                        {hasData && !isActive && (
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                isPass ? 'bg-emerald-500' :
                                                isFail ? 'bg-rose-500' :
                                                isPending ? 'bg-amber-500' : 'bg-indigo-400'
                                            }`} />
                                        )}
                                    </button>

                                    {idx < validPhases.length - 1 && (
                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 shrink-0" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* 3. MAIN CONTENT BODY */}
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <span>Đang tải thông tin tiến độ...</span>
                    </div>
                ) : activeTab === 'logs' ? (
                    /* AUDIT LOG TAB VIEW */
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <History className="w-4 h-4 text-indigo-500" /> Nhật Ký Thay Đổi CSDL (Audit Trail)
                            </h4>
                            <span className="text-[11px] text-slate-400">{logs.length} thao tác được ghi nhận</span>
                        </div>

                        {isLoadingLogs ? (
                            <div className="text-center py-8 text-slate-400 text-xs flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải lịch sử log...
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs italic">
                                Chưa có ghi nhận lịch sử log nào cho cửa hàng này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {logs.map((log, lIdx) => (
                                    <div key={log.id || lIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                                                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">
                                                    {(log.action_type || 'LOG')[0]}
                                                </span>
                                                <span>Giai đoạn: {log.field_name}</span>
                                            </div>
                                            <span className="text-[11px] text-slate-400 font-mono">
                                                {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : 'Mới đây'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-slate-400 block font-medium">Giá trị cũ:</span>
                                                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{log.old_value || 'Chưa có'}</p>
                                            </div>
                                            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                                <span className="text-indigo-500 font-medium block">Giá trị mới:</span>
                                                <p className="text-indigo-900 dark:text-indigo-200 font-medium mt-0.5">{log.new_value || 'Đã cập nhật'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* FORM VIEW */
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* LEFT COLUMN: KẾ HOẠCH (5 CỘT) */}
                            <div className="lg:col-span-5 flex flex-col gap-4">
                                <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-indigo-500" /> Kế Hoạch & Phân Công
                                        </label>
                                        <span className="text-[10px] text-slate-400 font-medium">Bước 1</span>
                                    </div>

                                    {/* Từ ngày */}
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block font-semibold">
                                            Từ ngày (Dự kiến)
                                        </label>
                                        <input
                                            type="date"
                                            value={form.expected_start || ''}
                                            onChange={e => {
                                                const newStart = e.target.value;
                                                setHasFormChanged(true);
                                                setForm(f => {
                                                    const autoEnd = calculateAutoSlaEnd(newStart, activePhase);
                                                    return {
                                                        ...f,
                                                        expected_start: newStart,
                                                        expected_end: f.expected_end || autoEnd
                                                    };
                                                });
                                            }}
                                            className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-medium"
                                        />
                                    </div>

                                    {/* Đến ngày */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-slate-600 dark:text-slate-400 block font-semibold">
                                                Đến ngày (Dự kiến)
                                            </label>
                                            {form.expected_start && (
                                                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                    🤖 Gợi ý SLA
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="date"
                                            value={form.expected_end || ''}
                                            onChange={e => {
                                                setHasFormChanged(true);
                                                setForm(f => ({ ...f, expected_end: e.target.value }));
                                            }}
                                            className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-medium"
                                        />
                                    </div>

                                    {/* Vis-Tech phụ trách */}
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block font-semibold">
                                            Vis-Tech Phụ Trách
                                        </label>
                                        {visTechs.length > 0 ? (
                                            <select
                                                value={form.vis_tech || ''}
                                                onChange={e => {
                                                    setHasFormChanged(true);
                                                    setForm(f => ({ ...f, vis_tech: e.target.value }));
                                                }}
                                                className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all cursor-pointer font-medium"
                                            >
                                                <option value="">-- Chọn kỹ thuật viên --</option>
                                                {visTechs.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="Nhập tên nhân viên phụ trách..."
                                                value={form.vis_tech || ''}
                                                onChange={e => {
                                                    setHasFormChanged(true);
                                                    setForm(f => ({ ...f, vis_tech: e.target.value }));
                                                }}
                                                className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all font-medium"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: THỰC HIỆN & BÁO CÁO (7 CỘT) */}
                            <div className="lg:col-span-7 flex flex-col gap-5">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <User className="w-4 h-4 text-indigo-500" /> Báo Cáo Hiện Trường & Kết Quả
                                        </label>
                                        <span className="text-[10px] text-slate-400 font-medium">Bước 2</span>
                                    </div>

                                    {/* Ngày Thực Tế */}
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block font-semibold">
                                            Ngày Thực Tế Thi Công / Báo Cáo
                                        </label>
                                        <input
                                            type="date"
                                            value={form.actual_date || ''}
                                            onChange={e => {
                                                setHasFormChanged(true);
                                                setForm(f => ({ ...f, actual_date: e.target.value }));
                                            }}
                                            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all cursor-pointer font-medium"
                                        />
                                    </div>

                                    {/* Trạng Thái & Kết Quả Matrix */}
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-2 block font-semibold">
                                            Quyết Định / Kết Quả Đánh Giá
                                        </label>

                                        <div className="space-y-2">
                                            {/* Nhóm 1: Tiến Trình */}
                                            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                                                    🔄 Tiến Trình Vận Hành
                                                </span>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasFormChanged(true);
                                                            setForm(f => ({ ...f, result: null, fail_reason: null }));
                                                        }}
                                                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                            !form.result 
                                                                ? 'bg-indigo-600 text-white shadow-sm' 
                                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-800'
                                                        }`}
                                                    >
                                                        Đang làm
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasFormChanged(true);
                                                            setForm(f => ({ ...f, result: 'on_hold' }));
                                                        }}
                                                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                            form.result === 'on_hold' 
                                                                ? 'bg-slate-700 text-white shadow-sm' 
                                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-800'
                                                        }`}
                                                    >
                                                        Tạm dừng
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasFormChanged(true);
                                                            setForm(f => ({ ...f, result: 'pending_review' }));
                                                        }}
                                                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                            form.result === 'pending_review' 
                                                                ? 'bg-amber-500 text-white shadow-sm' 
                                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-800'
                                                        }`}
                                                    >
                                                        Chờ duyệt
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Nhóm 2: Kết Luận */}
                                            <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                                                    🎯 Kết Luận Giai Đoạn
                                                </span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasFormChanged(true);
                                                            setForm(f => ({ ...f, result: 'pass', fail_reason: null }));
                                                        }}
                                                        className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                            form.result === 'pass' 
                                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                                                                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900'
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" /> Đạt (Hoàn Tất)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setHasFormChanged(true);
                                                            setForm(f => ({ ...f, result: 'fail' }));
                                                        }}
                                                        className={`py-2.5 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                            form.result === 'fail' 
                                                                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20' 
                                                                : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 border border-rose-200 dark:border-rose-900'
                                                        }`}
                                                    >
                                                        <XCircle className="w-4 h-4" /> Lỗi (Gặp Sự Cố)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DYNAMIC CONDITIONAL INPUTS BASED ON RESULT */}
                                    {form.result === 'fail' && (
                                        <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2 animate-in fade-in">
                                            <label className="text-xs font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                                <AlertCircle className="w-4 h-4" /> Chọn Nguyên Nhân Lỗi (Bắt Buộc Audit)
                                            </label>
                                            <select
                                                value={form.fail_reason || ''}
                                                onChange={e => {
                                                    setHasFormChanged(true);
                                                    setForm(f => ({ ...f, fail_reason: e.target.value }));
                                                }}
                                                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-xl outline-none text-rose-800 dark:text-rose-300 font-bold focus:ring-2 focus:ring-rose-400/30 cursor-pointer"
                                            >
                                                <option value="">-- Vui lòng chọn nguyên nhân --</option>
                                                <option value="[Lỗi] Cửa hàng đóng cửa / Đang sửa chữa">[Lỗi] Cửa hàng đóng cửa / Đang sửa chữa</option>
                                                <option value="[Lỗi] Cửa hàng từ chối thi công">[Lỗi] Cửa hàng từ chối thi công</option>
                                                <option value="[Lỗi] Không có không gian / Mặt bằng không đủ">[Lỗi] Không có không gian / Mặt bằng không đủ</option>
                                                <option value="[Lỗi] Lỗi POSM / Hàng hóa hư hỏng">[Lỗi] Lỗi POSM / Hàng hóa hư hỏng</option>
                                                <option value="[Lỗi] Phát sinh chi phí ngoài dự toán">[Lỗi] Phát sinh chi phí ngoài dự toán</option>
                                                <option value="[Lỗi] Khác">[Lỗi] Khác (Mô tả trong ghi chú)</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Ghi chú chi tiết */}
                                    <div>
                                        <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block font-semibold">
                                            Ghi Chú Tình Trạng {form.result === 'fail' && '(Mô Tả Chi Tiết Lỗi)'}
                                        </label>
                                        <textarea
                                            value={form.notes || ''}
                                            onChange={e => {
                                                setHasFormChanged(true);
                                                setForm(f => ({ ...f, notes: e.target.value }));
                                            }}
                                            placeholder={
                                                form.result === 'fail' ? "Mô tả chi tiết nguyên nhân sự cố hiện trường..." :
                                                form.result === 'on_hold' ? "Nhập lý do tạm dừng giai đoạn..." :
                                                "Nhập nội dung ghi chú phát sinh nếu có..."
                                            }
                                            rows={2}
                                            className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none font-medium"
                                        />
                                    </div>

                                    {/* DRAG & DROP FILE PROOF GALLERY */}
                                    <div>
                                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between mb-2">
                                            <span className="flex items-center gap-1.5">
                                                <Link2 className="w-4 h-4 text-indigo-500" /> Ảnh / File Minh Chứng
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-normal">
                                                Đã tải: {proofLinksList.length + pendingFiles.length} file
                                            </span>
                                        </label>

                                        <div 
                                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={handleDrop}
                                            className={`border-2 border-dashed rounded-2xl p-4 transition-all ${
                                                isDragging 
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 scale-[1.01]' 
                                                    : form.result === 'pass' && proofLinksList.length === 0 && pendingFiles.length === 0
                                                    ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900'
                                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
                                            }`}
                                        >
                                            <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer py-2">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        Kéo thả file vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">bấm để chọn</span>
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ hình ảnh (PNG, JPG), Video hoặc PDF</p>
                                                </div>
                                                <input 
                                                    type="file" 
                                                    multiple 
                                                    className="hidden" 
                                                    onChange={e => e.target.files && handleFilesSelected(e.target.files)}
                                                    disabled={isUploading}
                                                    accept="image/*,video/*,application/pdf"
                                                />
                                            </label>

                                            {/* Gallery view */}
                                            {(proofLinksList.length > 0 || pendingFiles.length > 0) && (
                                                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 mt-2">
                                                    {proofLinksList.map((link, idx) => {
                                                        const isImage = link.match(/\.(jpeg|jpg|gif|png|webp)/i) != null || link.includes('drive.google.com/uc?');
                                                        return (
                                                            <div 
                                                                key={`link-${idx}`} 
                                                                onClick={() => isImage && setPreviewImageUrl(link)}
                                                                className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 aspect-square flex items-center justify-center cursor-pointer shadow-xs"
                                                            >
                                                                {isImage ? (
                                                                    <img src={link} alt="proof" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-1 p-1">
                                                                        <FileText className="w-5 h-5 text-slate-400" />
                                                                        <span className="text-[9px] text-slate-500 truncate w-full text-center" title={link}>File</span>
                                                                    </div>
                                                                )}
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                                    <a href={link} target="_blank" rel="noopener noreferrer" className="p-1 bg-white/30 hover:bg-white text-white hover:text-slate-900 rounded-md transition-colors">
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                    </a>
                                                                    <button onClick={(e) => { e.stopPropagation(); removeLink(idx); }} className="p-1 bg-rose-500/80 hover:bg-rose-600 text-white rounded-md transition-colors">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {pendingFiles.map((file, idx) => (
                                                        <div key={`pending-${idx}`} className="relative group rounded-xl overflow-hidden border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 aspect-square flex items-center justify-center shadow-xs">
                                                            <div className="flex flex-col items-center gap-1 p-1">
                                                                <FileText className="w-5 h-5 text-amber-600" />
                                                                <span className="text-[9px] text-amber-700 dark:text-amber-300 truncate w-full text-center font-medium" title={file.name}>{file.name}</span>
                                                                <span className="text-[8px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1 rounded font-bold uppercase">Chờ lưu</span>
                                                            </div>
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button onClick={() => removePendingFile(idx)} className="p-1 bg-rose-500 text-white rounded-md">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. FOOTER WITH SMART CONFIRMATION FLOW */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 space-y-3">
                    
                    {/* INLINE CONFIRMATION BANNER */}
                    {confirmAction.show && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                    Xác nhận chốt kết quả <strong className="underline uppercase">{confirmAction.targetResult === 'pass' ? 'ĐẠT' : 'LỖI'}</strong> cho giai đoạn <strong className="text-indigo-600 dark:text-indigo-400">{activePhase}</strong>?
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setConfirmAction({ show: false, targetResult: null })}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={() => executeSave(confirmAction.proceedToNext)}
                                    className="px-4 py-1.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm cursor-pointer"
                                >
                                    Xác Nhận & Lưu
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Giai đoạn:</span>
                            <span className={`text-xs font-extrabold px-3 py-1 rounded-lg border ${PHASE_COLORS[activePhase] || 'bg-slate-100'}`}>
                                {activePhase}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md border ${statusColors[currentStatus.status]}`}>
                                {currentStatus.label}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={onClose} 
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                            >
                                Đóng
                            </button>

                            {/* SMART BUTTON: LƯU & TIẾP TỤC GIAI ĐOẠN SAU */}
                            {hasNextPhase && form.result === 'pass' && (
                                <button
                                    onClick={() => handleSaveButtonClick(true)}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Lưu & Sang {nextPhaseName}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* STANDARD SAVE BUTTON */}
                            <button
                                onClick={() => handleSaveButtonClick(false)}
                                disabled={isSaving}
                                className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Đang lưu...' : 'Lưu Tiến Độ'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* LIGHTBOX IMAGE PREVIEW MODAL */}
            {previewImageUrl && (
                <div 
                    onClick={() => setPreviewImageUrl(null)}
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in cursor-pointer"
                >
                    <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewImageUrl(null)}
                            className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img src={previewImageUrl} alt="preview" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
