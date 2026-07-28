const fs = require('fs');

let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// The block to replace:
//             <div className="bg-transparent">
//                 {selectedProjectKey ? (
//                     <ProjectDetailView currentUserRole={currentUserRole} ... />
//                 ) : (
//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//                         ...
//                     </div>
//                 )}
//             </div>

// First let's find the exact ProjectDetailView block.
const startIndex = modelTest.indexOf('<div className="bg-transparent">');
const endIndexStr = ')}';
// This is tricky using simple indexOf because there are many `)}`. Let's use string replace with regex or targeted replace.

const targetBlock = `            <div className="bg-transparent">
                {selectedProjectKey ? (
                    <ProjectDetailView currentUserRole={currentUserRole} 
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
                ) : (
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
                )}
            </div>`;

const replacementBlock = `            <div className="bg-transparent relative z-0">
                {/* Luôn hiển thị Grid */}
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

                {/* Slide-over Panel cho Chi tiết dự án */}
                {selectedProjectKey && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Backdrop */}
                        <div 
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
                            onClick={() => setSelectedProjectKey(null)} 
                        />
                        {/* Panel */}
                        <div className="relative w-full max-w-5xl h-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar flex flex-col">
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
                )}
            </div>`;

if (modelTest.includes(targetBlock.substring(0, 100))) {
    // Need to do a more flexible replacement in case of spacing issues
    const parts = modelTest.split('<div className="bg-transparent">');
    if (parts.length > 1) {
        const afterDiv = parts[1];
        const endOfBlock = afterDiv.indexOf('</div>\n\n            {/* Unified Modal */}');
        if (endOfBlock !== -1) {
            const finalReplacement = parts[0] + replacementBlock + '\n\n            {/* Unified Modal */}'+ afterDiv.substring(endOfBlock + '</div>\n\n            {/* Unified Modal */}'.length);
            fs.writeFileSync('src/components/ModelTest.tsx', finalReplacement);
            console.log("Replaced ModelTest successfully with Slide-over!");
        } else {
            console.log("Could not find end of block");
        }
    } else {
        console.log("Could not find bg-transparent div");
    }
} else {
    console.log("Target block not matched exactly");
}
