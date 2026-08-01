import React from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Search, Check } from 'lucide-react';
import { useMasterStoreDirectory } from '@/hooks/useMasterStoreDirectory';
import { useDebounce } from '@/hooks/useDebounce';

interface AddStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (store: { store_code: string; store_name?: string; region?: string; customer?: string; ka?: string; sr?: string; category?: string }) => Promise<void>;
}

export function AddStoreModal({ isOpen, onClose, onSave }: AddStoreModalProps) {
    const [form, setForm] = React.useState({ store_code: '', store_name: '', region: '', customer: '', ka: '', sr: '', category: '' });
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const debouncedSearch = useDebounce(form.store_code, 300);
    const { data: suggestions = [], isFetching } = useMasterStoreDirectory(debouncedSearch);

    React.useEffect(() => {
        if (isOpen) {
            setForm({ store_code: '', store_name: '', region: '', customer: '', ka: '', sr: '', category: '' });
            setError('');
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.store_code.trim()) { setError('Mã Cửa Hàng là bắt buộc!'); return; }
        setIsSaving(true);
        setError('');
        try {
            await onSave({
                store_code: form.store_code.trim(),
                store_name: form.store_name.trim() || undefined,
                region: form.region.trim() || undefined,
                customer: form.customer.trim() || undefined,
                ka: form.ka.trim() || undefined,
                sr: form.sr.trim() || undefined,
                category: form.category.trim() || undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    const fields = [
        { key: 'store_code', label: 'Mã Cửa Hàng *', placeholder: 'VD: STR-LOT-00471', required: true },
        { key: 'store_name', label: 'Tên Cửa Hàng', placeholder: 'VD: Lotte Nha Trang' },
        { key: 'region', label: 'Region', placeholder: 'VD: Miền Nam' },
        { key: 'customer', label: 'Customer', placeholder: 'VD: Lotte' },
        { key: 'ka', label: 'KA', placeholder: 'VD: Nam KA' },
        { key: 'sr', label: 'SR', placeholder: 'VD: Nguyễn Văn A' },
        { key: 'category', label: 'Hạng mục', placeholder: 'VD: Topboard' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-slate-950 dark:to-slate-900">
                    <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white">Thêm Cửa Hàng Thủ Công</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Dữ liệu sẽ vào danh sách bản nháp</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-xl cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar">
                    {fields.map(f => (
                        <div key={f.key} className="relative">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                            <input
                                type="text"
                                value={(form as any)[f.key]}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, [f.key]: e.target.value }));
                                    if (f.key === 'store_code') setShowSuggestions(true);
                                }}
                                onFocus={() => f.key === 'store_code' && setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder={f.placeholder}
                                className={`w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-950 border ${f.required && error && !(form as any)[f.key] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-800'} rounded-xl outline-none focus:border-indigo-400 transition-colors`}
                            />
                            {f.key === 'store_code' && isFetching && (
                                <div className="absolute right-3 top-8">
                                    <span className="animate-spin w-4 h-4 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full inline-block" />
                                </div>
                            )}
                            {f.key === 'store_code' && showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                                    {suggestions.map(s => (
                                        <div 
                                            key={s.store_code} 
                                            className="px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col gap-0.5"
                                            onClick={() => {
                                                setForm(prev => ({
                                                    ...prev,
                                                    store_code: s.store_code,
                                                    store_name: s.store_name || prev.store_name,
                                                    region: s.region || prev.region,
                                                    customer: s.customer || prev.customer,
                                                    ka: s.ka || prev.ka,
                                                    sr: s.sr || prev.sr,
                                                }));
                                                setShowSuggestions(false);
                                            }}
                                        >
                                            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{s.store_code}</div>
                                            <div className="text-[11px] text-slate-600 dark:text-slate-400">{s.store_name} | {s.customer}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">Hủy</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                        {isSaving ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full inline-block" /> : <Save className="w-3.5 h-3.5" />}
                        Thêm Store
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
