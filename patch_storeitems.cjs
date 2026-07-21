const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard/StoreItemsList.tsx', 'utf8');

// 1. Cập nhật Props của StoreItemsList
content = content.replace(
    'matchedProject: any;',
    'matchedProject: any;\n    currentUserRole: \'TECH\'|\'PM\';'
);

content = content.replace(
    'export function StoreItemsList({ group, matchedProject }: StoreItemsListProps) {',
    'export function StoreItemsList({ group, matchedProject, currentUserRole }: StoreItemsListProps) {'
);

// 2. Thêm hàm kiểm tra trạng thái khóa Phase
const phaseLockLogic = `
    // Logic Khóa Phase:
    // Lắp đặt chỉ mở khi Khảo sát đã COMPLETED hoặc COMPLETED_ON_TIME hoặc COMPLETED_LATE
    // NTXX chỉ mở khi Lắp đặt đã COMPLETED
    const isSurveyCompleted = (item: StoreItem) => {
        const status = item.survey_data?.status;
        return status && status.startsWith('COMPLETED');
    };

    const isInstallCompleted = (item: StoreItem) => {
        const status = item.installation_data?.status;
        return status && status.startsWith('COMPLETED');
    };
`;

content = content.replace(
    'const [showInstallModal, setShowInstallModal] = React.useState(false);',
    'const [showInstallModal, setShowInstallModal] = React.useState(false);\n' + phaseLockLogic
);

// 3. Vô hiệu hóa nút bấm Lắp Đặt và NTXX dựa trên logic khóa
content = content.replace(
    '<button onClick={() => { setSelectedInstallItem(item); setShowInstallModal(true); }}',
    '<button disabled={!isSurveyCompleted(item)} onClick={() => { setSelectedInstallItem(item); setShowInstallModal(true); }}'
);

content = content.replace(
    '<button onClick={() => { setSelectedNtxxItem(item); setShowNtxxModal(true); }}',
    '<button disabled={!isInstallCompleted(item)} onClick={() => { setSelectedNtxxItem(item); setShowNtxxModal(true); }}'
);

// Thêm class opacity cho nút bị disabled (Lắp đặt)
content = content.replace(
    'className={`px-3 py-1.5 rounded-md text-sm font-medium border flex items-center justify-center min-w-[120px] transition-colors',
    'className={`px-3 py-1.5 rounded-md text-sm font-medium border flex items-center justify-center min-w-[120px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
);

// 4. Truyền currentUserRole xuống PhaseActionModal
content = content.replace(
    '<PhaseActionModal item={selectedSurveyItem}',
    '<PhaseActionModal currentUserRole={currentUserRole} item={selectedSurveyItem}'
);
content = content.replace(
    '<PhaseActionModal item={selectedInstallItem}',
    '<PhaseActionModal currentUserRole={currentUserRole} item={selectedInstallItem}'
);
content = content.replace(
    '<PhaseActionModal item={selectedNtxxItem}',
    '<PhaseActionModal currentUserRole={currentUserRole} item={selectedNtxxItem}'
);

fs.writeFileSync('src/components/Dashboard/StoreItemsList.tsx', content);
