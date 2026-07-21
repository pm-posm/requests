const fs = require('fs');
let c = fs.readFileSync('src/components/ProjectDetail.tsx', 'utf8');

c = c.replace(/\\\`%Cập nhật tiến độ: \\\$\\{phaseStr\\}%\\\`/g, "`%Cập nhật tiến độ: ${phaseStr}%`");

c = c.replace(/\\\`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \\\$\\{activeTab === 'emails' \\? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'\\}\\\`/g, 
  "`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'emails' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`");

c = c.replace(/\\\`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 \\\$\\{activeTab === 'history' \\? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'\\}\\\`/g,
  "`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`");

fs.writeFileSync('src/components/ProjectDetail.tsx', c);
