const fs = require('fs');

let content = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');

// Thay đổi Modal container
content = content.replace(
    '<div className="bg-white dark:bg-slate-950 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">',
    '<div className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl w-full max-w-4xl rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/20 dark:border-white/5 flex flex-col max-h-[90vh] ring-1 ring-slate-200/50 dark:ring-slate-800/50">'
);

// Thay đổi header modal
content = content.replace(
    '<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50">',
    '<div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between shrink-0 bg-white/40 dark:bg-slate-900/40">'
);

// Thay đổi form control background
content = content.replace(
    'className="md:w-1/2 p-6 overflow-y-auto bg-white dark:bg-slate-950 custom-scrollbar"',
    'className="md:w-1/2 p-6 overflow-y-auto bg-white/40 dark:bg-slate-950/40 custom-scrollbar"'
);

// Nút submit style
content = content.replace(
    'className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"',
    'className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"'
);

// Nếu có actionType selector, cập nhật style active
content = content.replace(
    `bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm`,
    `bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200/50 dark:ring-slate-800/50 scale-105`
);

fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', content);
console.log("UI Redesign Step 3: PhaseActionModal updated to Glassmorphism!");
