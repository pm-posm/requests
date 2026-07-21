const fs = require('fs');
let c = fs.readFileSync('src/components/ProjectDetail.tsx', 'utf8');
c = c.replace(/import \{ History \} from 'lucide-react';/g, "import { History as HistoryIcon } from 'lucide-react';");
c = c.replace(/<History /g, '<HistoryIcon ');
fs.writeFileSync('src/components/ProjectDetail.tsx', c);
