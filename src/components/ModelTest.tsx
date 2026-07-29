import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProjects, type Project } from '@/hooks/useProjects';
import { Loader2, Search, Table, BarChart3, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { ProjectGroup, ActivityRow } from '@/types';
import { ProjectTable } from './ProjectList/ProjectTable';
import { ProjectCommandCenterHeader } from './Dashboard/ProjectCommandCenterHeader';
import { useGlobalProjectCustomData } from '@/hooks/useGlobalProjectFields';
import toast from 'react-hot-toast';

export default function ModelTest() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { data: projects, isLoading: projectsLoading } = useProjects();
    const { customDataMap } = useGlobalProjectCustomData();
    const [activeModuleTab, setActiveModuleTab] = React.useState<'DATA_LIST' | 'ANALYST'>('DATA_LIST');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeQuickFilter, setActiveQuickFilter] = React.useState<'ALL' | 'UNPROCESSED'>('ALL');
    const [isTriggeringSync, setIsTriggeringSync] = React.useState(false);
    const [isTokenModalOpen, setIsTokenModalOpen] = React.useState(false);
    const [patTokenInput, setPatTokenInput] = React.useState(localStorage.getItem('github_pat_token') || '');

    // Fetch latest GitHub Action Workflow Run status from GitHub API (Live polling)
    const { data: latestGhRun, refetch: refetchGhRun } = useQuery({
        queryKey: ['github_action_latest_run'],
        queryFn: async () => {
            try {
                const res = await fetch('https://api.github.com/repos/thanglh9-maker/PM-POSM/actions/runs?per_page=1');
                if (!res.ok) return null;
                const json = await res.json();
                return json.workflow_runs?.[0] || null;
            } catch (_e) {
                return null;
            }
        },
        staleTime: 0, // 0 staleTime để luôn lấy dữ liệu mới nhất!
        refetchInterval: 3000 // Poll mỗi 3 giây để cập nhật tiến độ Real-time!
    });

    // Helper to fetch shared GitHub Token across devices (Mobile, Tablets, Desktop)
    const getSharedGithubToken = async (): Promise<string | null> => {
        let token = localStorage.getItem('github_pat_token') || import.meta.env.VITE_GITHUB_TOKEN || null;
        if (token && token.trim()) return token.trim();

        // Query token saved by Admin in Supabase DB project_activities
        try {
            const { data: act } = await supabase
                .from('project_activities')
                .select('key_project')
                .eq('final_project', '__SYSTEM_CONFIG_GITHUB_TOKEN__')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (act?.key_project) {
                const fetchedToken = act.key_project.trim();
                localStorage.setItem('github_pat_token', fetchedToken);
                return fetchedToken;
            }
        } catch (_e) {}

        // Fallback: Query token from sync_jobs
        try {
            const { data: cfg } = await supabase
                .from('sync_jobs')
                .select('config_token')
                .not('config_token', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (cfg?.config_token) {
                const fetchedToken = cfg.config_token.trim();
                localStorage.setItem('github_pat_token', fetchedToken);
                return fetchedToken;
            }
        } catch (_e) {}

        return null;
    };

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

            // Tính toán mốc thời gian cào/đồng bộ mail gần nhất
            let latestActivityMs = 0;
            let latestActivityDate = '';
            if (group.activities && group.activities.length > 0) {
                group.activities.forEach(act => {
                    const actTime = new Date(act.created_at || (act as any).date_created || 0).getTime();
                    if (!isNaN(actTime) && actTime > latestActivityMs) {
                        latestActivityMs = actTime;
                        latestActivityDate = act.created_at || (act as any).date_created || '';
                    }
                });
            }

            const nowMs = Date.now();
            const isRecentlySynced = latestActivityMs > 0 && (nowMs - latestActivityMs) < (24 * 60 * 60 * 1000); // Nạp trong 24h
            const recentSyncCount = group.activities ? group.activities.filter(a => {
                const t = new Date(a.created_at || (a as any).date_created || 0).getTime();
                return !isNaN(t) && (nowMs - t) < (24 * 60 * 60 * 1000);
            }).length : 0;

            // Kiểm tra trạng thái Đã xử lý / Chờ xử lý
            const customProps = customDataMap[fp] || {};
            const isProcessed = customProps.is_processed === true;
            const isOverdue = !isProcessed && latestActivityMs > 0 && (nowMs - latestActivityMs) >= (24 * 60 * 60 * 1000);

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
                    status,
                    lastSyncedAt: latestActivityDate,
                    lastSyncedMs: latestActivityMs,
                    isRecentlySynced,
                    recentSyncCount,
                    isProcessed,
                    isOverdue
                }
            };
        }).sort((a, b) => {
            // Đưa các dự án Chưa xử lý (UNPROCESSED) & Trễ quá 24h lên đầu tiên!
            if (!a.stats?.isProcessed && b.stats?.isProcessed) return -1;
            if (a.stats?.isProcessed && !b.stats?.isProcessed) return 1;
            return (b.stats?.lastSyncedMs || 0) - (a.stats?.lastSyncedMs || 0);
        });
    }, [activities, overviews, projects, customDataMap]);

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

            if (activeQuickFilter === 'UNPROCESSED') {
                return matchesSearch && g.stats?.isProcessed !== true && g.activities && g.activities.length > 0;
            }
            return matchesSearch;
        });
    }, [groupedProjects, searchTerm, activeQuickFilter]);

    const findMatchedProject = (group: ProjectGroup): Project | null => {
        if (!projects) return null;
        return projects.find(p => p.final_key === group.final_project || p.source_key === group.key_project || p.source_project_name === group.name_project) || null;
    };

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
                    {/* LIVE GITHUB ACTION STATUS BADGE & PROGRESS BANNER */}
                    <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                        !latestGhRun
                            ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            : latestGhRun.status === 'in_progress' || latestGhRun.status === 'queued'
                            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 animate-pulse shadow-sm'
                            : latestGhRun.conclusion === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}>
                        <div className="flex items-center gap-3">
                            {!latestGhRun ? (
                                <Loader2 className="w-4.5 h-4.5 text-indigo-500 animate-spin shrink-0" />
                            ) : latestGhRun.status === 'in_progress' || latestGhRun.status === 'queued' ? (
                                <RefreshCw className="w-4.5 h-4.5 text-amber-600 animate-spin shrink-0" />
                            ) : latestGhRun.conclusion === 'success' ? (
                                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                            ) : (
                                <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                            )}
                            <div>
                                <div className="flex items-center gap-2 font-bold flex-wrap">
                                    <span>⚙️ Giám Sát Tiến Độ GitHub Action {!latestGhRun ? '' : `#${latestGhRun.run_number}`}:</span>
                                    {!latestGhRun ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                            ĐANG KẾT NỐI GITHUB...
                                        </span>
                                    ) : (
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-black ${
                                            latestGhRun.status === 'in_progress' ? 'bg-amber-200 text-amber-900' :
                                            latestGhRun.conclusion === 'success' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                        }`}>
                                            {latestGhRun.status === 'in_progress' ? '⚡ ĐANG CHẠY (IN PROGRESS)' : latestGhRun.conclusion === 'success' ? '🟢 ĐÃ HOÀN THÀNH (SUCCESS)' : '🔴 THẤT BẠI / HỦY'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] opacity-80 mt-0.5">
                                    {!latestGhRun
                                        ? 'Đang kiểm tra dữ liệu kết lộ tới repository PM-POSM...'
                                        : latestGhRun.status === 'in_progress' 
                                        ? `Workflow đang cào Mail 4 giai đoạn & đẩy lên Drive (Bắt đầu lúc ${new Date(latestGhRun.created_at).toLocaleTimeString('vi-VN')})...`
                                        : `Lần cào gần nhất: ${new Date(latestGhRun.updated_at).toLocaleString('vi-VN')}`
                                    }
                                </p>
                            </div>
                        </div>
                        {latestGhRun && (
                            <a
                                href={latestGhRun.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[11px] shrink-0 transition-colors flex items-center justify-center gap-1 cursor-pointer text-slate-800 dark:text-slate-200 shadow-2xs"
                            >
                                <span>Xem tiến độ trên GitHub</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>

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
                    <div className="flex items-center gap-1.5">
                        <button
                            id="trigger-sync-mail-btn"
                            onClick={async () => {
                                try {
                                    setIsTriggeringSync(true);
                                    toast.loading('🚀 Đang gửi lệnh kích hoạt đồng bộ Mail tự động...', { id: 'sync_mail_toast' });

                                    const ghRepo = import.meta.env.VITE_GITHUB_REPO || 'thanglh9-maker/PM-POSM';
                                    const ghToken = await getSharedGithubToken();

                                    let dispatched = false;

                                    if (ghToken && ghToken.trim()) {
                                        try {
                                            const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/actions/workflows/manual-sync.yml/dispatches`, {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': `Bearer ${ghToken.trim()}`,
                                                    'Accept': 'application/vnd.github.v3+json',
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({ ref: 'main' })
                                            });

                                            if (ghRes.ok || ghRes.status === 204) {
                                                dispatched = true;
                                                toast.success('🚀 Đã gửi lệnh kích hoạt GitHub Action thành công! Hãy xem bảng tiến độ bên dưới.', { id: 'sync_mail_toast' });
                                                setTimeout(() => refetchGhRun(), 1000);
                                            }
                                        } catch (ghErr) {
                                            console.warn('Lỗi Dispatch GitHub:', ghErr);
                                        }
                                    }

                                    // Kích hoạt thêm Supabase Edge Function song song
                                    try {
                                        await supabase.functions.invoke('cron-sync-gmail');
                                    } catch (_ef) {}

                                    if (!dispatched) {
                                        toast.success('🚀 Đã gửi lệnh đồng bộ Mail 4 giai đoạn!', { id: 'sync_mail_toast' });
                                    }

                                    queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
                                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                                    queryClient.invalidateQueries({ queryKey: ['project_overviews_rpc'] });
                                } catch (e: any) {
                                    toast.error('Lỗi đồng bộ: ' + (e.message || 'Thất bại'), { id: 'sync_mail_toast' });
                                } finally {
                                    setIsTriggeringSync(false);
                                }
                            }}
                            disabled={isTriggeringSync}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            title="Kích hoạt quét Mail tự động 4 giai đoạn (1-click cho tất cả người dùng)"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringSync ? 'animate-spin' : ''}`} />
                            <span>{isTriggeringSync ? 'Đang gửi lệnh...' : '⚡ Đồng bộ Mail Dự Án'}</span>
                        </button>

                        <button
                            onClick={() => setIsTokenModalOpen(true)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
                            title="Cấu hình Token GitHub (Chỉ dùng nếu muốn cập nhật Token hệ thống)"
                        >
                            🔑
                        </button>
                    </div>
                </div>

                {/* QUICK FILTER STATUS TABS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                    <button
                        onClick={() => setActiveQuickFilter('ALL')}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeQuickFilter === 'ALL'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        <span>📌 Tất cả</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-white/20 font-mono font-bold">
                            {groupedProjects.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveQuickFilter('UNPROCESSED')}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeQuickFilter === 'UNPROCESSED'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                        }`}
                    >
                        <span>📥 Chờ xử lý</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono font-black">
                            {groupedProjects.filter(g => !g.stats?.isProcessed && g.activities && g.activities.length > 0).length}
                        </span>
                        {groupedProjects.some(g => g.stats?.isOverdue) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-600 text-white font-mono font-black animate-pulse">
                                ⚠️ CÓ CA QUÁ 24H
                            </span>
                        )}
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

        {/* GITHUB PAT TOKEN MODAL */}
        {isTokenModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl p-5 border border-indigo-200 dark:border-indigo-900 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                            🔑 Cấu Hình Token GitHub Chia Sẻ Hệ Thống
                        </h3>
                        <button onClick={() => setIsTokenModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Lưu Token PAT 1 lần duy nhất để **tất cả người dùng (điện thoại di động, máy tính khác)** bấm 1-click là tự động kích hoạt GitHub Action Workflow trên repo <b>thanglh9-maker/PM-POSM</b>.
                    </p>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                        <p className="font-bold">📌 Hướng dẫn tạo GitHub Token trong 30 giây:</p>
                        <ol className="list-decimal pl-4 space-y-0.5">
                            <li>Vào GitHub ➔ <b>Settings</b> ➔ <b>Developer settings</b> ➔ <b>Personal access tokens</b> ➔ <b>Tokens (classic)</b>.</li>
                            <li>Bấm <b>Generate new token (classic)</b>.</li>
                            <li>Tích chọn quyền: <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 rounded">repo</span> và <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 rounded">workflow</span>.</li>
                            <li>Coppy đoạn token dạng <span className="font-mono font-bold">ghp_xxxx...</span> dán vào ô bên dưới.</li>
                        </ol>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            Dán GitHub PAT Token (VD: <span className="font-mono text-indigo-600">ghp_xxxx...</span>):
                        </label>
                        <input
                            type="password"
                            value={patTokenInput}
                            onChange={(e) => setPatTokenInput(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                        <button
                            onClick={() => setIsTokenModalOpen(false)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={async () => {
                                const trimmed = patTokenInput.trim();
                                if (!trimmed) {
                                    toast.error('Vui lòng dán Token GitHub PAT!');
                                    return;
                                }
                                localStorage.setItem('github_pat_token', trimmed);
                                
                                // Lưu token chung vào DB project_activities để tất cả thiết bị khác (Mobile, máy khác) tự dùng chung!
                                try {
                                    await supabase.from('project_activities').insert({
                                        final_project: '__SYSTEM_CONFIG_GITHUB_TOKEN__',
                                        key_project: trimmed,
                                        name_project: 'GitHub System Token',
                                        title_mail: 'System Configuration',
                                        created_at: new Date().toISOString()
                                    });
                                } catch (_e) {}

                                setIsTokenModalOpen(false);
                                toast.success('✅ Đã lưu Token chia sẻ hệ thống! Đang kích hoạt Workflow trên GitHub...');
                                setTimeout(() => {
                                    document.getElementById('trigger-sync-mail-btn')?.click();
                                }, 300);
                            }}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
                        >
                            💾 Lưu Token Chia Sẻ & Kích Hoạt Ngay
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
);
}