const fs = require('fs');

// Fix 1: StoreItemsList.tsx
let storePath = 'src/components/Dashboard/StoreItemsList.tsx';
let storeContent = fs.readFileSync(storePath, 'utf8');

const targetLoop = `        Promise.all(ids.map(async id => {
            const item = storeItems.find(i => i.id === id);`;
const newLoop = `        Promise.all(ids.map(async id => {
            const item = (storeItems || []).find(i => i.id === id);`;

if (storeContent.includes(targetLoop)) {
    storeContent = storeContent.replace(targetLoop, newLoop);
    fs.writeFileSync(storePath, storeContent);
}

// Fix 2 & 3: ProjectDetail.tsx
let projectPath = 'src/components/ProjectDetail.tsx';
let projectContent = fs.readFileSync(projectPath, 'utf8');

// Fix 2
const targetPhase = `let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'ACCEPTANCE' ? 'NTXX' : 'Brief';`;
const newPhase = `let phaseStr = phase === 'SURVEY' ? 'Khảo sát' : phase === 'INSTALLATION' ? 'Lắp đặt' : phase === 'NTXX' ? 'NTXX' : 'Brief';`;

if (projectContent.includes(targetPhase)) {
    projectContent = projectContent.replace(targetPhase, newPhase);
}

// Fix 3: HistoryIcon import
if (projectContent.includes('import { X } from \'lucide-react\';')) {
    projectContent = projectContent.replace('import { X } from \'lucide-react\';', 'import { X, History as HistoryIcon } from \'lucide-react\';');
} else if (projectContent.includes('import { X,')) {
     // it's already there or something else. Let's just blindly add it at the top if it doesn't exist
     if (!projectContent.includes('HistoryIcon')) {
         projectContent = `import { History as HistoryIcon } from 'lucide-react';\n` + projectContent;
     }
} else {
    // just add it at the top
    if (!projectContent.includes('HistoryIcon')) {
         projectContent = `import { History as HistoryIcon } from 'lucide-react';\n` + projectContent;
    }
}

fs.writeFileSync(projectPath, projectContent);
console.log('Fixed TS errors in StoreItemsList and ProjectDetail');
