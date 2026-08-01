import React, { useState } from 'react';
import { X, Save, Plus, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectGroup } from '@/types';

interface SplitViewModalProps {
    fileUrl: string;
    fileName: string;
    projectGroup: ProjectGroup;
    phaseType: string;
    onClose: () => void;
}

export function SplitViewModal({ fileUrl, fileName, projectGroup, phaseType, onClose }: SplitViewModalProps) {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    
    // Convert Drive view URL to preview URL for iframe
    const previewUrl = fileUrl.replace(/\/view.*$/, '/preview');
    
    const [stores, setStores] = useState([{ code: '', name: '' }]);

    const handleAddRow = () => {
        setStores([...stores, { code: '', name: '' }]);
    };

    const handleRowChange = (index: number, field: 'code' | 'name', value: string) => {
        const newStores = [...stores];
        newStores[index][field] = value;
        setStores(newStores);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index === stores.length - 1) {
                handleAddRow();
            }
        }
    };

    const handleSaveAll = async () => {
        const validStores = stores.filter(s => s.code.trim() !== '');
        if (validStores.length === 0) {
            toast.error("Vui lòng nhập ít nhất 1 cửa hàng!");
            return;
        }

        setIsSaving(true);
        try {
            const phaseStr = phaseType === 'SURVEY' ? 'Khảo sát' : phaseType === 'INSTALLATION' ? 'Lắp đặt' : phaseType === 'NTXX' ? 'NTXX' : 'Brief';
            
            // 1. Get or insert stores into project_store_items
            const storeItemsToInsert = validStores.map(s => ({
                final_project: projectGroup.final_project,
                store_code: s.code.trim(),
                store_name: s.name.trim() || 'Unknown Store'
            }));

            // Upsert stores based on final_project and store_code
            const { data: upsertedStores, error: upsertError } = await supabase
                .from('project_store_items')
                .upsert(storeItemsToInsert, { onConflict: 'final_project,store_code' })
                .select('id, store_code');

            if (upsertError) throw upsertError;

            // Create a map to quickly find the internal UUID of the store
            const storeIdMap = new Map(upsertedStores.map(s => [s.store_code, s.id]));

            // 2. Fetch existing phases to merge proof_links correctly
            const storeItemIds = validStores.map(s => storeIdMap.get(s.code.trim())).filter(Boolean) as string[];
            
            const { data: existingPhases, error: fetchPhaseError } = await supabase
                .from('project_store_phases')
                .select('*')
                .in('store_item_id', storeItemIds)
                .eq('phase', phaseStr);

            if (fetchPhaseError) throw fetchPhaseError;

            const existingPhaseMap = new Map(existingPhases?.map(p => [p.store_item_id, p]) || []);

            // 3. Upsert phases with status "Đạt" and new proof_link
            const phasesToUpsert = storeItemIds.map(storeId => {
                const existing = existingPhaseMap.get(storeId);
                const currentLinks = existing?.proof_links || [];
                const newLinks = currentLinks.includes(fileUrl) ? currentLinks : [...currentLinks, fileUrl];
                
                return {
                    store_item_id: storeId,
                    phase: phaseStr,
                    status: 'Đạt', // Mặc định báo cáo hoàn tất là Đạt
                    proof_links: newLinks,
                    is_active: true
                };
            });

            const { error: phaseError } = await supabase
                .from('project_store_phases')
                .upsert(phasesToUpsert, { onConflict: 'store_item_id,phase' });

            if (phaseError) throw phaseError;

            // Optional: Insert logs
            const logsToInsert = storeItemIds.map(storeId => ({
                store_item_id: storeId,
                action_type: 'PHASE_UPDATE',
                field_name: phaseStr,
                old_value: 'N/A',
                new_value: `KQ: pass, Files: 1`,
                created_by: 'SplitView User'
            }));

            await supabase.from('project_store_logs').insert(logsToInsert);

            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            queryClient.invalidateQueries({ queryKey: ['project_manual_files_phase'] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs_phase'] });
            
            toast.success(`Đã thêm thành công ${validStores.length} cửa hàng và gán file!`);
            onClose();
            
        } catch (err: any) {
            console.error(err);
            toast.error("Lỗi khi lưu dữ liệu: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Header (Absolute floating) */}
            <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/50 flex items-center justify-between px-6 z-10 border-b border-slate-700/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                        <Store className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-sm">Xử lý báo cáo thủ công</h2>
                        <p className="text-slate-400 text-xs truncate max-w-xl">{fileName}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex w-full h-full pt-14">
                {/* Left Side: Document Viewer (60%) */}
                <div className="flex-[6] bg-[#1a1b1e] border-r border-slate-700 h-full relative">
                    <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-none"
                        allow="autoplay"
                        title="Document Preview"
                    />
                </div>

                {/* Right Side: Data Entry Grid (40%) */}
                <div className="flex-[4] bg-white dark:bg-slate-900 flex flex-col h-full">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Bảng nhập liệu nhanh</h3>
                        <p className="text-xs text-slate-500 mt-1">Gõ Mã CH và Tên, bấm Enter để xuống dòng. Trạng thái mặc định là "Đạt".</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase pb-3 border-b border-slate-200 dark:border-slate-800 w-12 text-center">STT</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase pb-3 border-b border-slate-200 dark:border-slate-800 w-32">Mã CH *</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase pb-3 border-b border-slate-200 dark:border-slate-800 pl-3">Tên Siêu Thị</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.map((store, idx) => (
                                    <tr key={idx} className="group">
                                        <td className="py-2 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                                        <td className="py-2 pr-2">
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                                                placeholder="VD: BIG-01"
                                                value={store.code}
                                                onChange={(e) => handleRowChange(idx, 'code', e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, idx)}
                                                autoFocus={idx === stores.length - 1}
                                            />
                                        </td>
                                        <td className="py-2 pl-1">
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                                placeholder="Tên rút gọn..."
                                                value={store.name}
                                                onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, idx)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        <button 
                            onClick={handleAddRow}
                            className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline px-2 py-1"
                        >
                            <Plus className="w-4 h-4" /> Thêm dòng mới
                        </button>
                    </div>

                    <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0 flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? <span className="animate-spin text-lg leading-none">⟳</span> : <Save className="w-4 h-4" />}
                            {isSaving ? 'Đang lưu...' : 'Lưu tất cả'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
