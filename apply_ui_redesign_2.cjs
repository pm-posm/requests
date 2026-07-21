const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard/StoreItemsList.tsx', 'utf8');

// The block to replace starts at `<div className="overflow-x-auto max-h-60 border border-slate-100 dark:border-slate-800 rounded-lg">`
// and ends at `</table>\n                </div>`
const startIndex = content.indexOf('<div className="overflow-x-auto max-h-60 border border-slate-100 dark:border-slate-800 rounded-lg">');
const endIndex = content.indexOf('</table>\n                </div>') + '</table>\n                </div>'.length;

if (startIndex !== -1 && endIndex !== -1) {
    const newUI = `
                {/* Modern Grid View for Stores */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4 pt-2">
                    {storeItems.map((item) => {
                        const surveyStatus = computePhaseStatus(item.survey_data);
                        const installStatus = computePhaseStatus(item.installation_data);
                        const acceptStatus = computePhaseStatus(item.ntxx_data);
                        const isSurveyCompleted = surveyStatus.status === 'Hoàn tất' || surveyStatus.status === 'Hoàn thành' || surveyStatus.status === 'Đạt';

                        const getStatusColor = (status: string) => {
                            if (status === 'Hoàn tất' || status === 'Đạt' || status === 'Hoàn thành') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400';
                            if (status === 'Lỗi' || status === 'Không Đạt' || status === 'Quá hạn') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-455';
                            if (status === 'Đang làm') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400';
                            if (status === 'Chờ làm') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400';
                            return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400';
                        };

                        return (
                            <div 
                                key={item.id} 
                                className={\`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border transition-all duration-300 relative group flex flex-col shadow-sm \${item.is_locked ? 'opacity-70 border-slate-200/50 dark:border-slate-800/50' : 'border-white/40 dark:border-white/5 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-200/50 dark:hover:border-indigo-800/50'}\`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4 gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {item.is_locked && <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-pulse" />}
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{item.store_code}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.store_name || '(Trống tên)'}</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('Xóa store này khỏi danh sách?')) {
                                                deleteItemMutation.mutate(item.id);
                                            }
                                        }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                                        title="Xóa cửa hàng"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-3 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1/3 text-xs font-semibold text-slate-500">Hạng mục</div>
                                        <div className="w-2/3">
                                            <input
                                                type="text"
                                                defaultValue={item.category || ''}
                                                onBlur={(e) => {
                                                    if (e.target.value !== (item.category || '')) {
                                                        updateFieldMutation.mutate({ id: item.id, field: 'category', value: e.target.value });
                                                    }
                                                }}
                                                placeholder="Nhập hạng mục..."
                                                className="w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-950/50 hover:bg-white focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-1/3 text-xs font-semibold text-slate-500">Nhà thầu</div>
                                        <div className="w-2/3">
                                            <select
                                                disabled={item.is_locked}
                                                value={item.supplier_name || ''}
                                                onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: 'supplier_name', value: e.target.value || null })}
                                                className={\`w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg outline-none transition-all \${item.is_locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}\`}
                                            >
                                                <option value="">-- Chọn --</option>
                                                {suppliers.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-1/3 text-xs font-semibold text-slate-500">Kỹ thuật viên</div>
                                        <div className="w-2/3">
                                            <select
                                                disabled={item.is_locked}
                                                value={item.vis_tech || ''}
                                                onChange={(e) => updateFieldMutation.mutate({ id: item.id, field: 'vis_tech', value: e.target.value || null })}
                                                className={\`w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg outline-none transition-all \${item.is_locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}\`}
                                            >
                                                <option value="">-- Chọn --</option>
                                                {visTechs.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Phase Status Badges */}
                                <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div 
                                        onClick={() => { setSelectedSurveyItem(item); setShowSurveyModal(true); }}
                                        className={\`flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform \${getStatusColor(surveyStatus.status)}\`}
                                    >
                                        <span className="text-[9px] uppercase tracking-wide opacity-80 mb-0.5">Khảo sát</span>
                                        <span className="text-[10px] font-bold text-center leading-tight">{surveyStatus.status}</span>
                                    </div>
                                    
                                    <div 
                                        onClick={() => { setSelectedNtxxItem(item); setShowNtxxModal(true); }}
                                        className={\`flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer hover:scale-105 transition-transform \${getStatusColor(acceptStatus.status)}\`}
                                    >
                                        <span className="text-[9px] uppercase tracking-wide opacity-80 mb-0.5">NTXX</span>
                                        <span className="text-[10px] font-bold text-center leading-tight">{acceptStatus.status}</span>
                                    </div>

                                    <div 
                                        onClick={() => { 
                                            if (isSurveyCompleted) { setSelectedInstallItem(item); setShowInstallModal(true); }
                                            else { alert('Vui lòng hoàn thành phase Khảo sát trước khi bắt đầu Lắp đặt!'); }
                                        }}
                                        className={\`flex flex-col items-center justify-center p-2 rounded-xl transition-transform \${isSurveyCompleted ? 'cursor-pointer hover:scale-105 ' + getStatusColor(installStatus.status) : 'cursor-not-allowed opacity-40 grayscale ' + getStatusColor(installStatus.status)}\`}
                                    >
                                        <span className="text-[9px] uppercase tracking-wide opacity-80 mb-0.5">Lắp đặt</span>
                                        <span className="text-[10px] font-bold text-center leading-tight">{installStatus.status}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
    `;

    content = content.slice(0, startIndex) + newUI + content.slice(endIndex);
    fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', content);
    console.log("UI Redesign Step 2: StoreItemsList table converted to GlassCards!");
} else {
    console.error("Could not find table block in StoreItemsList.tsx");
}
