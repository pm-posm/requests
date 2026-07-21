import React from 'react';
import { Settings, X } from 'lucide-react';

export function ProjectActionHeader({
    projectGroup,
    activeTab,
    setActiveTab,
    storeItemsCount,
    onClose
}: any) {
    return (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/10 shrink-0">
            <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500 animate-spin-slow" />
                    Trung tâm Quản lý & Trích xuất
                </h3>
                <p className="text-xs text-slate-500 mt-1">Dự án: {projectGroup.final_project} | {projectGroup.name_project}</p>
            </div>
            
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('EXTRACT')}
                    className={`px-6 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'EXTRACT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Trích xuất Excel
                </button>
                <button 
                    onClick={() => setActiveTab('MASTER')}
                    className={`px-6 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'MASTER' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Dữ liệu Master Store ({storeItemsCount})
                </button>
            </div>

            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors bg-slate-100 dark:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
            </button>
        </div>
    );
}
