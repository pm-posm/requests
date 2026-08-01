import React from 'react';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import { normalizeDataResponser } from '@/services/sheetSyncService';
import { PHUONG_AN_OPTIONS } from '@/hooks/useWorkflowEngine';
import { Hash, Check, Copy, MessageSquare, Image as ImageIcon, Zap } from 'lucide-react';
import type { LightboxImage } from '@/components/ui/ImageLightboxModal';

interface RequestTableRowProps {
    r: RawRequestRecord;
    idx: number;
    visibleColumns: string[];
    isRowSelected: boolean;
    isAdmin: boolean;
    copiedId: string | null;
    isWrapText: boolean;
    contactMap?: Map<string, any>;
    dynamicStatusList: string[];
    dynamicProgressList: string[];
    category: 'to_do' | 'in_progress' | 'review' | 'done';
    slaBadge: { type: string; label: string; bgClass: string } | null;
    handleToggleSelectRow: (id: string) => void;
    handleGuardedUpdate: (id: string, updates: Partial<RawRequestRecord>) => void;
    onUpdateRequest: (id: string, updates: Partial<RawRequestRecord>) => Promise<any>;
    handleCopy: (text: string) => void;
    setWarrantySubtaskRecord: (r: RawRequestRecord) => void;
    setSubtaskModalRecord: (r: RawRequestRecord) => void;
    setSelectedDetailRequest: (r: RawRequestRecord) => void;
    setSelectedNotesRecord: (r: RawRequestRecord) => void;
    handleOpenLightbox: (imgs: LightboxImage[], index?: number) => void;
}

export const RequestTableRow = React.memo(function RequestTableRow({
    r,
    idx,
    visibleColumns,
    isRowSelected,
    isAdmin,
    copiedId,
    isWrapText,
    contactMap,
    dynamicStatusList,
    dynamicProgressList,
    category,
    slaBadge,
    handleToggleSelectRow,
    handleGuardedUpdate,
    onUpdateRequest,
    handleCopy,
    setWarrantySubtaskRecord,
    setSubtaskModalRecord,
    setSelectedDetailRequest,
    setSelectedNotesRecord,
    handleOpenLightbox
}: RequestTableRowProps) {
    const hasRequestId = Boolean(r.request_id && r.request_id.trim());
    const formattedResponser = normalizeDataResponser(r.data_responser);

    const storeContact = r.ess_store_code ? contactMap?.get(r.ess_store_code.toUpperCase().trim()) : null;
    const srPhone = storeContact?.sr_phone || storeContact?.sr_phone_2 || '';

    // Check if this request has a Phase Transition Alert (email received with next phase like Lắp đặt / NTXX / Gửi lịch)
    const tienDoLower = (r.tien_do || '').toLowerCase();
    const titleLower = (r.title_email_request || '').toLowerCase();
    const statusLower = (r.status || '').toLowerCase();
    const isDone = statusLower.includes('done') || tienDoLower.includes('hoàn thành');
    
    const isNewPhaseAlert = !isDone && (
        tienDoLower.includes('lắp đặt') || 
        tienDoLower.includes('gửi lịch') || 
        tienDoLower.includes('ntxx') || 
        titleLower.includes('lắp đặt') || 
        titleLower.includes('nghiệm thu')
    );

    let rowBgClass = 'transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50';
    if (slaBadge?.type === 'overdue') rowBgClass = 'bg-rose-50/70 dark:bg-rose-950/30 transition-colors duration-150 hover:bg-rose-100/70 border-l-4 border-l-rose-500';
    else if (isNewPhaseAlert) rowBgClass = 'bg-indigo-50/60 dark:bg-indigo-950/30 transition-colors duration-150 hover:bg-indigo-100/60 border-l-4 border-l-indigo-500';
    else if (slaBadge?.type === 'today') rowBgClass = 'bg-amber-50/70 dark:bg-amber-950/30 transition-colors duration-150 hover:bg-amber-100/70 border-l-4 border-l-amber-500';
    
    if (isRowSelected) rowBgClass = 'bg-sky-50 dark:bg-sky-950/60 transition-colors duration-150 hover:bg-sky-100/70 border-l-4 border-l-sky-500';

    return (
        <tr className={rowBgClass}>
            {/* Checkbox Select Cell */}
            <td className="p-3 text-center">
                <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={() => handleToggleSelectRow(r.id!)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
            </td>

            {/* Dòng Sheet (Row ID) */}
            <td className="p-3">
                <span className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-xs">
                    <Hash className="w-3 h-3 text-slate-400" />
                    {r.sheet_row_index ? r.sheet_row_index : idx + 2}
                </span>
            </td>

            {/* Request ID & Subtask Badge + Phase Transition Alert Badge */}
            {visibleColumns.includes('request_id') && (
                <td className="p-3">
                    <div className="flex flex-col gap-1 items-start">
                        {isNewPhaseAlert && (
                            <span className="text-[9px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-800 flex items-center gap-0.5 animate-pulse">
                                <Zap className="w-2.5 h-2.5 text-indigo-600 fill-indigo-600" /> ⚡ Phase Mới!
                            </span>
                        )}

                        {(() => {
                            const isWarrantyReq = (r.phuong_an || '').toLowerCase().includes('bảo hành') || 
                                                 (r.status || '').toLowerCase().includes('bảo hành') || 
                                                 (r.request_id || '').toLowerCase().startsWith('bh-');
                            
                            if (isWarrantyReq) {
                                const bhIdDisplay = r.request_id || `BH-${r.sheet_row_index || idx + 2}`;
                                return (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setWarrantySubtaskRecord(r)}
                                            className="font-mono text-xs font-bold text-sky-800 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/80 hover:bg-sky-200 px-2 py-0.5 rounded-md border border-sky-300 dark:border-sky-800 flex items-center gap-1 cursor-pointer transition-colors duration-150"
                                            title="Mở Subtask Bảo Hành & Đổi Trả"
                                        >
                                            🛡️ {bhIdDisplay}
                                        </button>
                                        <button
                                            onClick={() => handleCopy(bhIdDisplay)}
                                            className="p-1 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded text-sky-600 transition-colors duration-150 cursor-pointer"
                                            title="Copy Subtask ID"
                                        >
                                            {copiedId === bhIdDisplay ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                );
                            }

                            return hasRequestId ? (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setSubtaskModalRecord(r)}
                                        className="font-mono text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 transition-colors duration-150 flex items-center gap-1 cursor-pointer"
                                        title="Sửa Subtask Request ID"
                                    >
                                        📋 {r.request_id}
                                    </button>
                                    <button
                                        onClick={() => handleCopy(r.request_id)}
                                        className="p-1 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded text-sky-600 transition-colors duration-150 cursor-pointer"
                                        title="Copy Request ID"
                                    >
                                        {copiedId === r.request_id ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setSubtaskModalRecord(r)}
                                    className="text-[11px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 px-2 py-1 rounded-md border border-sky-200 dark:border-sky-800 transition-colors duration-150 flex items-center gap-1 cursor-pointer"
                                >
                                    + Subtask
                                </button>
                            );
                        })()}
                    </div>
                </td>
            )}

            {/* Store Info */}
            {visibleColumns.includes('store_info') && (
                <td className="p-3">
                    <div className={`font-bold text-slate-900 dark:text-white ${!isWrapText ? 'truncate max-w-[180px]' : ''}`} title={r.store_name}>
                        {r.store_name || '-'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold">
                            {r.ess_store_code || '-'}
                        </span>
                        <span>{r.customer || '-'}</span>
                    </div>
                </td>
            )}

            {/* POSM Item */}
            {visibleColumns.includes('posm_info') && (
                <td className="p-3">
                    <div className={`font-medium text-sky-700 dark:text-sky-400 ${!isWrapText ? 'truncate max-w-[160px]' : ''}`} title={r.posm}>
                        {r.posm || '-'} (SL: {r.so_luong || '1'})
                    </div>
                    <div className={`text-[11px] text-slate-400 ${!isWrapText ? 'truncate max-w-[160px]' : ''}`} title={r.brand}>
                        {r.brand || '-'} ({r.cat || '-'})
                    </div>
                </td>
            )}

            {/* Ngày Gửi Request */}
            {visibleColumns.includes('date_of_rq') && (
                <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                    📅 {r.date_of_rq || '-'}
                </td>
            )}

            {/* SR Yêu Cầu */}
            {visibleColumns.includes('sr_info') && (
                <td className="p-3">
                    <div className="font-bold text-slate-900 dark:text-white">{r.sr || storeContact?.sr_name || '-'}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {srPhone ? `📞 ${srPhone}` : '-'}
                    </div>
                </td>
            )}

            {/* Dropdown 1: Phương Án */}
            {visibleColumns.includes('phuong_an') && (
                <td className="p-3">
                    {(() => {
                        const val = (r.phuong_an || '').trim();
                        let currentPhuongAn = val || 'Visibility Request';
                        if (val.toLowerCase().includes('bảo hành') || val.toLowerCase().includes('bao hanh')) {
                            currentPhuongAn = 'Supplier Bảo Hành';
                        } else if (val.toLowerCase().includes('quick fix')) {
                            currentPhuongAn = 'Mer Quick Fix';
                        } else if (val.toLowerCase().includes('visibility')) {
                            currentPhuongAn = 'Visibility Request';
                        } else if (val.toLowerCase().includes('store')) {
                            currentPhuongAn = 'Đưa vào RQ by Store';
                        } else if (val.toLowerCase().includes('tuần')) {
                            currentPhuongAn = 'Đã đưa vào RQ tuần';
                        }

                        return (
                            <select
                                value={currentPhuongAn}
                                disabled={!isAdmin}
                                onChange={e => handleGuardedUpdate(r.id!, { phuong_an: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {PHUONG_AN_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        );
                    })()}
                </td>
            )}

            {/* Dropdown 2: Trạng Thái */}
            {visibleColumns.includes('status') && (
                <td className="p-3">
                    <select
                        value={r.status || dynamicStatusList[0]}
                        disabled={!isAdmin}
                        onChange={e => handleGuardedUpdate(r.id!, { status: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {dynamicStatusList.map(st => (
                            <option key={st} value={st}>{st}</option>
                        ))}
                    </select>
                </td>
            )}

            {/* Dropdown 3: Tiến Độ */}
            {visibleColumns.includes('tien_do') && (
                <td className="p-3">
                    <select
                        value={r.tien_do || dynamicProgressList[0]}
                        disabled={!isAdmin}
                        onChange={e => handleGuardedUpdate(r.id!, { tien_do: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {dynamicProgressList.map(prog => (
                            <option key={prog} value={prog}>{prog}</option>
                        ))}
                    </select>
                </td>
            )}

            {/* Trạng Thái Nhóm */}
            {visibleColumns.includes('category') && (
                <td className="p-3">
                    <select
                        value={category}
                        disabled={!isAdmin}
                        onChange={e => {
                            const targetCat = e.target.value;
                            let newStatus = r.status;
                            let newTienDo = r.tien_do;

                            if (targetCat === 'to_do') {
                                newStatus = 'To Do';
                                newTienDo = 'Mới tiếp nhận';
                            } else if (targetCat === 'in_progress') {
                                newStatus = 'In Progress';
                                newTienDo = 'Vis - Đang làm';
                            } else if (targetCat === 'review') {
                                newStatus = 'Under Review';
                                newTienDo = 'Chờ duyệt';
                            } else if (targetCat === 'done') {
                                newStatus = 'Completed';
                                newTienDo = 'Hoàn thành';
                            }

                            handleGuardedUpdate(r.id!, { 
                                status: newStatus,
                                tien_do: newTienDo
                            });
                        }}
                        className={`w-full border rounded px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            category === 'done'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                                : category === 'review'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                : category === 'in_progress'
                                ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300'
                                : 'bg-slate-50 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                    >
                        <option value="to_do">Cần xử lý (To Do)</option>
                        <option value="in_progress">Đang xử lý (In Progress)</option>
                        <option value="review">Chờ duyệt (Review)</option>
                        <option value="done">Hoàn thành (Done)</option>
                    </select>
                </td>
            )}

            {/* Data Responser */}
            {visibleColumns.includes('data_responser') && (
                <td className="p-3">
                    {r.data_responser ? (
                        <button 
                            onClick={() => setSelectedDetailRequest(r)}
                            className={`w-full text-left px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 rounded-lg text-[11px] font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between gap-1.5 transition-colors duration-150 cursor-pointer ${
                                !isWrapText ? 'truncate max-w-[240px]' : ''
                            }`}
                        >
                            <span className={!isWrapText ? 'truncate' : ''}>
                                {formattedResponser || r.data_responser}
                            </span>
                        </button>
                    ) : (
                        <span className="text-slate-400 text-[11px] italic">-</span>
                    )}
                </td>
            )}

            {/* Supplier Input */}
            {visibleColumns.includes('supplier') && (
                <td className="p-3">
                    <input
                        type="text"
                        defaultValue={r.supplier || ''}
                        placeholder="VD: Cát Thiên Minh..."
                        onBlur={e => onUpdateRequest(r.id!, { supplier: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 focus:border-sky-500 px-1 py-0.5 outline-none text-xs w-28"
                    />
                </td>
            )}

            {/* Ngày Cần Hoàn Thành (Deadline & SLA Badge) */}
            {visibleColumns.includes('deadline') && (
                <td className="p-3">
                    <input
                        type="text"
                        defaultValue={r.ngay_quick_fix || r.deadline || ''}
                        placeholder="VD: 10/02/2026"
                        onBlur={e => onUpdateRequest(r.id!, { ngay_quick_fix: e.target.value })}
                        className="bg-transparent border-b border-dashed border-sky-400 hover:border-sky-600 focus:border-sky-600 px-1 py-0.5 outline-none text-xs font-mono font-bold text-sky-800 dark:text-sky-300 w-24 block"
                    />
                    {slaBadge && (
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border mt-1 ${slaBadge.bgClass}`}>
                            {slaBadge.label}
                        </span>
                    )}
                </td>
            )}

            {/* Ghi Chú */}
            {visibleColumns.includes('notes') && (
                <td className="p-3">
                    <button
                        onClick={() => setSelectedNotesRecord(r)}
                        className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 rounded-lg text-[11px] font-bold text-sky-800 dark:text-sky-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Xem Ghi Chú</span>
                        {(r.sr_note || r.vis_note || r.mer_note) && (
                            <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
                        )}
                    </button>
                </td>
            )}

            {/* Links & Lightbox Ảnh */}
            <td className="p-3">
                {(() => {
                    const recordImgs: LightboxImage[] = [];
                    if (r.img_overview) recordImgs.push({ url: r.img_overview, title: `Ảnh Tổng Thể - ${r.store_name}`, caption: `POSM: ${r.posm}` });
                    if (r.img_detail_01) recordImgs.push({ url: r.img_detail_01, title: `Ảnh Chi Tiết 01 - ${r.store_name}`, caption: `POSM: ${r.posm}` });
                    if (r.img_detail_02) recordImgs.push({ url: r.img_detail_02, title: `Ảnh Chi Tiết 02 - ${r.store_name}`, caption: `POSM: ${r.posm}` });
                    if (r.img_detail_03) recordImgs.push({ url: r.img_detail_03, title: `Ảnh Chi Tiết 03 - ${r.store_name}`, caption: `POSM: ${r.posm}` });

                    if (recordImgs.length === 0) return <span className="text-slate-400 text-[11px] italic">-</span>;

                    return (
                        <button
                            onClick={() => handleOpenLightbox(recordImgs, 0)}
                            className="px-2 py-1 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150"
                            title="Mở bộ xem ảnh phóng to Pop-up"
                        >
                            <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                            <span>{recordImgs.length} ảnh</span>
                        </button>
                    );
                })()}
            </td>
        </tr>
    );
});
