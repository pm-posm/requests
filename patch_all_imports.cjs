const fs = require('fs');

const commonTypes = "import type { StoreItem, ProjectGroup } from '@/types';\n";

let excel = fs.readFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', 'utf8');
excel = excel.replace("import type { StoreItem, ProjectGroup } from '@/types';", "");
excel = excel.replace("import { StoreItem, ProjectGroup } from '@/types';", "");
excel = excel.replace("import { Loader2, ExternalLink, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';", "import { Loader2, ExternalLink, X, FileSpreadsheet, CheckCircle2, Move, Check, Trash2, Lock, Calendar, Mail } from 'lucide-react';\n" + commonTypes);
fs.writeFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', excel);

let unified = fs.readFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', 'utf8');
unified = unified.replace("import type { StoreItem, ProjectGroup } from '@/types';", "");
unified = unified.replace("import { StoreItem, ProjectGroup } from '@/types';", "");
unified = unified.replace("import { Loader2, Folder, ExternalLink, X, Move, Check } from 'lucide-react';", "import { Loader2, Folder, ExternalLink, X, Move, Check, AlertCircle, CheckCircle2, Settings, FileText, FileSpreadsheet, Layers, Trash2 } from 'lucide-react';\n" + commonTypes);
fs.writeFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', unified);

let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');
modelTest = modelTest.replace("import { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup, ActivityRow } from '@/types';");
const pgStart = modelTest.indexOf("interface ProjectGroup {");
const pgEnd = modelTest.indexOf("function MasterStoreTab() {", pgStart);
if (pgStart !== -1 && pgEnd !== -1) {
    modelTest = modelTest.substring(0, pgStart) + modelTest.substring(pgEnd);
}
fs.writeFileSync('src/components/ModelTest.tsx', modelTest);

let masterData = fs.readFileSync('src/components/MasterData/ManageMasterDataModal.tsx', 'utf8');
masterData = masterData.replace("import { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup } from '@/types';");
fs.writeFileSync('src/components/MasterData/ManageMasterDataModal.tsx', masterData);

let storeList = fs.readFileSync('src/components/Dashboard/StoreItemsList.tsx', 'utf8');
storeList = storeList.replace("import { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup } from '@/types';");
fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', storeList);

let activityCard = fs.readFileSync('src/components/Dashboard/ActivityDetailCard.tsx', 'utf8');
activityCard = activityCard.replace("import { StoreItem, ProjectGroup } from '@/types';", "import type { StoreItem, ProjectGroup } from '@/types';");
// Fix ActivityDetailCard export issue
activityCard = activityCard.replace("export function ActivityDetailCard", "export function ActivityDetailCard");
fs.writeFileSync('src/components/Dashboard/ActivityDetailCard.tsx', activityCard);
