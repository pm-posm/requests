import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ProjectGroup } from '@/types';
import type { Project } from '@/hooks/useProjects';
import { ChevronRight, ChevronDown, Plus, CheckCircle2, AlertTriangle, Clock, Mail, ExternalLink, Filter, Search, Check, Save, X } from 'lucide-react';
import { useGlobalProjectFields, useGlobalProjectCustomData } from '../../hooks/useGlobalProjectFields';
import { ManageProjectFieldsModal } from './ManageProjectFieldsModal';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ProjectTableProps {
  groups: ProjectGroup[];
  findMatchedProject: (group: ProjectGroup) => Project | null;
  onRowClick: (group: ProjectGroup) => void;
  requestsMap?: Record<string, string[]>; // Mapping of final_project / key_project -> Request IDs
  onRequestClick?: (requestId: string) => void;
  onRefresh?: () => void;
}

// Helpers for precise time calculations & relative formatting
function formatExactTimestamp(dateObj: Date | null): string {
  if (!dateObj || isNaN(dateObj.getTime())) return 'Chưa có thời gian';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function formatRelativeTime(dateObj: Date | null): string {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const diffMs = Date.now() - dateObj.getTime();
  if (diffMs < 0) return 'Vừa mới đây';
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `cách đây ${diffDays} ngày`;
  if (diffHours > 0) return `cách đây ${diffHours} giờ`;
  if (diffMins > 0) return `cách đây ${diffMins} phút`;
  return 'vừa nạp';
}

function formatTimeDelta(currDate: Date | null, prevDate: Date | null): string {
  if (!currDate || !prevDate || isNaN(currDate.getTime()) || isNaN(prevDate.getTime())) return '';
  const diffMs = currDate.getTime() - prevDate.getTime();
  if (diffMs <= 0) return '';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;

  if (diffDays > 0) {
    return remHours > 0 ? `+${diffDays} ngày ${remHours}h từ email trước` : `+${diffDays} ngày từ email trước`;
  }
  if (diffHours > 0) {
    return `+${diffHours} giờ từ email trước`;
  }
  const diffMins = Math.floor(diffMs / (1000 * 60));
  return `+${Math.max(1, diffMins)} phút từ email trước`;
}

export function ProjectTable({ groups, findMatchedProject, onRowClick, requestsMap = {}, onRequestClick, onRefresh }: ProjectTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isManageFieldsOpen, setIsManageFieldsOpen] = useState(false);
  const [inboxFilterMode, setInboxFilterMode] = useState<'ALL' | 'UNREAD' | 'OVERDUE_24H'>('ALL');
  
  // Assign Request ID Popover state
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null);
  const [inputRequestId, setInputRequestId] = useState<string>('');
  const [isSavingAssign, setIsSavingAssign] = useState(false);
  const [syncPopoverProjectId, setSyncPopoverProjectId] = useState<string | null>(null);

  // Pagination state for high scalability
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Global Project Custom Fields & Data
  const { fields } = useGlobalProjectFields();
  const { customDataMap, updateField } = useGlobalProjectCustomData();
  const queryClient = useQueryClient();

  // Fetch available Request IDs & metadata for autocomplete suggestions & CAT/Brand/Quantity mapping
  const { data: availableRequests = [] } = useQuery({
    queryKey: ['available_raw_requests_for_assign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_requests')
        .select('request_id, sheet_row_index, project_name, customer, ma_du_an, brand, cat, posm, so_luong')
        .eq('is_deleted_in_sheet', false)
        .order('sheet_row_index', { ascending: true });
      if (error) return [];
      return data || [];
    },
    staleTime: 2 * 60 * 1000
  });

  // Extract unique suggestion strings for autocomplete
  const suggestionList = useMemo(() => {
    const set = new Set<string>();
    availableRequests.forEach(r => {
      if (r.request_id) set.add(String(r.request_id).trim());
      if (r.sheet_row_index) set.add(String(r.sheet_row_index).trim());
    });
    return Array.from(set).filter(Boolean);
  }, [availableRequests]);

  // Inline editing state for custom fields
  const [editingCell, setEditingCell] = useState<{ projectId: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleCellClick = (e: React.MouseEvent, projectId: string, fieldKey: string, currentValue: any) => {
    e.stopPropagation();
    setEditingCell({ projectId, fieldKey });
    setEditValue(currentValue || '');
  };

  const handleSaveCell = async (projectId: string, fieldKey: string) => {
    if (editingCell) {
      await updateField({ finalProject: projectId, fieldKey, value: editValue });
      setEditingCell(null);
    }
  };

  const navigate = useNavigate();

  // Direct Tab Navigation: Jump to Request POSM tab & search directly for clicked Request ID
  const handleJumpToRequestTab = (rid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { setMainMenu, setSearchTerm } = useDashboardStore.getState();
    setMainMenu('request');
    setSearchTerm(rid);
    navigate('/requests');
    if (onRequestClick) onRequestClick(rid);
    toast.success(`Đã chuyển tới tab Yêu Cầu POSM (lọc theo #${rid})!`);
  };

  // Handle assigning Request ID & syncing back to Google Sheet
  const handleAssignRequestId = async (finalProject: string, ridToAssign: string) => {
    if (!ridToAssign || !ridToAssign.trim()) {
      toast.error('Vui lòng nhập hoặc chọn Request ID!');
      return;
    }
    const cleanRid = ridToAssign.trim();
    try {
      setIsSavingAssign(true);

      // 1. Update posm_projects in Supabase
      await supabase
        .from('posm_projects')
        .update({ request_id: cleanRid })
        .or(`final_key.eq.${finalProject},source_project_name.eq.${finalProject}`);

      // 2. Update raw_requests in Supabase & mark for Google Sheet sync
      await supabase
        .from('raw_requests')
        .update({
          request_id: cleanRid,
          is_mer_modified: true,
          updated_at: new Date().toISOString()
        })
        .or(`ma_du_an.eq.${finalProject},request_key.eq.${finalProject}`);

      // 3. Update local custom data mapping for instant UI refresh
      const customDataRaw = localStorage.getItem('POSM_PROJECT_CUSTOM_DATA') || '{}';
      const parsedData = JSON.parse(customDataRaw);
      const existingReqs: string[] = parsedData[finalProject]?.assigned_request_ids || [];
      if (!existingReqs.includes(cleanRid)) {
        existingReqs.push(cleanRid);
      }
      parsedData[finalProject] = {
        ...(parsedData[finalProject] || {}),
        assigned_request_ids: existingReqs
      };
      localStorage.setItem('POSM_PROJECT_CUSTOM_DATA', JSON.stringify(parsedData));

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['raw_requests'] });
      if (onRefresh) onRefresh();

      toast.success(`Đã gán Request ID #${cleanRid} cho dự án và sẵn sàng đồng bộ Sheet!`);
      setAssigningProjectId(null);
      setInputRequestId('');
    } catch (err: any) {
      toast.error('Lỗi khi gán Request ID: ' + err.message);
    } finally {
      setIsSavingAssign(false);
    }
  };

  // Metrics for Inbox breakdown
  const { unprocessedTotal, overdueCount, freshCount } = useMemo(() => {
    let overdue = 0;
    let fresh = 0;
    groups.forEach(g => {
      if (!g.stats?.isProcessed) {
        if (g.stats?.isOverdue) overdue++;
        else fresh++;
      }
    });
    return {
      unprocessedTotal: overdue + fresh,
      overdueCount: overdue,
      freshCount: fresh
    };
  }, [groups]);

  const displayGroups = useMemo(() => {
    if (inboxFilterMode === 'UNREAD') {
      return groups.filter(g => !g.stats?.isProcessed);
    }
    if (inboxFilterMode === 'OVERDUE_24H') {
      return groups.filter(g => !g.stats?.isProcessed && g.stats?.isOverdue);
    }
    return groups;
  }, [groups, inboxFilterMode]);

  // Reset page to 1 whenever filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [inboxFilterMode, groups.length]);

  // Paginated slice for current page
  const totalPages = Math.ceil(displayGroups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayGroups.slice(start, start + pageSize);
  }, [displayGroups, currentPage, pageSize]);

  return (
    <div className="space-y-3">
      {/* MAIN PROJECT TABLE CONTAINER WITH STICKY HEADER & ALWAYS VISIBLE SCROLLBAR */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="max-h-[calc(100vh-210px)] overflow-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs tracking-wide sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-4 py-3">Mã dự án</th>
                <th className="px-4 py-3 w-1/4">Tên dự án & Email mới nhất</th>
                <th className="px-4 py-3 text-purple-700 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-950/20">Request ID</th>
                <th className="px-4 py-3 text-sky-700 dark:text-sky-400 bg-sky-50/30 dark:bg-sky-950/20 font-bold">Nhãn hàng</th>
                <th className="px-4 py-3">Loại hình POSM</th>
                <th className="px-4 py-3">Hệ thống</th>
                <th className="px-4 py-3 text-center">Số lượng store</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Giai đoạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-center text-slate-700 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-800/60 font-bold">ℹ️ Thông tin Sync &amp; Xử lý</th>
                
                {/* Dynamic Columns */}
                {fields.map(field => (
                  <th key={field.id} className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20">
                    {field.field_name}
                  </th>
                ))}

                {/* Add Custom Field Button */}
                <th className="px-2 py-3 w-10 text-center sticky right-0 bg-[#fcfcfc] dark:bg-slate-800 border-l border-neutral-200 dark:border-neutral-800">
                  <button 
                    onClick={() => setIsManageFieldsOpen(true)}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors"
                    title="Quản lý cột dự án (Custom Fields)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-800 text-neutral-700 dark:text-slate-300 text-xs">
              {displayGroups.length === 0 && (
                <tr>
                  <td colSpan={12 + fields.length} className="px-4 py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-1.5">
                      <Mail className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">Không có dự án nào trong danh sách này</p>
                      {inboxFilterMode !== 'ALL' && (
                        <button onClick={() => setInboxFilterMode('ALL')} className="text-xs text-indigo-600 underline font-semibold mt-1">
                          Hiển thị tất cả dự án
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {paginatedGroups.map(group => {
                const isExpanded = expandedRows.has(group.final_project);
                const projectData = customDataMap[group.final_project] || {};

                // Find matching Request IDs for this project
                const matchedRequestIds = requestsMap[group.final_project] || 
                                          (group.key_project ? requestsMap[group.key_project] : undefined) || 
                                          (group.name_project ? requestsMap[group.name_project] : undefined) || [];

                const assignedReqs: string[] = projectData['assigned_request_ids'] || [];
                const allRequestIds = Array.from(new Set([...matchedRequestIds, ...assignedReqs])).filter(Boolean);

                // Sort activities by date/time (newest first)
                const sortedActivities = group.activities ? [...group.activities].sort((a, b) => {
                  const timeA = new Date(a.created_at || (a as any).date_created || (a as any).email_received_at || 0).getTime();
                  const timeB = new Date(b.created_at || (b as any).date_created || (b as any).email_received_at || 0).getTime();
                  return timeB - timeA; // Newest email first
                }) : [];

                const latestEmail = sortedActivities[0];

                // Audit metadata for processed button
                const processedAt = projectData['processed_at'];
                const processedBy = projectData['processed_by'] || 'PM/Vận hành';
                const formattedProcessedTime = processedAt ? formatExactTimestamp(new Date(processedAt)) : '';

                // Find matched raw_request or activity for CAT, Brand, POSM, Quantity
                const matchedRawReq = availableRequests.find(r => 
                  (r.ma_du_an && r.ma_du_an.trim() === group.final_project) ||
                  (r.request_id && allRequestIds.includes(r.request_id))
                );

                const catValue = matchedRawReq?.cat || (group.activities.find(a => (a as any).cat)?.cat) || '';
                const brandValue = group.stats?.brand || projectData['brand'] || projectData['nhan_hang'] || matchedRawReq?.brand || (group.activities.find(a => (a as any).brand)?.brand) || '';
                const posmTypeVal = group.stats?.posmType && group.stats.posmType !== 'Chưa cấu hình' ? group.stats.posmType : (matchedRawReq?.posm || '');
                const soLuongVal = matchedRawReq?.so_luong || (group.activities.find(a => (a as any).so_luong)?.so_luong) || '';

                const isAssigningThisRow = assigningProjectId === group.final_project;

                // Filtered suggestions for autocomplete
                const filteredSuggestions = inputRequestId
                  ? suggestionList.filter(s => s.toLowerCase().includes(inputRequestId.toLowerCase())).slice(0, 6)
                  : suggestionList.slice(0, 6);

                let rowBgClass = 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group/row transition-colors';
                if (group.stats?.isOverdue && !group.stats?.isProcessed) {
                  rowBgClass = 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/40 border-l-4 border-l-rose-500';
                }

                return (
                  <React.Fragment key={group.final_project}>
                    <tr 
                      className={rowBgClass}
                      onClick={() => onRowClick(group)}
                    >
                      <td className="px-3 py-3" onClick={(e) => toggleRow(group.final_project, e)}>
                        <button className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {group.key_project || <span className="text-neutral-400 font-normal">{group.final_project}</span>}
                      </td>
                      
                      {/* Project Name + Smart Email Audit & Phase Alert Subtext */}
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-semibold text-neutral-900 dark:text-white truncate">
                          {group.name_project || group.final_project}
                        </div>
                        {latestEmail && (() => {
                          const latestEmailMs = new Date(latestEmail.created_at || (latestEmail as any).date_created || 0).getTime();
                          const processedAtMs = processedAt ? new Date(processedAt).getTime() : 0;
                          const hasUnreadNewMail = !group.stats?.isProcessed || latestEmailMs > (processedAtMs + 5000);
                          
                          // Check if latest email represents a new phase compared to previous email
                          const prevEmail = sortedActivities[1];
                          const isPhaseChanged = prevEmail && latestEmail.phase_type && prevEmail.phase_type && latestEmail.phase_type !== prevEmail.phase_type;
                          const phaseLabel = latestEmail.phase_type || group.stats?.phase || 'Chưa phân loại';

                          return (
                            <div className="text-[11px] font-normal truncate mt-0.5 flex items-center gap-1.5">
                              {hasUnreadNewMail ? (
                                isPhaseChanged ? (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shrink-0 animate-pulse">
                                    ⚡ Mail giai đoạn mới [{phaseLabel}]:
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0 animate-pulse">
                                    ⚡ Mail mới [{phaseLabel}]:
                                  </span>
                                )
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                  ✓ Mail đã xử lý [{phaseLabel}]:
                                </span>
                              )}

                              <span className={`truncate ${hasUnreadNewMail ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`} title={latestEmail.title_mail || latestEmail.phase_type}>
                                {latestEmail.title_mail || latestEmail.phase_type}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Request ID (Subtask) Column - DIRECT TAB JUMP & AUTOCOMPLETE ASSIGN */}
                      <td className="px-4 py-3 bg-purple-50/10 dark:bg-purple-950/10 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {allRequestIds.map(rid => (
                            <button
                              key={rid}
                              onClick={(e) => handleJumpToRequestTab(rid, e)}
                              className="font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100/90 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer group/rid shadow-2xs"
                              title={`Bấm để chuyển sang tab Yêu Cầu POSM và xem trực tiếp Request #${rid}`}
                            >
                              <span>📋 {rid}</span>
                              <ExternalLink className="w-3 h-3 text-purple-500 group-hover/rid:text-purple-700 transition-colors" />
                            </button>
                          ))}

                          {/* + Gán Request ID Button */}
                          {!isAssigningThisRow ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningProjectId(group.final_project);
                                setInputRequestId('');
                              }}
                              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-800 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-dashed border-purple-300 dark:border-purple-800 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                              title="Gán Request ID mới cho dự án này (Tự động đồng bộ Sheet)"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Gán ID</span>
                            </button>
                          ) : (
                            /* Autocomplete Input Popover */
                            <div className="relative flex items-center gap-1 z-[100]" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                type="text"
                                placeholder="Gõ VIS-..., BH-..."
                                value={inputRequestId}
                                onChange={(e) => setInputRequestId(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAssignRequestId(group.final_project, inputRequestId);
                                  if (e.key === 'Escape') setAssigningProjectId(null);
                                }}
                                className="w-32 bg-white dark:bg-slate-900 border border-purple-400 rounded px-2 py-0.5 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500 shadow-sm"
                              />

                              <button
                                onClick={() => handleAssignRequestId(group.final_project, inputRequestId)}
                                disabled={isSavingAssign}
                                className="p-1 bg-purple-600 hover:bg-purple-700 text-white rounded cursor-pointer transition-colors"
                                title="Lưu & Đồng bộ Sheet"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>

                              {/* Autocomplete Dropdown List */}
                              {filteredSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg shadow-xl py-1 text-xs z-[999] max-h-40 overflow-y-auto custom-scrollbar">
                                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                                    Gợi ý Request ID:
                                  </div>
                                  {filteredSuggestions.map((sug) => (
                                    <div
                                      key={sug}
                                      onClick={() => {
                                        setInputRequestId(sug);
                                        handleAssignRequestId(group.final_project, sug);
                                      }}
                                      className="px-2.5 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950 font-mono font-bold text-purple-700 dark:text-purple-300 cursor-pointer flex items-center justify-between transition-colors"
                                    >
                                      <span>📋 {sug}</span>
                                      <Check className="w-3 h-3 text-purple-500 opacity-0 hover:opacity-100" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Nhãn Hàng & CAT Column */}
                      <td className="px-4 py-3 bg-sky-50/10 dark:bg-sky-950/10">
                        {brandValue ? (
                          <div className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            <span>🏷️ {brandValue}</span>
                            {catValue && (
                              <span className="text-[10px] font-normal text-sky-600 dark:text-sky-400 font-mono bg-sky-200/60 dark:bg-sky-900/60 px-1 py-0.2 rounded">
                                ({catValue})
                              </span>
                            )}
                          </div>
                        ) : catValue ? (
                          <span className="font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            📂 {catValue}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs font-mono italic">-</span>
                        )}
                      </td>

                      {/* POSM & Số Lượng Column */}
                      <td className="px-4 py-3">
                        {posmTypeVal ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                            <span>{posmTypeVal}</span>
                            {soLuongVal && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-200/70 dark:bg-violet-900/80 text-violet-900 dark:text-violet-100">
                                (SL: {soLuongVal})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-500 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400">
                            Chưa cấu hình
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-slate-400 font-medium">
                        {group.stats?.customer || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-800 min-w-[2rem]">
                          {group.stats?.storeCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-slate-400 font-medium">
                        {group.stats?.supplier || '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {group.stats?.phase || '-'}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-slate-400 font-medium">
                        {group.stats?.status || '-'}
                      </td>

                      {/* Combined Trigger Column: Thông tin Sync & Xử lý */}
                      <td className="px-3 py-3 text-center bg-slate-50/40 dark:bg-slate-800/20" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSyncPopoverProjectId(group.final_project);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                            group.stats?.isProcessed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                              : group.stats?.isOverdue
                                ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
                          }`}
                          title="Bấm để mở thông tin xử lý inbox & mốc thời gian đồng bộ gần nhất"
                        >
                          {group.stats?.isProcessed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Đã xử lý</span>
                            </>
                          ) : group.stats?.isOverdue ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Chờ &gt;24h</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Chờ xử lý</span>
                            </>
                          )}
                          
                          <span className="text-[10px] font-mono font-normal opacity-80 border-l border-current/30 pl-1.5 ml-0.5">
                            {group.stats?.isRecentlySynced ? 'Vừa nạp' : (group.stats?.lastSyncedAt ? formatRelativeTime(new Date(group.stats.lastSyncedAt)) : 'Sync')}
                          </span>
                        </button>
                      </td>

                      {/* Dynamic Cells */}
                      {fields.map(field => {
                        const cellValue = projectData[field.field_key];
                        const isEditing = editingCell?.projectId === group.final_project && editingCell?.fieldKey === field.field_key;

                        return (
                          <td 
                            key={field.id} 
                            className="px-4 py-3 bg-indigo-50/10 dark:bg-indigo-950/10 cursor-text hover:bg-indigo-50/30 transition-colors relative group/cell"
                            onClick={(e) => handleCellClick(e, group.final_project, field.field_key, cellValue)}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 min-w-[120px]"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={() => handleSaveCell(group.final_project, field.field_key)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(group.final_project, field.field_key);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            ) : (
                              <span className="text-neutral-600 dark:text-slate-400 font-medium">
                                {cellValue || <span className="text-neutral-300 dark:text-slate-600 italic text-xs">Thêm...</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-2 py-3 sticky right-0 bg-[#fcfcfc] dark:bg-slate-900 border-l border-neutral-100 dark:border-slate-800"></td>
                    </tr>

                    {/* Sub-table for Expanded Activities */}
                    {isExpanded && sortedActivities.length > 0 && (
                      <tr>
                        <td colSpan={12 + fields.length} className="px-6 py-3.5 bg-slate-50/90 dark:bg-slate-950/80 border-b border-neutral-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Luồng Email thuộc Dự Án ({sortedActivities.length} email - Xếp từ mới nhất đến cũ nhất):
                            </span>
                          </div>

                          <div className="space-y-2">
                            {sortedActivities.map((act, actIdx) => {
                              const rawDate = act.created_at || (act as any).date_created || (act as any).email_received_at;
                              const actDateObj = rawDate ? new Date(rawDate) : null;
                              
                              // Previous activity in chronological list
                              const prevAct = sortedActivities[actIdx + 1];
                              const prevRawDate = prevAct ? (prevAct.created_at || (prevAct as any).date_created || (prevAct as any).email_received_at) : null;
                              const prevDateObj = prevRawDate ? new Date(prevRawDate) : null;

                              const formattedTimestamp = formatExactTimestamp(actDateObj);
                              const relativeAge = formatRelativeTime(actDateObj);
                              const timeDelta = formatTimeDelta(actDateObj, prevDateObj);

                              const gmailSearchUrl = act.thread_id ? `https://mail.google.com/mail/u/0/#search/thread%3A${act.thread_id}` : null;

                              return (
                                <div 
                                  key={act.id || `act-${actIdx}`} 
                                  className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 transition-colors gap-3"
                                >
                                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                      #{actIdx + 1}
                                    </span>

                                    {/* Clean email subject */}
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xl" title={act.title_mail || act.phase_type}>
                                      {act.title_mail || act.phase_type}
                                    </span>

                                    {act.merged_from_project && (
                                      <span className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-semibold px-2 py-0.5 rounded text-[10px] border border-sky-200 dark:border-sky-800">
                                        📌 Gộp từ: {act.merged_from_project}
                                      </span>
                                    )}

                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="text-slate-500 font-mono text-[11px]">Thread ID: {act.thread_id || act.key_project || 'N/A'}</span>
                                  </div>

                                  {/* TIME & DELTA & QUICK ACCESS THREAD EMAIL */}
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    {/* Time Delta from Previous Email */}
                                    {timeDelta && (
                                      <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                        ⏱️ {timeDelta}
                                      </span>
                                    )}

                                    {/* Timestamp & Relative Age */}
                                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {formattedTimestamp}
                                      </span>
                                      {relativeAge && (
                                        <span className="text-[10px] text-slate-500 font-normal">
                                          ({relativeAge})
                                        </span>
                                      )}
                                    </div>

                                    {/* Mở Thread Mail Quick Access */}
                                    {gmailSearchUrl ? (
                                      <a
                                        href={gmailSearchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-1 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Mở luồng Email trực tiếp trên Gmail"
                                      >
                                        <span>Mở Thread Mail</span>
                                        <ExternalLink className="w-3 h-3 text-sky-600" />
                                      </a>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onRowClick(group); }}
                                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <span>Xem Chi Tiết</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* HIGH-PERFORMANCE PAGINATION BAR FOR HUNDREDS/THOUSANDS OF PROJECTS */}
        {displayGroups.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-t border-neutral-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={10}>10 dự án / trang</option>
                <option value={25}>25 dự án / trang</option>
                <option value={50}>50 dự án / trang</option>
                <option value={100}>100 dự án / trang</option>
              </select>
              <span>trên tổng số <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{displayGroups.length}</strong> dự án</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Đầu
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Trước
              </button>

              <span className="px-3 py-1.5 font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 rounded border border-indigo-200 dark:border-indigo-800">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Sau
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL: Thông Tin Xử Lý & Đồng Bộ Dự Án */}
      {syncPopoverProjectId && (() => {
        const popoverGroup = groups.find(g => g.final_project === syncPopoverProjectId);
        if (!popoverGroup) return null;

        const pData = customDataMap[popoverGroup.final_project] || {};
        const pProcessedAt = pData['processed_at'];
        const pProcessedBy = pData['processed_by'] || 'PM/Vận hành';
        const pFormattedTime = pProcessedAt ? formatExactTimestamp(new Date(pProcessedAt)) : '';

        return (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSyncPopoverProjectId(null)}
          >
            <div 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Thông Tin Xử Lý &amp; Đồng Bộ Dự Án
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">Mã: {popoverGroup.final_project}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSyncPopoverProjectId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Section 1: Inbox Status */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  📥 Trạng Thái Xử Lý Inbox PM
                </span>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      {popoverGroup.stats?.isProcessed ? (
                        <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Đã hoàn thành xử lý
                        </span>
                      ) : popoverGroup.stats?.isOverdue ? (
                        <span className="text-rose-600 font-extrabold flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Chờ quá 24h
                        </span>
                      ) : (
                        <span className="text-amber-600 font-extrabold flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Đang chờ xử lý
                        </span>
                      )}
                    </div>
                    {pFormattedTime && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Xử lý bởi <span className="font-bold text-slate-700 dark:text-slate-300">{pProcessedBy}</span> lúc <span className="font-mono">{pFormattedTime}</span>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      const isCurrProcessed = popoverGroup.stats?.isProcessed;
                      if (isCurrProcessed) {
                        await updateField({ finalProject: popoverGroup.final_project, fieldKey: 'is_processed', value: false });
                        toast.success('Đã chuyển về trạng thái Chờ xử lý');
                      } else {
                        const nowISO = new Date().toISOString();
                        await updateField({ finalProject: popoverGroup.final_project, fieldKey: 'is_processed', value: true });
                        await updateField({ finalProject: popoverGroup.final_project, fieldKey: 'processed_at', value: nowISO });
                        await updateField({ finalProject: popoverGroup.final_project, fieldKey: 'processed_by', value: 'PM/Vận hành' });
                        toast.success('✅ Đã xác nhận ĐÃ XỬ LÝ!');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs ${
                      popoverGroup.stats?.isProcessed
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {popoverGroup.stats?.isProcessed ? 'Hoàn tác ↺' : 'Xác nhận Đã xử lý ✓'}
                  </button>
                </div>
              </div>

              {/* Section 2: Sync Timestamp */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  🔄 Lần Cào / Đồng Bộ Dữ Liệu Gần Nhất
                </span>
                <div className="flex items-center justify-between text-xs pt-1">
                  <div>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                      {popoverGroup.stats?.lastSyncedAt 
                        ? formatExactTimestamp(new Date(popoverGroup.stats.lastSyncedAt))
                        : 'Chưa ghi nhận mốc đồng bộ'}
                    </span>
                    {popoverGroup.stats?.lastSyncedAt && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        ({formatRelativeTime(new Date(popoverGroup.stats.lastSyncedAt))})
                      </span>
                    )}
                  </div>
                  {popoverGroup.stats?.isRecentlySynced && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                      Vừa nạp
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setSyncPopoverProjectId(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg cursor-pointer transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MANAGE CUSTOM FIELDS MODAL */}
      <ManageProjectFieldsModal
        isOpen={isManageFieldsOpen}
        onClose={() => setIsManageFieldsOpen(false)}
      />
    </div>
  );
}
