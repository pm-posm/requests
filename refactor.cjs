const fs = require('fs');

let modelTestContent = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// Helper to extract function
function extractFunction(content, funcName) {
    const startPattern = `function ${funcName}(`;
    const start = content.indexOf(startPattern);
    if (start === -1) return { func: '', newContent: content };
    
    // Find the end by looking for the next function or the end of the file
    let end = content.indexOf('function ', start + 10);
    if (end === -1) {
        // If it's the last function, find the export default
        end = content.indexOf('export default ', start);
    }
    
    const func = content.substring(start, end);
    const newContent = content.substring(0, start) + content.substring(end);
    
    return { func, newContent };
}

// 1. ManageMasterDataModal
let res = extractFunction(modelTestContent, 'ManageMasterDataModal');
let manageMasterDataModalContent = res.func;
modelTestContent = res.newContent;

// 2. StoreItemsList
res = extractFunction(modelTestContent, 'StoreItemsList');
let storeItemsListContent = res.func;
modelTestContent = res.newContent;

// 3. ActivityDetailCard
res = extractFunction(modelTestContent, 'ActivityDetailCard');
let activityDetailCardContent = res.func;
modelTestContent = res.newContent;

// Add imports to extracted files
const commonImports = `import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ExternalLink, Mail, Folder, AlertCircle, CheckCircle2, HelpCircle, Layers, Check, ChevronDown, ChevronUp, User, Calendar, Clock, FileText, Trash2, FileSpreadsheet, X, Move, Settings, ArrowLeft, ArrowRight, Lock, Unlock, History as HistoryIcon } from 'lucide-react';
import { StoreItem, ProjectGroup } from '@/types';
import { computePhaseStatus } from '@/utils';
`;

fs.writeFileSync('src/components/MasterData/ManageMasterDataModal.tsx', commonImports + '\nexport ' + manageMasterDataModalContent);
fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', commonImports + `import { PhaseActionModal } from '../ActionModal/PhaseActionModal';\nexport ` + storeItemsListContent);
fs.writeFileSync('src/components/Dashboard/ActivityDetailCard.tsx', commonImports + '\nexport ' + activityDetailCardContent);

// Add imports to ModelTest
modelTestContent = `import { StoreItem, ProjectGroup } from '@/types';
import { computePhaseStatus } from '@/utils';
import { ManageMasterDataModal } from './MasterData/ManageMasterDataModal';
import { StoreItemsList } from './Dashboard/StoreItemsList';
import { ActivityDetailCard } from './Dashboard/ActivityDetailCard';\n` + modelTestContent;

fs.writeFileSync('src/components/ModelTest.tsx', modelTestContent);
