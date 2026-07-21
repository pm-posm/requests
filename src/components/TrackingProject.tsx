import React, { useState } from 'react';
import { Mail, CheckCircle2, XCircle, Clock4, Circle, FolderOpen } from 'lucide-react';
import { useTrackingData } from '@/hooks/useTrackingData';
import { TrackingHeader } from './TrackingProject/TrackingHeader';
import { TrackingTable } from './TrackingProject/TrackingTable';

type TabType = 'tracking' | 'brief' | 'ntxx' | 'khao_sat' | 'lap_dat' | 'thu_hoi';

export default function TrackingProject({ searchTerm = '' }: { searchTerm?: string }) {
    const [activeTab, setActiveTab] = useState<TabType>('tracking');
    const [monthFilter, setMonthFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
    
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editingSupplierRecordId, setEditingSupplierRecordId] = useState<string | null>(null);
    const [editSupplierName, setEditSupplierName] = useState('');
    
    const [selectedSub, setSelectedSub] = useState<any>(null);
    const [panelTab, setPanelTab] = useState<'brief' | 'khao_sat' | 'ntxx' | 'lap_dat' | 'thu_hoi'>('brief');

    const {
        isLoading,
        paginatedCombined,
        trackingCombined, // Used for merging options
        totalPages,
        handleSaveName,
        handleSaveSupplier,
        handleMergeProject,
        handleDeleteProject
    } = useTrackingData(searchTerm, monthFilter, currentPage, pageSize);

    const toggleExpand = (code: string) => {
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const toggleThread = (threadId: string) => {
        setExpandedThreads(prev => {
            const next = new Set(prev);
            if (next.has(threadId)) next.delete(threadId);
            else next.add(threadId);
            return next;
        });
    };

    // Filter raw data for simple tables
    const renderSimpleTable = (statusList: string[], emptyMsg: string) => {
        const data = trackingCombined.flatMap((p: any) => 
            statusList.flatMap(status => {
                const groupKey = status === 'brief' ? 'brief' : status === 'ntxx' ? 'ntxx' : status.includes('khao_sat') ? 'khao_sat' : status.includes('lap_dat') ? 'lap_dat' : 'thu_hoi';
                return p.stageGroups[groupKey]?.flatMap((t: any) => t.records) || [];
            })
        ).filter(Boolean);

        if (data.length === 0) return <div className="p-8 text-center text-slate-500">{emptyMsg}</div>;
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm">
                            <th className="p-3 font-semibold border-b dark:border-slate-700">Mã Dự Án</th>
                            <th className="p-3 font-semibold border-b dark:border-slate-700 w-1/3">Tên Dự Án</th>
                            <th className="p-3 font-semibold border-b dark:border-slate-700">Tiêu đề Email</th>
                            <th className="p-3 font-semibold border-b dark:border-slate-700">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((r: any) => (
                            <tr key={r.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="p-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">{r.detected_project_code}</td>
                                <td className="p-3 text-sm">{r.detected_project_name || <span className="italic text-slate-400">N/A</span>}</td>
                                <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                                    <div className="flex items-start gap-2">
                                        <Mail className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                        <span className="line-clamp-2" title={r.email_subject}>{r.email_subject}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-sm text-slate-500 whitespace-nowrap">
                                    {new Date(r.email_received_at).toLocaleString('vi-VN')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-indigo-500" />
                        Theo dõi Tiến độ
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Quản lý toàn bộ vòng đời của các dự án (Progress Board).</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <TrackingHeader 
                    monthFilter={monthFilter}
                    setMonthFilter={setMonthFilter}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />

                {activeTab === 'brief' && renderSimpleTable(['brief'], "Không có dữ liệu Brief nào.")}
                {activeTab === 'khao_sat' && renderSimpleTable(['khao_sat', 'hoan_thanh_khao_sat'], "Không có dữ liệu Khảo sát nào.")}
                {activeTab === 'ntxx' && renderSimpleTable(['ntxx'], "Không có dữ liệu NTXX nào.")}
                {activeTab === 'lap_dat' && renderSimpleTable(['lap_dat', 'hoan_thanh_lap_dat'], "Không có dữ liệu Lắp đặt nào.")}
                {activeTab === 'thu_hoi' && renderSimpleTable(['thu_hoi', 'hoan_tat_thu_hoi'], "Không có dữ liệu Thu hồi nào.")}
                
                {activeTab === 'tracking' && (
                    <TrackingTable 
                        paginatedCombined={paginatedCombined}
                        trackingCombined={trackingCombined}
                        expandedProjects={expandedProjects}
                        toggleExpand={toggleExpand}
                        editingCode={editingCode}
                        setEditingCode={setEditingCode}
                        editName={editName}
                        setEditName={setEditName}
                        handleSaveName={handleSaveName}
                        setSelectedSub={setSelectedSub}
                        setPanelTab={setPanelTab}
                        expandedThreads={expandedThreads}
                        toggleThread={toggleThread}
                        editingSupplierRecordId={editingSupplierRecordId}
                        setEditingSupplierRecordId={setEditingSupplierRecordId}
                        editSupplierName={editSupplierName}
                        setEditSupplierName={setEditSupplierName}
                        handleSaveSupplier={handleSaveSupplier}
                        handleMergeProject={handleMergeProject}
                        handleDeleteProject={handleDeleteProject}
                    />
                )}
                
                {activeTab === 'tracking' && paginatedCombined.length > 0 && (
                    <div className="mt-4 p-4 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                            Hiển thị 
                            <select className="bg-white border border-slate-200 rounded-md px-2 py-1 outline-none text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                            dự án trên mỗi trang
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 font-bold text-sm shadow-sm transition-colors">Trước</button>
                            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-sm shadow-sm">Trang {currentPage} / {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 font-bold text-sm shadow-sm transition-colors">Sau</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
