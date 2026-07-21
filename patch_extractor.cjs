const fs = require('fs');
const path = 'src/components/ExcelExtractor/UnifiedProjectActionModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add globalSupplier state and useQuery for suppliers
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

// 2. Add Supplier dropdown in UI
const targetHeaderUi = `                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-500">
                                                Cấu hình Cột:
                                            </span>`;

const newHeaderUi = `                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 dark:border-slate-800 pr-4">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Nhà thầu chung:</span>
                                                <select 
                                                    value={globalSupplier} 
                                                    onChange={(e) => setGlobalSupplier(e.target.value)}
                                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded px-2 py-1 outline-none"
                                                >
                                                    <option value="">-- Theo Excel --</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500">
                                                Cấu hình Cột:
                                            </span>`;

if (!content.includes('Nhà thầu chung:')) {
    content = content.replace(targetHeaderUi, newHeaderUi);
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

if (!content.includes('mappedPhase')) {
    content = content.replace(targetPayload, newPayload);
}

fs.writeFileSync(path, content);
console.log('Successfully patched UnifiedProjectActionModal.tsx');
