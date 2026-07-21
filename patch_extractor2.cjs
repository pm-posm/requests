const fs = require('fs');
const path = 'src/components/ExcelExtractor/UnifiedProjectActionModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add globalSupplier state if not already there
if (!content.includes('globalSupplier')) {
    const stateHook = `    const [globalSupplier, setGlobalSupplier] = React.useState('');
    const { data: suppliers = [] } = useQuery<any[]>({
        queryKey: ['project_suppliers'],
        queryFn: async () => {
            const { data } = await supabase.from('project_suppliers').select('*').order('name', { ascending: true });
            return data || [];
        }
    });`;
    content = content.replace('const [mapping, setMapping]', stateHook + '\n    const [mapping, setMapping]');
}

// 2. Add Supplier dropdown in Mapping Header
const targetHeader = `                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-500" /> Cấu hình ánh xạ cột</h4>
                                        <button onClick={() => setShowAdvancedMapping(!showAdvancedMapping)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                                            {showAdvancedMapping ? 'Ẩn cấu hình' : 'Hiện cấu hình'}
                                        </button>
                                    </div>`;

const newHeader = `                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-500" /> Cấu hình ánh xạ cột</h4>
                                            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                                                <span className="text-[10px] font-bold text-indigo-600 uppercase">Nhà thầu chung (Áp dụng tất cả):</span>
                                                <select 
                                                    value={globalSupplier} 
                                                    onChange={(e) => setGlobalSupplier(e.target.value)}
                                                    className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-xs rounded px-2 py-1 outline-none text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
                                                >
                                                    <option value="">-- Lấy theo cột Excel --</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowAdvancedMapping(!showAdvancedMapping)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                                            {showAdvancedMapping ? 'Ẩn cấu hình' : 'Hiện cấu hình'}
                                        </button>
                                    </div>`;

if (content.includes(targetHeader)) {
    content = content.replace(targetHeader, newHeader);
}

// 3. Update handleImportAll payload
const targetPayload = `                    payloadMap.set(f_storeCode, {
                        final_project: projectGroup.final_project,
                        store_name: storeName || undefined,
                        category: mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM',
                        supplier_name: mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined,
                        is_published: false,
                        store_code: f_storeCode
                    });`;

const newPayload = `                    const mappedPhase = selectedFile?.phase === 'SURVEY' ? 'Khảo sát' :
                                        selectedFile?.phase === 'INSTALLATION' ? 'Lắp đặt' :
                                        selectedFile?.phase === 'ACCEPTANCE' ? 'NTXX' : 'Brief';
                    
                    payloadMap.set(f_storeCode, {
                        final_project: projectGroup.final_project,
                        store_name: storeName || undefined,
                        category: mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM',
                        supplier_name: globalSupplier || (mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined),
                        is_published: false,
                        store_code: f_storeCode,
                        survey_data: { current_phase: mappedPhase } // auto set phase based on file
                    });`;

if (content.includes(targetPayload)) {
    content = content.replace(targetPayload, newPayload);
}

// 4. Update Preview rendering to show the global supplier override
const oldPreviewSupplier = `{mapping.supplier_name !== -1 && row[mapping.supplier_name] && <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[8px] font-bold border border-slate-200 dark:border-slate-700 truncate max-w-[80px]" title={row[mapping.supplier_name]}>{row[mapping.supplier_name]}</span>}`;
const newPreviewSupplier = `{(globalSupplier || (mapping.supplier_name !== -1 && row[mapping.supplier_name])) && <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[8px] font-bold border border-slate-200 dark:border-slate-700 truncate max-w-[80px]" title={globalSupplier || row[mapping.supplier_name]}>{globalSupplier || row[mapping.supplier_name]}</span>}`;

if (content.includes(oldPreviewSupplier)) {
    content = content.replace(oldPreviewSupplier, newPreviewSupplier);
}

fs.writeFileSync(path, content);
console.log('Successfully patched UnifiedProjectActionModal.tsx with Supplier logic');
