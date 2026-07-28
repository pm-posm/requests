import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProjects, type Project } from '@/hooks/useProjects';
import { Loader2, Search, Table, BarChart3, RefreshCw } from 'lucide-react';
import type { ProjectGroup, ActivityRow } from '@/types';
import { ProjectTable } from './ProjectList/ProjectTable';
import { ProjectCommandCenterHeader } from './Dashboard/ProjectCommandCenterHeader';
import toast from 'react-hot-toast';

export default function ModelTest() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: projects, isLoading: projectsLoading } = useProjects();
    const [activeModuleTab, setActiveModuleTab] = React.useState<'DATA_LIST' | 'ANALYST'>('DATA_LIST');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeQuickFilter, setActiveQuickFilter] = React.useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'HIGH_STORE_COUNT'>('ALL');
    const [isTriggeringSync, setIsTriggeringSync] = React.useState(false);

    // Fetch unified project activities and their attachments
    const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityRow[]>({
        queryKey: ['project_activities_with_attachments_all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_activities')
                .select('*, activity_attachments(*)')
                .order('created_at', { ascending: false });
            return data || [];
        }
    });

    // Fetch project overviews via RPC
    const { data: overviews, isLoading: overviewsLoading } = useQuery<any[]>({
        queryKey: ['project_overviews_rpc'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_project_overviews');
            if (error) {
                console.error("RPC Error:", error);
                return [];
            }
            return data || [];
        }
    });

    // Fetch raw requests to build Request ID -> Project Map
    const { data: rawRequests = [] } = useQuery<any[]>({
        queryKey: ['raw_requests_subtask_mapping'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('raw_requests')
                .select('request_id, ma_du_an, title_email_request')
                .not('request_id', 'is', null);
            if (error) return [];
            return data || [];
        }
    });

    // Build Request ID map indexed by project keys/names
    const requestsMap = React.useMemo(() => {
        const map: Record<string, string[]> = {};
        rawRequests.forEach(r => {
            if (!r.request_id) return;
            const rid = r.request_id.trim();
            const keys = [r.ma_du_an?.trim(), r.title_email_request?.trim()].filter(Boolean);
            keys.forEach(k => {
                if (!map[k]) map[k] = [];
                if (!map[k].includes(rid)) map[k].push(rid);
            });
        });
        return map;
    }, [rawRequests]);

    // Gom nhóm các hoạt động theo final_project
    const groupedProjects = React.useMemo(() => {
        if (!activities) return [];
        
        const map = new Map<string, ProjectGroup>();
        
        for (const act of activities) {
            const fp = act.final_project || act.title_mail || "Chưa xác định";
            
            if (!map.has(fp)) {
                map.set(fp, {
                    final_project: fp,
                    key_project: act.key_project || "",
                    name_project: act.name_project || "",
                    activities: []
                });
            }
            map.get(fp)!.activities.push(act);
        }
        
        // Sắp xếp theo mã dự án giảm dần và tính toán thống kê
        return Array.from(map.values()).map(group => {
            const fp = group.final_project;
            const overview = overviews?.find((o: any) => o.final_project === fp);
            
            const totalStores = overview?.store_count || 0;
            const publishedStores = overview?.published_store_count || 0;
            const draftCount = totalStores - publishedStores;
            
            const storeCount = publishedStores;
            
            const customers = overview?.customers || [];
            const customer = customers.length === 0 ? '-' : customers.length === 1 ? customers[0] : 'Khác';
            
            const suppliers = overview?.suppliers || [];
            const supplier = suppliers.length === 0 ? '-' : suppliers.length === 1 ? suppliers[0] : 'Khác';
            
            const phases = overview?.phases || [];
            const phase = phases.length === 0 ? '-' : phases.length === 1 ? phases[0] : 'Khác';
            
            const posmType = overview?.posm_type || 'Chưa cấu hình';
            
            // Tính toán trạng thái dựa vào cửa hàng
            let computedStatus = '-';
            if (totalStores === 0) {
                computedStatus = 'Khởi tạo';
            } else if (publishedStores === 0 && draftCount > 0) {
                computedStatus = 'Chờ công bố';
            } else {
                computedStatus = 'Đang thực hiện';
            }

            // Lấy trạng thái của dự án từ bảng posm_projects
            const matchedProj = projects?.find(p => p.final_key === fp || p.source_key === group.key_project || p.source_project_name === group.name_project);
            const status = matchedProj?.status || computedStatus;

            return {
                ...group,
                stats: {
                    storeCount,
                    totalStores,
                    publishedStores,
                    draftCount,
                    customer,
                    supplier,
                    phase,
                    posmType,
                    status
                }
            };
        });
    }, [activities, overviews, projects]);

    // Lọc theo từ khóa tìm kiếm & quick filter
    const filteredGroups = React.useMemo(() => {
        return groupedProjects.filter(g => {
            const term = searchTerm.toLowerCase().trim();
            const matchesSearch = !term || 
                (g.final_project || '').toLowerCase().includes(term) ||
                (g.key_project || '').toLowerCase().includes(term) ||
                (g.name_project || '').toLowerCase().includes(term) ||
                (g.stats?.customer || '').toLowerCase().includes(term) ||
                (g.stats?.supplier || '').toLowerCase().includes(term) ||
                (g.stats?.posmType || '').toLowerCase().includes(term);

            const isFinished = g.activities?.every(a => {
                const st = (a.status || '').toLowerCase();
                const prog = ((a as any).tien_do || '').toLowerCase();
                return st.includes('done') || st.includes('hoàn thành') || prog.includes('done') || prog.includes('hoàn thành');
            });

            if (activeQuickFilter === 'ACTIVE') {
                return matchesSearch && (!isFinished || !g.activities || g.activities.length === 0);
            }
            if (activeQuickFilter === 'COMPLETED') {
                return matchesSearch && isFinished && g.activities && g.activities.length > 0;
            }
            if (activeQuickFilter === 'HIGH_STORE_COUNT') {
                return matchesSearch && (g.stats?.storeCount || 0) > 0;
            }
            return matchesSearch;
        });
    }, [groupedProjects, searchTerm, activeQuickFilter]);

    const findMatchedProject = (group: ProjectGroup): Project | null => {
        if (!projects) return null;
        return projects.find(p => p.final_key === group.final_project || p.source_key === group.key_project || p.source_project_name === group.name_project) || null;
    };

    // FIX POINT 2: Navigate directly to the dedicated full-page Project Detail component route (/project/:id)!
    const handleRowClick = (group: ProjectGroup) => {
        navigate(`/project/${encodeURIComponent(group.final_project)}`);
    };

    if (activitiesLoading || overviewsLoading || projectsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* MODULE INTERNAL NAVIGATION SUB-TABS */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                <button
                    onClick={() => setActiveModuleTab('DATA_LIST')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        activeModuleTab === 'DATA_LIST'
                            ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Table className="w-4 h-4" />
                    <span>Danh Sách Dữ Liệu</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-mono">
                        {filteredGroups.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveModuleTab('ANALYST')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        activeModuleTab === 'ANALYST'
                            ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    <span>Báo Cáo & Thống Kê (Analyst)</span>
                </button>
            </div>

            {/* TAB 1: DEDICATED ANALYST / REPORTS WORKSPACE */}
            {activeModuleTab === 'ANALYST' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    <ProjectCommandCenterHeader
                        groups={groupedProjects}
                        activeQuickFilter={activeQuickFilter}
                        onSelectQuickFilter={setActiveQuickFilter}
                    />
                </div>
            )}

            {/* TAB 2: CLEAN OPERATIONAL DATA LIST WORKSPACE */}
            {activeModuleTab === 'DATA_LIST' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Header & Search + Trigger Đồng bộ Mail */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm kiếm mã dự án, tên dự án, khách hàng, supplier..."
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Trigger Đồng bộ Mail 4 Giai Đoạn */}
                        <button
                            onClick={async () => {
                                try {
                                    setIsTriggeringSync(true);
                                    toast.loading('🚀 Đang gửi lệnh kích hoạt đồng bộ Mail 4 giai đoạn...', { id: 'sync_mail_toast' });
                                    
                                    let syncSuccess = false;

                                    // 1. Kích hoạt Supabase Edge Function (cron-sync-gmail)
                                    try {
                                        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('cron-sync-gmail');
                                        if (edgeErr) {
                                            console.warn('Edge Function sync-gmail warning:', edgeErr);
                                        } else {
                                            syncSuccess = true;
                                        }
                                    } catch (efErr: any) {
                                        console.warn('Lỗi gọi Edge Function:', efErr);
                                    }

                                    // 2. Kích hoạt GitHub Action Workflow Dispatch (nếu có VITE_GITHUB_TOKEN & VITE_GITHUB_REPO)
                                    const ghRepo = import.meta.env.VITE_GITHUB_REPO || 'thanglh9-maker/posm-dashboard';
                                    const ghToken = import.meta.env.VITE_GITHUB_TOKEN;

                                    if (ghToken) {
                                        try {
                                            const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': `Bearer ${ghToken}`,
                                                    'Accept': 'application/vnd.github.v3+json',
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({
                                                    event_type: 'sync-emails'
                                                })
                                            });

                                            if (ghRes.ok || ghRes.status === 204) {
                                                toast.success('🚀 Đã gửi lệnh trigger GitHub Action Workflow thành công!', { id: 'sync_mail_toast' });
                                                syncSuccess = true;
                                            } else {
                                                const errText = await ghRes.text();
                                                console.error('GitHub Action dispatch error:', errText);
                                                toast.error(`⚠️ Lỗi GitHub Dispatch (${ghRes.status}): Vui lòng kiểm tra VITE_GITHUB_TOKEN`, { id: 'sync_mail_toast' });
                                            }
                                        } catch (ghErr: any) {
                                            console.error('Lỗi kết nối GitHub API:', ghErr);
                                        }
                                    } else if (!syncSuccess) {
                                        toast.success('🚀 Đã gửi lệnh quét ngầm CSDL! (Để kích hoạt GitHub Action từ giao diện, cần thêm VITE_GITHUB_TOKEN vào .env.local)', { id: 'sync_mail_toast' });
                                    } else {
                                        toast.success('🚀 Đã gửi lệnh kích hoạt quét Mail 4 giai đoạn thành công!', { id: 'sync_mail_toast' });
                                    }

                                    // 3. Ghi log sync job
                                    try {
                                        await supabase.from('sync_jobs').insert({ status: 'triggered', created_at: new Date().toISOString() });
                                    } catch (_err) {
                                        // Ignore RLS or schema mismatch
                                    }

                                    // Refetch data
                                    setTimeout(() => {
                                        queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
                                        queryClient.invalidateQueries({ queryKey: ['projects'] });
                                        queryClient.invalidateQueries({ queryKey: ['project_overviews_rpc'] });
                                        setIsTriggeringSync(false);
                                    }, 2500);
                                } catch (e: any) {
                                    toast.error('Lỗi gửi lệnh đồng bộ: ' + (e.message || 'Thất bại'), { id: 'sync_mail_toast' });
                                    setIsTriggeringSync(false);
                                }
                            }}
                            disabled={isTriggeringSync}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            title="Kích hoạt quét Mail tự động 4 giai đoạn (Brief, Khảo Sát, Lắp Đặt, NTXX)"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringSync ? 'animate-spin' : ''}`} />
                            <span>{isTriggeringSync ? 'Đang gửi lệnh...' : '⚡ Đồng bộ Mail Dự Án'}</span>
                        </button>
                    </div>

                    {/* Table */}
                    <ProjectTable 
                        groups={filteredGroups}
                        findMatchedProject={findMatchedProject}
                        onRowClick={handleRowClick}
                        requestsMap={requestsMap}
                        onRefresh={() => {
                            queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
                            queryClient.invalidateQueries({ queryKey: ['projects'] });
                            queryClient.invalidateQueries({ queryKey: ['raw_requests'] });
                        }}
                    />
                </div>
            )}
        </div>
    );
}