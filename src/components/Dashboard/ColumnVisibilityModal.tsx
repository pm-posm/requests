import React from 'react';
import { X, Eye, EyeOff, RotateCcw, Check } from 'lucide-react';

export interface ColumnDefinition {
    key: string;
    label: string;
    category?: string;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
    { key: 'request_id', label: 'Mã Subtask / Request ID' },
    { key: 'store_info', label: 'Cửa Hàng (Mã & Tên)' },
    { key: 'posm_info', label: 'POSM & Số Lượng' },
    { key: 'date_of_rq', label: 'Ngày Gửi Request' },
    { key: 'sr_info', label: 'SR Yêu Cầu & SĐT' },
    { key: 'phuong_an', label: 'Phương Án POSM' },
    { key: 'status', label: 'Trạng Thái Đăng Nhập' },
    { key: 'tien_do', label: 'Tiến Độ Thực Thi' },
    { key: 'category', label: 'Trạng Thái Nhóm (Kanban)' },
    { key: 'ma_du_an', label: 'Mã Dự Án (Master)' },
    { key: 'supplier', label: 'Nhà Thầu (Supplier)' },
    { key: 'deadline', label: 'Hạn Chót (Deadline SLA)' },
    { key: 'data_responser', label: 'Người Duyệt (SharePoint)' },
    { key: 'notes', label: 'Ghi Chú (SR / VIS / MER)' },
];

export const DEFAULT_VISIBLE_KEYS = ALL_COLUMNS.map(c => c.key);

interface ColumnVisibilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    visibleColumns: string[];
    onChangeVisibleColumns: (newVisibleKeys: string[]) => void;
}

export const ColumnVisibilityModal: React.FC<ColumnVisibilityModalProps> = ({
    isOpen,
    onClose,
    visibleColumns,
    onChangeVisibleColumns
}) => {
    if (!isOpen) return null;

    const toggleColumn = (key: string) => {
        if (visibleColumns.includes(key)) {
            // Keep at least 2 key columns visible
            if (visibleColumns.length <= 2) return;
            onChangeVisibleColumns(visibleColumns.filter(k => k !== key));
        } else {
            onChangeVisibleColumns([...visibleColumns, key]);
        }
    };

    const handleResetDefault = () => {
        onChangeVisibleColumns(DEFAULT_VISIBLE_KEYS);
    };

    const handleSelectAll = () => {
        onChangeVisibleColumns(DEFAULT_VISIBLE_KEYS);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                Tùy Chỉnh Cột Hiển Thị
                            </h3>
                            <p className="text-xs text-slate-500">
                                Ẩn/Hiện cột để tối ưu giao diện theo cá nhân
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Column List */}
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                        <span>Đang hiện <span className="font-bold text-sky-600">{visibleColumns.length}</span> / {ALL_COLUMNS.length} cột</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectAll}
                                className="text-sky-600 hover:underline font-semibold cursor-pointer"
                            >
                                Hiện tất cả
                            </button>
                            <span>•</span>
                            <button
                                onClick={handleResetDefault}
                                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw className="w-3 h-3" /> Mặc định
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {ALL_COLUMNS.map((col) => {
                            const isVisible = visibleColumns.includes(col.key);
                            return (
                                <button
                                    key={col.key}
                                    onClick={() => toggleColumn(col.key)}
                                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${
                                        isVisible
                                            ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        {isVisible ? (
                                            <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                                        ) : (
                                            <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                                        )}
                                        <span>{col.label}</span>
                                    </div>
                                    {isVisible && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                    >
                        Hoàn Tất
                    </button>
                </div>
            </div>
        </div>
    );
};
