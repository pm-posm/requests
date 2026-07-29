import React, { useState } from 'react';
import type { ProjectGroup } from '@/types';
import type { Project } from '@/hooks/useProjects';
import { ChevronRight, ChevronDown, Plus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useGlobalProjectFields, useGlobalProjectCustomData } from '../../hooks/useGlobalProjectFields';
import { ManageProjectFieldsModal } from './ManageProjectFieldsModal';
import toast from 'react-hot-toast';

interface ProjectTableProps {
  groups: ProjectGroup[];
  findMatchedProject: (group: ProjectGroup) => Project | null;
  onRowClick: (group: ProjectGroup) => void;
  requestsMap?: Record<string, string[]>; // Mapping of final_project / key_project -> Request IDs
  onRefresh?: () => void;
}

export function ProjectTable({ groups, findMatchedProject, onRowClick, requestsMap = {}, onRefresh }: ProjectTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isManageFieldsOpen, setIsManageFieldsOpen] = useState(false);

  // Global Project Custom Fields
  const { fields } = useGlobalProjectFields();
  const { customDataMap, updateField } = useGlobalProjectCustomData();

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

  return (
    <>
      <div className="w-full bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fbfbfb] border-b border-neutral-200 text-neutral-500 font-medium">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-4 py-3">Mã dự án</th>
                <th className="px-4 py-3 w-1/4">Tên dự án</th>
                <th className="px-4 py-3 text-purple-700 bg-purple-50/50">Request ID</th>
                <th className="px-4 py-3">Loại hình POSM</th>
                <th className="px-4 py-3">Hệ thống</th>
                <th className="px-4 py-3 text-center">Số lượng store</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Giai đoạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-amber-700 bg-amber-50/50">Xử lý Inbox</th>
                <th className="px-4 py-3 text-emerald-700 bg-emerald-50/50">Lần cào/Cập nhật</th>
                
                {/* Dynamic Columns */}
                {fields.map(field => (
                  <th key={field.id} className="px-4 py-3 font-medium text-indigo-600 bg-indigo-50/30">
                    {field.field_name}
                  </th>
                ))}

                {/* Add Custom Field Button */}
                <th className="px-2 py-3 w-10 text-center sticky right-0 bg-[#fbfbfb] border-l border-neutral-200 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                  <button 
                    onClick={() => setIsManageFieldsOpen(true)}
                    className="p-1 hover:bg-neutral-200 rounded-md text-neutral-400 hover:text-neutral-700 transition-colors"
                    title="Quản lý cột dự án (Custom Fields)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              {groups.length === 0 && (
                <tr>
                  <td colSpan={11 + fields.length} className="px-4 py-8 text-center text-neutral-400">
                    Không có dự án nào
                  </td>
                </tr>
              )}
              {groups.map(group => {
                const isExpanded = expandedRows.has(group.final_project);
                const projectData = customDataMap[group.final_project] || {};

                // Find matching Request IDs for this project
                const matchedRequestIds = requestsMap[group.final_project] || 
                                          (group.key_project ? requestsMap[group.key_project] : undefined) || 
                                          (group.name_project ? requestsMap[group.name_project] : undefined) || [];

                return (
                  <React.Fragment key={group.final_project}>
                    <tr 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer group/row"
                      onClick={() => onRowClick(group)}
                    >
                      <td className="px-3 py-3" onClick={(e) => toggleRow(group.final_project, e)}>
                        <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">
                        {group.key_project || <span className="text-neutral-400 font-normal">{group.final_project}</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-neutral-900 truncate max-w-md">
                        {group.name_project || group.final_project}
                      </td>

                      {/* Request ID (Subtask) Column */}
                      <td className="px-4 py-3 bg-purple-50/20">
                        {matchedRequestIds.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {matchedRequestIds.map(rid => (
                              <span key={rid} className="font-mono text-xs font-bold text-purple-700 bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                📋 {rid}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs font-mono">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium border ${group.stats?.posmType !== 'Chưa cấu hình' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                          {group.stats?.posmType || 'Chưa cấu hình'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 font-medium">
                        {group.stats?.customer || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100 min-w-[2rem]">
                          {group.stats?.storeCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {group.stats?.supplier || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-neutral-600 font-medium">
                            {group.stats?.phase || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-neutral-600 font-medium">
                            {group.stats?.status || '-'}
                        </span>
                      </td>

                      {/* Trạng thái Xử lý Inbox */}
                      <td className="px-4 py-3 bg-amber-50/10" onClick={(e) => e.stopPropagation()}>
                        {group.stats?.isProcessed ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await updateField({ finalProject: group.final_project, fieldKey: 'is_processed', value: false });
                              toast.success('Đã chuyển dự án về danh sách Chờ xử lý');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg flex items-center gap-1 border border-emerald-300 hover:bg-emerald-200 transition-colors cursor-pointer"
                            title="Bấm để mở lại trạng thái Chờ xử lý"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✅ Đã xử lý</span>
                          </button>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await updateField({ finalProject: group.final_project, fieldKey: 'is_processed', value: true });
                              toast.success('Đã đánh dấu ĐÃ XỬ LÝ thành công!');
                            }}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                              group.stats?.isOverdue
                                ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 border-rose-300 animate-pulse hover:bg-rose-200'
                                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 hover:bg-amber-200'
                            }`}
                            title="Bấm để đánh dấu đã xử lý xong (sẽ tự động rời khỏi tab Chờ xử lý)"
                          >
                            {group.stats?.isOverdue ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>⚠️ Chờ quá 24h</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>📥 Chờ xử lý</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Lần cào / Đồng bộ gần nhất */}
                      <td className="px-4 py-3 bg-emerald-50/10">
                        {group.stats?.isRecentlySynced ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            ⚡ Vừa nạp ({group.stats?.lastSyncedAt ? new Date(group.stats.lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'gần đây'})
                          </span>
                        ) : (
                          <span className="text-neutral-500 font-mono text-xs">
                            {group.stats?.lastSyncedAt 
                              ? `🕒 ${new Date(group.stats.lastSyncedAt).toLocaleDateString('vi-VN')}` 
                              : '-'}
                          </span>
                        )}
                      </td>

                      {/* Dynamic Cells */}
                      {fields.map(field => {
                        const cellValue = projectData[field.field_key];
                        const isEditing = editingCell?.projectId === group.final_project && editingCell?.fieldKey === field.field_key;

                        return (
                          <td 
                            key={field.id} 
                            className="px-4 py-3 bg-indigo-50/10 cursor-text hover:bg-indigo-50/40 transition-colors relative group/cell"
                            onClick={(e) => handleCellClick(e, group.final_project, field.field_key, cellValue)}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 min-w-[120px]"
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
                              <span className="text-neutral-600 font-medium">
                                {cellValue || <span className="text-neutral-300 italic text-xs">Thêm...</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-2 py-3 sticky right-0 bg-white border-l border-neutral-100 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.05)]"></td>
                    </tr>

                    {/* Sub-table for Expanded Activities */}
                    {isExpanded && group.activities && group.activities.length > 0 && (
                      <tr>
                        <td colSpan={12 + fields.length} className="px-8 py-3 bg-neutral-50/60 border-b border-neutral-200">
                          <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">
                            Danh sách công việc & Email thuộc dự án (Thread ID):
                          </div>

                          <div className="space-y-1.5">
                            {group.activities.map((act) => {
                              const actTime = new Date(act.created_at || (act as any).date_created || 0).getTime();
                              const isActRecent = !isNaN(actTime) && (Date.now() - actTime) < (24 * 60 * 60 * 1000);

                              return (
                                <div 
                                  key={act.id} 
                                  className={`flex items-center justify-between px-3 py-2 rounded border transition-colors text-xs ${
                                    isActRecent 
                                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-2xs' 
                                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    {isActRecent && (
                                      <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded text-[10px] flex items-center gap-1 shadow-2xs">
                                        ⚡ Mail mới nạp ({actTime ? new Date(actTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''})
                                      </span>
                                    )}
                                    <span className="font-bold text-neutral-900">{act.title_mail || act.phase_type}</span>
                                    {act.merged_from_project && (
                                      <span className="bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                        📌 Đã gộp từ: {act.merged_from_project}
                                      </span>
                                    )}
                                    <span className="text-neutral-400">|</span>
                                    <span className="text-neutral-500 font-mono text-[11px]">Thread ID: {act.thread_id || act.key_project || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-neutral-500 font-mono text-[11px] shrink-0">
                                    <span>{act.created_at ? new Date(act.created_at).toLocaleString('vi-VN') : ''}</span>
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
      </div>

      <ManageProjectFieldsModal 
        isOpen={isManageFieldsOpen}
        onClose={() => setIsManageFieldsOpen(false)}
      />
    </>
  );
}
