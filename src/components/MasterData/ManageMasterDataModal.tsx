import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ExternalLink, Mail, Folder, AlertCircle, CheckCircle2, HelpCircle, Layers, Check, ChevronDown, ChevronUp, User, Calendar, Clock, FileText, Trash2, FileSpreadsheet, X, Move, Settings, ArrowLeft, ArrowRight, Lock, Unlock, History as HistoryIcon } from 'lucide-react';
import type { StoreItem, ProjectGroup } from '@/types';
import { computePhaseStatus } from '@/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function ManageMasterDataModal({ 
    isOpen, 
    onClose, 
    suppliers, 
    visTechs, 
    onAddSupplier, 
    onDeleteSupplier, 
    onAddVisTech, 
    onDeleteVisTech 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    suppliers: any[]; 
    visTechs: any[]; 
    onAddSupplier: (name: string) => void;
    onDeleteSupplier: (id: string) => void;
    onAddVisTech: (name: string) => void;
    onDeleteVisTech: (id: string) => void;
}) {
    const [activeSubTab, setActiveSubTab] = React.useState<'suppliers' | 'techs'>('suppliers');
    const [newName, setNewName] = React.useState('');
    const [confirmDelete, setConfirmDelete] = useState<{type: 'supplier' | 'vistech', id: string, name: string} | null>(null);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return;
        
        if (activeSubTab === 'suppliers') {
            onAddSupplier(trimmed);
        } else {
            onAddVisTech(trimmed);
        }
        setNewName('');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-indigo-500 animate-spin-slow" />
                        Cài đặt Danh mục hệ thống
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-2 shrink-0">
                    <button
                        onClick={() => { setActiveSubTab('suppliers'); setNewName(''); }}
                        className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
                            activeSubTab === 'suppliers' 
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                                : 'border-transparent text-slate-450 hover:text-slate-650'
                        }`}
                    >
                        Nhà thầu ({suppliers.length})
                    </button>
                    <button
                        onClick={() => { setActiveSubTab('techs'); setNewName(''); }}
                        className={`py-2 px-4 text-xs font-bold transition-all border-b-2 ${
                            activeSubTab === 'techs' 
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                                : 'border-transparent text-slate-455 hover:text-slate-650'
                        }`}
                    >
                        Kỹ thuật viên VIS-TECH ({visTechs.length})
                    </button>
                </div>

                {/* Form & List */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4 flex flex-col min-h-0">
                    <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={activeSubTab === 'suppliers' ? "Nhập tên nhà thầu mới..." : "Nhập tên nhân sự mới..."}
                            className="flex-1 text-xs p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                        >
                            Thêm
                        </button>
                    </form>

                    <div className="flex-1 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-850/80 rounded-xl p-2 bg-slate-50/20 dark:bg-slate-950/10 min-h-[220px]">
                        {activeSubTab === 'suppliers' ? (
                            suppliers.length === 0 ? (
                                <div className="text-center py-12 text-[10px] text-slate-400 italic">Chưa có nhà thầu nào</div>
                            ) : (
                                suppliers.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-3xs">
                                        <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold">{s.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete({ type: 'supplier', id: s.id, name: s.name })}
                                            className="text-slate-400 hover:text-rose-500 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )
                        ) : (
                            visTechs.length === 0 ? (
                                <div className="text-center py-12 text-[10px] text-slate-400 italic">Chưa có nhân sự nào</div>
                            ) : (
                                visTechs.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-3xs">
                                        <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold">{t.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete({ type: 'vistech', id: t.id, name: t.name })}
                                            className="text-slate-400 hover:text-rose-500 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>

                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            <ConfirmDialog 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (confirmDelete?.type === 'supplier') onDeleteSupplier(confirmDelete.id);
                    if (confirmDelete?.type === 'vistech') onDeleteVisTech(confirmDelete.id);
                }}
                title={`Xác nhận xóa ${confirmDelete?.type === 'supplier' ? 'nhà thầu' : 'nhân sự'}`}
                description={`Bạn có chắc chắn muốn xóa "${confirmDelete?.name}" không? Hành động này không thể hoàn tác.`}
                confirmText="Xóa"
                isDestructive={true}
            />
        </div>
    );
}

/**
 * Hiển thị danh sách cửa hàng kèm theo cập nhật tiến độ trực tiếp
 */
const getSLAStatus = (expectedStr?: string, recordedStr?: string, status?: string) => {
    if (!expectedStr) return null;
    const expected = new Date(expectedStr);
    expected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isDone = status === 'Hoàn tất' || status === 'Đạt';
    
    if (!isDone) {
        if (expected < today) {
            return { 
                label: 'Trễ hạn', 
                color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400' 
            };
        }
    } else if (recordedStr) {
        const recorded = new Date(recordedStr);
        recorded.setHours(0, 0, 0, 0);
        if (recorded > expected) {
            return { 
                label: 'Hoàn tất trễ', 
                color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400' 
            };
        }
    }
    return null;
};

