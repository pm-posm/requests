const fs = require('fs');

// Patch 1: StoreItemsList.tsx - use dynamic status calculation
let storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

const oldStatusDef = 'const currentStatus = item.survey_data?.current_status || "Chờ làm";';
const newStatusDef = `const currentPhase = item.survey_data?.current_phase || "";
                                const phaseData = currentPhase === 'Khảo sát' ? item.survey_data : currentPhase === 'Lắp đặt' ? item.installation_data : currentPhase === 'NTXX' ? item.ntxx_data : item.survey_data;
                                const { status: currentStatus, isLate } = computePhaseStatus(phaseData);`;

if (storeContent.includes(oldStatusDef)) {
    storeContent = storeContent.replace('const currentPhase = item.survey_data?.current_phase || "";\n                                const currentStatus = item.survey_data?.current_status || "Chờ làm";', newStatusDef);
    storeContent = storeContent.replace('const currentStatus = item.survey_data?.current_status || "Chờ làm";', newStatusDef);
}

// Also update the UI to show Red if isLate
const oldStatusUi = `const currentStatus, isLate } = computePhaseStatus(phaseData);`; // this is just a comment, let's find the exact string
storeContent = storeContent.replace(
    /currentStatus === "Đang làm" \? "bg-blue-100 text-blue-700 dark:bg-blue-900\/40 dark:text-blue-400"/g,
    'currentStatus === "Đang làm" && isLate ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"'
);

// We should append (Trễ hạn) if isLate
storeContent = storeContent.replace(
    '{currentStatus}',
    '{currentStatus}{currentStatus === "Đang làm" && isLate ? " (Trễ)" : ""}'
);

fs.writeFileSync(storePath, storeContent);
console.log('Successfully patched StoreItemsList.tsx for dynamic status');


// Patch 2: PhaseActionDrawer.tsx - Add Date Inputs and Retry logic
let drawerPath = 'src/components/Dashboard/PhaseActionDrawer.tsx';
let drawerContent = fs.readFileSync(drawerPath, 'utf8');

// We need to rewrite a large chunk of PhaseActionDrawer.tsx, it's better to just rewrite the whole file 
// via a script since we add many fields.
const newDrawerCode = `import React from 'react';
import { X, Save, Upload, CheckCircle2, XCircle, AlertCircle, Clock, Calendar } from 'lucide-react';
import type { StoreItem } from '../../types';

interface PhaseActionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    item: StoreItem | null;
    currentPhase: string;
    onSave: (phase: string, data: any) => Promise<void>;
}

export function PhaseActionDrawer({ isOpen, onClose, item, currentPhase, onSave }: PhaseActionDrawerProps) {
    const [isSaving, setIsSaving] = React.useState(false);
    
    // Planning state
    const [expectedStart, setExpectedStart] = React.useState('');
    const [expectedEnd, setExpectedEnd] = React.useState('');
    
    // Execution state
    const [actualDate, setActualDate] = React.useState('');
    const [statusResult, setStatusResult] = React.useState<'pass' | 'fail' | ''>('');
    const [proofLinks, setProofLinks] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [visTech, setVisTech] = React.useState('');

    // Retry state
    const [retryExpectedStart, setRetryExpectedStart] = React.useState('');
    const [retryExpectedEnd, setRetryExpectedEnd] = React.useState('');

    React.useEffect(() => {
        if (isOpen && item) {
            const phaseData = currentPhase === 'Khảo sát' ? item.survey_data : 
                              currentPhase === 'Lắp đặt' ? item.installation_data : 
                              currentPhase === 'NTXX' ? item.ntxx_data : {};
            
            setExpectedStart(phaseData?.expected_start || '');
            setExpectedEnd(phaseData?.expected_end || '');
            setActualDate(phaseData?.actual_date || '');
            setStatusResult(phaseData?.result || '');
            setProofLinks(phaseData?.proof_links?.join('\\n') || '');
            setNotes(phaseData?.notes || '');
            setVisTech(item.vis_tech || ''); // Use native vis_tech from item
            setRetryExpectedStart('');
            setRetryExpectedEnd('');
        }
    }, [isOpen, item, currentPhase]);

    if (!isOpen || !item) return null;

    const handleSave = async () => {
        // Validation for Planning
        if (!expectedStart || !expectedEnd) {
            alert('Vui lòng nhập Ngày dự kiến (Từ ngày - Đến ngày) để kích hoạt trạng thái!');
            return;
        }

        // Validation for Execution (only if they try to set Pass/Fail)
        if (statusResult) {
            if (!actualDate) { alert('Vui lòng nhập Ngày thực hiện!'); return; }
            if (statusResult === 'fail' && !notes.trim()) { alert('Vui lòng nhập lý do lỗi!'); return; }
            if (!proofLinks.trim()) { alert('Vui lòng nhập link hình ảnh/file chứng minh!'); return; }
            if ((currentPhase === 'NTXX' || currentPhase === 'Lắp đặt') && !visTech) {
                alert('Vui lòng chọn Người thực hiện (Vis-Tech)!'); return;
            }
            if (statusResult === 'fail' && (!retryExpectedStart || !retryExpectedEnd)) {
                alert('Vì kết quả Không Đạt, vui lòng nhập khoản thời gian gia hạn LÀM LẠI!'); return;
            }
        }

        setIsSaving(true);
        try {
            const linksArray = proofLinks.trim() ? proofLinks.split('\\n').filter(l => l.trim().length > 0) : [];
            let errorCount = (item.survey_data?.error_count || 0);
            
            // If they failed, we apply the retry dates as the NEW expected dates
            const finalStart = (statusResult === 'fail' && retryExpectedStart) ? retryExpectedStart : expectedStart;
            const finalEnd = (statusResult === 'fail' && retryExpectedEnd) ? retryExpectedEnd : expectedEnd;
            
            if (statusResult === 'fail') {
                errorCount += 1;
            }

            const newData = {
                current_phase: currentPhase,
                expected_start: finalStart,
                expected_end: finalEnd,
                // Only save actual execution data if they provided a result. Otherwise clear it.
                actual_date: statusResult ? actualDate : null,
                result: statusResult || null,
                proof_links: statusResult ? linksArray : [],
                notes: notes,
                error_count: errorCount,
                updated_at: new Date().toISOString(),
                // we'll pass visTech separately to be saved in native column
                _vis_tech: visTech 
            };

            await onSave(currentPhase, newData);
            onClose();
        } catch (error) {
            alert('Có lỗi xảy ra khi lưu: ' + error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Cập nhật tiến độ: <span className="text-indigo-600 dark:text-indigo-400">{currentPhase || 'Chưa chọn'}</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{item.store_code} - {item.store_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-8">
                    {!currentPhase ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-xs">Vui lòng chọn Tiến độ ở bảng để cập nhật.</p>
                        </div>
                    ) : (
                        <>
                            {/* Khối 1: Planning */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kế hoạch Dự kiến</h4>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase">Từ ngày *</label>
                                        <input type="date" value={expectedStart} onChange={e => setExpectedStart(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase">Đến ngày *</label>
                                        <input type="date" value={expectedEnd} onChange={e => setExpectedEnd(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Khối 2: Execution */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kết quả Thực hiện</h4>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase">Ngày thực tế *</label>
                                        <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-500" />
                                    </div>
                                    {(currentPhase === 'NTXX' || currentPhase === 'Lắp đặt') && (
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase">Vis-Tech (Người làm) *</label>
                                            <input type="text" placeholder="Nhập tên..." value={visTech} onChange={e => setVisTech(e.target.value)} className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-indigo-500" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">Kết quả Nghiệm thu *</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => setStatusResult('pass')}
                                            className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all \${statusResult === 'pass' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}\`}
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Đạt
                                        </button>
                                        <button 
                                            onClick={() => setStatusResult('fail')}
                                            className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all \${statusResult === 'fail' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}\`}
                                        >
                                            <XCircle className="w-4 h-4" /> Không Đạt
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">Link File Chứng minh *</label>
                                    <textarea value={proofLinks} onChange={(e) => setProofLinks(e.target.value)} placeholder="Dán link Drive..." className="w-full h-20 text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none resize-none" />
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">Ghi chú {statusResult === 'fail' && <span className="text-rose-500">* (Bắt buộc vì Lỗi)</span>}</label>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lý do lỗi..." className={\`w-full h-20 text-sm p-3 bg-slate-50 border rounded-lg outline-none resize-none \${statusResult === 'fail' && !notes.trim() ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-500'}\`} />
                                </div>
                                
                                {/* Khối 3: Retry (Chỉ hiện khi Lỗi) */}
                                {statusResult === 'fail' && (
                                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in zoom-in-95">
                                        <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                                            <AlertCircle className="w-4 h-4" /> Cần làm lại: Gia hạn thời gian mới
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-rose-600 uppercase">Gia hạn Từ ngày *</label>
                                                <input type="date" value={retryExpectedStart} onChange={e => setRetryExpectedStart(e.target.value)} className="w-full text-sm p-2 bg-white border border-rose-200 rounded-lg outline-none focus:border-rose-500 text-rose-900" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-rose-600 uppercase">Đến ngày *</label>
                                                <input type="date" value={retryExpectedEnd} onChange={e => setRetryExpectedEnd(e.target.value)} className="w-full text-sm p-2 bg-white border border-rose-200 rounded-lg outline-none focus:border-rose-500 text-rose-900" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || !currentPhase}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                    >
                        {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Lưu & Cập nhật</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
`;

fs.writeFileSync(drawerPath, newDrawerCode);
console.log('Successfully patched PhaseActionDrawer.tsx');

// Patch 3: StoreItemsList.tsx to handle _vis_tech logic
let storeContent2 = fs.readFileSync(storePath, 'utf8');
const oldOnSave = `                        const oldData = drawerItem[fieldName as keyof typeof drawerItem] || {};
                        await updateFieldMutation.mutateAsync({ 
                            id: drawerItem.id, 
                            field: fieldName, 
                            value: { ...(typeof oldData === 'object' ? oldData : {}), ...data } 
                        });`;

const newOnSave = `                        const oldData = drawerItem[fieldName as keyof typeof drawerItem] || {};
                        const { _vis_tech, ...pureData } = data; // separate vis_tech
                        await updateFieldMutation.mutateAsync({ 
                            id: drawerItem.id, 
                            field: fieldName, 
                            value: { ...(typeof oldData === 'object' ? oldData : {}), ...pureData } 
                        });
                        
                        if (_vis_tech !== undefined && _vis_tech !== drawerItem.vis_tech) {
                             await updateFieldMutation.mutateAsync({
                                 id: drawerItem.id, field: 'vis_tech', value: _vis_tech
                             });
                        }
                        
                        // Log activity
                        await supabase.from('project_store_logs').insert({
                            final_project: drawerItem.final_project,
                            store_code: drawerItem.store_code,
                            store_name: drawerItem.store_name,
                            action: \`Cập nhật tiến độ: \${phase}\`,
                            details: pureData.result === 'pass' ? 'Nghiệm thu: Đạt' : pureData.result === 'fail' ? \`Nghiệm thu: Lỗi - \${pureData.notes}\` : \`Lên kế hoạch: \${pureData.expected_start} đến \${pureData.expected_end}\`
                        });`;

if (storeContent2.includes(oldOnSave)) {
    storeContent2 = storeContent2.replace(oldOnSave, newOnSave);
    fs.writeFileSync(storePath, storeContent2);
    console.log('Successfully added vis_tech and logs to StoreItemsList.tsx');
}
