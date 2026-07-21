const fs = require('fs');

const path = 'src/components/ExcelExtractor/UnifiedProjectActionModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the download fetch
content = content.replace(
    'const response = await fetch(`http://localhost:3001/api/attachments/${downloadFileId}/download`);',
    `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const response = await fetch(\`\${supabaseUrl}/functions/v1/download-drive-file?fileId=\${downloadFileId}\`, {
                    headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` }
                });`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched UnifiedProjectActionModal.tsx');
