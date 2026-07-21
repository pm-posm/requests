import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ExcelUploadZoneProps {
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ExcelUploadZone({ handleFileChange }: ExcelUploadZoneProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-slate-50/20 max-w-md mx-auto w-full p-6 space-y-4">
            <FileSpreadsheet className="w-10 h-10 text-slate-350" />
            <div className="text-center">
                <p className="text-xs font-bold text-slate-600">Chọn file Excel lịch trình</p>
                <p className="text-[10px] text-slate-400">Hỗ trợ tệp tin định dạng .xlsx, .xls</p>
            </div>
            <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950/40 dark:file:text-emerald-400 cursor-pointer"
            />
        </div>
    );
}
