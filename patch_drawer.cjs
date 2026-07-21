const fs = require('fs');

const path = 'src/components/Dashboard/StoreItemsList.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes('PhaseActionDrawer')) {
    content = content.replace(
        "import { PhaseActionModal } from '../ActionModal/PhaseActionModal';",
        "import { PhaseActionModal } from '../ActionModal/PhaseActionModal';\nimport { PhaseActionDrawer } from './PhaseActionDrawer';"
    );
}

// 2. Add state inside component
if (!content.includes('const [drawerOpen, setDrawerOpen]')) {
    content = content.replace(
        "const [activeTab, setActiveTab] = React.useState<'stores' | 'logs'>('stores');",
        "const [activeTab, setActiveTab] = React.useState<'stores' | 'logs'>('stores');\n    const [drawerOpen, setDrawerOpen] = React.useState(false);\n    const [drawerItem, setDrawerItem] = React.useState<StoreItem | null>(null);\n    const [drawerPhase, setDrawerPhase] = React.useState('');"
    );
}

// 3. Replace the Phase <select> and Status <select> with read-only badge and button
const targetTableCells = `                                        <td className="p-2 text-xs">
                                            <select disabled={item.is_locked} value={currentPhase} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "survey_data", value: { ...(item.survey_data || {}), current_phase: e.target.value } })} className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800 rounded border-none outline-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                <option value="">-- Chọn --</option>
                                                <option value="Brief">Brief</option>
                                                <option value="Khảo sát">Khảo sát</option>
                                                <option value="NTXX">NTXX</option>
                                                <option value="Lắp đặt">Lắp đặt</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-xs">
                                            <select disabled={item.is_locked} value={currentStatus} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "survey_data", value: { ...(item.survey_data || {}), current_status: e.target.value } })} className={\`w-full py-1.5 px-2 rounded border-none outline-none cursor-pointer text-xs font-semibold \${currentStatus === "Hoàn tất" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : currentStatus.startsWith("Lỗi") ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}\`}>
                                                <option value="Chờ làm">Chờ làm</option>
                                                <option value="Đang làm">Đang làm</option>
                                                <option value="Hoàn tất">Hoàn tất</option>
                                                <option value="Lỗi">Lỗi</option>
                                            </select>
                                        </td>`;

const newTableCells = `                                        <td className="p-2 text-xs">
                                            <div className="flex items-center gap-1">
                                                <select disabled={item.is_locked} value={currentPhase} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "survey_data", value: { ...(item.survey_data || {}), current_phase: e.target.value } })} className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800 rounded border-none outline-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    <option value="">-- Chọn --</option>
                                                    <option value="Brief">Brief</option>
                                                    <option value="Khảo sát">Khảo sát</option>
                                                    <option value="NTXX">NTXX</option>
                                                    <option value="Lắp đặt">Lắp đặt</option>
                                                </select>
                                                <button 
                                                    disabled={item.is_locked || !currentPhase}
                                                    onClick={() => { setDrawerItem(item); setDrawerPhase(currentPhase); setDrawerOpen(true); }}
                                                    className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Nhập dữ liệu tiến độ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-2 text-xs">
                                            <div className={\`w-full py-1.5 px-2 rounded border-none outline-none text-xs font-semibold text-center \${currentStatus === "Hoàn tất" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : currentStatus.startsWith("Lỗi") ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}\`}>
                                                {currentStatus}
                                            </div>
                                        </td>`;

content = content.replace(targetTableCells, newTableCells);

// 4. Render the Drawer
const drawerRender = `
            {drawerOpen && drawerItem && (
                <PhaseActionDrawer 
                    isOpen={drawerOpen}
                    onClose={() => { setDrawerOpen(false); setDrawerItem(null); }}
                    item={drawerItem}
                    currentPhase={drawerPhase}
                    onSave={async (phase, data) => {
                        // We use the generic updateFieldMutation but targeting the phase data
                        const fieldName = phase === 'Khảo sát' ? 'survey_data' : 
                                          phase === 'Lắp đặt' ? 'installation_data' : 
                                          phase === 'NTXX' ? 'ntxx_data' : 'survey_data';
                        
                        // Merge old data with new data
                        const oldData = drawerItem[fieldName as keyof typeof drawerItem] || {};
                        await updateFieldMutation.mutateAsync({ 
                            id: drawerItem.id, 
                            field: fieldName, 
                            value: { ...(typeof oldData === 'object' ? oldData : {}), ...data } 
                        });
                        
                        // If it's survey_data, the current_phase and current_status are shared there in our hack
                        if (fieldName !== 'survey_data') {
                             // Also update survey_data to reflect the global status/phase
                             const oldSurveyData = drawerItem.survey_data || {};
                             await updateFieldMutation.mutateAsync({
                                 id: drawerItem.id,
                                 field: 'survey_data',
                                 value: { ...(typeof oldSurveyData === 'object' ? oldSurveyData : {}), current_phase: data.current_phase, current_status: data.current_status }
                             });
                        }
                    }}
                />
            )}
        </div>
    );
}`;

content = content.replace('        </div>\n    );\n}', drawerRender);

fs.writeFileSync(path, content);
console.log('Successfully patched StoreItemsList.tsx');
