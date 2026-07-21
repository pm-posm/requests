import React from 'react';
import { FileSpreadsheet, FileText, ChevronRight, ChevronLeft, Download, CheckSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProjectGroup } from '@/types';
import toast from 'react-hot-toast';

interface StoreManagerSidebarProps {
    projectGroup: ProjectGroup;
    downloadFileId?: string;
    setDownloadFileId?: (id?: string) => void;
    setSelectedFile: (f: any) => void;
    setActiveTab: (t: 'EXTRACT' | 'MASTER') => void;
    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;
}

const BRIEF_ACTIONS = [
    { value: 'Thêm mới hoàn toàn', label: '🆕 Thêm mới hoàn toàn', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'Thêm mới có thu hồi', label: '🔄 Thêm mới có thu hồi', color: 'bg-blue-100 text-blue-700' },
    { value: 'Thu hồi hoàn toàn', label: '❌ Thu hồi hoàn toàn', color: 'bg-rose-100 text-rose-700' },
];

const PHASE_BADGE: Record<string, { label: string; cls: string }> = {
    BRIEF: { label: 'Brief', cls: 'bg-violet-100 text-violet-700' },
    SURVEY: { label: 'Khảo sát', cls: 'bg-purple-100 text-purple-700' },
    INSTALLATION: { label: 'Lắp đặt', cls: 'bg-amber-100 text-amber-700' },
    ACCEPTANCE: { label: 'NTXX', cls: 'bg-emerald-100 text-emerald-700' },
};

export function StoreManagerSidebar({ projectGroup, downloadFileId, setDownloadFileId, setSelectedFile, setActiveTab, isCollapsed, setIsCollapsed }: StoreManagerSidebarProps) {
    const queryClient = useQueryClient();
    const finalProject = projectGroup.final_project;

    // Brief decision
    const { data: briefDecision } = useQuery({
        queryKey: ['project_decision', finalProject, 'BRIEF'],
        queryFn: async () => {
            const { data } = await supabase
                .from('project_decisions')
                .select('*')
                .eq('final_project', finalProject)
                .eq('phase_type', 'BRIEF')
                .maybeSingle();
            return data || null;
        }
    });

    const [briefStatus, setBriefStatus] = React.useState('');
    React.useEffect(() => {
        if (briefDecision) setBriefStatus(briefDecision.decision_status || '');
    }, [briefDecision]);

    const saveBrief = useMutation({
        mutationFn: async (status: string) => {
            const { error } = await supabase.from('project_decisions').upsert({
                final_project: finalProject,
                phase_type: 'BRIEF',
                decision_status: status,
                updated_by: 'Admin',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'final_project,phase_type' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_decision', finalProject, 'BRIEF'] });
            toast.success('Đã lưu Brief!');
        },
        onError: (err: any) => toast.error(err.message),
    });

    // All files from activities
    const allFiles = React.useMemo(() => {
        const files: any[] = [];
        projectGroup.activities.forEach(act => {
            (act.activity_attachments || []).forEach(att => {
                files.push({ ...att, phase: act.phase_type });
            });
        });
        return files;
    }, [projectGroup]);

    const handleSelectFile = (file: any) => {
        setSelectedFile(file);
        setDownloadFileId && setDownloadFileId(file.drive_file_id || file.id);
        setActiveTab('EXTRACT');
    };

    const currentBriefAction = BRIEF_ACTIONS.find(a => a.value === briefStatus);

    return (
        <div className={`shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col overflow-hidden transition-all duration-300 relative ${isCollapsed ? 'w-10' : 'w-56'}`}>
            {/* Collapse Toggle Button */}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow hover:bg-slate-50 cursor-pointer"
                title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            >
                {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
            </button>

            {!isCollapsed && (
                <>
                    {/* Brief section */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 pt-10">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Loại hình POSM</span>
                        </div>
                        <select
                            value={briefStatus}
                            onChange={e => setBriefStatus(e.target.value)}
                            className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none mb-2 cursor-pointer"
                        >
                            <option value="">-- Chọn Loại hình POSM --</option>
                            {BRIEF_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                        {currentBriefAction && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded block text-center mb-2 ${currentBriefAction.color}`}>
                                {currentBriefAction.label}
                            </span>
                        )}
                        <button
                            onClick={() => saveBrief.mutate(briefStatus)}
                            disabled={!briefStatus || saveBrief.isPending}
                            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            {saveBrief.isPending ? 'Đang lưu...' : 'Lưu Loại hình'}
                        </button>
                    </div>

                    {/* All files section */}
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        <div className="flex items-center gap-2 mb-2">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tài liệu đính kèm ({allFiles.length})</span>
                        </div>

                        {allFiles.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic text-center py-4">Chưa có tài liệu nào</p>
                        ) : (
                            <div className="space-y-1.5">
                                {allFiles.map(file => {
                                    const isActive = downloadFileId === (file.drive_file_id || file.id);
                                    const badge = PHASE_BADGE[file.phase] || { label: file.phase, cls: 'bg-slate-100 text-slate-600' };
                                    const isExcel = file.file_name?.toLowerCase().endsWith('.xlsx') || file.file_name?.toLowerCase().endsWith('.xls');
                                    
                                    return (
                                        <button
                                            key={file.id}
                                            onClick={() => handleSelectFile(file)}
                                            className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer group ${
                                                isActive
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-indigo-50/30'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-1">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        {isExcel ? <FileSpreadsheet className="w-3 h-3 text-emerald-500" /> : <FileText className="w-3 h-3 text-rose-500" />}
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>{badge.label}</span>
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">{file.file_name}</p>
                                                </div>
                                                <ChevronRight className={`w-3 h-3 shrink-0 mt-0.5 transition-colors ${isActive ? 'text-indigo-500' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                                            </div>
                                            {isActive && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <CheckSquare className="w-2.5 h-2.5 text-indigo-500" />
                                                    <span className="text-[9px] font-bold text-indigo-600">{isExcel ? 'Đang trích xuất' : 'Đang xử lý'}</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
