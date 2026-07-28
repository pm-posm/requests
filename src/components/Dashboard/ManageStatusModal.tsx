import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Tag, Check, ChevronDown } from 'lucide-react';
import { useWorkflowEngine } from '@/hooks/useWorkflowEngine';
import type { RawRequestRecord } from '@/services/sheetSyncService';

interface ManageStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    requests?: RawRequestRecord[];
}

export function ManageStatusModal({ isOpen, onClose, requests = [] }: ManageStatusModalProps) {
    const { statuses, addStatus, deleteStatus } = useWorkflowEngine();
    
    // Inline new status inputs for each category
    const [addingCategory, setAddingCategory] = useState<string | null>(null);
    const [selectedDropdownValue, setSelectedDropdownValue] = useState('');
    const [customTextValue, setCustomTextValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Build Set of lowercased assigned status names for fast O(1) lookup
    const assignedStatusNames = useMemo(() => {
        const set = new Set<string>();
        statuses.forEach(s => {
            if (s.name?.trim()) set.add(s.name.trim().toLowerCase());
        });
        return set;
    }, [statuses]);

    // Extract 100% ALL unique real Tiến Độ & Status values from actual Google Sheet Source
    const dynamicSheetProgressList = useMemo(() => {
        const set = new Set<string>();

        // Standard presets
        set.add('Mới tiếp nhận');
        set.add('Vis - Đã gửi RQ tới Agency');
        set.add('Supplier đã gửi lịch');
        set.add('Supplier Bảo Hành');
        set.add('Supplier đã bảo hành');
        set.add('Mer quick fix');
        set.add('Tiếp nhận Quick Fix');
        set.add('Under CSP Review');
        set.add('Approved');
        set.add('Rejected');
        set.add('Not started');
        set.add('Hoàn Thành');
        set.add('Cancelled');

        // Dynamically add all unique values present in actual raw sheet requests!
        requests.forEach(r => {
            if (r.tien_do && r.tien_do.trim()) set.add(r.tien_do.trim());
            if (r.status && r.status.trim()) set.add(r.status.trim());
        });

        return Array.from(set).sort();
    }, [requests]);

    if (!isOpen) return null;

    const categories = [
        {
            id: 'to_do',
            title: '1. TO DO (Cần Xử Lý)',
            badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
            dotColor: '#94a3b8',
            description: 'Các tiến độ khi request mới tiếp nhận hoặc chờ Mer xử lý.'
        },
        {
            id: 'in_progress',
            title: '2. IN PROGRESS (Đang Xử Lý)',
            badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
            dotColor: '#3b82f6',
            description: 'Các tiến độ đang triển khai (Vis gửi mail, Supplier gửi lịch, Quick fix...).'
        },
        {
            id: 'review',
            title: '3. REVIEW / APPROVAL (Chờ Duyệt)',
            badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
            dotColor: '#f59e0b',
            description: 'Các tiến độ thuộc luồng review ngân sách từ CSP / KA.'
        },
        {
            id: 'done',
            title: '4. CLOSE / DONE (Đóng & Hoàn Thành)',
            badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            dotColor: '#10b981',
            description: 'Các tiến độ kết thúc (Hoàn thành, Hủy, Tuần tự động...)'
        }
    ];

    const handleOpenAddForm = (catId: string) => {
        setAddingCategory(catId);
        // Default to first available unassigned preset
        const firstAvailable = dynamicSheetProgressList.find(
            preset => !assignedStatusNames.has(preset.trim().toLowerCase())
        );
        setSelectedDropdownValue(firstAvailable || 'CUSTOM');
        setCustomTextValue('');
    };

    const handleAddStatus = async (categoryKey: 'to_do' | 'in_progress' | 'review' | 'done') => {
        const finalName = selectedDropdownValue === 'CUSTOM' ? customTextValue.trim() : selectedDropdownValue.trim();
        if (!finalName) return;

        if (assignedStatusNames.has(finalName.toLowerCase())) {
            alert(`Tiến độ "${finalName}" đã được gán vào hệ thống rồi! Hãy chọn tiến độ khác.`);
            return;
        }

        try {
            setIsSaving(true);
            const categoryObj = categories.find(c => c.id === categoryKey);
            await addStatus({
                name: finalName,
                category: categoryKey,
                phuong_an_scope: 'ALL',
                color: categoryObj?.dotColor || '#6366f1',
                order_index: statuses.length + 1
            });
            setSelectedDropdownValue('');
            setCustomTextValue('');
            setAddingCategory(null);
        } catch (err) {
            console.error(err);
            alert('Lỗi thêm tiến độ mới!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Bạn có chắc muốn xóa tiến độ "${name}" khỏi hệ thống?`)) {
            await deleteStatus(id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                Tùy Chỉnh Trạng Thái & Tiến Độ (Dynamic Workflow)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Chọn Tiến độ từ Google Sheet Source để gán vào các nhóm trạng thái. Mỗi tiến độ chỉ được gán 1 lần.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body: 4 Big Status Categories */}
                <div className="p-5 overflow-y-auto space-y-6 custom-scrollbar">
                    {categories.map(cat => {
                        const categoryStatuses = statuses.filter(s => s.category === cat.id);
                        const isAddingHere = addingCategory === cat.id;

                        return (
                            <div key={cat.id} className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                                {/* Category Header */}
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${cat.badgeColor}`}>
                                            {cat.title}
                                        </span>
                                        <span className="text-xs text-slate-400 font-semibold">
                                            ({categoryStatuses.length} tùy chọn)
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 pl-1">
                                    {cat.description}
                                </p>

                                {/* List of Status Options inside this category */}
                                <div className="space-y-2">
                                    {categoryStatuses.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                                            Chưa có tùy chọn tiến độ nào trong nhóm này
                                        </div>
                                    ) : (
                                        categoryStatuses.map(s => (
                                            <div 
                                                key={s.id} 
                                                className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                                                    <span className="font-bold text-xs text-slate-800 dark:text-white">
                                                        {s.name}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(s.id, s.name)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                                                    title="Xóa tùy chọn này khỏi Dropdown"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}

                                    {/* Add New Status Form using Dynamic Dropdown with Disabled/Grayed Out Items */}
                                    {isAddingHere ? (
                                        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-2 mt-2">
                                            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                                                Chọn Tiến độ từ Google Sheet Source để gán vào nhóm {cat.title}:
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={selectedDropdownValue}
                                                    onChange={e => setSelectedDropdownValue(e.target.value)}
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-white font-medium outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[420px] truncate"
                                                >
                                                    <option value="" disabled>-- Chọn Tiến độ từ Sheet Source --</option>
                                                    {dynamicSheetProgressList.map(preset => {
                                                        const isAssigned = assignedStatusNames.has(preset.trim().toLowerCase());
                                                        return (
                                                            <option 
                                                                key={preset} 
                                                                value={preset}
                                                                disabled={isAssigned}
                                                                className={isAssigned ? 'text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500 italic' : 'font-semibold text-slate-800 dark:text-white'}
                                                            >
                                                                {preset} {isAssigned ? ' ⛔ (Đã gán)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                    <option value="CUSTOM" className="font-bold text-indigo-600">✏️ [Nhập tên tùy chỉnh khác...]</option>
                                                </select>

                                                <button
                                                    onClick={() => handleAddStatus(cat.id as any)}
                                                    disabled={isSaving || !selectedDropdownValue || (selectedDropdownValue !== 'CUSTOM' && assignedStatusNames.has(selectedDropdownValue.toLowerCase())) || (selectedDropdownValue === 'CUSTOM' && !customTextValue.trim())}
                                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                                >
                                                    {isSaving ? 'Đang lưu...' : 'Thêm vào nhóm'}
                                                </button>
                                                <button
                                                    onClick={() => setAddingCategory(null)}
                                                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                                                >
                                                    Hủy
                                                </button>
                                            </div>

                                            {/* Custom Text input if CUSTOM selected */}
                                            {selectedDropdownValue === 'CUSTOM' && (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={customTextValue}
                                                    onChange={e => setCustomTextValue(e.target.value)}
                                                    placeholder="Tên tiến độ tùy chỉnh khác..."
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 mt-2"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleOpenAddForm(cat.id)}
                                            className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-center gap-1.5 transition-colors mt-2"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Thêm tiến độ từ Sheet Source vào nhóm này
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
