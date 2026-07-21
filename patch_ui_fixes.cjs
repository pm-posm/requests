const fs = require('fs');

// Patch 1: utils/index.ts to return empty status instead of 'Chờ làm'
let utilsPath = 'src/utils/index.ts';
let utilsContent = fs.readFileSync(utilsPath, 'utf8');

const targetFallback = `        // 3. Fallback to manually saved status if no dates
        if (data.current_status) return { status: data.current_status };
        return { status: 'Chờ làm' };`;
const newFallback = `        // 3. Fallback to manually saved status if no dates
        if (data.current_status) return { status: data.current_status };
        return { status: '' };`; // Return completely empty

if (utilsContent.includes(targetFallback)) {
    utilsContent = utilsContent.replace(targetFallback, newFallback);
    fs.writeFileSync(utilsPath, utilsContent);
    console.log('Successfully patched utils/index.ts for empty status');
}

// Patch 2: StoreItemsList.tsx
let storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

// a) Add handleBulkSupplier function
const targetBulkFn = `    const deleteVisTechMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('project_vis_techs').delete().eq('id', id);
            // removed undefined error throw
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project_vis_techs'] })
    });`;

const newBulkFn = `    const deleteVisTechMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('project_vis_techs').delete().eq('id', id);
            // removed undefined error throw
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project_vis_techs'] })
    });

    const handleBulkSupplier = async (supplierName: string) => {
        if (!supplierName) return;
        if (!confirm(\`Bạn có chắc muốn áp dụng nhà thầu "\${supplierName}" cho TẤT CẢ store trong danh sách?\`)) return;
        
        const ids = storeItems.map(item => item.id);
        const { error } = await supabase.from('project_store_items').update({ supplier_name: supplierName }).in('id', ids);
        if (error) alert('Lỗi: ' + error.message);
        else {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            // Log this bulk action loosely or just rely on the UI update
        }
    };`;

if (storeContent.includes(targetBulkFn) && !storeContent.includes('handleBulkSupplier')) {
    storeContent = storeContent.replace(targetBulkFn, newBulkFn);
}

// b) Update Supplier table header
const targetTh = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[140px]">Supplier</th>`;
const newTh = `<th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[140px]">
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
                                </th>`;

if (storeContent.includes(targetTh)) {
    storeContent = storeContent.replace(targetTh, newTh);
}

// c) Update Supplier row cell
const targetTd = `<td className="p-3 text-xs">
                                            <select disabled={item.is_locked} value={item.supplier_name || ""} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "supplier_name", value: e.target.value || null })} className="w-full bg-transparent border-none focus:ring-0 outline-none cursor-pointer text-xs text-slate-600 dark:text-slate-400 p-0">
                                                <option value="">-- Chọn --</option>
                                                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </td>`;
const newTd = `<td className="p-3 text-xs">
                                            {item.supplier_name ? (
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800/50 rounded font-bold text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 break-words line-clamp-2" title={item.supplier_name}>
                                                    {item.supplier_name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">-- Trống --</span>
                                            )}
                                        </td>`;

if (storeContent.includes(targetTd)) {
    storeContent = storeContent.replace(targetTd, newTd);
}

// d) Replace status span 
const searchStr = `<span className={\`px-2 py-1 rounded font-bold border whitespace-nowrap \${
                                                    currentStatus === "Đang làm" && isLate ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : 
                                                    currentStatus === "Hoàn tất" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : 
                                                    currentStatus.startsWith("Lỗi") ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" :
                                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"\`}>
                                                    {currentStatus}{currentStatus === "Đang làm" && isLate ? " (Trễ)" : ""}
                                                </span>`;

const replaceStr = `{currentStatus ? (
                                                <span className={\`px-2 py-1 rounded font-bold border whitespace-nowrap \${
                                                    currentStatus === "Đang làm" && isLate ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : 
                                                    currentStatus === "Hoàn tất" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : 
                                                    currentStatus.startsWith("Lỗi") ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" :
                                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"\`}>
                                                    {currentStatus}{currentStatus === "Đang làm" && isLate ? " (Trễ)" : ""}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">&lt;Trống&gt;</span>
                                            )}`;

if (storeContent.includes(searchStr)) {
    storeContent = storeContent.replace(searchStr, replaceStr);
}

fs.writeFileSync(storePath, storeContent);
console.log('Successfully patched StoreItemsList.tsx for Bulk Supplier and Empty Status display');
