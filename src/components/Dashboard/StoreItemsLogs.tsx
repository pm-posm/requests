import React from 'react';

interface StoreItemsLogsProps {
    logs: any[];
    isLoadingLogs: boolean;
}

export function StoreItemsLogs({ logs, isLoadingLogs }: StoreItemsLogsProps) {
    const formatLogMessage = (log: any) => {
        const timeStr = new Date(log.created_at).toLocaleString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            day: '2-digit', month: '2-digit' 
        });
        const storeCode = log.store_code || 'Store';
        
        const oldValue = !log.old_value || String(log.old_value).toLowerCase() === 'null' ? 'Trống' : log.old_value;
        const newValue = !log.new_value || String(log.new_value).toLowerCase() === 'null' ? 'Trống' : log.new_value;
        
        switch (log.action_type) {
            case 'INSERT':
                return `[${timeStr}] ➕ Store [${storeCode}] được thêm vào với trạng thái: ${newValue}`;
            case 'DELETE':
                return `[${timeStr}] ❌ Store [${storeCode}] đã bị xóa khỏi danh sách`;
            case 'UPDATE': {
                let fieldNameVi = log.field_name;
                if (log.field_name === 'survey_status') fieldNameVi = 'Trạng thái Khảo sát';
                if (log.field_name === 'installation_status') fieldNameVi = 'Trạng thái Lắp đặt';
                if (log.field_name === 'acceptance_status') fieldNameVi = 'Trạng thái NTXX';
                if (log.field_name === 'survey_notes') fieldNameVi = 'Ghi chú Khảo sát';
                if (log.field_name === 'installation_notes') fieldNameVi = 'Ghi chú Lắp đặt';
                if (log.field_name === 'acceptance_notes') fieldNameVi = 'Ghi chú NTXX';
                if (log.field_name === 'category') fieldNameVi = 'Hạng mục';
                if (log.field_name === 'supplier_name') fieldNameVi = 'Nhà thầu';
                if (log.field_name === 'vis_tech') fieldNameVi = 'Kỹ thuật viên';

                return `[${timeStr}] ✏️ Store [${storeCode}] cập nhật [${fieldNameVi}] từ "${oldValue}" sang "${newValue}"`;
            }
            default:
                return `[${timeStr}] Thao tác [${log.action_type}] trên store [${storeCode}]`;
        }
    };

    return (
        <div className="max-h-60 overflow-y-auto space-y-2 p-3 border border-slate-150 dark:border-slate-850 rounded-lg bg-slate-50/20 dark:bg-slate-955/10 min-h-[150px]">
            {isLoadingLogs ? (
                <div className="text-center py-8 text-[10px] text-slate-400 italic">Đang tải lịch sử...</div>
            ) : logs.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-slate-400 italic">Chưa có nhật ký hoạt động nào được ghi nhận.</div>
            ) : (
                logs.map(log => (
                    <div key={log.id} className="text-[10px] font-medium font-mono text-slate-650 dark:text-slate-400 py-1 border-b border-slate-100/50 dark:border-slate-850/50 last:border-0">
                        {formatLogMessage(log)}
                    </div>
                ))
            )}
        </div>
    );
}
