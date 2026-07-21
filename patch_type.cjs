const fs = require('fs');
let modelTest = fs.readFileSync('src/components/ModelTest.tsx', 'utf8');
modelTest = modelTest.replace("onExtractExcel?: (fileId: string, phaseType: 'SURVEY'|'INSTALLATION'|'ACCEPTANCE', group: ProjectGroup) => void", "onExtractExcel?: (fileId: string, phaseType: any, group: ProjectGroup) => void");
modelTest = modelTest.replace("onExtractExcel={(fileId: string, phaseType: 'SURVEY'|'INSTALLATION'|'ACCEPTANCE', group: ProjectGroup)", "onExtractExcel={(fileId: string, phaseType: any, group: ProjectGroup)");
modelTest = modelTest.replace("onExtractExcel={(fileId, phaseType, group)", "onExtractExcel={(fileId: string, phaseType: any, group: ProjectGroup)");
fs.writeFileSync('src/components/ModelTest.tsx', modelTest);
