import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import type { StoreItem, StorePhase } from '@/types';
import { computePhaseStatus } from '@/hooks/useStorePhases';
import { normalizeDataResponser } from '@/services/sheetSyncService';
import { useRawRequests } from '@/hooks/useRawRequests';
import { StorePlanCommandCenterHeader } from '@/components/Dashboard/StorePlanCommandCenterHeader';
import { 
    Search, Store, FolderKanban, ArrowLeft, Hash, Copy, Check, Eye, ExternalLink, 
    CheckCircle2, Clock, Building2, User, Layers, FileText, ArrowRight, ShieldCheck, Mail, Briefcase, MessageSquare, X, CheckSquare, Sparkles, Calendar, Tag, Table, BarChart3 
} from 'lucide-react';

interface ProjectDetailItem {
    id?: string;
    project_code: string;
    project_name: string;
    source: 'MASTER_STORE' | 'RAW_REQUEST';
    current_phase?: string;
    supplier_name?: string;
    vis_tech?: string;
    category?: string;
    expected_start?: string | null;
    expected_end?: string | null;
    status_label?: string;
    status_color?: string;
    requestCount: number;
}

interface StoreGroupedData {
    store_code: string;
    store_name: string;
    customer: string;
    ka: string;
    region: string;
    sr_name: string;
    mer_name: string;
    masterStoreProjects: ProjectDetailItem[];
    requests: RawRequestRecord[];
    totalRequests: number;
    completedRequests: number;
    inProgressRequests: number;
    toDoRequests: number;
    completionPercentage: number;
}

export function StorePlanBoardPage() {
    const [activeModuleTab, setActiveModuleTab] = useState<'DATA_LIST' | 'ANALYST'>('DATA_LIST');
    const [searchTerm, setSearchTerm] = useState('');
    const [regionFilter, setRegionFilter] = useState('ALL');
    const [customerFilter, setCustomerFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [projectPhaseFilter, setProjectPhaseFilter] = useState('ALL');
    const [activeQuickFilter, setActiveQuickFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'BEHIND_SCHEDULE'>('ALL');
    
    // State for viewing a specific Store Detail Component by Key
    const [selectedStoreKey, setSelectedStoreKey] = useState<string | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState<'PROJECTS' | 'REQUESTS'>('PROJECTS');
    const [selectedDataResponserRecord, setSelectedDataResponserRecord] = useState<RawRequestRecord | null>(null);
    const [selectedNotesRecord, setSelectedNotesRecord] = useState<RawRequestRecord | null>(null);

    const { updateRequest } = useRawRequests();

    // 1. Fetch raw requests from Supabase
    const { data: requests = [], isLoading: isLoadingRequests } = useQuery<RawRequestRecord[]>({
        queryKey: ['raw_requests_store_plan'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('raw_requests')
                .select('*')
                .eq('is_deleted_in_sheet', false)
                .order('sheet_row_index', { ascending: true });

            if (error) throw error;
            return data as RawRequestRecord[];
        }
    });

    // 2. Fetch master store directory for metadata
    const { data: masterStores = [] } = useQuery({
        queryKey: ['master_stores_metadata'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('master_stores_directory')
                .select('store_code, store_name, customer, ka, region, mer_name, sr_name');
            
            if (error) return [];
            return data || [];
        },
        staleTime: 5 * 60 * 1000
    });

    // 3. Fetch ONLY PUBLISHED projects from Master Store Items (`project_store_items` where is_published = true)
    const { data: storeItems = [] } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items_master_published_only'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_store_items')
                .select('*')
                .eq('is_published', true);
            
            if (error) {
                console.error("Error fetching project_store_items:", error);
                return [];
            }
            return data || [];
        }
    });

    // 4. Fetch store phases for timelines
    const { data: storePhases = [] } = useQuery<StorePhase[]>({
        queryKey: ['project_store_phases_all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_store_phases')
                .select('*');
            if (error) return [];
            return data || [];
        }
    });

    // Fast lookup maps
    const masterStoresMap = useMemo(() => {
        const map = new Map<string, any>();
        masterStores.forEach(s => {
            if (s.store_code) map.set(s.store_code.toUpperCase().trim(), s);
        });
        return map;
    }, [masterStores]);

    // 5. Group requests & published master projects by Store
    const storeGroups = useMemo<StoreGroupedData[]>(() => {
        const map = new Map<string, StoreGroupedData>();

        // Helper to get or create store entry
        const getOrCreateStore = (storeCodeRaw: string, storeNameRaw?: string) => {
            const storeCode = (storeCodeRaw || '').toUpperCase().trim() || 'NO_CODE';
            const storeName = storeNameRaw?.trim() || 'Cửa hàng chưa xác định';
            const storeKey = storeCode !== 'NO_CODE' ? storeCode : `NAME_${storeName}`;

            const masterInfo = masterStoresMap.get(storeCode);

            if (!map.has(storeKey)) {
                map.set(storeKey, {
                    store_code: storeCode !== 'NO_CODE' ? storeCode : '-',
                    store_name: storeName,
                    customer: masterInfo?.customer || '-',
                    ka: masterInfo?.ka || '-',
                    region: masterInfo?.region || '-',
                    sr_name: masterInfo?.sr_name || '-',
                    mer_name: masterInfo?.mer_name || '-',
                    masterStoreProjects: [],
                    requests: [],
                    totalRequests: 0,
                    completedRequests: 0,
                    inProgressRequests: 0,
                    toDoRequests: 0,
                    completionPercentage: 0
                });
            }
            return map.get(storeKey)!;
        };

        // A. Populate ONLY from Published Master Store Items (`project_store_items` where is_published = true)
        storeItems.forEach(si => {
            const group = getOrCreateStore(si.store_code, si.store_name);
            if (si.customer && group.customer === '-') group.customer = si.customer;
            if (si.ka && group.ka === '-') group.ka = si.ka;
            if (si.region && group.region === '-') group.region = si.region;
            if (si.sr && group.sr_name === '-') group.sr_name = si.sr;
            if (si.vis_tech && group.mer_name === '-') group.mer_name = si.vis_tech;

            const prjName = si.final_project || si.project_name || 'Dự án chưa đặt tên';
            const existingPrj = group.masterStoreProjects.find(p => p.project_name === prjName);

            if (!existingPrj) {
                // Find matching phase data for timeline
                const phaseData = storePhases.find(p => p.store_item_id === si.id && p.phase === (si.current_phase || 'Brief'));
                const computed = computePhaseStatus(phaseData);

                group.masterStoreProjects.push({
                    id: si.id,
                    project_code: prjName,
                    project_name: prjName,
                    source: 'MASTER_STORE',
                    current_phase: si.current_phase || 'Brief',
                    supplier_name: si.supplier_name || '-',
                    vis_tech: si.vis_tech || '-',
                    category: si.category || 'POSM',
                    expected_start: phaseData?.expected_start,
                    expected_end: phaseData?.expected_end,
                    status_label: computed.label,
                    status_color: computed.status === 'completed' ? 'emerald' : computed.status === 'late' ? 'rose' : computed.status === 'in_progress' ? 'indigo' : 'slate',
                    requestCount: 0
                });
            }
        });

        // B. Populate from Raw Requests (`raw_requests`)
        requests.forEach(r => {
            const group = getOrCreateStore(r.ess_store_code, r.store_name);
            group.requests.push(r);

            if (r.customer && group.customer === '-') group.customer = r.customer;
            if (r.sr && group.sr_name === '-') group.sr_name = r.sr;
            if (r.mer && group.mer_name === '-') group.mer_name = r.mer;

            // Increment requestCount for matching published projects
            const prjCode = r.ma_du_an?.trim() || r.title_email_request?.trim();
            if (prjCode) {
                let prj = group.masterStoreProjects.find(p => p.project_code === prjCode || p.project_name === prjCode);
                if (prj) {
                    prj.requestCount++;
                }
            }

            // Categorize completion status
            const tienDo = (r.tien_do || '').toLowerCase();
            const status = (r.status || '').toLowerCase();

            if (status.includes('cancel') || status.includes('reject') || tienDo.includes('hoàn thành') || status.includes('approve')) {
                group.completedRequests++;
            } else if (tienDo.includes('vis') || tienDo.includes('supplier') || tienDo.includes('quick fix') || status.includes('review') || status.includes('sent')) {
                group.inProgressRequests++;
            } else {
                group.toDoRequests++;
            }
        });

        // Compute completion percentage
        return Array.from(map.values()).map(group => {
            group.totalRequests = group.requests.length;
            group.completionPercentage = group.totalRequests > 0 
                ? Math.round((group.completedRequests / group.totalRequests) * 100) 
                : 0;
            return group;
        });
    }, [requests, storeItems, storePhases, masterStoresMap]);

    // Dynamic Filter Options
    const regionsList = useMemo(() => {
        const set = new Set<string>();
        storeGroups.forEach(g => { if (g.region && g.region !== '-') set.add(g.region); });
        return Array.from(set).sort();
    }, [storeGroups]);

    const customersList = useMemo(() => {
        const set = new Set<string>();
        storeGroups.forEach(g => { if (g.customer && g.customer !== '-') set.add(g.customer); });
        return Array.from(set).sort();
    }, [storeGroups]);

    // Unique Project Phases for filter
    const projectPhasesList = useMemo(() => {
        const set = new Set<string>();
        storeGroups.forEach(g => {
            g.masterStoreProjects.forEach(p => {
                if (p.current_phase) set.add(p.current_phase);
            });
        });
        return Array.from(set).sort();
    }, [storeGroups]);

    // Filter Store Groups
    const filteredStoreGroups = useMemo(() => {
        return storeGroups.filter(g => {
            const matchesSearch = !searchTerm.trim() || 
                g.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.store_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.mer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.sr_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.masterStoreProjects.some(p => p.project_code.toLowerCase().includes(searchTerm.toLowerCase()) || p.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                g.requests.some(r => (r.request_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.posm || '').toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesRegion = regionFilter === 'ALL' || g.region === regionFilter;
            const matchesCustomer = customerFilter === 'ALL' || g.customer === customerFilter;

            let matchesStatus = true;
            if (statusFilter === 'COMPLETED') matchesStatus = g.completionPercentage === 100;
            else if (statusFilter === 'IN_PROGRESS') matchesStatus = g.inProgressRequests > 0 || (g.completionPercentage > 0 && g.completionPercentage < 100);
            else if (statusFilter === 'TO_DO') matchesStatus = g.toDoRequests > 0 && g.completionPercentage === 0;

            let matchesPhase = true;
            if (projectPhaseFilter !== 'ALL') {
                matchesPhase = g.masterStoreProjects.some(p => p.current_phase === projectPhaseFilter);
            }

            let matchesQuick = true;
            if (activeQuickFilter === 'COMPLETED') matchesQuick = g.completionPercentage === 100;
            else if (activeQuickFilter === 'IN_PROGRESS') matchesQuick = g.inProgressRequests > 0 || (g.completionPercentage > 0 && g.completionPercentage < 100);
            else if (activeQuickFilter === 'BEHIND_SCHEDULE') matchesQuick = g.completionPercentage < 50;

            return matchesSearch && matchesRegion && matchesCustomer && matchesStatus && matchesPhase && matchesQuick;
        });
    }, [storeGroups, searchTerm, regionFilter, customerFilter, statusFilter, projectPhaseFilter, activeQuickFilter]);

    // Resolve currently selected store object safely
    const selectedStore = useMemo(() => {
        if (!selectedStoreKey) return null;
        return storeGroups.find(g => (g.store_code !== '-' && g.store_code === selectedStoreKey) || g.store_name === selectedStoreKey) || null;
    }, [selectedStoreKey, storeGroups]);

    // Modals Component Renderer Helper
    const renderSharedModals = () => (
        <>
            {/* Notes Viewer Modal for SR note, Vis note, Mer note */}
            {selectedNotesRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                        Chi Tiết 3 Ghi Chú Request
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Store: {selectedNotesRecord.store_name} ({selectedNotesRecord.ess_store_code})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedNotesRecord(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
                            {/* 1. SR Note */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                                    📌 SR Note:
                                </span>
                                <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                    {selectedNotesRecord.sr_note || <span className="text-slate-400 italic">Chưa có ghi chú lỗi chi tiết từ SR</span>}
                                </div>
                            </div>

                            {/* 2. Vis Note */}
                            <div className="p-3 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-1">
                                <span className="font-bold text-sky-900 dark:text-sky-200 block text-[11px]">
                                    🏢 Vis Note:
                                </span>
                                <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                    {selectedNotesRecord.vis_note || <span className="text-slate-400 italic">Chưa có phản hồi từ Team Vis văn phòng</span>}
                                </div>
                            </div>

                            {/* 3. Mer Note */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] flex items-center gap-1.5">
                                        🛠️ Mer Note:
                                    </span>
                                    <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                                        ✍️ Tự động lưu & Auto-Push Sheet
                                    </span>
                                </div>
                                <textarea
                                    defaultValue={selectedNotesRecord.mer_note || ''}
                                    placeholder="Nhập ghi chú xử lý của Mer tại đây..."
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== (selectedNotesRecord.mer_note || '')) {
                                            updateRequest(selectedNotesRecord.id!, { mer_note: val });
                                            setSelectedNotesRecord({ ...selectedNotesRecord, mer_note: val });
                                        }
                                    }}
                                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500 outline-none resize-y min-h-[80px]"
                                />
                                <p className="text-[10px] text-slate-500 italic">
                                    💡 Ghi chú sẽ tự động được lưu trên Dashboard & Auto-push về Google Sheet Source!
                                </p>
                            </div>

                        </div>

                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
                            <button
                                onClick={() => setSelectedNotesRecord(null)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Responser Detail Modal */}
            {selectedDataResponserRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-amber-600" />
                                <div>
                                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                        Chi Tiết Data Responser
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Store: {selectedDataResponserRecord.store_name} ({selectedDataResponserRecord.ess_store_code})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDataResponserRecord(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3 text-xs overflow-y-auto custom-scrollbar">
                            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 font-mono text-slate-800 dark:text-slate-200 text-xs leading-relaxed select-all">
                                {normalizeDataResponser(selectedDataResponserRecord.data_responser)}
                            </div>
                            <details className="pt-1">
                                <summary className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer font-mono">
                                    ▶ Xem chuỗi JSON gốc từ SharePoint
                                </summary>
                                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] break-all mt-2 select-all overflow-x-auto">
                                    {selectedDataResponserRecord.data_responser}
                                </div>
                            </details>
                        </div>

                        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
                            <button
                                onClick={() => setSelectedDataResponserRecord(null)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );

    // --- RENDER 1: DETAILED STORE COMPONENT (IF A STORE IS CLICKED) ---
    if (selectedStore) {
        return (
            <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Top Bar with Back Button */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setSelectedStoreKey(null)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4 text-indigo-600" />
                            Quay lại danh sách Cửa hàng
                        </button>
                    </div>

                    {/* Store Information Card Header */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                    {selectedStore.store_code}
                                </span>
                                <span className="text-xs font-bold text-slate-500">
                                    Hệ thống: {selectedStore.customer} {selectedStore.ka !== '-' ? `/ ${selectedStore.ka}` : ''}
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                                {selectedStore.store_name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    SR: <strong className="text-slate-800 dark:text-slate-200">{selectedStore.sr_name}</strong>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Building2 className="w-4 h-4 text-blue-500" />
                                    Mer: <strong className="text-slate-800 dark:text-slate-200">{selectedStore.mer_name}</strong>
                                </span>
                            </div>
                        </div>

                        {/* Progress Stats Box */}
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">Tiến Độ Store:</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                        {selectedStore.completionPercentage}%
                                    </span>
                                    <span className="text-xs text-slate-500 font-semibold">
                                        ({selectedStore.completedRequests}/{selectedStore.totalRequests} Xong)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2 Clean Component Tabs: TAB 1: DỰ ÁN vs TAB 2: REQUEST POSM */}
                    <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
                        <button
                            onClick={() => setActiveDetailTab('PROJECTS')}
                            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                                activeDetailTab === 'PROJECTS'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 rounded-t-xl'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            <span>📁 TAB 1: DỰ ÁN ĐANG CHẠY ({selectedStore.masterStoreProjects.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveDetailTab('REQUESTS')}
                            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                                activeDetailTab === 'REQUESTS'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 rounded-t-xl'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            <span>📋 TAB 2: REQUEST POSM CHI TIẾT ({selectedStore.requests.length})</span>
                        </button>
                    </div>

                    {/* TAB 1 CONTENT: DỰ ÁN TỪ MASTER STORE */}
                    {activeDetailTab === 'PROJECTS' && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                    Danh Sách Các Dự Án Đang Triển Khai Tại Siêu Thị
                                </h3>
                            </div>

                            {selectedStore.masterStoreProjects.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                    Cửa hàng này chưa có Dự án nào được công bố từ Tổng hợp dự án.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedStore.masterStoreProjects.map((prj, i) => (
                                        <div key={i} className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
                                            
                                            {/* Header with Project Status Badge */}
                                            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                                                <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                                                    {prj.project_name}
                                                </div>
                                                {prj.status_label && (
                                                    <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                                                        prj.status_color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        prj.status_color === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    }`}>
                                                        {prj.status_label}
                                                    </span>
                                                )}
                                            </div>

                                            {/* 4 Separate Clean Metadata Fields */}
                                            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 space-y-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Giai đoạn (Phase)</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                        {prj.current_phase || 'Brief'}
                                                    </span>
                                                </div>

                                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 space-y-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-slate-400" />
                                                        Mốc thời gian
                                                    </span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                                                        {prj.expected_start ? (
                                                            `${prj.expected_start} ${prj.expected_end ? `➔ ${prj.expected_end}` : ''}`
                                                        ) : (
                                                            'Chưa lên lịch'
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 space-y-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                                        <Tag className="w-3 h-3 text-slate-400" />
                                                        Loại POSM
                                                    </span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {prj.category || 'POSM'}
                                                    </span>
                                                </div>

                                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 space-y-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                                        <Building2 className="w-3 h-3 text-slate-400" />
                                                        Nhà Cung Cấp
                                                    </span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                        {prj.supplier_name && prj.supplier_name !== '-' ? prj.supplier_name : 'Chưa phân công'}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2 CONTENT: REQUEST POSM SUBTASKS WITH DATA RESPONSER & 3 NOTES VIEWER BUTTON */}
                    {activeDetailTab === 'REQUESTS' && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                    Danh Sách Chi Tiết Request POSM (Liên kết Dự Án)
                                </h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase">
                                        <tr>
                                            <th className="p-3.5 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">Request ID</th>
                                            <th className="p-3.5 min-w-[200px]">Mã & Tên Dự Án</th>
                                            <th className="p-3.5">Hạng Mục POSM</th>
                                            <th className="p-3.5">SR Yêu Cầu</th>
                                            <th className="p-3.5">Phương Án</th>
                                            <th className="p-3.5">Trạng Thái</th>
                                            <th className="p-3.5">Thời Gian</th>
                                            <th className="p-3.5 text-center">Data Responser</th>
                                            <th className="p-3.5 text-center bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">Ghi Chú (Notes)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selectedStore.requests.map((r, rIdx) => (
                                            <tr key={r.id || rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                
                                                {/* Request ID (Fix VIS-..., never REQ-#...) */}
                                                <td className="p-3.5">
                                                    {r.request_id ? (
                                                        <div className="font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-800 shadow-2xs inline-flex items-center gap-1">
                                                            📋 {r.request_id}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs font-mono font-medium">+ Subtask</span>
                                                    )}
                                                </td>

                                                {/* Mã & Tên Dự Án (FIELD FORCE REQUEST) */}
                                                <td className="p-3.5">
                                                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                        <span>🏷️ {r.ma_du_an || 'FIELD FORCE REQUEST'}</span>
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-snug mt-0.5">
                                                        {r.title_email_request || r.ma_du_an || 'Chưa liên kết tên dự án'}
                                                    </div>
                                                </td>

                                                {/* Hạng mục POSM */}
                                                <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                                                    {r.posm} {r.brand ? `(${r.brand})` : ''}
                                                </td>

                                                {/* SR Yêu cầu */}
                                                <td className="p-3.5 font-medium">{r.sr || '-'}</td>

                                                {/* Phương Án */}
                                                <td className="p-3.5 font-semibold text-indigo-700 dark:text-indigo-300">
                                                    {r.phuong_an || 'Visibility Request'}
                                                </td>

                                                {/* Trạng Thái */}
                                                <td className="p-3.5">
                                                    <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                        {r.status || 'To Do'}
                                                    </span>
                                                </td>

                                                {/* Thời gian */}
                                                <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                                                    {r.date_of_rq || '-'}
                                                </td>

                                                {/* Data Responser */}
                                                <td className="p-3.5 text-center">
                                                    {r.data_responser && r.data_responser.trim() !== '' ? (
                                                        <button
                                                            onClick={() => setSelectedDataResponserRecord(r)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-mono text-[11px] rounded-lg border border-amber-300 dark:border-amber-700 hover:border-amber-500 transition-colors cursor-pointer"
                                                        >
                                                            <span className="truncate max-w-[130px]">{normalizeDataResponser(r.data_responser)}</span>
                                                            <Eye className="w-3 h-3 text-amber-600 shrink-0" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700 text-[10px] italic">Không có dữ liệu</span>
                                                    )}
                                                </td>

                                                {/* Ghi Chú (Notes Viewer Button) */}
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        onClick={() => setSelectedNotesRecord(r)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 font-bold text-[11px] rounded-lg border border-blue-300 dark:border-blue-700 hover:border-blue-500 transition-colors cursor-pointer"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                        <span>Xem 3 Ghi Chú</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                {renderSharedModals()}
            </div>
        );
    }

    // --- RENDER 2: MASTER STORE TABLE VIEW (MAIN PAGE) ---
    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-4">
                
                {/* 🚨 EXECUTIVE STORE PLAN COMMAND CENTER HEADER */}
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <FolderKanban className="w-8 h-8 text-indigo-600" />
                            Kế Hoạch theo Store (Store Matrix Board)
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Tổng hợp danh sách Cửa hàng đang chạy Dự án & Request. Click dòng để mở trang chi tiết.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-2xs">
                            <Store className="w-4 h-4 text-indigo-500" />
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">Cửa Hàng Active:</span>
                                <span className="font-bold text-xs text-slate-900 dark:text-white">{storeGroups.length} Store</span>
                            </div>
                        </div>
                    </div>
                </div>

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
                            {filteredStoreGroups.length}
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
                        <StorePlanCommandCenterHeader
                            storesData={storeGroups}
                            activeQuickFilter={activeQuickFilter}
                            onSelectQuickFilter={setActiveQuickFilter}
                        />
                    </div>
                )}

                {/* TAB 2: CLEAN OPERATIONAL DATA LIST WORKSPACE */}
                {activeModuleTab === 'DATA_LIST' && (
                    <div className="space-y-4">

                        {/* Filter & Search Bar */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm theo Siêu thị, Mã Store, Mã Dự Án, SR, Mer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={projectPhaseFilter}
                            onChange={e => setProjectPhaseFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200 font-bold outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả Giai đoạn Dự án</option>
                            {projectPhasesList.map(ph => (
                                <option key={ph} value={ph}>Giai đoạn: {ph}</option>
                            ))}
                        </select>

                        <select
                            value={regionFilter}
                            onChange={e => setRegionFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả Vùng miền</option>
                            {regionsList.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        <select
                            value={customerFilter}
                            onChange={e => setCustomerFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả Hệ thống</option>
                            {customersList.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white font-medium outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả Trạng thái Store</option>
                            <option value="IN_PROGRESS">Đang Triển Khai</option>
                            <option value="COMPLETED">Đã Hoàn Thành 100%</option>
                            <option value="TO_DO">Mới Tiếp Nhận</option>
                        </select>
                    </div>
                </div>

                {/* Master Store Table View */}
                {isLoadingRequests ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 font-medium border border-slate-200 dark:border-slate-700">
                        Đang tổng hợp kế hoạch theo cửa hàng...
                    </div>
                ) : filteredStoreGroups.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 font-medium border border-slate-200 dark:border-slate-700">
                        Không tìm thấy Cửa hàng nào phù hợp với bộ lọc hiện tại.
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 min-w-[220px]">Store Name / Store Code</th>
                                        <th className="p-4 min-w-[180px]">Hệ thống (KA / Customer)</th>
                                        <th className="p-4 min-w-[200px]">SR (Quản lý CH) / Mer (Vis Tech)</th>
                                        <th className="p-4 min-w-[120px] text-center">Dự Án</th>
                                        <th className="p-4 min-w-[120px] text-center">Request</th>
                                        <th className="p-4 min-w-[160px]">Tiến Độ Store</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                    {filteredStoreGroups.map((g, idx) => {
                                        const storeKey = g.store_code !== '-' ? g.store_code : g.store_name;
                                        return (
                                            <tr 
                                                key={storeKey}
                                                onClick={() => setSelectedStoreKey(storeKey)}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group"
                                            >
                                                {/* 1. Store Name / Store Code */}
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600">
                                                        {g.store_name}
                                                    </div>
                                                    <div className="mt-1">
                                                        <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                            {g.store_code}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 2. Hệ thống (KA / Customer) */}
                                                <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                                    <div>{g.customer}</div>
                                                    <div className="text-[10px] text-slate-400">{g.ka !== '-' ? g.ka : g.region}</div>
                                                </td>

                                                {/* 3. SR (Quản lý CH) / Mer (Vis Tech) */}
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                                        {g.sr_name} <span className="text-[10px] text-slate-400 font-normal">(SR)</span>
                                                    </div>
                                                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                                        {g.mer_name} <span className="text-[10px] text-slate-400 font-normal">(Mer)</span>
                                                    </div>
                                                </td>

                                                {/* 4. Dự Án (Số lượng) */}
                                                <td className="p-4 text-center font-bold">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                                        📦 {g.masterStoreProjects.length} Dự án
                                                    </span>
                                                </td>

                                                {/* 5. Request (Số lượng) */}
                                                <td className="p-4 text-center font-bold">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                                                        📋 {g.totalRequests} Request
                                                    </span>
                                                </td>

                                                {/* 6. Tiến Độ Store */}
                                                <td className="p-4">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`font-bold text-xs ${
                                                            g.completionPercentage === 100 ? 'text-emerald-600' : (g.completionPercentage > 0 ? 'text-blue-600' : 'text-slate-500')
                                                        }`}>
                                                            {g.completionPercentage}%
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">{g.completedRequests}/{g.totalRequests} Xong</span>
                                                    </div>
                                                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-300 ${
                                                                g.completionPercentage === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                                                            }`} 
                                                            style={{ width: `${g.completionPercentage}%` }} 
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </div>
            )}
            </div>

            {renderSharedModals()}
        </div>
    );
}
