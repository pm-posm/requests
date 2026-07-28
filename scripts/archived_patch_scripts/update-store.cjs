const fs = require('fs');

const content = fs.readFileSync('src/components/Dashboard/StoreItemsList.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = 362;
// Find the exact end index where the grid and Lịch trình end.
let endIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].includes(') : (')) {
        endIndex = i;
        break;
    }
}

if (endIndex === -1) {
    console.error("Could not find the end index.");
    process.exit(1);
}

const tableContent = [
    '                {/* Modern Data Table for Stores */}',
    '                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm mt-4 custom-scrollbar">',
    '                    <table className="w-full text-left border-collapse min-w-[900px]">',
    '                        <thead>',
    '                            <tr className="bg-slate-50 dark:bg-slate-950/50 text-[11px] text-slate-500 uppercase tracking-wider">',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Store Code</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 max-w-[200px]">Store Name</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">SR</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Vis-tech</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[140px]">Supplier</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Tiến độ</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-[120px]">Trạng thái</th>',
    '                                <th className="p-3 font-semibold border-b border-slate-200 dark:border-slate-800 w-10 text-center"></th>',
    '                            </tr>',
    '                        </thead>',
    '                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">',
    '                            {storeItems.map((item) => {',
    '                                const currentPhase = item.survey_data?.current_phase || "";',
    '                                const currentStatus = item.survey_data?.current_status || "Chờ làm";',
    '                                return (',
    '                                    <tr key={item.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${item.is_locked ? "opacity-70" : ""}`}>',
    '                                        <td className="p-3 text-xs font-bold text-slate-700 dark:text-slate-300">',
    '                                            <div className="flex items-center gap-1.5">',
    '                                                {item.is_locked && <Lock className="w-3 h-3 text-indigo-500 shrink-0" />}',
    '                                                {item.store_code}',
    '                                            </div>',
    '                                        </td>',
    '                                        <td className="p-3 text-xs font-semibold text-slate-900 dark:text-white line-clamp-2" title={item.store_name}>',
    '                                            {item.store_name || "(Trống)"}',
    '                                        </td>',
    '                                        <td className="p-3 text-xs">',
    '                                            <input type="text" defaultValue={item.category || ""} onBlur={(e) => { if (e.target.value !== (item.category || "")) updateFieldMutation.mutate({ id: item.id, field: "category", value: e.target.value }); }} placeholder="Nhập SR..." className="w-full bg-transparent border-none focus:ring-0 outline-none text-xs text-slate-600 dark:text-slate-400 p-0" />',
    '                                        </td>',
    '                                        <td className="p-3 text-xs">',
    '                                            <select disabled={item.is_locked} value={item.vis_tech || ""} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "vis_tech", value: e.target.value || null })} className="w-full bg-transparent border-none focus:ring-0 outline-none cursor-pointer text-xs text-slate-600 dark:text-slate-400 p-0">',
    '                                                <option value="">-- Chọn --</option>',
    '                                                {visTechs.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}',
    '                                            </select>',
    '                                        </td>',
    '                                        <td className="p-3 text-xs">',
    '                                            <select disabled={item.is_locked} value={item.supplier_name || ""} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "supplier_name", value: e.target.value || null })} className="w-full bg-transparent border-none focus:ring-0 outline-none cursor-pointer text-xs text-slate-600 dark:text-slate-400 p-0">',
    '                                                <option value="">-- Chọn --</option>',
    '                                                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}',
    '                                            </select>',
    '                                        </td>',
    '                                        <td className="p-2 text-xs">',
    '                                            <select disabled={item.is_locked} value={currentPhase} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "survey_data", value: { ...(item.survey_data || {}), current_phase: e.target.value } })} className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800 rounded border-none outline-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">',
    '                                                <option value="">-- Chọn --</option>',
    '                                                <option value="Brief">Brief</option>',
    '                                                <option value="Khảo sát">Khảo sát</option>',
    '                                                <option value="NTXX">NTXX</option>',
    '                                                <option value="Lắp đặt">Lắp đặt</option>',
    '                                            </select>',
    '                                        </td>',
    '                                        <td className="p-2 text-xs">',
    '                                            <select disabled={item.is_locked} value={currentStatus} onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: "survey_data", value: { ...(item.survey_data || {}), current_status: e.target.value } })} className={`w-full py-1.5 px-2 rounded border-none outline-none cursor-pointer text-xs font-semibold ${currentStatus === "Hoàn tất" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : currentStatus === "Đang làm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : currentStatus.startsWith("Lỗi") ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>',
    '                                                <option value="Chờ làm">Chờ làm</option>',
    '                                                <option value="Đang làm">Đang làm</option>',
    '                                                <option value="Hoàn tất">Hoàn tất</option>',
    '                                                <option value="Lỗi lần 1">Lỗi lần 1</option>',
    '                                                <option value="Lỗi lần 2">Lỗi lần 2</option>',
    '                                                <option value="Lỗi lần 3">Lỗi lần 3</option>',
    '                                            </select>',
    '                                        </td>',
    '                                        <td className="p-3 text-xs text-center">',
    '                                            <button type="button" onClick={() => { if (confirm("Xóa cửa hàng này?")) deleteItemMutation.mutate(item.id); }} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>',
    '                                        </td>',
    '                                    </tr>',
    '                                );',
    '                            })}',
    '                        </tbody>',
    '                    </table>',
    '                </div>',
    '            </>'
];

const newLines = [
    ...lines.slice(0, startIndex),
    ...tableContent,
    ...lines.slice(endIndex)
];

fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', newLines.join('\n'));
console.log("Successfully replaced Grid with Table and removed Lịch trình.");
