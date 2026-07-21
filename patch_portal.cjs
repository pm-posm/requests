const fs = require('fs');
const path = 'src/components/Dashboard/ModernPhaseModal.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { createPortal }')) {
    content = "import { createPortal } from 'react-dom';\n" + content;
}

if (!content.includes('return createPortal(')) {
    content = content.replace('return (\n        <div className="fixed inset-0', 'return createPortal(\n        <div className="fixed inset-0');
    // Find the last </div>\n    );
    const lastIndex = content.lastIndexOf('</div>\n    );');
    if (lastIndex !== -1) {
        content = content.substring(0, lastIndex) + '</div>,\n        document.body\n    );' + content.substring(lastIndex + 14);
    }
}

// Make sure z-index is extremely high to beat everything else
content = content.replace('z-[100]', 'z-[99999]');

fs.writeFileSync(path, content);
console.log('Fixed Modal Portal and Z-Index');
