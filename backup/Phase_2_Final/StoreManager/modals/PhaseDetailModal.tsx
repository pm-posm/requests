import React from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { X, Save, CheckCircle2, XCircle, Calendar, Link2, FileText, User } from 'lucide-react';
import type { StoreItem, StorePhase } from '@/types';
import { computePhaseStatus } from '@/hooks/useStorePhases';
import { useStorePhases, useStorePhasesBulk, useUpsertStorePhase, useBulkUpsertStorePhases } from '@/hooks/useStorePhases';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2, ExternalLink, Trash2 } from 'lucide-react';

const PHASES: StorePhase['phase'][] = ['Brief', 'Khảo sát', 'NTXX', 'Lắp đặt'];

const PHASE_COLORS: Record<string, string> = {
    'Brief': 'bg-violet-100 text-violet-700 border-violet-300',
    'Khảo sát': 'bg-purple-100 text-purple-700 border-purple-300',
    'NTXX': 'bg-amber-100 text-amber-700 border-amber-300',
    'Lắp đặt': 'bg-emerald-100 text-emerald-700 border-emerald-300',
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

export function PhaseDetailModal({ isOpen, onClose, items, defaultPhase = 'Khảo sát', visTechs = [], finalProject, validPhases = PHASES, onPhaseSaved }: PhaseDetailModalProps) {
    const isBulk = items.length > 1;
    const item = items[0]; // Used as reference when single

    const [activePhase, setActivePhase] = React.useState<StorePhase['phase']>(defaultPhase);
    const { data: singlePhases = [], isLoading: isSingleLoading } = useStorePhases((isOpen && !isBulk) ? item?.id : undefined);
    const { data: bulkPhases = [], isLoading: isBulkLoading } = useStorePhasesBulk((isOpen && isBulk) ? items.map(i => i.id) : []);
    
    const phases = isBulk ? bulkPhases : singlePhases;
    const isLoading = isBulk ? isBulkLoading : isSingleLoading;
    
    const upsertPhase = useUpsertStorePhase(finalProject);
    const bulkUpsertPhases = useBulkUpsertStorePhases(finalProject);

    // Form state
    const [form, setForm] = React.useState<Partial<StorePhase>>({});
    const [isSaving, setIsSaving] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);

    const initializedRef = React.useRef(false);

    // Reset initialization when switching phases or reopening
    React.useEffect(() => {
        if (!isOpen) {
            initializedRef.current = false;
            setPendingFiles([]);
        } else {
            initializedRef.current = false;
        }
    }, [activePhase, isBulk ? 'bulk' : item?.id, isOpen]);

    // Load phase data into form only once per phase switch
    React.useEffect(() => {
        if (!isOpen) return;
        if (isLoading) return;
        
        if (isBulk) {
            // Bulk edit: compute common values if they exist for activePhase
            if (!initializedRef.current) {
                const activeBulkPhases = phases.filter(p => p.phase === activePhase);
                const commonValues: Partial<StorePhase> = { phase: activePhase };
                
                if (activeBulkPhases.length === items.length && items.length > 0) {
                    // All selected items have this phase in DB. Check for common values.
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
                    if (commonResult) commonValues.result = commonResult as 'pass' | 'fail';
                    
                    // Do not compute common notes or proof_links to avoid accidental overwrite of unique ones
                }
                
                setForm(commonValues);
                initializedRef.current = true;
            }
            return;
        }

        if (initializedRef.current) return;
        
        const existing = phases.find(p => p.phase === activePhase);
        setForm(existing ? { ...existing } : { store_item_id: item.id, phase: activePhase });
        initializedRef.current = true;
    }, [activePhase, phases, item?.id, isLoading, isBulk, isOpen]);

    React.useEffect(() => {
        if (isOpen) setActivePhase(defaultPhase);
    }, [isOpen, defaultPhase]);

    const isPlanFilled = React.useMemo(() => {
        if (isBulk) {
            if (form.expected_start || form.expected_end) return true;
            return items.every(store => {
                const existingPhase = phases.find(p => p.store_item_id === store.id && p.phase === activePhase);
                return existingPhase && (existingPhase.expected_start || existingPhase.expected_end);
            });
        }
        return !!form.expected_start || !!form.expected_end;
    }, [form.expected_start, form.expected_end, isBulk, items, phases, activePhase]);

    if (!isOpen || items.length === 0) return null;

    const currentStatus = computePhaseStatus(form as StorePhase);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            
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
                toast.error('Vui lòng nhập Ngày thực tế khi đánh giá kết quả là Hoàn tất');
                setIsSaving(false);
                return;
            }

            const uploadedUrls: string[] = [];
            
            // Upload pending files first
            if (pendingFiles.length > 0) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                for (let i = 0; i < pendingFiles.length; i++) {
                    const file = pendingFiles[i];
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('final_project', finalProject || 'General');
                    formData.append('subfolder_name', 'Uploads Thủ Công');

                    const res = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.drive_url) {
                            uploadedUrls.push(data.drive_url);
                            
                            // 1. Insert into project_activities
                            const { data: actData, error: actErr } = await supabase.from('project_activities').insert({
                                final_project: finalProject,
                                activity_type: 'MANUAL_UPLOAD',
                                phase_type: activePhase === 'Khảo sát' ? 'SURVEY' : 
                                            activePhase === 'Lắp đặt' ? 'INSTALLATION' : 
                                            activePhase === 'NTXX' ? 'NTXX' : 'BRIEF',
                                content: `Tải lên tài liệu thủ công: ${file.name}`,
                                nguoi_gui: 'Người dùng Dashboard',
                                activity_subtype: 'REPORT'
                            }).select('id').single();

                            if (actData && !actErr) {
                                // 2. Insert into activity_attachments
                                await supabase.from('activity_attachments').insert({
                                    activity_id: actData.id,
                                    file_name: file.name,
                                    drive_file_id: data.drive_file_id || 'unknown',
                                    drive_url: data.drive_url,
                                    is_manual_upload: true,
                                    uploaded_by: 'Người dùng Dashboard'
                                });
                            }
                        }
                    }
                }
            }

            const proofLinks = typeof form.proof_links === 'string'
                ? (form.proof_links as string).split('\n').filter(l => l.trim())
                : (form.proof_links || []);
                
            // Hợp nhất các link mới upload
            const finalProofLinks = [...proofLinks, ...uploadedUrls];

            if (isBulk) {
                // Bulk update: apply fields that were filled in the form on top of existing data
                const updates = items.map(store => {
                    const existingPhase = phases.find(p => p.store_item_id === store.id && p.phase === activePhase);
                    const updateObj: any = existingPhase ? { ...existingPhase } : { store_item_id: store.id, phase: activePhase };

                    if (form.expected_start !== undefined) updateObj.expected_start = form.expected_start || null;
                    if (form.expected_end !== undefined) updateObj.expected_end = form.expected_end || null;
                    if (form.actual_date !== undefined) updateObj.actual_date = form.actual_date || null;
                    if (form.result !== undefined) updateObj.result = form.result || null;
                    if (form.notes !== undefined) updateObj.notes = form.notes || null;
                    if (form.vis_tech !== undefined) updateObj.vis_tech = form.vis_tech || null;
                    
                    if (uploadedUrls.length > 0) {
                        updateObj.proof_links = [...(updateObj.proof_links || []), ...uploadedUrls];
                    }
                    return updateObj;
                });
                await bulkUpsertPhases.mutateAsync(updates);
                if (onPhaseSaved) onPhaseSaved(activePhase, items.map(i => i.id));
            } else {
                // Single update
                await upsertPhase.mutateAsync({
                    ...form,
                    store_item_id: item.id,
                    phase: activePhase,
                    proof_links: finalProofLinks,
                } as StorePhase);
                if (onPhaseSaved) onPhaseSaved(activePhase, [item.id]);
            }
            
            toast.success(isBulk ? 'Đã cập nhật hàng loạt thành công!' : 'Đã lưu tiến độ!');
            setPendingFiles([]);
            onClose();
        } catch (err: any) {
            toast.error('Lỗi khi lưu: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const newFiles = Array.from(files);
        setPendingFiles(prev => [...prev, ...newFiles]);
        toast.success(`Đã chọn ${newFiles.length} file. Bấm Lưu tiến độ để tải lên.`);
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
    };

    const statusColors: Record<string, string> = {
        'unscheduled': 'bg-slate-100 text-slate-500',
        'scheduled': 'bg-blue-100 text-blue-700',
        'in_progress': 'bg-indigo-100 text-indigo-700',
        'late': 'bg-rose-100 text-rose-700',
        'completed': 'bg-emerald-100 text-emerald-700',
        'error': 'bg-red-100 text-red-700',
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-slate-950 dark:to-slate-900 shrink-0">
                    <div>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Chi tiết Tiến độ</p>
                        <h3 className="text-base font-black text-slate-800 dark:text-white">
                            {isBulk ? `Cập nhật hàng loạt (${items.length} cửa hàng)` : item.store_code}
                        </h3>
                        {!isBulk && item.store_name && <p className="text-xs text-slate-500 mt-0.5">{item.store_name}</p>}
                        {isBulk && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium bg-indigo-100/50 dark:bg-indigo-900/30 px-2 py-1 rounded inline-block">Mẹo: Các trường để trống sẽ giữ nguyên giá trị cũ của từng cửa hàng.</p>}
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-xl transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Phase tabs */}
                <div className="flex gap-1 px-4 pt-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
                    {validPhases.map(ph => {
                        // For bulk, compute a representative status (e.g. only if ALL have same status, else 'in_progress' or blank)
                        let statusObj = { status: 'unscheduled', label: 'Chưa lên lịch', isLate: false };
                        let hasDot = false;
                        
                        if (isBulk) {
                            const activeBulkPhases = phases.filter(p => p.phase === ph);
                            if (activeBulkPhases.length > 0) {
                                hasDot = true; // some stores have data
                            }
                        } else {
                            const phaseData = phases.find(p => p.phase === ph);
                            statusObj = computePhaseStatus(phaseData);
                            hasDot = phaseData && statusObj.status !== 'unscheduled' ? true : false;
                        }
                        
                        const { status } = statusObj;
                        return (
                            <button
                                key={ph}
                                onClick={() => setActivePhase(ph)}
                                className={`relative px-3 pb-2 text-xs font-bold rounded-t border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    activePhase === ph
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {hasDot && (
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        status === 'completed' ? 'bg-emerald-500' :
                                        status === 'error' ? 'bg-red-500' :
                                        status === 'late' ? 'bg-rose-500' : 'bg-indigo-400'
                                    }`} />
                                )}
                                {ph}
                            </button>
                        );
                    })}
                    <div className="flex-1" />
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md self-center mb-2 ${statusColors[currentStatus.status]}`}>
                        {currentStatus.label}
                    </span>
                </div>

                {/* Form body */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">Đang tải...</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Left Column: Plan */}
                            <div className="w-full lg:w-5/12 flex flex-col gap-5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                        <Calendar className="w-3.5 h-3.5" /> Kế hoạch
                                    </label>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1 block">Từ ngày (Dự kiến)</label>
                                            <input
                                                type="date"
                                                value={form.expected_start || ''}
                                                onChange={e => setForm(f => ({ ...f, expected_start: e.target.value }))}
                                                className="w-full text-sm p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1 block">Đến ngày (Dự kiến)</label>
                                            <input
                                                type="date"
                                                value={form.expected_end || ''}
                                                onChange={e => setForm(f => ({ ...f, expected_end: e.target.value }))}
                                                className="w-full text-sm p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1 block">Vis-Tech phụ trách</label>
                                            {visTechs.length > 0 ? (
                                                <select
                                                    value={form.vis_tech || ''}
                                                    onChange={e => setForm(f => ({ ...f, vis_tech: e.target.value }))}
                                                    className="w-full text-sm p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                                                >
                                                    <option value="">-- Chọn --</option>
                                                    {visTechs.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="Nhập tên..."
                                                    value={form.vis_tech || ''}
                                                    onChange={e => setForm(f => ({ ...f, vis_tech: e.target.value }))}
                                                    className="w-full text-sm p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-400 transition-colors"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Execution */}
                            <div className={`w-full lg:w-7/12 flex flex-col gap-5 transition-all duration-300 ${!isPlanFilled ? 'opacity-40 pointer-events-none select-none grayscale-[50%]' : ''}`}>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                        <User className="w-3.5 h-3.5" /> Thực hiện & Báo cáo
                                    </label>
                                    
                                    <div className="space-y-4">
                                        {/* Date & Result */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-slate-500 mb-1 block">Ngày thực tế</label>
                                                <input
                                                    type="date"
                                                    value={form.actual_date || ''}
                                                    onChange={e => setForm(f => ({ ...f, actual_date: e.target.value }))}
                                                    className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-400 transition-colors cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 mb-1 block">Kết quả</label>
                                                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 gap-1">
                                                    <button
                                                        onClick={() => setForm(f => ({ ...f, result: undefined }))}
                                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${!form.result ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        Đang làm
                                                    </button>
                                                    <button
                                                        onClick={() => setForm(f => ({ ...f, result: 'pass' }))}
                                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${form.result === 'pass' ? 'bg-emerald-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Đạt
                                                    </button>
                                                    <button
                                                        onClick={() => setForm(f => ({ ...f, result: 'fail' }))}
                                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${form.result === 'fail' ? 'bg-rose-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" /> Lỗi
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fail Reason / Note */}
                                        <div className="transition-all">
                                            <label className={`text-[10px] mb-1 block font-medium ${form.result === 'fail' ? 'text-rose-600' : 'text-slate-500'}`}>
                                                {form.result === 'fail' ? 'Lý do lỗi (Bắt buộc) & Ghi chú' : 'Ghi chú (Tùy chọn)'}
                                            </label>
                                            {form.result === 'fail' && (
                                                <select
                                                    value={form.notes?.split(' - ')[0] || ''}
                                                    onChange={e => {
                                                        const reason = e.target.value;
                                                        const currentNote = form.notes?.split(' - ').slice(1).join(' - ') || '';
                                                        setForm(f => ({ ...f, notes: reason ? (currentNote ? `${reason} - ${currentNote}` : reason) : currentNote }));
                                                    }}
                                                    className="w-full text-sm p-2.5 mb-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl outline-none focus:border-rose-400 transition-colors text-rose-700"
                                                >
                                                    <option value="">-- Chọn lý do lỗi --</option>
                                                    <option value="[Lỗi] Cửa hàng đóng cửa">[Lỗi] Cửa hàng đóng cửa</option>
                                                    <option value="[Lỗi] Cửa hàng từ chối">[Lỗi] Cửa hàng từ chối</option>
                                                    <option value="[Lỗi] Không có không gian lắp đặt">[Lỗi] Không có không gian lắp đặt</option>
                                                    <option value="[Lỗi] Lỗi POSM/Hàng hóa">[Lỗi] Lỗi POSM/Hàng hóa</option>
                                                    <option value="[Lỗi] Phát sinh chi phí">[Lỗi] Phát sinh chi phí</option>
                                                    <option value="[Lỗi] Khác">[Lỗi] Khác</option>
                                                </select>
                                            )}
                                            <textarea
                                                value={form.result === 'fail' ? (form.notes?.split(' - ').slice(1).join(' - ') || form.notes || '') : (form.notes || '')}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (form.result === 'fail') {
                                                        const reason = form.notes?.split(' - ')[0] || '';
                                                        const hasReason = reason.startsWith('[Lỗi]');
                                                        setForm(f => ({ ...f, notes: hasReason ? `${reason} - ${val}` : val }));
                                                    } else {
                                                        setForm(f => ({ ...f, notes: val }));
                                                    }
                                                }}
                                                placeholder={form.result === 'fail' ? "Chi tiết tình trạng lỗi..." : "Chi tiết tình trạng..."}
                                                rows={2}
                                                className={`w-full text-sm p-3 border rounded-xl outline-none transition-colors resize-none ${
                                                    form.result === 'fail' 
                                                        ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 focus:border-rose-400' 
                                                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-indigo-400'
                                                }`}
                                            />
                                        </div>

                                        {/* Proof links Gallery */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                                <Link2 className="w-3.5 h-3.5" /> File Minh Chứng (Hình ảnh / Báo cáo)
                                            </label>
                                            
                                            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                                                {/* Upload button */}
                                                <div className="mb-3">
                                                    <label className={`flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer'}`}>
                                                        {isUploading ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</>
                                                        ) : (
                                                            <><Upload className="w-4 h-4" /> Chọn file tải lên</>
                                                        )}
                                                        <input 
                                                            type="file" 
                                                            multiple 
                                                            className="hidden" 
                                                            onChange={handleUpload}
                                                            disabled={isUploading}
                                                            accept="image/*,video/*,application/pdf"
                                                        />
                                                    </label>
                                                </div>

                                                {/* Gallery view */}
                                                {(proofLinksList.length > 0 || pendingFiles.length > 0) ? (
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                        {/* Existing uploaded files */}
                                                        {proofLinksList.map((link, idx) => {
                                                            const isImage = link.match(/\.(jpeg|jpg|gif|png|webp)/i) != null || link.includes('drive.google.com/uc?');
                                                            return (
                                                                <div key={`link-${idx}`} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 aspect-square flex items-center justify-center">
                                                                    {isImage ? (
                                                                        <img src={link} alt="proof" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="flex flex-col items-center gap-1 p-2">
                                                                            <FileText className="w-6 h-6 text-slate-400" />
                                                                            <span className="text-[9px] text-slate-500 truncate w-full text-center" title={link}>File</span>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Overlay actions */}
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                        <a href={link} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md text-white transition-colors" title="Xem chi tiết">
                                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                                        </a>
                                                                        <button onClick={() => removeLink(idx)} className="p-1.5 bg-rose-500/80 hover:bg-rose-500 rounded-md text-white transition-colors" title="Xóa">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Pending files */}
                                                        {pendingFiles.map((file, idx) => (
                                                            <div key={`pending-${idx}`} className="relative group rounded-lg overflow-hidden border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 aspect-square flex items-center justify-center">
                                                                <div className="flex flex-col items-center gap-1 p-2">
                                                                    <FileText className="w-6 h-6 text-amber-500" />
                                                                    <span className="text-[9px] text-amber-600 truncate w-full text-center" title={file.name}>{file.name}</span>
                                                                    <span className="text-[8px] bg-amber-200 text-amber-800 px-1 rounded font-bold uppercase mt-1">Chờ tải lên</span>
                                                                </div>
                                                                
                                                                {/* Overlay actions */}
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                    <button onClick={() => removePendingFile(idx)} className="p-1.5 bg-rose-500/80 hover:bg-rose-500 rounded-md text-white transition-colors" title="Bỏ chọn">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-center text-slate-400 italic py-4">Chưa có ảnh minh chứng</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg ${PHASE_COLORS[activePhase] || 'bg-slate-100 text-slate-600'}`}>
                        Giai đoạn: {activePhase}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition-colors cursor-pointer">
                            Đóng
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            {isSaving ? <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" /> : <Save className="w-3.5 h-3.5" />}
                            {isSaving ? 'Đang lưu...' : 'Lưu tiến độ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
