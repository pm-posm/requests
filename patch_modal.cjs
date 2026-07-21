const fs = require('fs');
let content = fs.readFileSync('PhaseActionModal_temp.tsx', 'utf8');

// 1. Add simulatedRole
content = content.replace(
    /const needsPlanning = !lastEvent \|\| lastEvent\.type === 'ERROR' \|\| lastEvent\.type === 'COMPLETED';/g,
    `const isPendingReview = data.status === 'PENDING_REVIEW' || (lastEvent && lastEvent.type === 'PENDING_REVIEW');\n    const needsPlanning = !lastEvent || lastEvent.type === 'ERROR' || lastEvent.type === 'COMPLETED';\n    const [simulatedRole, setSimulatedRole] = React.useState<'PM' | 'TECH'>('TECH');`
);

// 2. Add PENDING_REVIEW normalization
content = content.replace(
    /\} else if \(data\.status === 'COMPLETED_ON_TIME' \|\| data\.status === 'COMPLETED_LATE'\) \{/g,
    `} else if (data.status === 'PENDING_REVIEW') {\n                events.push({\n                    id: 'init-pend',\n                    type: 'PENDING_REVIEW',\n                    timestamp: data.updated_at || new Date().toISOString(),\n                    user: data.assignee || 'Hệ thống',\n                    metadata: {\n                        evidence: data.evidence,\n                        notes: data.notes || ''\n                    }\n                });\n            } else if (data.status === 'COMPLETED_ON_TIME' || data.status === 'COMPLETED_LATE') {`
);

// 3. Update actionType state
content = content.replace(
    /const \[actionType, setActionType\] = React\.useState\<'PLAN' \| 'UPDATE' \| 'EVALUATE'\>\(needsPlanning && !isCompleted \? 'PLAN' : 'UPDATE'\);/g,
    `const [actionType, setActionType] = React.useState<'PLAN' | 'UPDATE' | 'REPORT' | 'EVALUATE'>(\n        needsPlanning && !isCompleted ? 'PLAN' : (isPendingReview && simulatedRole === 'PM' ? 'EVALUATE' : 'UPDATE')\n    );`
);

// 4. Update save handler for REPORT
content = content.replace(
    /else if \(actionType === 'UPDATE'\) \{([\s\S]*?)\} \n\s+else if \(actionType === 'EVALUATE'\)/g,
    `else if (actionType === 'UPDATE') {$1}\n        else if (actionType === 'REPORT') {\n            if (!notes && !evidenceUrl) return alert('Vui lòng nhập ghi chú hoặc bằng chứng!');\n            newEvent.type = 'PENDING_REVIEW';\n            newEvent.metadata.evidence = evidenceUrl;\n            \n            newData.status = 'PENDING_REVIEW';\n            newData.assignee = assignee;\n            newData.notes = notes;\n            if (evidenceUrl) newData.evidence = evidenceUrl;\n        }\n        else if (actionType === 'EVALUATE')`
);

// 5. Update header UI with role toggle
content = content.replace(
    new RegExp('div className="flex items-center gap-2">\\s*<span className="bg-indigo-100/50'),
    `div className="flex items-center gap-4">\n                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">\n                            <button onClick={() => { setSimulatedRole('TECH'); setActionType('UPDATE'); }} className={\`px-3 py-1 text-[10px] rounded-md transition-all \${simulatedRole === 'TECH' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}\`}>Quyền Thợ Thi Công</button>\n                            <button onClick={() => { setSimulatedRole('PM'); if (isPendingReview) setActionType('EVALUATE'); }} className={\`px-3 py-1 text-[10px] rounded-md transition-all \${simulatedRole === 'PM' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}\`}>Quyền Quản Lý (PM)</button>\n                        </div>\n                        <span className="bg-indigo-100/50`
);

// 6. Update action buttons UI
content = content.replace(
    /\<div className="grid grid-cols-2 sm:grid-cols-4 gap-2"\>([\s\S]*?)\<\/div\>/,
    `<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">\n                                                    {simulatedRole === 'PM' && needsPlanning && (\n                                                        <button\n                                                            onClick={() => setActionType('PLAN')}\n                                                            className={\`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all \${actionType === 'PLAN' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500/50 dark:text-blue-400 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-400'}\`}\n                                                        >\n                                                            <Calendar className="w-5 h-5" />\n                                                            <span className="text-[10px] font-bold">Lên Lịch / Giao Việc</span>\n                                                        </button>\n                                                    )}\n                                                    \n                                                    {!isPendingReview && (\n                                                        <button\n                                                            onClick={() => setActionType('UPDATE')}\n                                                            className={\`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all \${actionType === 'UPDATE' ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:border-amber-500/50 dark:text-amber-400 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-400'}\`}\n                                                        >\n                                                            <FileText className="w-5 h-5" />\n                                                            <span className="text-[10px] font-bold">Cập Nhật Tiến Độ</span>\n                                                        </button>\n                                                    )}\n\n                                                    {!isPendingReview && simulatedRole === 'TECH' && !needsPlanning && (\n                                                        <button\n                                                            onClick={() => setActionType('REPORT')}\n                                                            className={\`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all \${actionType === 'REPORT' ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/50 dark:text-purple-400 ring-2 ring-purple-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-400'}\`}\n                                                        >\n                                                            <CheckCircle2 className="w-5 h-5" />\n                                                            <span className="text-[10px] font-bold">Báo Cáo Hoàn Thành</span>\n                                                        </button>\n                                                    )}\n                                                    \n                                                    {isPendingReview && simulatedRole === 'PM' && (\n                                                        <button\n                                                            onClick={() => setActionType('EVALUATE')}\n                                                            className={\`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all \${actionType === 'EVALUATE' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400 ring-2 ring-emerald-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-400'}\`}\n                                                        >\n                                                            <CheckSquare className="w-5 h-5" />\n                                                            <span className="text-[10px] font-bold">Nghiệm Thu (PM)</span>\n                                                        </button>\n                                                    )}\n                                                </div>`
);

// 7. Render PENDING_REVIEW icon
content = content.replace(
    /case 'ERROR': return \<AlertCircle className="w-4 h-4 text-rose-500" \/\>;/g,
    `case 'ERROR': return <AlertCircle className="w-4 h-4 text-rose-500" />;\n            case 'PENDING_REVIEW': return <Clock className="w-4 h-4 text-purple-500" />;`
);

fs.writeFileSync('PhaseActionModal_temp.tsx', content);
