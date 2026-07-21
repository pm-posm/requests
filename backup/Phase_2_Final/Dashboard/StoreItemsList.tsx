import React from 'react';
import type { StoreItem, ActivityRow } from '@/types';
import { ManageMasterDataModal } from '../MasterData/ManageMasterDataModal';
import { ModernPhaseModal } from './ModernPhaseModal';
import { useStoreItemsData } from '@/hooks/useStoreItemsData';
import { supabase } from '@/lib/supabase';
import { useStorePhasesByProject } from '@/hooks/useStorePhases';
import { StoreItemsHeader } from './StoreItemsHeader';
import { StoreItemsTable } from './StoreItemsTable';
import { StoreItemsLogs } from './StoreItemsLogs';
import { Toaster } from 'react-hot-toast';

export function StoreItemsList({ 
    finalProjectName,
    hasSurvey = false,
    hasInstall = false,
    hasAccept = false,
    activities = [],
    onlyPublished = false
}: { 
    finalProjectName: string,
    hasSurvey?: boolean,
    hasInstall?: boolean,
    hasAccept?: boolean,
    activities?: ActivityRow[],
    onlyPublished?: boolean
}) {
    const [activeTab, setActiveTab] = React.useState<'stores' | 'logs'>('stores');
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [drawerItem, setDrawerItem] = React.useState<StoreItem | null>(null);
    const [drawerPhase, setDrawerPhase] = React.useState('');
    const [showManageModal, setShowManageModal] = React.useState(false);

    const {
        storeItems,
        isLoading,
        suppliers,
        visTechs,
        logs,
        isLoadingLogs,
        updateFieldMutation,
        deleteItemMutation,
        addSupplierMutation,
        deleteSupplierMutation,
        addVisTechMutation,
        deleteVisTechMutation,
        handleBulkVisTech,
        handleBulkPhase,
        handleBulkCategory,
        handleBulkSupplier
    } = useStoreItemsData(finalProjectName, onlyPublished, activeTab);

    const { data: phases = [] } = useStorePhasesByProject(finalProjectName);

    if (isLoading) return <div className="text-xs text-slate-400 py-1.5 animate-pulse pl-3">Đang tải danh sách store...</div>;
    if (!storeItems || storeItems.length === 0) return null;

    const total = storeItems.length;
    const completed = storeItems.filter(s => s.acceptance_status === 'Hoàn tất' || s.acceptance_status === 'Đạt').length;
    const errors = storeItems.filter(s => s.survey_status === 'Lỗi' || s.installation_status === 'Lỗi' || s.acceptance_status === 'Lỗi').length;
    const pending = total - completed - errors;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl space-y-3 mt-3 shadow-xs relative">
            <Toaster position="top-right" />
            
            <StoreItemsHeader 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                total={total}
                completed={completed}
                errors={errors}
                pending={pending}
                setShowManageModal={setShowManageModal}
            />

            <ManageMasterDataModal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                suppliers={suppliers}
                visTechs={visTechs}
                onAddSupplier={(name) => addSupplierMutation.mutate(name)}
                onDeleteSupplier={(id) => deleteSupplierMutation.mutate(id)}
                onAddVisTech={(name) => addVisTechMutation.mutate(name)}
                onDeleteVisTech={(id) => deleteVisTechMutation.mutate(id)}
            />

            {activeTab === 'stores' ? (
                <StoreItemsTable 
                    storeItems={storeItems}
                    phases={phases}
                    visTechs={visTechs}
                    suppliers={suppliers}
                />
            ) : (
                <StoreItemsLogs logs={logs} isLoadingLogs={isLoadingLogs} />
            )}
        </div>
    );
}