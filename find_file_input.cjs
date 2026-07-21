const fs = require('fs');
const path = require('path');
function find(dir) {
    const files = fs.readdirSync(dir);
    for(const f of files) {
        const p = path.join(dir, f);
        if(f === 'node_modules' || f === '.git' || f === '.gemini') continue;
        if(fs.statSync(p).isDirectory()) {
            find(p);
        } else if(p.endsWith('.tsx') || p.endsWith('.ts')) {
            const c = fs.readFileSync(p, 'utf8');
            if(c.includes('type="file"')) console.log(p);
        }
    }
}
find('.');
