const fs = require('fs');

function patchFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const oldFetchCode = `const response = await fetch(\`\${supabaseUrl}/functions/v1/download-drive-file?fileId=\${downloadFileId}\`, {
                    headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` }
                });`;
                
    const newFetchCode = `// Fetch the Google Access Token first
                const tokenRes = await fetch(\`\${supabaseUrl}/functions/v1/download-drive-file?mode=token\`, {
                    headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` }
                });
                if (!tokenRes.ok) {
                    throw new Error('Không lấy được mã xác thực Google Drive.');
                }
                const tokenData = await tokenRes.json();

                // Download directly from Google Drive API (Bypasses Supabase Egress)
                const response = await fetch(\`https://www.googleapis.com/drive/v3/files/\${downloadFileId}?alt=media\`, {
                    headers: { 'Authorization': \`Bearer \${tokenData.token}\` }
                });`;

    if (content.includes(oldFetchCode)) {
        content = content.replace(oldFetchCode, newFetchCode);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully patched ${filePath}`);
    } else {
        console.log(`Could not find target fetch block in ${filePath}`);
        // Let's do a more generic search/replace if formatting was different
        const oldFetchCodeAlt = `const response = await fetch(\n                \`\${supabaseUrl}/functions/v1/download-drive-file?fileId=\${downloadFileId}\`,\n                { headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` } }\n            );`;
        if (content.includes(oldFetchCodeAlt)) {
            content = content.replace(oldFetchCodeAlt, newFetchCode);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Successfully patched (alt) ${filePath}`);
        } else {
            console.log(`Generic patch failed for ${filePath}`);
        }
    }
}

patchFile('src/components/ExcelExtractor/ExcelExtractorModal.tsx');
patchFile('src/components/ExcelExtractor/UnifiedProjectActionModal.tsx');
