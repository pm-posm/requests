const fs = require('fs');

let content = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// Thay đổi background tổng thể
content = content.replace(
    '<div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">',
    '<div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950/50 font-sans selection:bg-indigo-500/30">'
);

// Tìm vị trí bắt đầu nội dung chính
const headerSearchIndex = content.indexOf('<div className="flex justify-between items-center mb-6">');
if (headerSearchIndex !== -1) {
    const sidebar = `
        {/* Modern Sidebar */}
        <aside className="w-72 hidden lg:flex flex-col border-r border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl sticky top-0 h-screen overflow-y-auto">
            <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight leading-tight">POSM<br/><span className="text-indigo-600 dark:text-indigo-400">Tracker</span></h1>
                </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Navigation</p>
                <button className="flex items-center gap-3 w-full p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium transition-all">
                    <Folder className="w-5 h-5" />
                    Quản lý Dự án
                </button>
                <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-medium transition-all group">
                    <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    Nghiệm thu
                </button>
                
                <div className="mt-8 mb-2 px-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vai trò hiện tại</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="relative flex items-center justify-between w-full h-10 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                        <button 
                            onClick={() => setCurrentUserRole('TECH')}
                            className={\`flex-1 h-full rounded-md text-xs font-bold transition-all \${currentUserRole === 'TECH' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}\`}
                        >
                            TECH
                        </button>
                        <button 
                            onClick={() => setCurrentUserRole('PM')}
                            className={\`flex-1 h-full rounded-md text-xs font-bold transition-all \${currentUserRole === 'PM' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-sm' : 'text-slate-500'}\`}
                        >
                            PM
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="p-6 border-t border-slate-200/60 dark:border-slate-800/60 mt-auto">
                <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">U</div>
                    <span>{currentUserRole === 'PM' ? 'Quản lý' : 'Kỹ thuật viên'}</span>
                </button>
            </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <header className="h-20 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quản lý Dự án POSM</h2>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Tìm nhanh mã CH, dự án..." 
                            className="w-64 pl-9 pr-4 py-2 text-sm rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                {/* Background decorative blobs */}
                <div className="absolute top-0 left-0 w-full h-[300px] overflow-hidden -z-10 pointer-events-none opacity-40">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                    <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                </div>
                
                <div className="max-w-6xl mx-auto space-y-8">
    `;

    // Remove old headerSearch block and replace with the new layout wrapper
    // We need to find the end of the old search block
    const endSearchBlock = content.indexOf('</div>', headerSearchIndex) + 6;
    const oldBlock = content.substring(headerSearchIndex, content.indexOf('</div>', content.indexOf('</div>', content.indexOf('</div>', headerSearchIndex) + 6) + 6) + 6);
    
    // Actually just string replace the old header entirely
    content = content.replace(oldBlock, sidebar);

    // Close the layout tags at the end of the file
    content = content.replace(
        '        </div>\n    );\n}',
        '                </div>\n            </div>\n        </main>\n        </div>\n    );\n}'
    );
}

fs.writeFileSync('src/components/ModelTest.tsx', content);
