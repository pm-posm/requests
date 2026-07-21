const fs = require('fs');

const path = 'src/components/ProjectDetail.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. We need useQuery in PhaseModal
const targetFn = `function PhaseModal({ phase, group, onClose }: { phase: PhaseType, group: ProjectGroup, onClose: () => void }) {
  const filteredEvents = group.activities.filter(a => {`;

const newFn = `function PhaseModal({ phase, group, onClose }: { phase: PhaseType, group: ProjectGroup, onClose: () => void }) {
  const { data: logs = [] } = useQuery({
      queryKey: ['project_store_logs_phase', group.final_project, phase],
      queryFn: async () => {
          // fetch logs for this phase
          let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'ACCEPTANCE' ? 'NTXX' : 'Brief';
          const { data } = await supabase.from('project_store_logs')
            .select('*')
            .eq('final_project', group.final_project)
            .ilike('action', \`%Cập nhật tiến độ: \${phaseStr}%\`)
            .order('created_at', { ascending: false });
          return data || [];
      }
  });

  const filteredEvents = group.activities.filter(a => {`;

if (content.includes(targetFn)) {
    content = content.replace(targetFn, newFn);
}

// 2. Display the logs inside the body
const targetBody = `                  {filteredEvents.length === 0 ? (
                      <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                          <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <h3 className="text-base font-bold text-slate-500">Chưa có dữ liệu</h3>
                          <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                              Giai đoạn này chưa có email hoặc sự kiện nào được hệ thống ghi nhận.
                          </p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {filteredEvents.map((event) => (
                              <ActivityDetailCard key={event.id} activity={event} projectGroup={group} />
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
}`;

const newBody = `                  {filteredEvents.length === 0 && logs.length === 0 ? (
                      <div className="text-center p-12 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
                          <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <h3 className="text-base font-bold text-slate-500">Chưa có dữ liệu</h3>
                          <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                              Giai đoạn này chưa có email hoặc sự kiện nào được hệ thống ghi nhận.
                          </p>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          {filteredEvents.length > 0 && (
                              <div className="space-y-4">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Mail className="w-4 h-4"/> Nguồn Email & Tài liệu</h4>
                                  {filteredEvents.map((event) => (
                                      <ActivityDetailCard key={event.id} activity={event} projectGroup={group} />
                                  ))}
                              </div>
                          )}

                          {logs.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"><HistoryIcon className="w-4 h-4"/> Lịch sử Cập nhật</h4>
                                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                                          {logs.map(log => (
                                              <div key={log.id} className="text-[11px] flex gap-3 pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                                                  <div className="font-mono text-slate-400 shrink-0">
                                                      {new Date(log.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                                  </div>
                                                  <div className="text-slate-600 dark:text-slate-300">
                                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">[{log.store_code}]</span> {log.action} - <span className="font-medium text-slate-700 dark:text-slate-200">{log.details}</span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
}`;

if (content.includes(targetBody)) {
    content = content.replace(targetBody, newBody);
}

// Since I added HistoryIcon, I need to make sure it's imported.
if (!content.includes('HistoryIcon')) {
    content = content.replace('X } from', 'X, History as HistoryIcon } from');
}

// 3. I also need to make sure useQuery and supabase are imported if not
if (!content.includes('useQuery')) {
    content = `import { useQuery } from '@tanstack/react-query';\n` + content;
}
if (!content.includes('import { supabase }')) {
    content = `import { supabase } from '@/lib/supabase';\n` + content;
}

fs.writeFileSync(path, content);
console.log('Patched ProjectDetail.tsx successfully');
