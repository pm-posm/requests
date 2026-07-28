import React, { useState } from 'react';
import { CheckSquare, X, CheckCircle2, Layers, Tag, Building2, Clock, Loader2, Sparkles } from 'lucide-react';
import { PHUONG_AN_OPTIONS } from '@/hooks/useWorkflowEngine';
import toast from 'react-hot-toast';

interface BulkActionBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onBulkUpdate: (updates: { phuong_an?: string; status?: string; tien_do?: string; supplier?: string }) => Promise<void>;
    statusOptions: string[];
    progressOptions: string[];
    isAdmin: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount,
    onClearSelection,
    onBulkUpdate,
    statusOptions,
    progressOptions,
    isAdmin
}) => {
    const [selectedPhuongAn, setSelectedPhuongAn] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedProgress, setSelectedProgress] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [isApplying, setIsApplying] = useState(false);

    if (selectedCount === 0) return null;

    const handleApplyUpdates = async () => {
        if (!isAdmin) {
            toast.error('🔒 Quyền bị từ chối: Vui lòng đăng nhập Admin để thực hiện thao tác hàng loạt!');
            return;
        }

        const updates: { phuong_an?: string; status?: string; tien_do?: string; supplier?: string } = {};
        if (selectedPhuongAn) updates.phuong_an = selectedPhuongAn;
        if (selectedStatus) updates.status = selectedStatus;
        if (selectedProgress) updates.tien_do = selectedProgress;
        if (selectedSupplier.trim()) updates.supplier = selectedSupplier.trim();

        if (Object.keys(updates).length === 0) {
            toast.error('Vui lòng chọn ít nhất một giá trị cần cập nhật hàng loạt.');
            return;
        }

        setIsApplying(true);
        try {
            await onBulkUpdate(updates);
            toast.success(`🎉 Đã cập nhật thành công ${selectedCount} yêu cầu POSM!`);
            setSelectedPhuongAn('');
            setSelectedStatus('');
            setSelectedProgress('');
            setSelectedSupplier('');
            onClearSelection();
        } catch (err: any) {
            console.error(err);
            toast.error(`Thất bại khi cập nhật hàng loạt: ${err.message || 'Lỗi hệ thống'}`);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 animate-in slide-in-from-bottom duration-300">
            <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
                {/* Left Counter */}
                <div className="flex items-center gap-2.5 pl-2">
                    <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
                        <CheckSquare className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>Đã chọn <span className="text-sky-400 font-mono text-sm font-bold">{selectedCount}</span> yêu cầu</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Chọn giá trị bên phải để áp dụng đồng thời</p>
                    </div>
                    <button
                        onClick={onClearSelection}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                        title="Bỏ chọn tất cả"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Bulk Select Options */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Select Phuong An */}
                    <div className="relative">
                        <select
                            value={selectedPhuongAn}
                            onChange={(e) => setSelectedPhuongAn(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer max-w-[140px]"
                        >
                            <option value="">-- Phương Án --</option>
                            {PHUONG_AN_OPTIONS.map((pa) => (
                                <option key={pa} value={pa}>{pa}</option>
                            ))}
                        </select>
                    </div>

                    {/* Select Status */}
                    <div className="relative">
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer max-w-[140px]"
                        >
                            <option value="">-- Trạng Thái --</option>
                            {statusOptions.map((st) => (
                                <option key={st} value={st}>{st}</option>
                            ))}
                        </select>
                    </div>

                    {/* Select Tien Do */}
                    <div className="relative">
                        <select
                            value={selectedProgress}
                            onChange={(e) => setSelectedProgress(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-200 outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer max-w-[140px]"
                        >
                            <option value="">-- Tiến Độ --</option>
                            {progressOptions.map((pr) => (
                                <option key={pr} value={pr}>{pr}</option>
                            ))}
                        </select>
                    </div>

                    {/* Execute Button */}
                    <button
                        onClick={handleApplyUpdates}
                        disabled={isApplying || !isAdmin}
                        title={!isAdmin ? 'Cần quyền Admin để cập nhật hàng loạt' : ''}
                        className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all ${
                            !isAdmin
                                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white cursor-pointer hover:shadow-sky-500/20 active:scale-95'
                        }`}
                    >
                        {isApplying ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang áp dụng...
                            </>
                        ) : !isAdmin ? (
                            <>🔒 Cần Admin</>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                Áp Dụng ({selectedCount})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
