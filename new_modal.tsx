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
    
    // Normalize timeline events from old data structure
    const timelineEvents = React.useMemo(() => {
        let events = data.timeline_events || [];
        if (events.length === 0 && data.status) {
            // backward compatibility
            if (data.history) {
                data.history.forEach((h: any, i: number) => {
                    events.push({
                        id: `hist-${i}`,
                        type: h.result === 'Đạt' ? 'COMPLETED' : 'ERROR',
                        timestamp: h.created_at || new Date().toISOString(),
                        user: h.assignee || data.assignee || 'Hệ thống',
                        metadata: {
                            planned_start: h.planned_start,
                            planned_end: h.planned_end,
                            actual_date: h.actual_date,
                            evidence: h.evidence,
                            notes: h.notes || ''
                        }
                    });
                });
            }
            if (data.status === 'PLANNED') {
                events.push({
                    id: 'init-plan',
                    type: 'PLANNED',
                    timestamp: data.updated_at || new Date().toISOString(),
                    user: data.assignee || 'Hệ thống',
                    metadata: {
                        start: data.planned_start_date,
                        end: data.planned_end_date
                    }
                });
            } else if (data.status === 'COMPLETED_ON_TIME' || data.status === 'COMPLETED_LATE') {
                events.push({
                    id: 'init-comp',
                    type: 'COMPLETED',
                    timestamp: data.updated_at || new Date().toISOString(),
                    user: data.assignee || 'Hệ thống',
                    metadata: {
                        actual_date: data.actual_date,
                        evidence: data.evidence,
                        notes: data.notes || ''
                    }
                });
            }
        }
        return events.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [data]);

    const isCompleted = data.status === 'COMPLETED_ON_TIME' || data.status === 'COMPLETED_LATE';
    const lastEvent = timelineEvents[timelineEvents.length - 1];
    const needsPlanning = !lastEvent || lastEvent.type === 'ERROR' || lastEvent.type === 'COMPLETED';

    // Form State
    const [actionType, setActionType] = React.useState<'PLAN' | 'UPDATE' | 'EVALUATE'>(needsPlanning && !isCompleted ? 'PLAN' : 'UPDATE');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [actualDate, setActualDate] = React.useState('');
    const [result, setResult] = React.useState<'Đạt' | 'Không đạt' | ''>('');
    const [evidenceUrl, setEvidenceUrl] = React.useState('');
    const [assignee, setAssignee] = React.useState(data.assignee || '');
    const [notes, setNotes] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    // Initial effect to set default dates based on last plan
    React.useEffect(() => {
        if (!needsPlanning && lastEvent && (lastEvent.type === 'PLANNED' || lastEvent.type === 'UPDATE')) {
            // Find the last planned dates
            const planEvent = [...timelineEvents].reverse().find(e => e.type === 'PLANNED');
            if (planEvent) {
                setStartDate(planEvent.metadata?.start || '');
                setEndDate(planEvent.metadata?.end || '');
            }
        }
    }, [needsPlanning, lastEvent, timelineEvents]);

    const handleSaveTimelineEvent = async (isBulk: boolean = false) => {
        const saveFn = isBulk && onBulkSave ? onBulkSave : onSave;
        
        let newEvent: any = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
            timestamp: new Date().toISOString(),
            user: assignee || 'Hệ thống',
            metadata: { notes }
        };

        let newData = { ...data };

        if (actionType === 'PLAN') {
            if (!startDate || !endDate) return alert('Vui lòng nhập đầy đủ ngày dự kiến!');
            newEvent.type = 'PLANNED';
            newEvent.metadata.start = startDate;
            newEvent.metadata.end = endDate;
            
            newData.status = 'PLANNED';
            newData.planned_start_date = startDate;
            newData.planned_end_date = endDate;
            newData.assignee = assignee;
        } 
        else if (actionType === 'UPDATE') {
            if (!notes && !evidenceUrl) return alert('Vui lòng nhập ghi chú hoặc bằng chứng tiến độ!');
            newEvent.type = 'UPDATE';
            newEvent.metadata.evidence = evidenceUrl;
            
            newData.status = 'PLANNED';
            newData.assignee = assignee;
            newData.notes = notes;
            if (evidenceUrl) newData.evidence = evidenceUrl;
        }
        else if (actionType === 'EVALUATE') {
            if (!actualDate || !result) return alert('Vui lòng nhập ngày thực tế và kết quả!');
            if (result === 'Đạt' && !evidenceUrl) return alert('Vui lòng cung cấp link hình ảnh/bằng chứng khi đạt!');
            
            newEvent.type = result === 'Đạt' ? 'COMPLETED' : 'ERROR';
            newEvent.metadata.actual_date = actualDate;
            newEvent.metadata.evidence = evidenceUrl;
            
            newData.assignee = assignee;
            newData.notes = notes;
            
            if (result === 'Đạt') {
                const actual = new Date(actualDate);
                const plannedEnd = new Date(endDate || data.planned_end_date || new Date());
                actual.setHours(0,0,0,0); plannedEnd.setHours(23,59,59,999);
                newData.status = actual <= plannedEnd ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE';
                newData.actual_date = actualDate;
                newData.evidence = evidenceUrl;
            } else {
                newData.status = 'ERROR';
                newData.error_count = (data.error_count || 0) + 1;
            }
        }

        newData.timeline_events = [...timelineEvents, newEvent];

        setLoading(true);
        try {
            await saveFn(newData);
            onClose();
        } catch(e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    const renderEventIcon = (type: string) => {
        switch(type) {
            case 'PLANNED': return <Calendar className="w-4 h-4 text-blue-500" />;
            case 'UPDATE': return <FileText className="w-4 h-4 text-amber-500" />;
            case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'ERROR': return <AlertCircle className="w-4 h-4 text-rose-500" />;
            default: return <Clock className="w-4 h-4 text-slate-500" />;
        }
    };

    const renderEventLabel = (type: string) => {
        switch(type) {
            case 'PLANNED': return 'Lên lịch';
            case 'UPDATE': return 'Cập nhật tiến độ';
            case 'COMPLETED': return 'Nghiệm thu: Đạt';
            case 'ERROR': return 'Nghiệm thu: Không đạt';
            default: return 'Sự kiện';
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-500" />
                            Timeline Hành động: {phaseName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mã CH: <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.store_code}</span> - {item.store_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Left: Timeline History */}
                    <div className="md:w-1/2 p-6 overflow-y-auto border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 custom-scrollbar">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-1.5"><History className="w-4 h-4" /> Lịch sử hoạt động</h4>
                        
                        {timelineEvents.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm italic">
                                Chưa có hoạt động nào.
                            </div>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                                {timelineEvents.map((evt: any, i: number) => (
                                    <div key={evt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            {renderEventIcon(evt.type)}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{new Date(evt.timestamp).toLocaleDateString('vi-VN')} {new Date(evt.timestamp).toLocaleTimeString('vi-VN')}</span>
                                            </div>
                                            <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">{renderEventLabel(evt.type)}</h5>
                                            <p className="text-[10px] text-slate-500 font-medium mb-2 flex items-center gap-1"><User className="w-3 h-3" /> {evt.user}</p>
                                            
                                            {evt.metadata?.start && evt.metadata?.end && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-1.5 rounded mt-1 border border-slate-100 dark:border-slate-700">Dự kiến: <span className="font-bold">{evt.metadata.start}</span> đến <span className="font-bold">{evt.metadata.end}</span></p>
                                            )}
                                            {evt.metadata?.actual_date && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-1.5 rounded mt-1 border border-slate-100 dark:border-slate-700">Thực tế: <span className="font-bold">{evt.metadata.actual_date}</span></p>
                                            )}
                                            {evt.metadata?.notes && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-1 italic border border-amber-100 dark:border-amber-900/30">"{evt.metadata.notes}"</p>
                                            )}
                                            {evt.metadata?.evidence && (
                                                <a href={evt.metadata.evidence} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                    <ExternalLink className="w-3 h-3" /> Xem Bằng chứng
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Action Form */}
                    <div className="md:w-1/2 p-6 overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="flex-1">
                            {isCompleted ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-emerald-50 dark:border-emerald-900">
                                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                    </div>
                                    <h4 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">Đã nghiệm thu hoàn thành</h4>
                                    <p className="text-sm text-slate-500">Mọi thông tin lịch sử đã được ghi nhận trong Timeline.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-indigo-500" />
                                        Thực hiện Hành động mới
                                    </h4>

                                    {/* Action Selector */}
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setActionType('PLAN')}
                                            disabled={!needsPlanning}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${actionType === 'PLAN' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                        >
                                            Lên lịch
                                        </button>
                                        <button 
                                            onClick={() => setActionType('UPDATE')}
                                            disabled={needsPlanning}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${actionType === 'UPDATE' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                        >
                                            Cập nhật
                                        </button>
                                        <button 
                                            onClick={() => setActionType('EVALUATE')}
                                            disabled={needsPlanning}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${actionType === 'EVALUATE' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                        >
                                            Nghiệm thu
                                        </button>
                                    </div>

                                    {/* Common Assignee */}
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Người thực hiện *</label>
                                        <select 
                                            value={assignee} 
                                            onChange={e => setAssignee(e.target.value)} 
                                            className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white dark:bg-slate-900 transition-all"
                                        >
                                            <option value="">-- Chọn nhân sự --</option>
                                            {actualVisTechs.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Action Forms */}
                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        {actionType === 'PLAN' && (
                                            <div className="space-y-4">
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
                                        )}

                                        {actionType === 'UPDATE' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Link Bằng chứng / Hình ảnh</label>
                                                    <input type="url" placeholder="https://drive.google.com/..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nội dung cập nhật</label>
                                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="VD: Đã khảo sát xong mặt bằng, chờ chốt thiết kế..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all custom-scrollbar"></textarea>
                                                </div>
                                            </div>
                                        )}

                                        {actionType === 'EVALUATE' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ngày thực tế *</label>
                                                        <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Đánh giá *</label>
                                                        <select value={result} onChange={e => setResult(e.target.value as any)} className={`w-full text-sm p-2.5 border rounded-lg outline-none focus:ring-2 transition-all ${result === 'Đạt' ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700 focus:ring-emerald-500/20' : result === 'Không đạt' ? 'border-rose-500 bg-rose-50/30 text-rose-700 focus:ring-rose-500/20' : 'border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-500/20'}`}>
                                                            <option value="">-- Chọn --</option>
                                                            <option value="Đạt">Đạt</option>
                                                            <option value="Không đạt">Không đạt</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                
                                                {result === 'Đạt' && (
                                                    <div className="animate-in fade-in zoom-in-95 duration-200">
                                                        <label className="block text-[10px] uppercase font-bold text-emerald-600 mb-1">Link Bằng chứng (Bắt buộc) *</label>
                                                        <input type="url" placeholder="https://..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className="w-full text-sm p-2.5 border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Lý do / Ghi chú {result === 'Không đạt' ? '*' : ''}</label>
                                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Nhập ghi chú đánh giá..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all custom-scrollbar"></textarea>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        {!isCompleted && (
                            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                                {onBulkSave ? (
                                    <button onClick={() => handleSaveTimelineEvent(true)} disabled={loading} className="text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-colors">
                                        Áp dụng cho TOÀN BỘ Cửa hàng
                                    </button>
                                ) : <div />}
                                <button onClick={() => handleSaveTimelineEvent(false)} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Lưu sự kiện
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
