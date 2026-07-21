const fs = require('fs');
let c = fs.readFileSync('src/components/ProjectDetail.tsx', 'utf8');

c = c.replace(
  "supabase.from('project_activities').select('*').eq('final_project', projectCode)",
  "supabase.from('project_activities').select('*, activity_attachments(*)').eq('final_project', projectCode)"
);

fs.writeFileSync('src/components/ProjectDetail.tsx', c);
