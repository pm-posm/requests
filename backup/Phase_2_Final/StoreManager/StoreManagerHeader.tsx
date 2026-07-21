import React from 'react';
import { X, Settings2, Database } from 'lucide-react';
import type { ProjectGroup } from '@/types';

interface StoreManagerHeaderProps {
    projectGroup: ProjectGroup;
    activeTab: 'EXTRACT' | 'MASTER';
    setActiveTab: (t: 'EXTRACT' | 'MASTER') => void;
    storeCount: number;
    draftCount: number;
    onClose: () => void;
}

export function StoreManagerHeader({ projectGroup, activeTab, setActiveTab, storeCount, draftCount, onClose }: StoreManagerHeaderProps) {
    return (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            {/* Left: project info */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                    <Settings2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trung tâm Quản lý & Trích xuất</p>
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[400px]">
                        Dự án: {projectGroup.final_project}
                    </p>
                </div>
            </div>

            {/* Center: tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                <TabButton
                    active={activeTab === 'EXTRACT'}
                    onClick={() => setActiveTab('EXTRACT')}
                    icon={<Settings2 className="w-3.5 h-3.5" />}
                    label="Trích xuất Excel"
                />
                <TabButton
                    active={activeTab === 'MASTER'}
                    onClick={() => setActiveTab('MASTER')}
                    icon={<Database className="w-3.5 h-3.5" />}
                    label={`Dữ liệu Master Store`}
                    badge={storeCount > 0 ? storeCount : undefined}
                    badgeColor={draftCount > 0 ? 'bg-amber-400 text-white' : 'bg-indigo-500 text-white'}
                />
            </div>

            {/* Right: close */}
            <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
}

function TabButton({ active, onClick, icon, label, badge, badgeColor }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: number;
    badgeColor?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                active
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
            {icon}
            {label}
            {badge !== undefined && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}
