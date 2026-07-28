const fs = require('fs');
const content = fs.readFileSync('src/components/ExcelExtractor/ExcelExtractorModal.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
    if (l.includes('type="file"') || l.includes('accept=')) {
        console.log(i, l);
    }
});
