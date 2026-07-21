export const computePhaseStatus = (phaseData: any): { status: string, isLate?: boolean, detail?: string } => {
    try {
        const data = typeof phaseData === 'string' ? JSON.parse(phaseData) : phaseData;
        if (!data) return { status: 'Chờ làm' };
        
        // 1. Definite results
        if (data.result === 'pass') return { status: 'Hoàn tất' };
        if (data.result === 'fail') return { status: `Lỗi${data.error_count ? ` lần ${data.error_count}` : ''}` };

        // 2. Date-based logic
        if (data.expected_start) {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const startDate = new Date(data.expected_start);
            startDate.setHours(0,0,0,0);
            
            if (today < startDate) {
                return { status: 'Chờ làm' };
            }
            
            if (data.expected_end) {
                const endDate = new Date(data.expected_end);
                endDate.setHours(23,59,59,999);
                if (today > endDate) {
                    return { status: 'Đang làm', isLate: true };
                }
            }
            return { status: 'Đang làm' };
        }
        
        // 3. Fallback to manually saved status if no dates
        if (data.current_status) return { status: data.current_status };
        return { status: '' };
    } catch(e) {
        return { status: 'Chờ làm' };
    }
};
