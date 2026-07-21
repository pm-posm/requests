const fs = require('fs');

// 1. Patch StoreItemsList.tsx to add logs to handleBulkPhase
const storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

const targetBulkPhase = `        Promise.all(ids.map(async id => {
            const item = (storeItems || []).find(i => i.id === id);
            if (item) {
                await updateFieldMutation.mutateAsync({ 
                    id, 
                    field: "survey_data", 
                    value: { ...(item.survey_data || {}), current_phase: val } 
                });
            }
        })).then(() => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
        });`;

const newBulkPhase = `        Promise.all(ids.map(async id => {
            const item = (storeItems || []).find(i => i.id === id);
            if (item) {
                await updateFieldMutation.mutateAsync({ 
                    id, 
                    field: "survey_data", 
                    value: { ...(item.survey_data || {}), current_phase: val } 
                });
                await supabase.from('project_store_logs').insert({
                    final_project: item.final_project,
                    store_code: item.store_code,
                    store_name: item.store_name,
                    action: \`Cập nhật tiến độ: \${val}\`,
                    details: 'Cập nhật hàng loạt'
                });
            }
        })).then(() => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            queryClient.invalidateQueries({ queryKey: ['project_store_logs_phase'] });
        });`;

if (storeContent.includes(targetBulkPhase)) {
    storeContent = storeContent.replace(targetBulkPhase, newBulkPhase);
    fs.writeFileSync(storePath, storeContent);
}

// 2. Patch ProjectDetail.tsx PhaseModal to have tabs
const projectPath = 'src/components/ProjectDetail.tsx';
let projectContent = fs.readFileSync(projectPath, 'utf8');

// Replace the entire PhaseModal component
const targetFnStart = 'function PhaseModal({ phase, group, onClose }: { phase: PhaseType, group: ProjectGroup, onClose: () => void }) {';

// Need to find the end of the PhaseModal component.
// It ends with:
//   );
// }
// right before export default function ProjectDetail() {

const targetFnEndStr = 'export default function ProjectDetail() {';
const startIndex = projectContent.indexOf(targetFnStart);
const endIndex = projectContent.indexOf(targetFnEndStr);

if (startIndex !== -1 && endIndex !== -1) {
    const originalFn = projectContent.substring(startIndex, endIndex);

    const newFn = `function PhaseModal({ phase, group, onClose }: { phase: PhaseType, group: ProjectGroup, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'emails' | 'history'>('emails');

  const { data: logs = [] } = useQuery({
      queryKey: ['project_store_logs_phase', group.final_project, phase],
      queryFn: async () => {
          let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'NTXX' ? 'NTXX' : 'Brief';
          const { data } = await supabase.from('project_store_logs')
            .select('*')
            .eq('final_project', group.final_project)
            .ilike('action', \`%Cập nhật tiến độ: \${phaseStr}%\`)
            .order('created_at', { ascending: false });
          return data || [];
      }
  });

  const filteredEvents = group.activities.filter(a => {
      const p = (a.phase_type || '').toUpperCase();
      if (phase === 'BRIEF') return p === 'BRIEF';
      if (phase === 'NTXX') return p === 'ACCEPTANCE' || p === 'NTXX';
      if (phase === 'SURVEY') return p === 'SURVEY' || p === 'KHAO_SAT';
      if (phase === 'INSTALLATION') return p === 'INSTALLATION' || p === 'LAP_DAT';
      return false;
  });

  const phaseLabels: Record<PhaseType, string> = {
      'BRIEF': 'Brief Nhãn Hàng',
      'NTXX': 'Nghiệm thu Xuất xưởng (NTXX)',
      'SURVEY': 'Khảo sát',
      'INSTALLATION': 'Lắp đặt'
  };

  return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 rounded-lg">
                          <Mail className="w-5 h-5" />
                      </div>
                      <div>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">
                              Chi tiết Giai đoạn: {phaseLabels[phase]}
                          </h2>
                      </div>
                  </div>
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                  </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 shrink-0">
                  <button 
                      onClick={() => setActiveTab('emails')}
                      className={\`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \${activeTab === 'emails' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
                  >
                      <Mail className="w-4 h-4" /> Luồng Email ({filteredEvents.length})
                  </button>
                  <button 
                      onClick={() => setActiveTab('history')}
                      className={\`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \${activeTab === 'history' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
                  >
                      <HistoryIcon className="w-4 h-4" /> Lịch sử Truy vấn ({logs.length})
                  </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                  {activeTab === 'emails' ? (
                      filteredEvents.length === 0 ? (
                          <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                              <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <h3 className="text-base font-bold text-slate-500">Chưa có email nào</h3>
                              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                  Giai đoạn này chưa có luồng email hoặc tài liệu đính kèm.
                              </p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {filteredEvents.map((event) => (
                                  <ActivityDetailCard key={event.id} activity={event} projectGroup={group} />
                              ))}
                          </div>
                      )
                  ) : (
                      logs.length === 0 ? (
                          <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                              <HistoryIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <h3 className="text-base font-bold text-slate-500">Chưa có lịch sử</h3>
                              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                  Giai đoạn này chưa có bất kỳ cập nhật tiến độ nào từ người dùng.
                              </p>
                          </div>
                      ) : (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                              <div className="overflow-y-auto custom-scrollbar p-0">
                                  <table className="w-full text-left border-collapse">
                                      <thead className="bg-slate-50 dark:bg-slate-950/50">
                                          <tr>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Thời gian</th>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Store</th>
                                              <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">Hành động</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {logs.map(log => (
                                              <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                  <td className="p-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                      {new Date(log.created_at).toLocaleString('vi-VN')}
                                                  </td>
                                                  <td className="p-3 text-xs">
                                                      <span className="font-bold text-indigo-600 dark:text-indigo-400 block">{log.store_code}</span>
                                                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">{log.store_name}</span>
                                                  </td>
                                                  <td className="p-3 text-xs text-slate-700 dark:text-slate-300">
                                                      <span className="font-semibold">{log.action}</span> - {log.details}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )
                  )}
              </div>
          </div>
      </div>
  );
}

`;

    projectContent = projectContent.replace(originalFn, newFn);
    fs.writeFileSync(projectPath, projectContent);
}

console.log('Patched tabs successfully!');
