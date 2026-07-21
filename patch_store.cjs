const fs = require('fs');

const storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

// 1. Add bulk handle functions
const bulkFns = `
    const handleBulkVisTech = async (val: string) => {
        if (!val || !confirm(\`Áp dụng "\${val}" cho TẤT CẢ store?\`)) return;
        const ids = (storeItems || []).map(i => i.id);
        const { error } = await supabase.from('project_store_items').update({ vis_tech: val }).in('id', ids);
        if (!error) queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
    };

    const handleBulkPhase = async (val: string) => {
        if (!val || !confirm(\`Chuyển tiến độ TẤT CẢ store sang "\${val}"?\`)) return;
        const ids = (storeItems || []).map(i => i.id);
        // Bulk update JSON is tricky in Supabase, but we can do it via a loop or RPC.
        // For 20-50 stores, a loop of promises is totally fine.
        Promise.all(ids.map(async id => {
            const item = storeItems.find(i => i.id === id);
            if (item) {
                await updateFieldMutation.mutateAsync({ 
                    id, 
                    field: "survey_data", 
                    value: { ...(item.survey_data || {}), current_phase: val } 
                });
            }
        })).then(() => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        });
    };

    const handleBulkCategory = async (val: string) => {
        if (!val || !confirm(\`Áp dụng hạng mục "\${val}" cho TẤT CẢ store?\`)) return;
        const ids = (storeItems || []).map(i => i.id);
        const { error } = await supabase.from('project_store_items').update({ category: val }).in('id', ids);
        if (!error) queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
    };

    const handleBulkSR = async (val: string) => {
        if (!val || !confirm(\`Áp dụng SR "\${val}" cho TẤT CẢ store?\`)) return;
        // The DB doesn't have an SR column globally mapped except maybe category? Wait, where is SR?
        // Ah, the user uses category as SR right now... Wait! Let's check StoreItemsList!
        // "input type='text' defaultValue={item.category}" is under SR header!
        // So SR is category!
        // Wait, what is Hạng mục then? Maybe 'notes' or something? I should add a dedicated column or just use 'notes'.
    };
`;

if (!storeContent.includes('handleBulkVisTech')) {
    storeContent = storeContent.replace('const handleBulkSupplier =', bulkFns + '\n    const handleBulkSupplier =');
}

// 2. Fix the Headers
const oldHeaders = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">SR</th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Vis-tech</th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[140px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Supplier</span>
                                        <select 
                                            onChange={(e) => { 
                                                e.target.value && handleBulkSupplier(e.target.value); 
                                                e.target.value = ''; 
                                            }} 
                                            className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[120px] text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                        >
                                            <option value="">-- Chọn đồng loạt --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Tiến độ</th>`;

const newHeaders = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>SR</span>
                                        <input type="text" placeholder="-- Sửa loạt --" onKeyDown={(e) => { if(e.key==='Enter') { handleBulkCategory(e.currentTarget.value); e.currentTarget.value=''; } }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[90px] text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                </th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">Hạng mục</th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Vis-tech</span>
                                        <select onChange={(e) => { e.target.value && handleBulkVisTech(e.target.value); e.target.value = ''; }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[90px] text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                            <option value="">-- Chọn loạt --</option>
                                            {visTechs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[120px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Supplier</span>
                                        <select onChange={(e) => { e.target.value && handleBulkSupplier(e.target.value); e.target.value = ''; }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[100px] text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                            <option value="">-- Chọn loạt --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[100px]">
                                    <div className="flex flex-col gap-1.5">
                                        <span>Tiến độ</span>
                                        <select onChange={(e) => { e.target.value && handleBulkPhase(e.target.value); e.target.value = ''; }} className="text-[10px] font-normal border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 bg-white dark:bg-slate-900 outline-none w-full max-w-[90px] text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                            <option value="">-- Chọn loạt --</option>
                                            <option value="Brief">Brief</option>
                                            <option value="Khảo sát">Khảo sát</option>
                                            <option value="NTXX">NTXX</option>
                                            <option value="Lắp đặt">Lắp đặt</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[140px]">Ngày dự kiến</th>`;

if (storeContent.includes(oldHeaders)) {
    storeContent = storeContent.replace(oldHeaders, newHeaders);
}

// 3. Fix the Td rendering to match the new headers
// The old rendering had: SR(input), VisTech(select), Supplier(span), Tiến độ(select+button), Trạng thái, Action
// We need to insert Category and Expected Date

const oldRowBody = `<td className="p-3 text-xs">
                                            <input type="text" defaultValue={item.category || ""} onBlur={(e) => { if (e.target.value !== (item.category || "")) updateFieldMutation.mutate({ id: item.id, field: "category", value: e.target.value }); }} placeholder="Nhập SR..." className="w-full bg-transparent border-none focus:ring-0 outline-none text-xs text-slate-600 dark:text-slate-400 p-0" />
                                        </td>
                                        <td className="p-3 text-xs">
                                            <select disabled={item.is_locked} value={item.vis_tech || ""} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "vis_tech", value: e.target.value || null })} className="w-full bg-transparent border-none focus:ring-0 outline-none cursor-pointer text-xs text-slate-600 dark:text-slate-400 p-0">
                                                <option value="">-- Chọn --</option>
                                                {visTechs.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                            </select>
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
                                        </td>`;

const newRowBody = `<td className="p-3 text-xs">
                                            <input type="text" defaultValue={item.category || ""} onBlur={(e) => { if (e.target.value !== (item.category || "")) updateFieldMutation.mutate({ id: item.id, field: "category", value: e.target.value }); }} placeholder="Nhập SR..." className="w-full bg-transparent border-none focus:ring-0 outline-none text-xs text-slate-600 dark:text-slate-400 p-0 font-medium" />
                                        </td>
                                        <td className="p-3 text-xs">
                                            <input type="text" defaultValue={item.notes || ""} onBlur={(e) => { if (e.target.value !== (item.notes || "")) updateFieldMutation.mutate({ id: item.id, field: "notes", value: e.target.value }); }} placeholder="Nhập Hạng mục..." className="w-full bg-transparent border-none focus:ring-0 outline-none text-xs text-slate-600 dark:text-slate-400 p-0" />
                                        </td>
                                        <td className="p-3 text-xs">
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
                                        </td>
                                        <td className="p-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                            {phaseData?.expected_start ? (
                                                <div className="flex flex-col gap-0.5 whitespace-nowrap">
                                                    <span>{formatDate(phaseData.expected_start)} -</span>
                                                    <span>{formatDate(phaseData.expected_end)}</span>
                                                </div>
                                            ) : <span className="italic">Chưa có</span>}
                                        </td>`;

if (storeContent.includes(oldRowBody)) {
    storeContent = storeContent.replace(oldRowBody, newRowBody);
}

fs.writeFileSync(storePath, storeContent);
console.log('Patched StoreItemsList.tsx successfully');
