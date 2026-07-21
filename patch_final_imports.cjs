const fs = require('fs');

// 1. PhaseActionModal
let phase = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');
phase = phase.replace("import { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup } from '@/types';");
fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', phase);

// 2. ExcelExtractorModal
let excel = fs.readFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', 'utf8');
excel = excel.replace("import type { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup, ExcelExtractorModalProps } from '@/types';\nimport { useMutation, useQuery } from '@tanstack/react-query';");
fs.writeFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', excel);

// 3. UnifiedProjectActionModal
let unified = fs.readFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', 'utf8');
unified = unified.replace("import type { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup } from '@/types';\nimport { useMutation, useQuery } from '@tanstack/react-query';\nimport * as XLSX from 'xlsx';");
fs.writeFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', unified);

// 4. StoreItemsList
let store = fs.readFileSync('src/components/Dashboard/StoreItemsList.tsx', 'utf8');
store = store.replace("import type { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup, ActivityRow } from '@/types';\nimport { ManageMasterDataModal } from '../MasterData/ManageMasterDataModal';");
// also fix any implicit any
store = store.replace(/onSubmit={async \(name, id\) => \{/g, "onSubmit={async (name: string, id?: string) => {");
fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', store);

// 5. ModelTest
let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');
// remove local ActivityRow
const aStart = modelTest.indexOf("interface ActivityRow {");
const aEnd = modelTest.indexOf("function MasterStoreTab() {", aStart);
if (aStart !== -1 && aEnd !== -1) {
    // we want to remove until the end of ActivityRow which is before MasterStoreTab, but wait, MasterStoreTab is gone! It was extracted.
    // wait, where is ActivityRow now?
    const startIdx = modelTest.indexOf('interface ActivityRow {');
    const endIdx = modelTest.indexOf('}', startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
        modelTest = modelTest.substring(0, startIdx) + modelTest.substring(endIdx + 1);
    }
}
// Fix onExtractExcel typing
modelTest = modelTest.replace("onExtractExcel?: (fileId: string, phaseType: 'SURVEY'|'INSTALLATION'|'ACCEPTANCE', group: ProjectGroup) => void", "onExtractExcel?: (fileId: string, phaseType: 'SURVEY'|'INSTALL'|'NTXX', group: ProjectGroup) => void");
fs.writeFileSync('src/components/ModelTest.tsx', modelTest);
