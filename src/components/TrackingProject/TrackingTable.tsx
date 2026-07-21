import React, { useState } from 'react';
import { Mail, Clock4, CheckCircle2, XCircle, Circle, Edit2, Check, X, Building, Info, MessageSquare, ChevronUp, ChevronDown, User, Clock, MoreVertical, Merge, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrackingTableProps {
    paginatedCombined: any[];
    expandedProjects: Set<string>;
    toggleExpand: (code: string) => void;
    editingCode: string | null;
    setEditingCode: (code: string | null) => void;
    editName: string;
    setEditName: (name: string) => void;
    handleSaveName: (code: string, newName: string) => void;
    setSelectedSub: (sub: any) => void;
    setPanelTab: (tab: any) => void;
    expandedThreads: Set<string>;
    toggleThread: (threadId: string) => void;
    editingSupplierRecordId: string | null;
    setEditingSupplierRecordId: (id: string | null) => void;
    editSupplierName: string;
    setEditSupplierName: (name: string) => void;
    handleSaveSupplier: (recordId: string, currentNtxxDetails: any, newSupplierName: string) => void;
    trackingCombined?: any[];
    handleMergeProject?: (sourceCode: string, targetCode: string, targetName: string) => void;
    handleDeleteProject?: (code: string) => void;
}

const ProgressBadge = ({ status, date, tooltip }: { status: string, date: string | null, tooltip?: string }) => {
    if (status === 'none') return <div className="flex justify-center" title="Chưa có"><Circle className="w-5 h-5 text-slate-200 dark:text-slate-700" /></div>;
    if (status === 'rejected') return <div className="flex flex-col items-center" title={tooltip}><XCircle className="w-5 h-5 text-rose-500" /><span className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{new Date(date!).toLocaleDateString('vi-VN')}</span></div>;
    if (status === 'in_progress' || status === 'review') return <div className="flex flex-col items-center" title={tooltip}><Clock4 className="w-5 h-5 text-amber-500" /><span className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{new Date(date!).toLocaleDateString('vi-VN')}</span></div>;
    if (status === 'confirmed' || status === 'completed') return <div className="flex flex-col items-center" title={tooltip}><CheckCircle2 className="w-5 h-5 text-emerald-500" /><span className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{new Date(date!).toLocaleDateString('vi-VN')}</span></div>;
    return null;
};

export function TrackingTable({
    paginatedCombined,
    expandedProjects,
    toggleExpand,
    editingCode,
    setEditingCode,
    editName,
    setEditName,
    handleSaveName,
    setSelectedSub,
    setPanelTab,
    expandedThreads,
    toggleThread,
    editingSupplierRecordId,
    setEditingSupplierRecordId,
    editSupplierName,
    setEditSupplierName,
    handleSaveSupplier,
    trackingCombined = [],
    handleMergeProject,
    handleDeleteProject
}: TrackingTableProps) {
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [projectToMerge, setProjectToMerge] = useState<{code: string, name: string} | null>(null);
    const [targetProjectCode, setTargetProjectCode] = useState('');
    const [isMenuOpenCode, setIsMenuOpenCode] = useState<string | null>(null);
    
    if (paginatedCombined.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">Không tìm thấy dự án nào</div>;
    }

    const renderThreadGroup = (groupName: string, threads: any[]) => {
        if (threads.length === 0) return null;
        const stageColors: Record<string, string> = {
            'Brief': 'border-blue-200 dark:border-blue-900',
            'Khảo Sát': 'border-purple-200 dark:border-purple-900',
            'NTXX': 'border-indigo-200 dark:border-indigo-900',
            'Lắp Đặt': 'border-amber-200 dark:border-amber-900',
            'Thu Hồi': 'border-rose-200 dark:border-rose-900'
        };
        const color = stageColors[groupName] || 'border-slate-200';

        return (
            <div className={`mb-8 border-l-2 ${color} pl-4 space-y-4 relative`}>
                <div className="absolute -left-2.5 -top-3 bg-white dark:bg-slate-900 px-1">
                    <Badge variant="outline" className="font-semibold uppercase tracking-wider text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {groupName} ({threads.reduce((acc, t) => acc + t.records.length, 0)} email)
                    </Badge>
                </div>
                <div className="pt-3 space-y-5">
                    {threads.map((thread: any, idx: number) => {
                        const isThreadExpanded = expandedThreads.has(thread.id);
                        return (
                            <div key={thread.id} className="relative">
                                <div className="absolute -left-[21px] top-4 w-4 h-[1px] bg-slate-300 dark:bg-slate-600"></div>
                                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="uppercase text-[10px] py-0 h-5 bg-white dark:bg-slate-800">
                                                {thread.latestStatus === 'ntxx' && thread.phaseIndex ? `PHASE ${thread.phaseIndex}` : thread.latestStatus.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(thread.originalTime).toLocaleString('vi-VN')}
                                                {idx === 0 && <span className="text-indigo-500 ml-1 font-medium">(Mới nhất)</span>}
                                            </span>
                                        </div>
                                        {(thread.records.length > 1 || thread.records.some((r: any) => r.ntxx_details)) && (
                                            <button 
                                                onClick={() => toggleThread(thread.id)}
                                                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded transition-colors"
                                            >
                                                {thread.records.length > 1 ? (
                                                    <><MessageSquare className="w-3.5 h-3.5" />{thread.records.length} phản hồi</>
                                                ) : (
                                                    <><Info className="w-3.5 h-3.5" />Chi tiết dữ liệu</>
                                                )}
                                                {isThreadExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="p-3">
                                        <div className="text-sm text-slate-800 dark:text-slate-200 font-medium mb-2 leading-snug">
                                            {thread.cleanSubject}
                                        </div>
                                        <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="font-medium text-slate-500 flex items-center gap-1">
                                                <User className="w-3.5 h-3.5" />
                                                {thread.records[0].sender || 'Không rõ người gửi'}
                                            </span>
                                            {thread.records.some((r: any) => r.ntxx_details?.supplier) && (
                                                <span className="font-medium text-emerald-600 flex items-center gap-1">
                                                    <Building className="w-3.5 h-3.5" />
                                                    Supplier: {thread.records.find((r: any) => r.ntxx_details?.supplier)?.ntxx_details.supplier}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isThreadExpanded && (
                                        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-3 space-y-4">
                                            <div className="space-y-2">
                                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Lịch sử email & Dữ liệu trích xuất</div>
                                                {thread.records.map((r: any) => {
                                                    const hasData = r.ntxx_details && typeof r.ntxx_details === 'object';
                                                    
                                                    return (
                                                        <div key={r.id} className="flex flex-col gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                                            <div className="flex gap-2 text-xs">
                                                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex justify-between gap-2 mb-0.5">
                                                                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{r.sender || 'Unknown'}</span>
                                                                        <span className="text-slate-400 whitespace-nowrap">{new Date(r.email_received_at).toLocaleString('vi-VN')}</span>
                                                                    </div>
                                                                    <p className="text-slate-600 dark:text-slate-400 truncate">{r.email_subject}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            {hasData && (
                                                                <div className="mt-2 bg-indigo-50/30 dark:bg-indigo-900/10 rounded border border-indigo-100 dark:border-indigo-800/50 overflow-hidden">
                                                                    <div className="bg-indigo-50/80 dark:bg-indigo-900/30 px-3 py-1.5 border-b border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center gap-2">
                                                                        <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                                                            <CheckCircle2 className="w-3 h-3" /> Dữ liệu trích xuất
                                                                        </span>
                                                                        <div className="flex items-center shrink-0">
                                                                            {editingSupplierRecordId === r.id ? (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <input 
                                                                                        type="text" value={editSupplierName} onChange={(e) => setEditSupplierName(e.target.value)}
                                                                                        className="px-2 py-1 text-[10px] border border-indigo-300 rounded w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" autoFocus
                                                                                    />
                                                                                    <button onClick={() => handleSaveSupplier(r.id, r.ntxx_details, editSupplierName)} className="p-1 bg-indigo-500 text-white rounded"><Check className="w-3 h-3" /></button>
                                                                                    <button onClick={() => setEditingSupplierRecordId(null)} className="p-1 bg-slate-200 rounded"><X className="w-3 h-3" /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1 group">
                                                                                    <Badge variant="outline" className="text-[10px] py-0 bg-white dark:bg-slate-900 border-indigo-200">
                                                                                        Supplier: {r.ntxx_details.supplier || 'Chưa có'}
                                                                                    </Badge>
                                                                                    <button onClick={() => { setEditSupplierName(r.ntxx_details.supplier || ''); setEditingSupplierRecordId(r.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-500 cursor-pointer"><Edit2 className="w-3 h-3" /></button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {r.ntxx_details.stores && r.ntxx_details.stores.length > 0 ? (
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-left text-[11px] min-w-[500px]">
                                                                                <thead className="bg-white/50 dark:bg-slate-900/50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="p-2 border-b font-medium">Mã Store</th>
                                                                                        <th className="p-2 border-b font-medium">Tên siêu thị</th>
                                                                                        <th className="p-2 border-b font-medium text-center">SL</th>
                                                                                        <th className="p-2 border-b font-medium">Hạng mục</th>
                                                                                        <th className="p-2 border-b font-medium">Ghi chú</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                                                    {r.ntxx_details.stores.map((s: any, idx: number) => (
                                                                                        <tr key={idx} className="bg-white/30 dark:bg-slate-900/30">
                                                                                            <td className="p-2 font-bold text-slate-700 dark:text-slate-300">{s.store_code}</td>
                                                                                            <td className="p-2 truncate max-w-[120px]" title={s.store_name}>{s.store_name}</td>
                                                                                            <td className="p-2 text-center">{s.quantity || 1}</td>
                                                                                            <td className="p-2 text-indigo-600 dark:text-indigo-400 font-medium">{s.category || 'POSM'}</td>
                                                                                            <td className="p-2 text-slate-500 italic truncate max-w-[100px]" title={s.notes}>{s.notes || '-'}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-3 text-[11px] text-slate-500 italic text-center">Không trích xuất được danh sách store cụ thể</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
            {/* Master Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px_60px] gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-bold text-slate-500 uppercase tracking-wider items-center">
                <div className="pl-2">Dự Án & Tên (Click để sửa)</div>
                <div className="text-center">Brief</div>
                <div className="text-center">Khảo sát</div>
                <div className="text-center">NTXX</div>
                <div className="text-center">Lắp đặt</div>
                <div className="text-center">Thu hồi</div>
                <div></div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedCombined.map((project: any) => {
                    const isExpanded = expandedProjects.has(project.subCode);
                    const isEditing = editingCode === project.subCode;
                    const isMenuOpen = isMenuOpenCode === project.subCode;
                    
                    return (
                        <div key={project.subCode} className="flex flex-col transition-colors relative">
                            {/* Row Header */}
                            <div className={`grid grid-cols-[1fr_80px_80px_80px_80px_80px_60px] gap-2 p-3 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-bold text-indigo-700 dark:text-indigo-400">
                                                {project.subCode}
                                            </span>
                                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium text-slate-500">
                                                {project.totalEvents} updates
                                            </Badge>
                                        </div>
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <input 
                                                    type="text" 
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full text-xs px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSaveName(project.subCode, editName)} className="p-1 bg-indigo-500 text-white rounded cursor-pointer"><Check className="w-3 h-3" /></button>
                                                <button onClick={() => setEditingCode(null)} className="p-1 bg-slate-200 rounded cursor-pointer"><X className="w-3 h-3" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 group w-full">
                                                <span 
                                                    onClick={() => { setSelectedSub(project); setPanelTab('brief'); }}
                                                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                    title={project.projectName}
                                                >
                                                    {project.projectName || <span className="italic text-slate-400 font-normal">Chưa có tên dự án</span>}
                                                </span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditName(project.projectName || ''); setEditingCode(project.subCode); }} 
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer transition-opacity shrink-0"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Progress Columns */}
                                <div onClick={() => { setSelectedSub(project); setPanelTab('brief'); }} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 transition-colors">
                                    <ProgressBadge status={project.progress.briefStatus} date={project.progress.briefDate} />
                                </div>
                                <div onClick={() => { setSelectedSub(project); setPanelTab('khao_sat'); }} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 transition-colors">
                                    <ProgressBadge status={project.progress.khaoSatStatus} date={project.progress.khaoSatDate} />
                                </div>
                                <div onClick={() => { setSelectedSub(project); setPanelTab('ntxx'); }} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 transition-colors">
                                    <ProgressBadge status={project.progress.ntxxStatus} date={project.progress.ntxxDate} />
                                </div>
                                <div onClick={() => { setSelectedSub(project); setPanelTab('lap_dat'); }} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 transition-colors">
                                    <ProgressBadge status={project.progress.lapDatStatus} date={project.progress.lapDatDate} />
                                </div>
                                <div onClick={() => { setSelectedSub(project); setPanelTab('thu_hoi'); }} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 transition-colors">
                                    <ProgressBadge status={project.progress.thuHoiStatus} date={project.progress.thuHoiDate} />
                                </div>
                                
                                <div className="flex justify-end pr-2 gap-1 relative">
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsMenuOpenCode(isMenuOpen ? null : project.subCode);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                        
                                        {isMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setIsMenuOpenCode(null); }} />
                                                <div className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 overflow-hidden text-sm">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpenCode(null); setEditName(project.projectName || ''); setEditingCode(project.subCode); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                        <Edit2 className="w-4 h-4 text-indigo-500" /> Sửa Tên
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpenCode(null); setProjectToMerge({ code: project.subCode, name: project.projectName || project.subCode }); setMergeModalOpen(true); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                        <Merge className="w-4 h-4 text-amber-500" /> Gộp Dự Án
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpenCode(null); handleDeleteProject && handleDeleteProject(project.subCode); }} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600 dark:text-red-400">
                                                        <Trash2 className="w-4 h-4" /> Xóa Dự Án
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={() => toggleExpand(project.subCode)} 
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Content (Timeline) */}
                            {isExpanded && (
                                <div className="p-4 pl-12 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                                    <div className="max-w-4xl">
                                        {renderThreadGroup('Brief', project.stageGroups.brief)}
                                        {renderThreadGroup('Khảo Sát', project.stageGroups.khao_sat)}
                                        {renderThreadGroup('NTXX', project.stageGroups.ntxx)}
                                        {renderThreadGroup('Lắp Đặt', project.stageGroups.lap_dat)}
                                        {renderThreadGroup('Thu Hồi', project.stageGroups.thu_hoi)}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Merge Modal */}
            {mergeModalOpen && projectToMerge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Merge className="w-5 h-5 text-amber-500" />
                                Gộp Dự Án
                            </h3>
                            <button onClick={() => setMergeModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Bạn đang chọn gộp dự án <strong className="text-indigo-600">{projectToMerge.name}</strong> vào một dự án khác. Toàn bộ dữ liệu email của dự án này sẽ được chuyển sang dự án đích.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chọn Dự án đích để gộp vào:</label>
                                <select 
                                    value={targetProjectCode} 
                                    onChange={e => setTargetProjectCode(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">-- Chọn dự án --</option>
                                    {trackingCombined.filter(p => p.subCode !== projectToMerge.code).map(p => (
                                        <option key={p.subCode} value={p.subCode}>
                                            {p.subCode} - {p.projectName || 'Chưa có tên'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setMergeModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
                                Hủy bỏ
                            </button>
                            <button 
                                disabled={!targetProjectCode}
                                onClick={() => {
                                    const targetProj = trackingCombined.find(p => p.subCode === targetProjectCode);
                                    if (handleMergeProject && targetProj) {
                                        handleMergeProject(projectToMerge.code, targetProj.subCode, targetProj.projectName || targetProj.subCode);
                                    }
                                    setMergeModalOpen(false);
                                }} 
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Gộp ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
