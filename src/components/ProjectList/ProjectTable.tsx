import React, { useState } from 'react';
import type { ProjectGroup } from '@/types';
import type { Project } from '@/hooks/useProjects';
import { ChevronRight, ChevronDown, Plus, LayoutGrid } from 'lucide-react';

interface ProjectTableProps {
  groups: ProjectGroup[];
  findMatchedProject: (group: ProjectGroup) => Project | null;
  onRowClick: (group: ProjectGroup) => void;
}

export function ProjectTable({ groups, findMatchedProject, onRowClick }: ProjectTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  return (
    <div className="w-full bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#fbfbfb] border-b border-neutral-200 text-neutral-500 font-medium">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">Mã dự án</th>
              <th className="px-4 py-3 w-1/4">Tên dự án</th>
              <th className="px-4 py-3">Loại hình POSM</th>
              <th className="px-4 py-3">Hệ thống</th>
              <th className="px-4 py-3 text-center">Số lượng store</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Giai đoạn</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-700">
            {groups.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                  Không có dự án nào
                </td>
              </tr>
            )}
            {groups.map(group => {
              const matched = findMatchedProject(group);
              const isExpanded = expandedRows.has(group.final_project);
              const hasBrief = group.activities.some(a => a.phase_type === 'BRIEF');
              const hasSurvey = group.activities.some(a => a.phase_type === 'SURVEY');
              const hasInstall = group.activities.some(a => a.phase_type === 'INSTALLATION');
              const hasAccept = group.activities.some(a => a.phase_type === 'ACCEPTANCE');

              return (
                <React.Fragment key={group.final_project}>
                  <tr 
                    className="hover:bg-neutral-50 cursor-pointer group/row transition-colors"
                    onClick={() => onRowClick(group)}
                  >
                    <td className="px-4 py-3" onClick={(e) => toggleRow(group.final_project, e)}>
                      <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                      {group.key_project || <span className="text-neutral-400">-</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900 truncate max-w-md">
                      {group.name_project || group.final_project}
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
                  </tr>

                  {/* Subtask Row - Shown when expanded */}
                  {isExpanded && (
                    <tr className="bg-[#fafafa]">
                      <td className="px-4 py-3 border-l-2 border-neutral-200"></td>
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex flex-col gap-2 pl-4">
                          {/* Placeholder cho Subtask */}
                          <div className="flex items-center justify-between py-2 border-b border-dashed border-neutral-200 text-neutral-500 text-sm">
                            <div className="flex items-center gap-3">
                              <LayoutGrid className="w-4 h-4 text-neutral-400" />
                              <span>(Các Subtask/Store sẽ được hiển thị ở đây)</span>
                            </div>
                          </div>
                          
                          <button 
                            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 font-medium py-1.5 w-fit transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Plus className="w-4 h-4" /> Thêm subtask
                          </button>
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
  );
}
