const fs = require('fs');

const path = 'src/components/ExcelExtractor/ExcelExtractorModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetLine = 'href={att.drive_url || https://drive.google.com/uc?export=download&id=}/functions/v1/download-drive-file?fileId=${att.drive_file_id || att.id}`}';
const fixedLine = 'href={att.drive_url || `https://drive.google.com/uc?export=download&id=${att.drive_file_id || att.id}`}';

if (content.includes(targetLine)) {
    content = content.replace(targetLine, fixedLine);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully fixed file corruption!');
} else {
    console.log('Target corrupted line not found in file.');
}
