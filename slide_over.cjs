const fs = require('fs');

let content = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

const startTag = '<div className="bg-transparent">';
const endTag = '{showUnifiedModal && importingProject && (';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const newUI = `
            {/* Grid Luôn Hiện */}
            <div className="bg-transparent relative z-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredGroups.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-500 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/20">
                            Không có dự án nào
                        </div>
                    ) : (
                        filteredGroups.map(group => (
                            <ProjectCard 
                                key={group.final_project}
                                group={group}
                                currentUserRole={currentUserRole}
                                matchedProject={findMatchedProject(group)}
                                onClick={() => setSelectedProjectKey(group.final_project)}
                            />
                        ))
                    )}
                </div>

                {/* Slide-over Panel */}
                {selectedProjectKey && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Backdrop */}
                        <div 
                            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
                            onClick={() => setSelectedProjectKey(null)} 
                        />
                        {/* Right Panel */}
                        <div className="relative w-full max-w-4xl h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-3xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-in slide-in-from-right duration-300 flex flex-col">
                            {/* Nút Đóng Tuyệt đối góc trên */}
                            <button 
                                onClick={() => setSelectedProjectKey(null)}
                                className="absolute top-4 right-4 z-[60] w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <ProjectDetailView 
                                    currentUserRole={currentUserRole} 
                                    group={filteredGroups.find(g => g.final_project === selectedProjectKey)!}
                                    matchedProject={findMatchedProject(filteredGroups.find(g => g.final_project === selectedProjectKey)!)}
                                    onBack={() => setSelectedProjectKey(null)}
                                    onExtractExcel={(fileId, phase, grp) => {
                                        setDownloadFileId(fileId);
                                        setImportingProject(grp);
                                        setShowUnifiedModal(true);
                                    }}
                                    setShowUnifiedModal={setShowUnifiedModal}
                                    setImportingProject={setImportingProject}
                                    setDownloadFileId={setDownloadFileId}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            `;
    
    content = content.slice(0, startIndex) + newUI + content.slice(endIndex);
    fs.writeFileSync('src/components/ModelTest.tsx', content);
    console.log('Slide-over Panel implemented!');
} else {
    console.log('Indexes not found!');
}
