const fs = require('fs');
let content = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');
content = `import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Calendar, FileText, CheckCircle2, Clock, CheckSquare, AlertCircle } from 'lucide-react';

interface StoreItem { id: string; store_code: string; store_name?: string; [key: string]: any; }

export ` + content;
fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', content);
