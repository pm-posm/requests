const fs = require('fs');

// 1. Patch StoreItemsList.tsx
let storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

// Replace handleBulkPhase insert
storeContent = storeContent.replace(/await supabase\.from\('project_store_logs'\)\.insert\(\{\s*final_project: item\.final_project,\s*store_code: item\.store_code,\s*store_name: item\.store_name,\s*action: `Cập nhật tiến độ: \$\{val\}`,\s*details: 'Cập nhật hàng loạt'\s*\}\);/g, 
`await supabase.from('project_store_logs').insert({
                    store_item_id: item.id,
                    store_code: item.store_code,
                    action_type: 'PHASE_UPDATE',
                    field_name: val,
                    new_value: 'Cập nhật hàng loạt qua Header'
                });`);

// Replace Modal insert
const oldModalInsert = `await supabase.from('project_store_logs').insert({
                                final_project: currentItem.final_project,
                                store_code: currentItem.store_code,
                                store_name: currentItem.store_name,
                                action: \`Cập nhật tiến độ: \${phase}\`,
                                details: pureData.result === 'pass' ? 'Nghiệm thu: Đạt' : pureData.result === 'fail' ? \`Nghiệm thu: Lỗi - \${pureData.notes}\` : 'Cập nhật'
                            });`;

const newModalInsert = `await supabase.from('project_store_logs').insert({
                                store_item_id: currentItem.id,
                                store_code: currentItem.store_code,
                                action_type: 'PHASE_UPDATE',
                                field_name: phase,
                                new_value: pureData.result === 'pass' ? 'Nghiệm thu: Đạt' : pureData.result === 'fail' ? \`Nghiệm thu: Lỗi - \${pureData.notes}\` : 'Cập nhật'
                            });`;

storeContent = storeContent.replace(oldModalInsert, newModalInsert);
fs.writeFileSync(storePath, storeContent);

// 2. Patch ProjectDetail.tsx
let projectPath = 'src/components/ProjectDetail.tsx';
let projectContent = fs.readFileSync(projectPath, 'utf8');

const oldLogsQuery = `const { data: logs = [] } = useQuery({
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
  });`;

const newLogsQuery = `const { data: logs = [] } = useQuery({
      queryKey: ['project_store_logs_phase', group.final_project, phase],
      queryFn: async () => {
          let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'NTXX' ? 'NTXX' : 'Brief';
          
          // Step 1: get store IDs for this project
          const { data: stores } = await supabase.from('project_store_items')
              .select('id, store_name')
              .eq('final_project', group.final_project);
              
          if (!stores || stores.length === 0) return [];
          
          const storeIds = stores.map(s => s.id);
          const storeMap = stores.reduce((acc, s) => { acc[s.id] = s.store_name; return acc; }, {} as Record<string, string>);

          // Step 2: query logs for these stores
          const { data } = await supabase.from('project_store_logs')
            .select('*')
            .in('store_item_id', storeIds)
            .eq('action_type', 'PHASE_UPDATE')
            .eq('field_name', phaseStr)
            .order('created_at', { ascending: false });
            
          return (data || []).map(log => ({
              ...log,
              store_name: storeMap[log.store_item_id] || 'Unknown Store'
          }));
      }
  });`;

projectContent = projectContent.replace(oldLogsQuery, newLogsQuery);

// In ProjectDetail, the render uses log.action and log.details which no longer exist.
const oldLogRender = `<span className="font-semibold">{log.action}</span> - {log.details}`;
const newLogRender = `<span className="font-semibold">{log.field_name}</span> - {log.new_value}`;
projectContent = projectContent.replace(oldLogRender, newLogRender);

fs.writeFileSync(projectPath, projectContent);

console.log('Fixed logs for both insertions and querying.');
