const fs = require('fs');

const path = 'src/components/ModelTest.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the folder link fetch
content = content.replace(
    'const response = await fetch(\n                `http://localhost:3001/api/project-folder-link?phase_type=${phaseType}&final_project=${encodeURIComponent(finalProject)}&key_project=${encodeURIComponent(keyProject || "")}&name_project=${encodeURIComponent(nameProject || "")}`\n            );',
    `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const response = await fetch(
                \`\${supabaseUrl}/functions/v1/project-folder-link?phase_type=\${phaseType}&final_project=\${encodeURIComponent(finalProject)}&key_project=\${encodeURIComponent(keyProject || "")}&name_project=\${encodeURIComponent(nameProject || "")}\`,
                { headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` } }
            );`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched ModelTest.tsx');
