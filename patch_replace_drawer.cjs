const fs = require('fs');

// 1. Create ModernPhaseModal.tsx
const modalCode = `import React from 'react';
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
            setProofLinks(phaseData?.proof_links?.join('\\n') || '');
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
            const linksArray = proofLinks.trim() ? proofLinks.split('\\n').filter(l => l.trim().length > 0) : [];
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
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
                            <button onClick={() => setStatusResult('pass')} className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all \${statusResult === 'pass' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}\`}>
                                <CheckCircle2 className="w-4 h-4" /> Đạt
                            </button>
                            <button onClick={() => setStatusResult('fail')} className={\`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all \${statusResult === 'fail' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}\`}>
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
        </div>
    );
}
`;

fs.writeFileSync('src/components/Dashboard/ModernPhaseModal.tsx', modalCode);

// 2. Patch StoreItemsList.tsx
const storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

// Replace import
storeContent = storeContent.replace("import { PhaseActionDrawer } from './PhaseActionDrawer';", "import { ModernPhaseModal } from './ModernPhaseModal';");

// Replace Header for Tiến độ
const oldPhaseHeader = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Tiến độ</span>
                                        <select onChange={(e) => { e.target.value && handleBulkPhase(e.target.value); e.target.value = ''; }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[90px] text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                            <option value="">-- Chọn loạt --</option>
                                            <option value="Brief">Brief</option>
                                            <option value="Khảo sát">Khảo sát</option>
                                            <option value="NTXX">NTXX</option>
                                            <option value="Lắp đặt">Lắp đặt</option>
                                        </select>
                                    </div>
                                </th>`;

const newPhaseHeader = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center w-full max-w-[90px]">
                                            <span>Tiến độ</span>
                                            <button 
                                                onClick={() => { setDrawerItem(null); setDrawerPhase('Khảo sát'); setDrawerOpen(true); }}
                                                className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                                title="Cập nhật loạt"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                        </div>
                                        <select onChange={(e) => { e.target.value && handleBulkPhase(e.target.value); e.target.value = ''; }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[90px] text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                            <option value="">-- Chọn loạt --</option>
                                            <option value="Brief">Brief</option>
                                            <option value="Khảo sát">Khảo sát</option>
                                            <option value="NTXX">NTXX</option>
                                            <option value="Lắp đặt">Lắp đặt</option>
                                        </select>
                                    </div>
                                </th>`;

if (storeContent.includes(oldPhaseHeader)) {
    storeContent = storeContent.replace(oldPhaseHeader, newPhaseHeader);
}

// Replace Drawer logic
const oldDrawerRender = `{drawerOpen && drawerItem && (
                <PhaseActionDrawer 
                    isOpen={drawerOpen}
                    onClose={() => { setDrawerOpen(false); setDrawerItem(null); }}
                    item={drawerItem}
                    currentPhase={drawerPhase}
                    onSave={async (phase, data) => {
                        // We use the generic updateFieldMutation but targeting the phase data
                        const fieldName = phase === 'Khảo sát' ? 'survey_data' : 
                                          phase === 'Lắp đặt' ? 'installation_data' : 
                                          phase === 'NTXX' ? 'ntxx_data' : 'survey_data';
                        
                        // Merge old data with new data
                        const oldData = drawerItem[fieldName as keyof typeof drawerItem] || {};
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
                        });
                        
                        // If it's survey_data, the current_phase and current_status are shared there in our hack
                        if (fieldName !== 'survey_data') {
                             // Also update survey_data to reflect the global status/phase
                             const oldSurveyData = drawerItem.survey_data || {};
                             await updateFieldMutation.mutateAsync({ 
                                 id: drawerItem.id, 
                                 field: 'survey_data', 
                                 value: { ...oldSurveyData, current_phase: phase, current_status: pureData.result === 'pass' ? 'COMPLETED_ON_TIME' : pureData.result === 'fail' ? 'ERROR' : 'IN_PROGRESS' } 
                             });
                        }
                    }}
                />
            )}`;

const newDrawerRender = `{drawerOpen && (
                <ModernPhaseModal 
                    isOpen={drawerOpen}
                    onClose={() => { setDrawerOpen(false); setDrawerItem(null); }}
                    item={drawerItem}
                    currentPhase={drawerPhase || 'Khảo sát'}
                    onSave={async (phase, data) => {
                        const isBulk = !drawerItem;
                        const targetItems = isBulk ? (storeItems || []) : [drawerItem];
                        
                        await Promise.all(targetItems.map(async (currentItem) => {
                            const fieldName = phase === 'Khảo sát' ? 'survey_data' : 
                                              phase === 'Lắp đặt' ? 'installation_data' : 
                                              phase === 'NTXX' ? 'ntxx_data' : 'survey_data';
                            
                            const oldData = currentItem[fieldName as keyof typeof currentItem] || {};
                            const { _vis_tech, ...pureData } = data;
                            
                            await updateFieldMutation.mutateAsync({ 
                                id: currentItem.id, 
                                field: fieldName, 
                                value: { ...(typeof oldData === 'object' ? oldData : {}), ...pureData, current_phase: phase } 
                            });
                            
                            if (_vis_tech !== undefined && _vis_tech !== currentItem.vis_tech) {
                                 await updateFieldMutation.mutateAsync({
                                     id: currentItem.id, field: 'vis_tech', value: _vis_tech
                                 });
                            }
                            
                            await supabase.from('project_store_logs').insert({
                                final_project: currentItem.final_project,
                                store_code: currentItem.store_code,
                                store_name: currentItem.store_name,
                                action: \`Cập nhật tiến độ: \${phase}\`,
                                details: pureData.result === 'pass' ? 'Nghiệm thu: Đạt' : pureData.result === 'fail' ? \`Nghiệm thu: Lỗi - \${pureData.notes}\` : 'Cập nhật'
                            });
                            
                            if (fieldName !== 'survey_data') {
                                 const oldSurveyData = currentItem.survey_data || {};
                                 await updateFieldMutation.mutateAsync({ 
                                     id: currentItem.id, 
                                     field: 'survey_data', 
                                     value: { ...oldSurveyData, current_phase: phase, current_status: pureData.result === 'pass' ? 'COMPLETED_ON_TIME' : pureData.result === 'fail' ? 'ERROR' : 'IN_PROGRESS' } 
                                 });
                            }
                        }));
                        
                        setDrawerOpen(false);
                        setDrawerItem(null);
                        queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
                    }}
                />
            )}`;

if (storeContent.includes(oldDrawerRender)) {
    storeContent = storeContent.replace(oldDrawerRender, newDrawerRender);
} else {
    // maybe spacing is different, let's use a regex replace
    storeContent = storeContent.replace(/\{drawerOpen && drawerItem && \([\s\S]*?<PhaseActionDrawer[\s\S]*?\/>\s*\)\}/, newDrawerRender);
}

fs.writeFileSync(storePath, storeContent);
console.log('Successfully created ModernPhaseModal and patched StoreItemsList.');
