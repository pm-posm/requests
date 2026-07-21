const fs = require('fs');

// 1. Dọn dẹp Dashboard.tsx (Glassmorphism Sidebar & Layout)
let dashboard = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace(
  'className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden"',
  'className="flex h-screen bg-slate-50/50 dark:bg-slate-950/50 font-sans text-slate-900 dark:text-slate-100 overflow-hidden selection:bg-indigo-500/30"'
);
dashboard = dashboard.replace(
  '<aside className="w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20">',
  '<aside className="w-[280px] shrink-0 border-r border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl flex flex-col z-20 shadow-xl shadow-indigo-500/5">'
);
// Fix top bar in Dashboard main area
dashboard = dashboard.replace(
  '<header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0 z-10">',
  '<header className="h-16 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">'
);
fs.writeFileSync('src/components/Dashboard.tsx', dashboard);

// 2. Dọn dẹp ModelTest.tsx
let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');
// Thêm background blobs
modelTest = modelTest.replace(
  '<div className="space-y-6">',
  `<div className="space-y-8 animate-in fade-in duration-500 relative z-0 pb-12">
            <div className="absolute top-0 left-0 w-full h-[400px] overflow-hidden -z-10 pointer-events-none opacity-40">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
                <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
            </div>`
);
// Sửa ProjectCard hover effects
modelTest = modelTest.replace(
  'className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer group hover:border-indigo-500/40 relative overflow-hidden flex flex-col h-full"',
  'className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-5 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer group hover:-translate-y-1 relative overflow-hidden flex flex-col h-full"'
);
// Sửa ProjectDetailView background
modelTest = modelTest.replace(
  '<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">',
  '<div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-indigo-500/5 relative overflow-hidden">'
);
fs.writeFileSync('src/components/ModelTest.tsx', modelTest);

console.log("UI Redesign Step 1: Dashboard and ModelTest basic layout updated!");
