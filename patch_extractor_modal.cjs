const fs = require('fs');

const path = 'src/components/ExcelExtractor/ExcelExtractorModal.tsx';
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

// Replace the anchor link download
content = content.replace(
    '<a href={`http://localhost:3001/api/attachments/${att.id}/download`}',
    '<a href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-drive-file?fileId=${att.drive_file_id || att.id}`}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched ExcelExtractorModal.tsx');
