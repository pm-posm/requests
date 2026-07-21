const fs = require('fs');
const path = require('path');
function find(dir) {
    const files = fs.readdirSync(dir);
    for(const f of files) {
        const p = path.join(dir, f);
        if(fs.statSync(p).isDirectory()) {
            find(p);
        } else if(p.endsWith('.tsx')) {
            const c = fs.readFileSync(p, 'utf8');
            if(c.includes('type="file"') || c.includes("type='file'") || c.includes('handleFileUpload') || c.includes('upload')) {
                console.log(p);
            }
        }
    }
}
find('src/components');
