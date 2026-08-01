import React from 'react';
import { Toaster } from 'react-hot-toast';
import type { ProjectGroup, StoreItem } from '@/types';

import { useExcelImport } from '@/hooks/useExcelImport';
import { useStoreManager } from '@/hooks/useStoreManager';
import { useStorePhasesByProject, useUpsertStorePhase, useBulkUpsertStorePhases, getValidPhasesForDecision } from '@/hooks/useStorePhases';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

import { StoreManagerHeader } from './StoreManagerHeader';
import { StoreManagerSidebar } from './StoreManagerSidebar';
import { ExtractTab } from './tabs/ExtractTab';
import { MasterStoreTab } from './tabs/MasterStoreTab';
import { PhaseDetailModal } from './modals/PhaseDetailModal';
import { AddStoreModal } from './modals/AddStoreModal';

interface StoreManagerModalProps {
    projectGroup: ProjectGroup;
    downloadFileId?: string;
    setDownloadFileId?: (id?: string) => void;
    defaultPhase?: string;
    onClose: () => void;
}

export function StoreManagerModal({ projectGroup, downloadFileId, setDownloadFileId, defaultPhase, onClose }: StoreManagerModalProps) {
    const [activeTab, setActiveTab] = React.useState<'EXTRACT' | 'MASTER'>('EXTRACT');

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const [phaseModalItems, setPhaseModalItems] = React.useState<StoreItem[]>([]);
    const [phaseModalPhase, setPhaseModalPhase] = React.useState<'Brief' | 'Khảo sát' | 'NTXX' | 'Lắp đặt'>((defaultPhase as any) || 'Khảo sát');

    React.useEffect(() => {
        if (defaultPhase) {
            setPhaseModalPhase(defaultPhase as any);
        }
    }, [defaultPhase]);
    const [addStoreOpen, setAddStoreOpen] = React.useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [lastAddedStore, setLastAddedStore] = React.useState<any>(null);

    // Hooks
    const excel = useExcelImport(projectGroup, downloadFileId, setDownloadFileId);
    const store = useStoreManager(projectGroup);
    const { data: phases = [] } = useStorePhasesByProject(projectGroup.final_project);
    const { fields: customFields = [] } = useCustomFields(projectGroup.final_project);
    const upsertPhase = useUpsertStorePhase(projectGroup.final_project);
    const bulkUpsertPhases = useBulkUpsertStorePhases(projectGroup.final_project);

    const draftCount = store.storeItems.filter(s => !s.is_published).length;

    const { data: briefDecision, isLoading: decisionLoading } = useQuery({
        queryKey: ['project_decision', projectGroup.final_project, 'BRIEF'],
        queryFn: async () => {
            const { data } = await supabase
                .from('project_decisions')
                .select('*')
                .eq('final_project', projectGroup.final_project)
                .eq('phase_type', 'BRIEF')
                .maybeSingle();
            return data || null;
        }
    });

    const isPosmTypeConfigured = !!briefDecision?.decision_status;

    const handleOpenPhaseModal = (items: StoreItem[]) => {
        if (items.length === 0) return;
        setPhaseModalItems(items);
        setPhaseModalPhase((items[0].current_phase as any) || 'Khảo sát');
        setActiveTab('MASTER'); // Stay in master tab
    };

    const handleBulkUpdate = async (field: string, value: string) => {
        await store.bulkUpdate(field, value);
    };

    const handleAddStore = async (storeData: any) => {
        const result = await store.addStoreMutation.mutateAsync(storeData);
        if (result && result.length > 0) {
            setLastAddedStore(result[0]);
        }
    };

    const handleUpdateExpectedDate = async (itemId: string, field: 'start' | 'end', date: string) => {
        const item = store.storeItems.find(s => s.id === itemId);
        if (!item) return;
        const phaseName = (item.current_phase || 'Khảo sát') as 'Brief' | 'Khảo sát' | 'NTXX' | 'Lắp đặt';
        
        // Lấy phase hiện tại để giữ lại các trường cũ (expected_start hoặc expected_end)
        const existingPhase = phases.find(p => p.store_item_id === itemId && p.phase === phaseName);
        
        await upsertPhase.mutateAsync({
            store_item_id: itemId,
            phase: phaseName,
            expected_start: field === 'start' ? date : (existingPhase?.expected_start || null),
            expected_end: field === 'end' ? date : (existingPhase?.expected_end || null)
        });
    };

    const handleBulkExpectedDate = async (field: 'start' | 'end', date: string, selectedIds: Set<string>) => {
        const targets = selectedIds.size > 0 
            ? store.storeItems.filter(i => selectedIds.has(i.id)) 
            : store.storeItems;
        
        const phaseUpdates = targets.map(item => {
            const phaseName = (item.current_phase || 'Khảo sát') as 'Brief' | 'Khảo sát' | 'NTXX' | 'Lắp đặt';
            const existingPhase = phases.find(p => p.store_item_id === item.id && p.phase === phaseName);
            
            return {
                store_item_id: item.id,
                phase: phaseName,
                expected_start: field === 'start' ? date : (existingPhase?.expected_start || null),
                expected_end: field === 'end' ? date : (existingPhase?.expected_end || null)
            };
        });

        await bulkUpsertPhases.mutateAsync(phaseUpdates);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
            <Toaster position="top-right" containerStyle={{ zIndex: 999999 }} />
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 relative"
                style={{ maxWidth: '92vw', height: '92vh', maxHeight: '900px' }}
            >
                {/* Full-screen Loading Overlay for Bulk Actions */}
                {store.publishAllMutation.isPending && (
                    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-indigo-100 dark:border-indigo-900/30 animate-in zoom-in-95 duration-300">
                            <div className="relative w-16 h-16 mb-6">
                                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-slate-700 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 text-center tracking-tight">Đang đồng bộ dữ liệu...</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center mb-6 leading-relaxed">
                                Quá trình lưu và công bố hàng loạt đang diễn ra. Xin vui lòng đợi và không đóng cửa sổ này.
                            </p>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full w-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <StoreManagerHeader
                    projectGroup={projectGroup}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    storeCount={store.storeItems.length}
                    draftCount={draftCount}
                    onClose={onClose}
                />

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <StoreManagerSidebar
                        projectGroup={projectGroup}
                        downloadFileId={downloadFileId}
                        setDownloadFileId={setDownloadFileId}
                        setSelectedFile={excel.setSelectedFile}
                        setActiveTab={setActiveTab}
                        isCollapsed={isSidebarCollapsed}
                        setIsCollapsed={setIsSidebarCollapsed}
                    />

                    {/* Main content */}
                    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden relative">
                        {!decisionLoading && !isPosmTypeConfigured && (
                            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-900/50 max-w-sm text-center">
                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Bắt buộc chọn Loại hình POSM</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Vui lòng cấu hình Loại hình POSM ở menu bên trái (thanh Sidebar) trước khi tiếp tục thao tác với dự án này.
                                    </p>
                                </div>
                            </div>
                        )}
                        {activeTab === 'EXTRACT' ? (
                            <ExtractTab
                                projectGroup={projectGroup}
                                downloading={excel.downloading}
                                downloadFileId={downloadFileId}
                                selectedFile={excel.selectedFile}
                                selectedRows={excel.selectedRows}
                                setSelectedRows={excel.setSelectedRows}
                                allValidRows={excel.allValidRows}
                                newRows={excel.newRows}
                                existingRows={excel.existingRows}
                                toggleRow={excel.toggleRow}
                                handleImportAll={excel.handleImportAll}
                                loading={excel.loading}
                                success={excel.success}
                                headers={excel.headers}
                                showAdvancedMapping={excel.showAdvancedMapping}
                                setShowAdvancedMapping={excel.setShowAdvancedMapping}
                                mapping={excel.mapping}
                                setMapping={excel.setMapping}
                                storeCount={store.storeItems.length}
                                onAddStore={() => setAddStoreOpen(true)}
                                lastAddedStore={lastAddedStore}
                            />
                        ) : (
                            <MasterStoreTab
                                storeItems={store.storeItems}
                                phases={phases}
                                visTechs={store.visTechs}
                                suppliers={store.suppliers}
                                updateField={(id, field, value) => store.updateFieldMutation.mutate({ id, field, value })}
                                onDelete={id => store.deleteItemMutation.mutate(id)}
                                onBulkDelete={ids => store.bulkDeleteMutation.mutate(ids)}
                                onOpenPhaseModal={handleOpenPhaseModal}
                                onBulkVisTech={(val, ids) => store.bulkUpdateSpecific('vis_tech', val, Array.from(ids))}
                                onBulkSupplier={(val, ids) => store.bulkUpdateSpecific('supplier_name', val, Array.from(ids))}
                                onBulkPhase={(val, ids) => store.bulkUpdateSpecific('current_phase', val, Array.from(ids))}
                                onPublish={() => store.publishAllMutation.mutate()}
                                isPublishing={store.publishAllMutation.isPending}
                                onUpdateExpectedDate={handleUpdateExpectedDate}
                                onBulkExpectedDate={handleBulkExpectedDate}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Phase Detail Modal */}
            <PhaseDetailModal 
                isOpen={phaseModalItems.length > 0} 
                onClose={() => setPhaseModalItems([])} 
                items={phaseModalItems}
                defaultPhase={phaseModalPhase}
                visTechs={store.visTechs}
                finalProject={projectGroup.final_project}
                validPhases={getValidPhasesForDecision(briefDecision?.decision_status)}
                onPhaseSaved={async (phase, itemIds) => {
                    // Update current_phase of those items
                    for (const id of itemIds) {
                        await store.updateFieldMutation.mutateAsync({ id, field: 'current_phase', value: phase });
                    }
                }}
            />

            {/* Add Store Modal */}
            <AddStoreModal
                isOpen={addStoreOpen}
                onClose={() => setAddStoreOpen(false)}
                onSave={handleAddStore}
            />
        </div>
    );
}
