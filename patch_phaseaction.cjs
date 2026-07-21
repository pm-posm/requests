const fs = require('fs');
let content = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');

// 1. Thay đổi Props
content = content.replace(
    'visTechs?: any[] }) {',
    'visTechs?: any[], currentUserRole?: \'TECH\'|\'PM\' }) {'
);

// 2. Loại bỏ simulatedRole (thay bằng currentUserRole)
content = content.replace(
    'const [simulatedRole, setSimulatedRole] = React.useState<\'PM\' | \'TECH\'>(\'TECH\');',
    'const userRole = currentUserRole || \'TECH\';'
);

// 3. Sửa lại actionType để có thêm REVIEW
content = content.replace(
    'const [actionType, setActionType] = React.useState<\'PLAN\' | \'UPDATE\' | \'REPORT\' | \'EVALUATE\'>(',
    'const [actionType, setActionType] = React.useState<\'PLAN\' | \'UPDATE\' | \'EVALUATE\' | \'REVIEW\'>('
);

// Sửa logic default actionType
content = content.replace(
    'needsPlanning && !isCompleted ? \'PLAN\' : (isPendingReview && simulatedRole === \'PM\' ? \'EVALUATE\' : \'UPDATE\')',
    'needsPlanning && !isCompleted ? \'PLAN\' : (isPendingReview && userRole === \'PM\' ? \'REVIEW\' : (isPendingReview && userRole === \'TECH\' ? \'UPDATE\' : \'EVALUATE\'))'
);

// 4. Định nghĩa lại renderEventLabel
content = content.replace(
    'case \'COMPLETED\': return \'Nghiệm thu: Đạt\';',
    'case \'COMPLETED\': return \'Nghiệm thu: Đạt\';\n            case \'PENDING_REVIEW\': return \'Trình duyệt (Chờ PM)\';'
);

// 5. Cập nhật actionType selector UI
const newSelectorUI = `{/* Action Selector */}
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap">
                                        <button 
                                            onClick={() => setActionType('PLAN')}
                                            disabled={!needsPlanning || userRole === 'PM'}
                                            className={\`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all \${actionType === 'PLAN' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:hidden'}\`}
                                        >
                                            Lên lịch
                                        </button>
                                        <button 
                                            onClick={() => setActionType('UPDATE')}
                                            disabled={needsPlanning || userRole === 'PM'}
                                            className={\`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all \${actionType === 'UPDATE' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:hidden'}\`}
                                        >
                                            Cập nhật
                                        </button>
                                        <button 
                                            onClick={() => setActionType('EVALUATE')}
                                            disabled={needsPlanning || userRole === 'PM'}
                                            className={\`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all \${actionType === 'EVALUATE' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:hidden'}\`}
                                        >
                                            Trình duyệt
                                        </button>
                                        {userRole === 'PM' && isPendingReview && (
                                            <button 
                                                onClick={() => setActionType('REVIEW')}
                                                className={\`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-lg transition-all \${actionType === 'REVIEW' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}\`}
                                            >
                                                PM Duyệt
                                            </button>
                                        )}
                                    </div>`;

content = content.replace(
    /\{\/\* Action Selector \*\/\}.*?(?=\{\/\* Common Assignee \*\/\})/s,
    newSelectorUI + '\n\n                                    '
);

// 6. Cập nhật actionType EVALUATE (TECH) -> chỉ submit actualDate, evidenceUrl -> PENDING_REVIEW
const evaluateUI = `{actionType === 'EVALUATE' && (
                                            <div className="space-y-4">
                                                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs">Bạn đang gửi yêu cầu trình duyệt cho PM. Vui lòng cung cấp ngày thực tế và hình ảnh nghiệm thu.</div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ngày thực tế *</label>
                                                    <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Link Bằng chứng (Bắt buộc) *</label>
                                                    <input type="url" placeholder="https://..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ghi chú</label>
                                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Nhập ghi chú cho PM..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all custom-scrollbar"></textarea>
                                                </div>
                                            </div>
                                        )}
                                        {actionType === 'REVIEW' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Quyết định của PM *</label>
                                                    <select value={result} onChange={e => setResult(e.target.value as any)} className={\`w-full text-sm p-2.5 border rounded-lg outline-none focus:ring-2 transition-all \${result === 'Đạt' ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700 focus:ring-emerald-500/20' : result === 'Không đạt' ? 'border-rose-500 bg-rose-50/30 text-rose-700 focus:ring-rose-500/20' : 'border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-500/20'}\`}>
                                                        <option value="">-- Chọn --</option>
                                                        <option value="Đạt">Duyệt (Đạt)</option>
                                                        <option value="Không đạt">Từ chối (Không đạt)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Lý do / Phản hồi của PM {result === 'Không đạt' ? '*' : ''}</label>
                                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Nhập phản hồi cho Tech..." className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all custom-scrollbar"></textarea>
                                                </div>
                                            </div>
                                        )}`;

content = content.replace(
    /\{actionType === 'EVALUATE' && \(.*?(?=\{\/\* Footer Buttons \*\/\})/s,
    evaluateUI + '\n                                    </div>\n                                </div>\n                            )}\n                        </div>\n\n                        '
);

// 7. Cập nhật logic handleSaveTimelineEvent cho EVALUATE và REVIEW
const newLogic = `else if (actionType === 'EVALUATE') {
            if (!actualDate || !evidenceUrl) return alert('Vui lòng nhập ngày thực tế và bằng chứng!');
            
            newEvent.type = 'PENDING_REVIEW';
            newEvent.metadata.actual_date = actualDate;
            newEvent.metadata.evidence = evidenceUrl;
            
            newData.status = 'PENDING_REVIEW';
            newData.assignee = assignee;
            newData.notes = notes;
            newData.actual_date = actualDate;
            newData.evidence = evidenceUrl;
        }
        else if (actionType === 'REVIEW') {
            if (!result) return alert('Vui lòng chọn quyết định Duyệt hay Từ chối!');
            if (result === 'Không đạt' && !notes) return alert('Vui lòng nhập lý do từ chối!');
            
            newEvent.type = result === 'Đạt' ? 'COMPLETED' : 'ERROR';
            newEvent.metadata.notes = notes;
            
            newData.assignee = assignee;
            newData.notes = notes;
            
            if (result === 'Đạt') {
                const actual = new Date(data.actual_date || new Date());
                const plannedEnd = new Date(data.planned_end_date || new Date());
                actual.setHours(0,0,0,0); plannedEnd.setHours(23,59,59,999);
                newData.status = actual <= plannedEnd ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE';
            } else {
                newData.status = 'ERROR';
                newData.error_count = (data.error_count || 0) + 1;
            }
        }`;

content = content.replace(
    /else if \(actionType === 'EVALUATE'\) \{.*?(?=newData\.timeline_events)/s,
    newLogic + '\n\n        '
);

// Xóa userRole declaration khỏi logic nếu không cần (đã khai báo ở trên)
// Thêm userRole vào insert parameters (hiện là role, nhưng ở đây biến là userRole)
content = content.replace(
    'user_role: role,',
    'user_role: userRole,'
);

fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', content);
