import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CheckCircle2 } from 'lucide-react';
import type { ProjectGroup } from '@/types';
import toast from 'react-hot-toast';

import { useProjectActionModal } from '@/hooks/useProjectActionModal';
import { ProjectActionHeader } from './ProjectActionHeader';
import { ProjectActionSidebar } from './ProjectActionSidebar';
import { ProjectActionExtract } from './ProjectActionExtract';
import { StoreItemsList } from '../Dashboard/StoreItemsList';

export function UnifiedProjectActionModal({ 
    projectGroup, 
    downloadFileId, 
    setDownloadFileId, 
    onClose 
}: {
    projectGroup: ProjectGroup;
    downloadFileId?: string;
    setDownloadFileId?: (id?: string) => void;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    
    const {
        downloading,
        activeTab, setActiveTab,
        selectedFile, setSelectedFile,
        briefStatus, setBriefStatus,
        saveBriefMutation,
        headers, excelRows, headerRowIdx,
        showAdvancedMapping, setShowAdvancedMapping,
        globalSupplier, setGlobalSupplier, suppliers,
        mapping, setMapping,
        loading, success,
        allExcelFiles,
        storeItems,
        selectedRows, setSelectedRows,
        allValidRows, newRows, existingRows,
        toggleRow, handleImportAll,
        masterDirMap
    } = useProjectActionModal(projectGroup, downloadFileId, setDownloadFileId);

    const handlePublish = async () => {
        const { error } = await supabase
            .from('project_store_items')
            .update({ is_published: true })
            .eq('final_project', projectGroup.final_project)
            .eq('is_published', false);
        if (error) { toast.error('Lỗi: ' + error.message); return; }
        queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
        toast.success('Đã chốt và công bố dữ liệu thành công!');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-[90vw] lg:max-w-7xl shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in fade-in zoom-in-95 duration-150 relative">
                {success && (
                    <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce mb-2" />
                        <h4 className="text-xl font-bold text-emerald-700">Đồng bộ {selectedRows.size} cửa hàng thành công!</h4>
                    </div>
                )}
                
                <ProjectActionHeader 
                    projectGroup={projectGroup}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    storeItemsCount={storeItems?.length || 0}
                    onClose={onClose}
                />
                
                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    <ProjectActionSidebar 
                        briefStatus={briefStatus}
                        setBriefStatus={setBriefStatus}
                        saveBriefMutation={saveBriefMutation}
                        allExcelFiles={allExcelFiles}
                        downloadFileId={downloadFileId}
                        setDownloadFileId={setDownloadFileId}
                        setSelectedFile={setSelectedFile}
                        setActiveTab={setActiveTab}
                    />

                    {/* Right Content */}
                    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
                        {activeTab === 'MASTER' ? (
                            <div className="flex-1 flex flex-col h-full overflow-hidden">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Dữ liệu Master Store (Nội bộ)</h4>
                                        <p className="text-xs text-slate-500">Đây là bản nháp, các thay đổi tại đây chưa hiển thị ra bên ngoài.</p>
                                    </div>
                                    <button 
                                        onClick={handlePublish}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Lưu & Công bố Dữ liệu
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <StoreItemsList 
                                        finalProjectName={projectGroup.final_project}
                                        hasSurvey={projectGroup.activities.some(a => a.phase_type === 'SURVEY')}
                                        hasInstall={projectGroup.activities.some(a => a.phase_type === 'INSTALLATION')}
                                        hasAccept={projectGroup.activities.some(a => a.phase_type === 'ACCEPTANCE')}
                                        activities={projectGroup.activities}
                                        onlyPublished={false}
                                    />
                                </div>
                            </div>
                        ) : (
                            <ProjectActionExtract 
                                downloading={downloading}
                                downloadFileId={downloadFileId}
                                selectedFile={selectedFile}
                                selectedRows={selectedRows}
                                setSelectedRows={setSelectedRows}
                                allValidRows={allValidRows}
                                newRows={newRows}
                                existingRows={existingRows}
                                toggleRow={toggleRow}
                                handleImportAll={handleImportAll}
                                loading={loading}
                                headers={headers}
                                showAdvancedMapping={showAdvancedMapping}
                                setShowAdvancedMapping={setShowAdvancedMapping}
                                globalSupplier={globalSupplier}
                                setGlobalSupplier={setGlobalSupplier}
                                suppliers={suppliers}
                                mapping={mapping}
                                setMapping={setMapping}
                                headerRowIdx={headerRowIdx}
                                masterDirMap={masterDirMap}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
