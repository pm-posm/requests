const fs = require('fs');
let storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

// The original chunk that contains the three TDs:
const searchTarget = `<td className="p-3 text-xs">
                                            {item.vis_tech ? (
                                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.vis_tech}</span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">-- Trống --</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs">
                                            {item.supplier_name ? (
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800/50 rounded font-bold text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 break-words line-clamp-2" title={item.supplier_name}>
                                                    {item.supplier_name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">-- Trống --</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{currentPhase || <span className="italic text-slate-300 font-normal">-- Trống --</span>}</span>
                                                <button 
                                                    disabled={item.is_locked || !currentPhase}
                                                    onClick={() => { setDrawerItem(item); setDrawerPhase(currentPhase); setDrawerOpen(true); }}
                                                    className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Chỉnh sửa tiến độ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                            </div>
                                        </td>`;

const replacementTarget = `<td className="p-3 text-xs">
                                            <select 
                                                value={item.vis_tech || ''} 
                                                onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: 'vis_tech', value: e.target.value })}
                                                className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-transparent outline-none w-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 px-1 -ml-1 border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                                            >
                                                <option value="" className="italic text-slate-400">-- Trống --</option>
                                                {visTechs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-3 text-xs">
                                            <select 
                                                value={item.supplier_name || ''} 
                                                onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: 'supplier_name', value: e.target.value })}
                                                className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-transparent outline-none w-full max-w-[100px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 px-1 -ml-1 border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                                            >
                                                <option value="" className="italic text-slate-400">-- Trống --</option>
                                                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2 text-xs">
                                            <div className="flex items-center gap-1 w-full max-w-[100px]">
                                                <select 
                                                    value={currentPhase || ''} 
                                                    onChange={async (e) => { 
                                                        const phase = e.target.value;
                                                        await updateFieldMutation.mutateAsync({ id: item.id, field: 'survey_data', value: { ...(item.survey_data || {}), current_phase: phase } });
                                                        if (phase) {
                                                            await supabase.from('project_store_logs').insert({ store_item_id: item.id, store_code: item.store_code, action_type: 'PHASE_UPDATE', field_name: phase, new_value: 'Cập nhật' });
                                                            queryClient.invalidateQueries({ queryKey: ['project_store_logs_phase'] });
                                                        }
                                                    }}
                                                    className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-transparent outline-none flex-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1 px-1 -ml-1 border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                                                >
                                                    <option value="" className="italic text-slate-400">-- Trống --</option>
                                                    <option value="Brief">Brief</option>
                                                    <option value="Khảo sát">Khảo sát</option>
                                                    <option value="NTXX">NTXX</option>
                                                    <option value="Lắp đặt">Lắp đặt</option>
                                                </select>
                                                <button 
                                                    disabled={item.is_locked || !currentPhase}
                                                    onClick={() => { setDrawerItem(item); setDrawerPhase(currentPhase); setDrawerOpen(true); }}
                                                    className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                    title="Chỉnh sửa tiến độ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                            </div>
                                        </td>`;

storeContent = storeContent.replace(searchTarget, replacementTarget);
fs.writeFileSync(storePath, storeContent);
console.log('Restored individual selects!');
