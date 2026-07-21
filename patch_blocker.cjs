const fs = require('fs');
let content = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');

content = content.replace(
    /const computed = computePhaseStatus\(item\.installation_data\);\s+return \(\s+<div className="w-full">\s+<div onClick=\{.*?\}.*?title="Click để cập nhật trạng thái Lắp đặt">/,
    `const computed = computePhaseStatus(item.installation_data);
                                            const surveyComputed = computePhaseStatus(item.survey_data);
                                            const isSurveyCompleted = surveyComputed.status === 'Hoàn tất' || surveyComputed.status === 'Hoàn thành' || surveyComputed.status === 'Đạt';
                                            return (
                                                <div className="w-full">
                                                    <div onClick={() => { 
                                                        if (isSurveyCompleted) { setSelectedInstallItem(item); setShowInstallModal(true); }
                                                        else { alert('Vui lòng hoàn thành phase Khảo sát trước khi bắt đầu Lắp đặt!'); }
                                                    }} className={\`transition-opacity \${isSurveyCompleted ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'}\`} title={isSurveyCompleted ? "Click để cập nhật trạng thái Lắp đặt" : "Phải hoàn thành Khảo sát trước"}>`
);

fs.writeFileSync('src/components/ModelTest.tsx', content);
