const fs = require('fs');

let content = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// Patch ExcelExtractorModal unimportedRows filter
content = content.replace(
    /const unimportedRows = excelRows.map\(\(row, idx\) => \(\{ row, originalIdx: idx \}\)\).filter\(\(\{ row \}\) => \{([\s\S]*?)if \(!code\) return false;/g,
    `const unimportedRows = excelRows.map((row, idx) => ({ row, originalIdx: idx })).filter(({ row }) => {$1if (!code) return true; // Keep empty to auto-gen ID`
);

// Patch UnifiedProjectActionModal allValidRows
content = content.replace(
    /const allValidRows = React.useMemo\(\(\) => \{([\s\S]*?)return code !== '';\s+\}\);\s+\}, \[excelRows, mapping.store_code\]\);/g,
    `const allValidRows = React.useMemo(() => {$1return true;\n        });\n    }, [excelRows, mapping.store_code]);`
);

// Patch ExcelExtractorModal handleImportAll
content = content.replace(
    /const payload = excelRows.map\(row => \{([\s\S]*?)return \{([\s\S]*?)\};\s+\}\).filter\(item => item.store_code !== ''\);/g,
    `const payloadMap = new Map();
            excelRows.forEach(row => {$1
                let f_storeCode = storeCode;
                if (!f_storeCode) {
                    f_storeCode = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                }
                if (!payloadMap.has(f_storeCode)) {
                    payloadMap.set(f_storeCode, {$2, store_code: f_storeCode});
                }
            });
            const payload = Array.from(payloadMap.values());`
);

// Patch UnifiedProjectActionModal handleImportAll
content = content.replace(
    /const payload = excelRows.filter\(\(_, idx\) => selectedRows.has\(idx\)\).map\(row => \{([\s\S]*?)return \{([\s\S]*?)\};\s+\}\).filter\(item => item.store_code !== ''\);/g,
    `const payloadMap = new Map();
            excelRows.filter((_, idx) => selectedRows.has(idx)).forEach(row => {$1
                let f_storeCode = storeCode;
                if (!f_storeCode) {
                    f_storeCode = 'CH-TRONG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                }
                if (!payloadMap.has(f_storeCode)) {
                    payloadMap.set(f_storeCode, {$2, store_code: f_storeCode});
                }
            });
            const payload = Array.from(payloadMap.values());`
);

fs.writeFileSync('src/components/ModelTest.tsx', content);
console.log('Patched successfully!');
