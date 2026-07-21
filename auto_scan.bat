@echo off
cd /d "C:\Users\thang\.gemini\antigravity\scratch\posm-dashboard"
echo [%date% %time%] Bat dau quet email... >> logs\auto_scan.log
npx dotenvx run -f .env.local -- node scripts/scan_and_update.js >> logs\auto_scan.log 2>&1
echo [%date% %time%] Hoan thanh quet email. >> logs\auto_scan.log
