const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU/gviz/tq?tqx=out:csv&sheet=Mer%20View%202026';

function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c.length > 0)) {
                lines.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        lines.push(currentRow);
    }
    return lines;
}

async function run() {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    console.log('Header Col 24:', rows[0][24]);

    const uniqueTienDo = new Set();
    rows.slice(1).forEach(r => {
        const val = r[24] ? r[24].trim() : '';
        if (val) uniqueTienDo.add(val);
    });

    console.log('Unique Column Y Values on Sheet:', Array.from(uniqueTienDo));
}

run();
