import React from 'react';
import type { StoreItem, ActivityRow } from '@/types';
import { ManageMasterDataModal } from '../MasterData/ManageMasterDataModal';
import { useStoreItemsData } from '@/hooks/useStoreItemsData';
import { supabase } from '@/lib/supabase';
import { useStorePhasesByProject, computePhaseStatus } from '@/hooks/useStorePhases';
import { useCustomFields } from '@/hooks/useCustomFields';
import { StoreItemsHeader } from './StoreItemsHeader';
import { StoreItemsTable } from './StoreItemsTable';
import { StoreItemsLogs } from './StoreItemsLogs';
import { ManageFieldsModal } from '../StoreManager/modals/ManageFieldsModal';
import { Toaster, toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export function StoreItemsList({ 
    finalProjectName,
    hasSurvey = false,
    hasInstall = false,
    hasAccept = false,
    activities = [],
    onlyPublished = false,
    externalPhaseFilter
}: { 
    finalProjectName: string,
    hasSurvey?: boolean,
    hasInstall?: boolean,
    hasAccept?: boolean,
    activities?: ActivityRow[],
    onlyPublished?: boolean,
    externalPhaseFilter?: string
}) {
    const [activeTab, setActiveTab] = React.useState<'stores' | 'logs'>('stores');
    const [showManageModal, setShowManageModal] = React.useState(false);
    const [showManageFieldsModal, setShowManageFieldsModal] = React.useState(false);

    // Search and filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [phaseFilter, setPhaseFilter] = React.useState('ALL');
    const [supplierFilter, setSupplierFilter] = React.useState('ALL');

    React.useEffect(() => {
        if (externalPhaseFilter !== undefined) {
            setPhaseFilter(externalPhaseFilter);
        }
    }, [externalPhaseFilter]);

    const {
        storeItems,
        isLoading,
        suppliers,
        visTechs,
        logs,
        isLoadingLogs,
        addSupplierMutation,
        deleteSupplierMutation,
        addVisTechMutation,
        deleteVisTechMutation
    } = useStoreItemsData(finalProjectName, onlyPublished, activeTab);

    const { data: phases = [] } = useStorePhasesByProject(finalProjectName);
    const { fields = [] } = useCustomFields(finalProjectName);

    // Create map of current phase for each store
    const phaseMap = React.useMemo(() => {
        const m = new Map<string, any>();
        phases.forEach(p => {
            const item = storeItems?.find(s => s.id === p.store_item_id);
            if (item && p.phase === item.current_phase) m.set(p.store_item_id, p);
        });
        return m;
    }, [phases, storeItems]);

    // Filter store items based on search and selected filters
    const filteredStoreItems = React.useMemo(() => {
        if (!storeItems) return [];
        return storeItems.filter(item => {
            // Search filter
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase().trim();
                const codeMatch = item.store_code?.toLowerCase().includes(query);
                const nameMatch = item.store_name?.toLowerCase().includes(query);
                if (!codeMatch && !nameMatch) return false;
            }
            // Phase filter
            if (phaseFilter !== 'ALL') {
                const currentP = item.current_phase || 'Khảo sát';
                if (currentP !== phaseFilter) return false;
            }
            // Supplier filter
            if (supplierFilter !== 'ALL') {
                if (item.supplier_name !== supplierFilter) return false;
            }
            return true;
        });
    }, [storeItems, searchTerm, phaseFilter, supplierFilter]);

    if (isLoading) return <div className="text-xs text-slate-400 py-1.5 animate-pulse pl-3">Đang tải danh sách store...</div>;
    if (!storeItems || storeItems.length === 0) return null;

    const total = storeItems.length;
    let completed = 0;
    let errors = 0;
    let late = 0;

    storeItems.forEach(s => {
        const phaseData = phaseMap.get(s.id);
        const { status, isLate } = computePhaseStatus(phaseData);
        if (status === 'completed') completed++;
        else if (status === 'error') errors++;
        else if (isLate) late++;
    });

    const pending = total - completed - errors - late;

    const handleExportExcel = () => {
        if (!storeItems || storeItems.length === 0) {
            toast.error('Không có dữ liệu để xuất báo cáo!');
            return;
        }
        const dataToExport = storeItems.map((s, idx) => {
            const phaseData = phaseMap.get(s.id);
            const statusObj = computePhaseStatus(phaseData);
            return {
                'STT': idx + 1,
                'Mã CH': s.store_code,
                'Tên CH': s.store_name,
                'Region': s.region || '',
                'Khách hàng': s.customer || '',
                'Nhà thầu': s.supplier_name || '',
                'Vis-Tech': s.vis_tech || '',
                'Giai đoạn': s.current_phase || 'Khảo sát',
                'Trạng thái': statusObj.label,
                'Từ ngày (Dự kiến)': phaseData?.expected_start || '',
                'Đến ngày (Dự kiến)': phaseData?.expected_end || '',
                'Ngày thực tế': phaseData?.actual_date || '',
                'Kết quả': phaseData?.result || '',
                'Lý do lỗi': phaseData?.fail_reason || '',
                'Ghi chú': phaseData?.notes || ''
            };
        });
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BaoCao_TienDo');
        XLSX.writeFile(wb, `BaoCao_Stores_${finalProjectName}_${Date.now()}.xlsx`);
        toast.success('Đã xuất báo cáo Excel thành công!');
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl space-y-3 mt-3 shadow-xs relative">
            <Toaster position="top-right" />
            
            <StoreItemsHeader 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                total={total}
                completed={completed}
                errors={errors}
                late={late}
                pending={pending}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                phaseFilter={phaseFilter}
                setPhaseFilter={setPhaseFilter}
                supplierFilter={supplierFilter}
                setSupplierFilter={setSupplierFilter}
                suppliers={suppliers}
                setShowManageModal={setShowManageModal}
                setShowManageFieldsModal={setShowManageFieldsModal}
                onExportExcel={handleExportExcel}
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

            <ManageFieldsModal
                isOpen={showManageFieldsModal}
                onClose={() => setShowManageFieldsModal(false)}
                projectId={finalProjectName}
            />

            {activeTab === 'stores' ? (
                <StoreItemsTable 
                    storeItems={filteredStoreItems}
                    phases={phases}
                    visTechs={visTechs}
                    suppliers={suppliers}
                    customFields={fields}
                    finalProjectName={finalProjectName}
                />
            ) : (
                <StoreItemsLogs logs={logs} isLoadingLogs={isLoadingLogs} />
            )}
        </div>
    );
}