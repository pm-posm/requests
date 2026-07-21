const fs = require('fs');
const path = require('path');
function find(dir) {
    const files = fs.readdirSync(dir);
    for(const f of files) {
        const p = path.join(dir, f);
        if(fs.statSync(p).isDirectory()) {
            find(p);
        } else if(p.endsWith('.tsx') || p.endsWith('.ts')) {
            const c = fs.readFileSync(p, 'utf8');
            if(c.includes('[Manual]')) {
                console.log(p);
                // Print the line
                const lines = c.split('\n');
                lines.forEach((l, i) => {
                    if (l.includes('[Manual]')) console.log(`  Line ${i}: ${l}`);
                });
            }
        }
    }
}
find('src');
