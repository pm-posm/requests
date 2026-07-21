const fs = require('fs');

// Patch ExcelExtractorModal
let excelContent = fs.readFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', 'utf8');
excelContent = `import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, ExternalLink, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export ` + excelContent;
fs.writeFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', excelContent);

// Patch UnifiedProjectActionModal
let unifiedContent = fs.readFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', 'utf8');
unifiedContent = `import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, Folder, ExternalLink, X, Move, Check } from 'lucide-react';
import { ExcelExtractorModal } from './ExcelExtractorModal';

export ` + unifiedContent;
fs.writeFileSync('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx', unifiedContent);

// Patch ModelTest
let modelTestContent = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');
const m1Start = modelTestContent.indexOf('function ExcelExtractorModal({');
const m1End = modelTestContent.indexOf('function ActivityDetailCard({');
const m2Start = modelTestContent.indexOf('function UnifiedProjectActionModal({');

// Remove ExcelExtractorModal and UnifiedProjectActionModal
modelTestContent = modelTestContent.substring(0, m1Start) + modelTestContent.substring(m1End, m2Start);

// Add imports
modelTestContent = `import { ExcelExtractorModal } from './ExcelExtractor/ExcelExtractorModal';
import { UnifiedProjectActionModal } from './ExcelExtractor/UnifiedProjectActionModal';\n` + modelTestContent;

fs.writeFileSync('src/components/ModelTest.tsx', modelTestContent);
