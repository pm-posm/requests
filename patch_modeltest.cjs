const fs = require('fs');

let content = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

// 1. Thêm state currentUserRole
content = content.replace(
    'const [selectedProjectKey, setSelectedProjectKey] = React.useState<string | null>(null);',
    'const [selectedProjectKey, setSelectedProjectKey] = React.useState<string | null>(null);\n    const [currentUserRole, setCurrentUserRole] = React.useState<\'TECH\'|\'PM\'>(\'TECH\');'
);

// 2. Thêm UI Role Switcher ở Header
const headerSearch = `<div className="max-w-md mx-auto mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />`;
const roleSwitcher = `<div className="flex justify-between items-center mb-6">
                <div className="flex-1"></div>
                <div className="max-w-md flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm theo mã dự án hoặc tên..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 flex justify-end">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Role:</span>
                        <select 
                            className="text-sm bg-transparent font-semibold text-blue-600 outline-none cursor-pointer"
                            value={currentUserRole}
                            onChange={(e) => setCurrentUserRole(e.target.value as any)}
                        >
                            <option value="TECH">Kỹ thuật (Maker)</option>
                            <option value="PM">Quản lý (Checker)</option>
                        </select>
                    </div>
                </div>
            </div>`;

content = content.replace(
    `<div className="max-w-md mx-auto mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm theo mã dự án hoặc tên..." 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>`,
    roleSwitcher
);

// 3. Truyền currentUserRole xuống ProjectDetailView
content = content.replace(
    '<ProjectDetailView',
    '<ProjectDetailView currentUserRole={currentUserRole}'
);

// 4. Định nghĩa lại Props của ProjectDetailView để nhận currentUserRole
content = content.replace(
    'group: ProjectGroup; \n    matchedProject: Project | null; ',
    'group: ProjectGroup; \n    matchedProject: Project | null; \n    currentUserRole: \'TECH\'|\'PM\';'
);

// 5. Truyền currentUserRole xuống StoreItemsList
content = content.replace(
    '<StoreItemsList group={group} matchedProject={matchedProject} />',
    '<StoreItemsList group={group} matchedProject={matchedProject} currentUserRole={currentUserRole} />'
);

fs.writeFileSync('src/components/ModelTest.tsx', content);
