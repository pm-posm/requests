function PhaseActionModal({ item, phaseName, rawData, onClose, onSave, onBulkSave, visTechs = [] }: { item: StoreItem, phaseName: string, rawData: any, onClose: () => void, onSave: (newData: any) => Promise<void>, onBulkSave?: (newData: any) => Promise<void>, visTechs?: any[] }) {
    const { data: fetchedVisTechs = [] } = useQuery<any[]>({
        queryKey: ['project_vis_techs'],
        queryFn: async () => {
            const { data } = await supabase.from('project_vis_techs').select('*').order('name', { ascending: true });
            return data || [];
        }
    });
    const actualVisTechs = visTechs.length > 0 ? visTechs : fetchedVisTechs;

    const data = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) || {};
    const isNew = !data.status || data.status === 'Cần hành động';
    const isPlanned = data.status === 'PLANNED' || data.status === 'ERROR';
    const isCompleted = data.status === 'COMPLETED_ON_TIME' || data.status === 'COMPLETED_LATE';
    
    // Form State
    const [startDate, setStartDate] = React.useState(data.planned_start_date || '');
    const [endDate, setEndDate] = React.useState(data.planned_end_date || '');
    const [actualDate, setActualDate] = React.useState('');
    const [result, setResult] = React.useState<'Đạt' | 'Không đạt' | ''>('');
    const [evidenceUrl, setEvidenceUrl] = React.useState('');
    const [assignee, setAssignee] = React.useState(data.assignee || '');
    const [notes, setNotes] = React.useState(data.notes || '');
    const [loading, setLoading] = React.useState(false);

    // If 'Không đạt', we need new planned dates for the next iteration
    const [newStartDate, setNewStartDate] = React.useState('');
    const [newEndDate, setNewEndDate] = React.useState('');

    const handleSavePlanForAll = async () => {
        if (!startDate || !endDate) return alert('Vui lòng nhập đầy đủ ngày dự kiến!');
        if (!onBulkSave) return;
        if (!confirm('Hành động này sẽ áp dụng lịch làm việc này cho TẤT CẢ cửa hàng trong dự án. Bạn có chắc chắn?')) return;
        setLoading(true);
        try {
            await onBulkSave({ ...data, status: 'PLANNED', planned_start_date: startDate, planned_end_date: endDate, error_count: data.error_count || 0, history: data.history || [] });
            onClose();
        } catch(e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    const handleSavePlan = async () => {
        if (!startDate || !endDate) return alert('Vui lòng nhập đầy đủ ngày dự kiến!');
        setLoading(true);
        try {
            await onSave({ ...data, status: 'PLANNED', planned_start_date: startDate, planned_end_date: endDate, error_count: data.error_count || 0, history: data.history || [] });
            onClose();
        } catch(e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    const performSaveResult = async (saveFn: (d: any) => Promise<void>) => {
        if (!actualDate || !result) return alert('Vui lòng nhập ngày thực tế và kết quả!');
        if (result === 'Đạt' && !evidenceUrl) return alert('Vui lòng cung cấp link hình ảnh/bằng chứng khi đạt!');
        if (result === 'Không đạt' && (!newStartDate || !newEndDate)) return alert('Vui lòng cung cấp lịch làm lại do không đạt!');

        setLoading(true);
        try {
            const historyItem = {
                iteration: (data.error_count || 0) + 1,
                planned_start: data.planned_start_date,
                planned_end: data.planned_end_date,
                actual_date: actualDate,
                result: result,
                evidence: evidenceUrl,
                created_at: new Date().toISOString()
            };

            let newData = { ...data };
            newData.history = [...(data.history || []), historyItem];
            newData.notes = notes;
            newData.assignee = assignee;

            if (result === 'Đạt') {
                const actual = new Date(actualDate);
                const plannedEnd = new Date(data.planned_end_date);
                actual.setHours(0,0,0,0); plannedEnd.setHours(23,59,59,999);
                newData.status = actual <= plannedEnd ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE';
                newData.actual_date = actualDate;
                newData.evidence = evidenceUrl;
            } else {
                newData.status = 'ERROR';
                newData.error_count = (data.error_count || 0) + 1;
                newData.planned_start_date = newStartDate;
                newData.planned_end_date = newEndDate;
            }

            await saveFn(newData);
            onClose();
        } catch(e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    const handleSaveResultForAll = async () => {
        if (!onBulkSave) return;
        if (!confirm('Hành động này sẽ áp dụng kết quả này cho TẤT CẢ cửa hàng trong dự án. Bạn có chắc chắn?')) return;
        await performSaveResult(onBulkSave);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-500" />
                            Hành động: {phaseName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mã CH: <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.store_code}</span> - {item.store_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* View 1: Cần hành động */}
                    {isNew && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> 1. Lên lịch dự kiến</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Từ ngày</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Đến ngày</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                {onBulkSave && (
                                    <button onClick={handleSavePlanForAll} disabled={loading} className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-200 transition-colors">
                                        Áp dụng cho TOÀN BỘ Cửa hàng
                                    </button>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={handleSavePlan} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm">
                                        {loading ? 'Đang lưu...' : 'Chốt lịch làm việc'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View 2: Cập nhật kết quả */}
                    {isPlanned && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> 2. Cập nhật Thực tế & Kết quả</h4>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ngày thực hiện thực tế *</label>
                                            <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Đánh giá *</label>
                                            <select value={result} onChange={e => setResult(e.target.value as any)} className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500">
                                                <option value="">-- Chọn --</option>
                                                <option value="Đạt">Đạt</option>
                                                <option value="Không đạt">Không đạt</option>
                                            </select>
                                        </div>
                                    </div>

                                    {result === 'Đạt' && (
                                        <div className="animate-in fade-in zoom-in-95 duration-200">
                                            <label className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Link Bằng chứng / Hình ảnh (Bắt buộc) *</label>
                                            <input type="url" placeholder="https://drive.google.com/..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className="w-full text-sm p-2 border border-emerald-300 dark:border-emerald-700 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20 outline-none focus:ring-1 focus:ring-emerald-500" />
                                        </div>
                                    )}

                                    {result === 'Không đạt' && (
                                        <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                                            <h5 className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Vòng lặp lỗi: Hẹn lịch làm lại</h5>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-rose-600/80 mb-1">Bắt đầu lại (Dự kiến)</label>
                                                    <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="w-full text-sm p-2 border rounded-lg border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-rose-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-rose-600/80 mb-1">Kết thúc lại (Dự kiến)</label>
                                                    <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="w-full text-sm p-2 border rounded-lg border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-rose-500" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Người thực hiện</label>
                                            <select 
                                                value={assignee} 
                                                onChange={e => setAssignee(e.target.value)} 
                                                disabled={!!data.assignee} 
                                                className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 disabled:font-bold"
                                            >
                                                <option value="">-- Chọn --</option>
                                                {actualVisTechs.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ghi chú / Đánh giá</label>
                                            <input 
                                                type="text" 
                                                value={notes} 
                                                onChange={e => setNotes(e.target.value)} 
                                                placeholder="Nhập ghi chú (nếu có)..."
                                                className="w-full text-sm p-2 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                {onBulkSave && (
                                    <button onClick={handleSaveResultForAll} disabled={loading} className="text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-200 transition-colors">
                                        Áp dụng cho TOÀN BỘ Cửa hàng
                                    </button>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => performSaveResult(onSave)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm">
                                        {loading ? 'Đang lưu...' : 'Cập nhật Kết quả'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View 3: Hoàn thành */}
                    {isCompleted && (
                        <div className="space-y-4">
                            <div className="py-8 px-6 text-center text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 opacity-10">
                                    <CheckCircle2 className="w-40 h-40" />
                                </div>
                                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-90 drop-shadow-sm" />
                                <h4 className="font-bold text-xl mb-1">Đã nghiệm thu thành công!</h4>
                                <p className="text-sm font-medium text-emerald-600/80 mb-6">Trạng thái: <span className="font-bold">{data.status === 'COMPLETED_ON_TIME' ? 'Đúng hạn' : 'Trễ hạn'}</span></p>

                                <div className="grid grid-cols-2 gap-4 text-left bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người thực hiện</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                            <User className="w-4 h-4 text-indigo-500" />
                                            {data.assignee || 'Chưa cập nhật'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian hoàn thành</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                            <Calendar className="w-4 h-4 text-emerald-500" />
                                            {data.actual_date}
                                        </p>
                                    </div>
                                    <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bằng chứng / Hình ảnh</p>
                                        {data.evidence ? (
                                            <a href={data.evidence} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                                                <ExternalLink className="w-3.5 h-3.5" /> Xem đính kèm
                                            </a>
                                        ) : (
                                            <span className="text-sm text-slate-500 italic">Không có bằng chứng</span>
                                        )}
                                    </div>
                                    {data.notes && (
                                        <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                                                "{data.notes}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lịch sử */}
                    {data.history && data.history.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><History className="w-4 h-4" /> Lịch sử thực hiện</h4>
                            <div className="space-y-2">
                                {data.history.map((h: any, i: number) => (
                                    <div key={i} className="text-xs p-3 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 px-2 py-1 rounded-lg text-[10px] border border-slate-200 dark:border-slate-600 shadow-sm">Lần {h.iteration}</span> 
                                            <div>
                                                <p className="font-medium text-slate-600 dark:text-slate-400">Ngày thực tế: <span className="font-bold text-slate-800 dark:text-slate-200">{h.actual_date}</span></p>
                                                {h.evidence && (
                                                    <a href={h.evidence} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-indigo-500 hover:underline mt-0.5 inline-flex items-center gap-1">
                                                        <ExternalLink className="w-3 h-3" /> Xem Bằng chứng
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`font-bold px-3 py-1 rounded-lg border ${h.result === 'Đạt' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50'}`}>
                                            {h.result}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

