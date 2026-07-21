import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const cleanSubject = (subject: string) => {
    return subject.replace(/^(?:(?:Re|Fw|Fwd)\s*[:\-]\s*)+/gi, '').trim();
};

export function useTrackingData(searchTerm: string, monthFilter: string, currentPage: number, pageSize: number) {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);

    // Fetch raw data
    const { data: trackingData, isLoading } = useQuery({
        queryKey: ['tracking_data'],
        queryFn: async () => {
            let allData: any[] = [];
            let page = 0;
            const size = 1000;
            
            while (true) {
                const { data, error } = await supabase
                    .from('project_progress_ai')
                    .select('*')
                    .order('email_received_at', { ascending: false })
                    .range(page * size, (page + 1) * size - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    if (data.length < size) break;
                } else {
                    break;
                }
                page++;
            }
            return allData;
        },
        refetchInterval: 10000
    });

    // Grouping logic
    const { trackingCombined } = useMemo(() => {
        if (!trackingData) return { trackingCombined: [] };

        const subProjectGroups: Record<string, any[]> = {};
        trackingData.forEach(r => {
            const code = r.detected_project_code;
            if (!code) return;
            if (!subProjectGroups[code]) subProjectGroups[code] = [];
            subProjectGroups[code].push(r);
        });

        const combined = Object.entries(subProjectGroups).map(([subCode, spRecords]) => {
            spRecords.sort((a, b) => new Date(a.email_received_at).getTime() - new Date(b.email_received_at).getTime());
            
            const stageGroups: Record<string, any[]> = { brief: [], khao_sat: [], ntxx: [], lap_dat: [], thu_hoi: [] };
            const progress = {
                briefStatus: 'none', briefDate: null as string | null,
                khaoSatStatus: 'none', khaoSatDate: null as string | null,
                ntxxStatus: 'none', ntxxDate: null as string | null,
                lapDatStatus: 'none', lapDatDate: null as string | null,
                thuHoiStatus: 'none', thuHoiDate: null as string | null,
            };

            const getThread = (groupName: string, threadId: string, initialData: any) => {
                let thread = stageGroups[groupName].find(t => t.id === threadId);
                if (!thread) {
                    thread = initialData;
                    stageGroups[groupName].push(thread);
                }
                return thread;
            };

            spRecords.forEach(r => {
                const clean = cleanSubject(r.email_subject);
                const rDate = r.email_received_at;
                const lowerSubject = clean.toLowerCase();

                if (r.detected_status === 'brief') {
                    if (progress.briefStatus === 'none') { progress.briefStatus = 'review'; progress.briefDate = rDate; }
                    if (lowerSubject.includes('[brief confirmed]')) { progress.briefStatus = 'confirmed'; progress.briefDate = rDate; }
                    else if (lowerSubject.includes('[brief rejected]')) { progress.briefStatus = 'rejected'; progress.briefDate = rDate; }
                    const thread = getThread('brief', clean, { id: clean, cleanSubject: clean, latestStatus: 'brief', originalTime: rDate, latestTime: rDate, records: [] });
                    thread.records.push(r); thread.latestTime = rDate;
                }
                else if (['khao_sat', 'hoan_thanh_khao_sat'].includes(r.detected_status)) {
                    if (progress.khaoSatStatus === 'none') { progress.khaoSatStatus = 'in_progress'; progress.khaoSatDate = rDate; }
                    if (r.detected_status === 'hoan_thanh_khao_sat') { progress.khaoSatStatus = 'completed'; progress.khaoSatDate = rDate; }
                    const thread = getThread('khao_sat', clean, { id: clean, cleanSubject: clean, latestStatus: r.detected_status, originalTime: rDate, latestTime: rDate, records: [] });
                    thread.records.push(r); thread.latestTime = rDate;
                }
                else if (r.detected_status === 'ntxx') {
                    if (progress.ntxxStatus === 'none') { progress.ntxxStatus = 'in_progress'; progress.ntxxDate = rDate; }
                    let targetPhase = null;
                    
                    if (r.linked_phase_id) {
                        targetPhase = stageGroups.ntxx.find((t: any) => t.id === r.linked_phase_id);
                    }
                    
                    if (!targetPhase) {
                        targetPhase = stageGroups.ntxx.find((t: any) => t.cleanSubject === clean);
                    }
                    
                    if (!targetPhase) {
                        targetPhase = { id: r.id, phaseIndex: r.phase_index || (stageGroups.ntxx.length + 1), cleanSubject: clean, latestStatus: 'ntxx', originalTime: rDate, latestTime: rDate, records: [] };
                        stageGroups.ntxx.push(targetPhase);
                    }
                    
                    targetPhase.records.push(r);
                    targetPhase.latestTime = rDate;
                }
                else if (['lap_dat', 'hoan_thanh_lap_dat'].includes(r.detected_status)) {
                    if (progress.lapDatStatus === 'none') { progress.lapDatStatus = 'in_progress'; progress.lapDatDate = rDate; }
                    if (r.detected_status === 'hoan_thanh_lap_dat') { progress.lapDatStatus = 'completed'; progress.lapDatDate = rDate; }
                    const thread = getThread('lap_dat', clean, { id: clean, cleanSubject: clean, latestStatus: r.detected_status, originalTime: rDate, latestTime: rDate, records: [] });
                    thread.records.push(r); thread.latestTime = rDate;
                }
                else if (['thu_hoi', 'hoan_tat_thu_hoi'].includes(r.detected_status)) {
                    if (progress.thuHoiStatus === 'none') { progress.thuHoiStatus = 'in_progress'; progress.thuHoiDate = rDate; }
                    if (r.detected_status === 'hoan_tat_thu_hoi') { progress.thuHoiStatus = 'completed'; progress.thuHoiDate = rDate; }
                    const thread = getThread('thu_hoi', clean, { id: clean, cleanSubject: clean, latestStatus: r.detected_status, originalTime: rDate, latestTime: rDate, records: [] });
                    thread.records.push(r); thread.latestTime = rDate;
                }
            });

            Object.values(stageGroups).forEach(group => {
                group.sort((a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime());
            });
            
            const spName = spRecords.find(r => r.detected_project_name)?.detected_project_name || spRecords[0].detected_project_name;
            const maxTime = Math.max(...spRecords.map(r => new Date(r.email_received_at).getTime()));

            return { subCode, projectName: spName, totalEvents: spRecords.length, stageGroups, progress, latestTime: maxTime };
        });

        combined.sort((a, b) => b.latestTime - a.latestTime);

        return { trackingCombined: combined };
    }, [trackingData]);

    const filteredCombined = useMemo(() => {
        let result = trackingCombined;
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(project => 
                project.subCode.toLowerCase().includes(lower) || 
                (project.projectName && project.projectName.toLowerCase().includes(lower))
            );
        }
        if (monthFilter) {
            const [year, month] = monthFilter.split('-');
            result = result.filter(project => {
                return Object.values(project.stageGroups).some((threads: any) =>
                    threads.some((thread: any) => 
                        thread.records.some((r: any) => {
                            const d = new Date(r.email_received_at);
                            return d.getFullYear().toString() === year && (d.getMonth() + 1).toString().padStart(2, '0') === month;
                        })
                    )
                );
            });
        }
        return result;
    }, [trackingCombined, searchTerm, monthFilter]);

    const paginatedCombined = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredCombined.slice(start, start + pageSize);
    }, [filteredCombined, currentPage, pageSize]);
    
    const totalPages = Math.max(1, Math.ceil(filteredCombined.length / pageSize));

    // Mutations
    const handleSaveName = async (code: string, newName: string) => {
        if (!newName.trim()) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('project_progress_ai')
                .update({ detected_project_name: newName.trim() })
                .like('detected_project_code', `${code}%`);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ['tracking_data'] });
            toast.success('Đã lưu tên dự án');
        } catch (err: any) {
            toast.error("Lỗi khi lưu tên dự án: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSupplier = async (recordId: string, currentNtxxDetails: any, newSupplierName: string) => {
        if (!newSupplierName.trim()) return;
        setIsSaving(true);
        try {
            const updatedDetails = { ...currentNtxxDetails, supplier: newSupplierName.trim() };
            const { error } = await supabase
                .from('project_progress_ai')
                .update({ ntxx_details: updatedDetails })
                .eq('id', recordId);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ['tracking_data'] });
            toast.success('Đã lưu tên nhà thầu');
        } catch (err: any) {
            toast.error("Lỗi khi lưu tên nhà thầu: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMergeProject = async (sourceCode: string, targetCode: string, targetName: string) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('project_progress_ai')
                .update({ 
                    detected_project_code: targetCode,
                    detected_project_name: targetName
                })
                .eq('detected_project_code', sourceCode);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ['tracking_data'] });
            toast.success('Đã gộp dự án thành công');
        } catch (err: any) {
            toast.error("Lỗi khi gộp dự án: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProject = async (code: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu của dự án này?')) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('project_progress_ai')
                .delete()
                .eq('detected_project_code', code);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ['tracking_data'] });
            toast.success('Đã xóa dự án thành công');
        } catch (err: any) {
            toast.error("Lỗi khi xóa dự án: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return {
        isLoading,
        isSaving,
        trackingCombined,
        paginatedCombined,
        totalPages,
        handleSaveName,
        handleSaveSupplier,
        handleMergeProject,
        handleDeleteProject
    };
}
