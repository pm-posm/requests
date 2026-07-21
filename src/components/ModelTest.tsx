import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProjects, type Project } from '@/hooks/useProjects';
import { Loader2, Search } from 'lucide-react';
import type { ProjectGroup, ActivityRow } from '@/types';
import { ProjectTable } from './ProjectList/ProjectTable';
import { StoreManagerModal } from './StoreManager/StoreManagerModal';

export default function ModelTest() {
    const navigate = useNavigate();
    const { data: projects, isLoading: projectsLoading } = useProjects();
    const [searchTerm, setSearchTerm] = React.useState('');

    // States for Excel import modal
    const [showUnifiedModal, setShowUnifiedModal] = React.useState<boolean>(false);
    const [importingProject, setImportingProject] = React.useState<ProjectGroup | null>(null);
    const [downloadFileId, setDownloadFileId] = React.useState<string | undefined>(undefined);

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
                stats: { customer, storeCount, supplier, phase, posmType, status }
            };
        }).sort((a, b) => b.final_project.localeCompare(a.final_project));
    }, [activities, overviews, projects]);

    // Hàm so khớp bản ghi Model với bảng posm_projects
    const findMatchedProject = React.useCallback((group: ProjectGroup): Project | null => {
        if (!projects || projects.length === 0) return null;

        return projects.find(p => {
            const keyMatch = p.source_key && group.key_project && 
                p.source_key.trim().toLowerCase() === group.key_project.trim().toLowerCase();
            
            const nameMatch = p.source_project_name && group.name_project && 
                p.source_project_name.trim().toLowerCase() === group.name_project.trim().toLowerCase();
            
            const finalKeyMatch = p.final_key && group.final_project && 
                p.final_key.trim().toLowerCase() === group.final_project.trim().toLowerCase();

            return !!(keyMatch || nameMatch || finalKeyMatch);
        }) || null;
    }, [projects]);

    // Lọc dữ liệu hiển thị theo tìm kiếm
    const filteredGroups = React.useMemo(() => {
        if (!groupedProjects) return [];
        if (!searchTerm) return groupedProjects;

        const term = searchTerm.toLowerCase();
        return groupedProjects.filter(group => {
            const matchedProj = findMatchedProject(group);
            return (
                group.final_project.toLowerCase().includes(term) ||
                (group.key_project || '').toLowerCase().includes(term) ||
                (group.name_project || '').toLowerCase().includes(term) ||
                (matchedProj?.store_name || '').toLowerCase().includes(term) ||
                (matchedProj?.store_code || '').toLowerCase().includes(term)
            );
        });
    }, [groupedProjects, searchTerm, findMatchedProject]);

    const isLoading = projectsLoading || activitiesLoading || overviewsLoading;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-500 font-medium">Đang tải và tổng hợp dữ liệu POSM Projects...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative z-0 pb-12">
            <div className="absolute top-0 left-0 w-full h-[400px] overflow-hidden -z-10 pointer-events-none opacity-40">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
                <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
            </div>
            
            {/* Header & Local Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="relative w-full sm:max-w-md group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dự án..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 rounded-md text-sm outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Bảng dữ liệu Project (Table View) */}
            <div className="relative z-0">
                <ProjectTable 
                    groups={filteredGroups}
                    findMatchedProject={findMatchedProject}
                    onRowClick={(group) => navigate(`/project/${group.final_project}`)}
                />
            </div>

            {showUnifiedModal && importingProject && (
                <StoreManagerModal 
                    projectGroup={importingProject} 
                    downloadFileId={downloadFileId}
                    setDownloadFileId={setDownloadFileId}
                    onClose={() => {
                        setShowUnifiedModal(false);
                        setImportingProject(null);
                        setDownloadFileId(undefined);
                    }} 
                />
            )}
        </div>
    );
}