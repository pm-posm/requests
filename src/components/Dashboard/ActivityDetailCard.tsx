import React from 'react';
import { Mail, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import type { ProjectGroup, ActivityRow } from '@/types';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

function FolderLinkButton({ finalProject, phaseType }: { finalProject: string, phaseType: string }) {
    const [loading, setLoading] = React.useState(false);

    const handleOpen = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${supabaseUrl}/functions/v1/project-folder-link?phase_type=${phaseType}&final_project=${encodeURIComponent(finalProject)}`,
                { 
                    headers: { 
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey
                    } 
                }
            );

            const contentType = response.headers.get('content-type') || '';
            if (response.ok && contentType.includes('application/json')) {
                const data = await response.json();
                if (data.folder_url) {
                    window.open(data.folder_url, '_blank');
                    return;
                }
            }

            // Fallback mở trực tiếp tìm kiếm Drive của dự án nếu Edge Function chưa sẵn sàng hoặc không tìm thấy
            window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(finalProject)}`, '_blank');
        } catch (err: any) {
            // Mở link tìm kiếm Drive tự động nếu có bất kỳ lỗi kết nối nào
            window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(finalProject)}`, '_blank');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button type="button" onClick={handleOpen} disabled={loading} className="text-[11px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-medium cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            {loading ? 'Đang mở Drive...' : 'Mở Folder Drive'}
        </button>
    );
}

import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function ChangePhaseSelector({ activityId, currentPhase, finalProject }: { activityId: string, currentPhase: string, finalProject: string }) {
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = React.useState(false);

    const phaseLabels: Record<string, string> = {
        'BRIEF': '📋 Brief Nhãn Hàng',
        'SURVEY': '📐 Khảo sát',
        'NTXX': '🏭 Nghiệm thu Xuất xưởng (NTXX)',
        'INSTALLATION': '🛠️ Lắp đặt'
    };

    const handlePhaseChange = async (newPhase: string) => {
        if (!newPhase || newPhase === currentPhase) return;
        setIsUpdating(true);

        try {
            const { supabase } = await import('@/lib/supabase');

            // 1. Cập nhật project_activities (có fallback ACCEPTANCE nếu DB enum không chứa NTXX)
            let { error: actErr } = await supabase
                .from('project_activities')
                .update({ phase_type: newPhase })
                .eq('id', activityId);

            if (actErr && actErr.message.includes('enum') && newPhase === 'NTXX') {
                const fb = await supabase
                    .from('project_activities')
                    .update({ phase_type: 'ACCEPTANCE' })
                    .eq('id', activityId);
                actErr = fb.error;
            }

            if (actErr) throw actErr;

            // 2. Cập nhật activity_attachments
            let { error: attErr } = await supabase
                .from('activity_attachments')
                .update({ phase_type: newPhase })
                .eq('activity_id', activityId);

            if (attErr && attErr.message.includes('enum') && newPhase === 'NTXX') {
                await supabase
                    .from('activity_attachments')
                    .update({ phase_type: 'ACCEPTANCE' })
                    .eq('activity_id', activityId);
            }

            // 3. Tự động di chuyển file đính kèm trên Google Drive nếu có
            try {
                await fetch(`${supabaseUrl}/functions/v1/change-activity-phase`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'apikey': supabaseAnonKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        activity_id: activityId,
                        final_project: finalProject,
                        new_phase_type: newPhase
                    })
                });
            } catch (edgeErr) {
                console.warn('Chuyển file Drive ngầm:', edgeErr);
            }

            toast.success(`✅ Đã chuyển email & file sang giai đoạn ${phaseLabels[newPhase] || newPhase}!`);
            queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
            queryClient.invalidateQueries({ queryKey: ['project_groups'] });
            queryClient.invalidateQueries({ queryKey: ['project_overviews_rpc'] });
        } catch (err: any) {
            toast.error(`❌ Lỗi chuyển giai đoạn: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-500">🔁 Giai đoạn:</span>
            <select
                disabled={isUpdating}
                value={currentPhase || 'NTXX'}
                onChange={(e) => handlePhaseChange(e.target.value)}
                className="px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs disabled:opacity-50"
            >
                <option value="BRIEF">📋 Brief Nhãn Hàng</option>
                <option value="SURVEY">📐 Khảo sát</option>
                <option value="NTXX">🏭 Nghiệm thu Xuất xưởng (NTXX)</option>
                <option value="INSTALLATION">🛠️ Lắp đặt</option>
            </select>
        </div>
    );
}

export function ActivityDetailCard({ activity, projectGroup, onProcessData }: { 
    activity: ActivityRow, 
    projectGroup: ProjectGroup,
    onProcessData?: (fileId: string) => void
}) {
    const queryClient = useQueryClient();
    const [confirmDelete, setConfirmDelete] = React.useState<{attId: string, driveFileId: string} | null>(null);

    const executeDeleteFile = async () => {
        if (!confirmDelete) return;
        const { attId, driveFileId } = confirmDelete;
        
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            // 1. Delete from Drive
            if (driveFileId && driveFileId !== 'unknown') {
                const res = await fetch(`${supabaseUrl}/functions/v1/delete-from-drive`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file_id: driveFileId })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Lỗi xóa file trên Drive');
                }
            }

            // 2. Delete from DB (activity_attachments and activity itself since manual upload has 1 file)
            // Wait, manual uploads are 1 activity per file. If we delete the file, we should delete the activity.
            const { supabase } = await import('@/lib/supabase');
            await supabase.from('activity_attachments').delete().eq('id', attId);
            if ((activity as any).activity_type === 'MANUAL_UPLOAD') {
                await supabase.from('project_activities').delete().eq('id', activity.id);
            }
            
            queryClient.invalidateQueries({ queryKey: ['project_groups'] });
            toast.success('Đã xóa file thành công!');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setConfirmDelete(null);
        }
    };

    const handleDeleteFile = (attId: string, driveFileId: string) => {
        setConfirmDelete({ attId, driveFileId });
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200">{activity.title_mail || 'Không có tiêu đề'}</h4>
                    {(activity as any).merged_from_project && (
                        <span className="bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded text-[10px] border border-sky-200 dark:border-sky-800">
                            📌 Đã gộp từ: {(activity as any).merged_from_project}
                        </span>
                    )}
                </div>
                <div className="text-xs">
                    {activity.thread_id ? (
                        <a href={`https://mail.google.com/mail/u/0/#inbox/${activity.thread_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium">
                            Mở Thread Mail
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    ) : (
                        <span className="text-slate-500">{new Date(activity.created_at).toLocaleString('vi-VN')}</span>
                    )}
                </div>
            </div>
            
            <div className="text-xs text-slate-500 mb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span>Người gửi:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{activity.nguoi_gui || 'N/A'} ({new Date(activity.created_at).toLocaleString('vi-VN')})</span>
                </div>
                <div className="flex items-center gap-3">
                    <ChangePhaseSelector activityId={activity.id} currentPhase={activity.phase_type || ''} finalProject={projectGroup.final_project} />
                    <FolderLinkButton finalProject={projectGroup.final_project} phaseType={activity.phase_type || ''} />
                </div>
            </div>

            {activity.activity_attachments && activity.activity_attachments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">File đính kèm</h5>
                    </div>
                    <div className="space-y-2">
                        {activity.activity_attachments.map(att => {
                            const isExcel = att.file_name?.toLowerCase().endsWith('.xlsx') || att.file_name?.toLowerCase().endsWith('.xls');
                            return (
                                <div key={att.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                    <a href={att.drive_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex-1 truncate" title={att.file_name}>
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">{att.file_name}</span>
                                    </a>
                                    {!att.is_manual_upload && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const realDriveId = (att.drive_file_id && att.drive_file_id !== 'unknown' && att.drive_file_id.length > 15 && !att.drive_file_id.includes('-'))
                                                    ? att.drive_file_id
                                                    : (att.drive_url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || att.drive_url?.match(/id=([a-zA-Z0-9_-]+)/)?.[1] || att.id);
                                                if (onProcessData && realDriveId) {
                                                    onProcessData(realDriveId);
                                                }
                                            }}
                                            className="ml-auto flex items-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50 px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer shadow-sm"
                                        >
                                            <CheckCircle2 className="w-3 h-3" /> Xử lý Dữ liệu
                                        </button>
                                    )}
                                    {att.is_manual_upload && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteFile(att.id, att.drive_file_id)}
                                            className="ml-auto flex items-center gap-1 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                            title="Xóa file khỏi hệ thống và Drive"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            Xóa
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <ConfirmDialog 
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={executeDeleteFile}
                title="Xác nhận xóa file"
                description="Bạn có chắc chắn muốn xóa file này khỏi Drive và hệ thống không? Dữ liệu này sẽ không thể khôi phục lại."
                confirmText="Xóa file"
                isDestructive={true}
            />
        </div>
    );
}
