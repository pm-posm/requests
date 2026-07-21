import { createPortal } from 'react-dom';
import React from 'react';
import { X, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import type { StoreItem } from '../../types';

interface ModernPhaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: StoreItem | null; // null means bulk mode
    currentPhase: string;
    onSave: (phase: string, data: any) => Promise<void>;
}

export function ModernPhaseModal({ isOpen, onClose, item, currentPhase: initialPhase, onSave }: ModernPhaseModalProps) {
    const [phase, setPhase] = React.useState(initialPhase || 'Khảo sát');
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [expectedStart, setExpectedStart] = React.useState('');
    const [expectedEnd, setExpectedEnd] = React.useState('');
    const [actualDate, setActualDate] = React.useState('');
    const [statusResult, setStatusResult] = React.useState<'pass' | 'fail' | ''>('');
    const [proofLinks, setProofLinks] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [visTech, setVisTech] = React.useState('');

    React.useEffect(() => {
        if (isOpen && item) {
            setPhase(initialPhase);
            const phaseData = initialPhase === 'Khảo sát' ? item.survey_data : 
                              initialPhase === 'Lắp đặt' ? item.installation_data : 
                              initialPhase === 'NTXX' ? item.ntxx_data : {};
            
            setExpectedStart(phaseData?.expected_start || '');
            setExpectedEnd(phaseData?.expected_end || '');
            setActualDate(phaseData?.actual_date || '');
            setStatusResult(phaseData?.result || '');
            setProofLinks(phaseData?.proof_links?.join('\n') || '');
            setNotes(phaseData?.notes || '');
            setVisTech(item.vis_tech || '');
        } else if (isOpen && !item) {
            setPhase(initialPhase || 'Khảo sát');
            setExpectedStart(''); setExpectedEnd(''); setActualDate(''); setStatusResult(''); setProofLinks(''); setNotes(''); setVisTech('');
        }
    }, [isOpen, item, initialPhase]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const linksArray = proofLinks.trim() ? proofLinks.split('\n').filter(l => l.trim().length > 0) : [];
            let errorCount = (item?.survey_data?.error_count || 0);
            if (statusResult === 'fail') errorCount += 1;

            const newData = {
                current_phase: phase,
                expected_start: expectedStart || null,
                expected_end: expectedEnd || null,
                actual_date: actualDate || null,
                result: statusResult || null,
                proof_links: linksArray,
                notes: notes,
                error_count: errorCount,
                updated_at: new Date().toISOString(),
                _vis_tech: visTech || undefined
            };

            await onSave(phase, newData);
        } catch (error) {
            alert('Lỗi: ' + error);
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-indigo-600" />
                            {item ? 'Cập nhật tiến độ: ' + phase : 'Cập nhật hàng loạt (Tất cả Stores)'}
                        </h3>
                        {item && <p className="text-xs text-slate-500 mt-1 font-mono">{item.store_code} - {item.store_name}</p>}
                        {!item && <p className="text-xs text-indigo-600 font-semibold mt-1">Hành động này sẽ thay đổi đồng loạt các stores đang hiển thị.</p>}
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[75vh] space-y-6">
                    {!item && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Chọn Giai đoạn cập nhật *</label>
                            <select value={phase} onChange={e => setPhase(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold">
                                <option value="Brief">Brief</option>
                                <option value="Khảo sát">Khảo sát</option>
                                <option value="NTXX">NTXX</option>
                                <option value="Lắp đặt">Lắp đặt</option>
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Kế hoạch: Từ ngày</label>
                            <input type="date" value={expectedStart} onChange={e => setExpectedStart(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Kế hoạch: Đến ngày</label>
                            <input type="date" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Ngày thực tế</label>
                            <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Vis-Tech (Người làm)</label>
                            <input type="text" placeholder="Nhập tên..." value={visTech} onChange={e => setVisTech(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Kết quả</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setStatusResult('pass')} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${statusResult === 'pass' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                <CheckCircle2 className="w-4 h-4" /> Đạt
                            </button>
                            <button onClick={() => setStatusResult('fail')} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all ${statusResult === 'fail' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                <XCircle className="w-4 h-4" /> Lỗi / Không Đạt
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Link File Chứng minh</label>
                        <textarea value={proofLinks} onChange={e => setProofLinks(e.target.value)} placeholder="Dán link Drive..." className="w-full h-20 text-sm p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none resize-none" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Ghi chú</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Chi tiết..." className="w-full h-20 text-sm p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none resize-none" />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                        Hủy
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {isSaving ? 'Đang lưu...' : 'Lưu & Cập nhật'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );}
