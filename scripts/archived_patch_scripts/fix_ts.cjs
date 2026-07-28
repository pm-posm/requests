const fs = require('fs');

// Fix ModelTest.tsx
let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// Thêm currentUserRole vào props của ProjectDetailView
modelTest = modelTest.replace(
    'setShowUnifiedModal: (show: boolean) => void;\n    setImportingProject: (grp: ProjectGroup) => void;\n    setDownloadFileId: (id?: string) => void;\n}) {',
    'setShowUnifiedModal: (show: boolean) => void;\n    setImportingProject: (grp: ProjectGroup) => void;\n    setDownloadFileId: (id?: string) => void;\n    currentUserRole?: \'TECH\'|\'PM\';\n}) {'
);

// Truyền currentUserRole vào ProjectCard
modelTest = modelTest.replace(
    '<ProjectCard \n                                key={group.final_project}\n                                group={group}',
    '<ProjectCard \n                                key={group.final_project}\n                                group={group}\n                                currentUserRole={currentUserRole}'
);

fs.writeFileSync('src/components/ModelTest.tsx', modelTest);


// Fix PhaseActionModal.tsx
let phaseModal = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');
phaseModal = phaseModal.replace(
    'user_role: currentUserRole,',
    'user_role: userRole,'
);

fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', phaseModal);

console.log("Fixed TS Errors!");
