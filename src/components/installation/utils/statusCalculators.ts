import type { InstallationItem } from '@/services/installationSyncService';

/**
 * Ánh xạ mã ngành hàng kỹ thuật (VD: PSC-FACE) sang tên Ngành hàng chuẩn hóa
 */
export const mapCategoryCodeToCatName = (categoryCode?: string): string => {
  if (!categoryCode || !categoryCode.trim()) return 'Khác';
  const upper = categoryCode.trim().toUpperCase();

  const VALID_CATS = ['SKIN', 'HAIR', 'F.SOL', 'H&H', 'F.SEN', 'FOOD', 'SCL', 'DEO', 'ORAL'];
  if (VALID_CATS.includes(upper)) return upper;

  const CAT_MAPPING: Record<string, string> = {
    'PSC-FACE': 'Skin',
    'PSC-HAIRM': 'Hair',
    'PSC-HAIRW': 'Hair',
    'PSC-LOTION': 'Skin',
    'PSC-LIQ': 'F.Sol',
    'PSC-DW': 'H&H',
    'PSC-FLC': 'H&H',
    'PSC-FSEN': 'F.Sen',
    'PSC-POW': 'F.Sol',
    'PSC-SSC': 'H&H',
    'PSC-TLET': 'H&H',
    'PSC-CUL': 'Food',
    'PSC-TEA': 'Food',
    'PSC-BW': 'SCL',
    'PSC-DEO': 'Deo',
    'PSC-HW&S': 'SCL',
    'PSC-TBR': 'Oral',
    'PSC-TP&M': 'Oral'
  };

  return CAT_MAPPING[upper] || upper || 'Khác';
};

/**
 * Tính toán biểu tượng kết quả (✔, ❌, OVERDUE_RED, '')
 */
export const calculateInstallationResult = (
  actualTime?: string,
  completionTime?: string,
  statusStr?: string,
  existingResultSign?: string
): { sign: string; isOverdue: boolean; isLateOrFailed: boolean; failReason: 'LATE' | 'QC_FAIL' | 'NONE' } => {
  const rawSign = (existingResultSign || '').trim();

  // 1. STRICT 1:1 MAPPING WITH SHEET COLUMN X (><) FIRST
  if (rawSign === '✔' || rawSign.toLowerCase().includes('pass') || rawSign === 'v') {
    return { sign: '✔', isOverdue: false, isLateOrFailed: false, failReason: 'NONE' };
  }
  if (rawSign === '❌' || rawSign.toLowerCase().includes('fail') || rawSign === 'x') {
    return { sign: '❌', isOverdue: false, isLateOrFailed: true, failReason: 'QC_FAIL' };
  }

  // 2. FALLBACK ONLY IF SHEET COLUMN X IS EMPTY
  const statusLower = (statusStr || '').toLowerCase().trim();
  const isQCFailed = statusLower.includes('installation qc failed') || statusLower.includes('qc failed') || statusLower.includes('failed') || statusLower.includes('lỗi');
  const isCompleted = statusLower.includes('completed') || statusLower.includes('hoàn thành') || statusLower.includes('qc passed');

  if (isQCFailed) {
    return { sign: '❌', isOverdue: false, isLateOrFailed: true, failReason: 'QC_FAIL' };
  }

  if (isCompleted || (completionTime && completionTime.trim())) {
    return { sign: '✔', isOverdue: false, isLateOrFailed: false, failReason: 'NONE' };
  }

  return { sign: '', isOverdue: false, isLateOrFailed: false, failReason: 'NONE' };
};

/**
 * Trả về class style cho Badge trạng thái
 */
export const getStatusBadgeStyle = (statusStr?: string) => {
  const st = (statusStr || '').trim().toLowerCase();
  if (st.includes('completed') || st.includes('qc passed') || st.includes('pass') || st.includes('hoàn thành')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-bold';
  }
  if (st.includes('pending install') || st.includes('thi công') || st.includes('lắp đặt') || st.includes('progress')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 font-bold';
  }
  if (st === 'new') {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 font-bold';
  }
  if (st.includes('installation qc failed') || st.includes('qc failed') || st.includes('failed') || st.includes('lỗi')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-bold';
  }
  if (st.includes('chưa gửi report') || st.includes('no report') || st.includes('bảo hành') || st.includes('tháo dỡ')) {
    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 font-bold';
  }
  if (st.includes('cancelled') || st.includes('cancel') || st.includes('hủy')) {
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 font-bold';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold';
};

/**
 * Đánh giá highlight thời gian thi công dự kiến
 */
export const evaluateScheduleHighlight = (
  actualTime?: string,
  completionTime?: string,
  statusStr?: string
) => {
  const st = (statusStr || '').toLowerCase();
  const isCompleted = st.includes('completed') || st.includes('hoàn thành') || st.includes('pass');
  
  if (isCompleted || (completionTime && completionTime.trim())) {
    return {
      statusKey: 'COMPLETED',
      label: 'Đã hoàn thành',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300',
      textStyle: 'text-emerald-700 dark:text-emerald-300 font-medium'
    };
  }

  if (!actualTime || !actualTime.trim()) {
    return {
      statusKey: 'NONE',
      label: 'Chưa có lịch',
      badgeStyle: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
      textStyle: 'text-slate-400'
    };
  }

  const parts = actualTime.split(/[-–—]/).map(p => p.trim());
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (parts.length >= 2) {
    const endStr = parts[parts.length - 1];
    const endParts = endStr.split('/');
    let year = new Date().getFullYear();
    if (endParts.length === 3) {
      let y = parseInt(endParts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(y)) year = y;
      endDate = new Date(year, parseInt(endParts[1], 10) - 1, parseInt(endParts[0], 10));
    }

    const startStr = parts[0];
    const startParts = startStr.split('/');
    if (startParts.length >= 2) {
      const sDay = parseInt(startParts[0], 10);
      const sMonth = parseInt(startParts[1], 10) - 1;
      const sYear = startParts.length === 3 ? (parseInt(startParts[2], 10) < 100 ? parseInt(startParts[2], 10) + 2000 : parseInt(startParts[2], 10)) : year;
      if (!isNaN(sDay) && !isNaN(sMonth)) {
        startDate = new Date(sYear, sMonth, sDay);
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
    if (today.getTime() > endDate.getTime()) {
      return {
        statusKey: 'OVERDUE',
        label: 'QUÁ HẠN THI CÔNG',
        badgeStyle: 'bg-rose-600 text-white font-bold border-rose-700 animate-pulse shadow-sm',
        textStyle: 'text-rose-600 dark:text-rose-400 font-extrabold'
      };
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / msPerDay);

    if (daysLeft <= 2 && daysLeft >= 0) {
      return {
        statusKey: 'DUE_SOON',
        label: `SẮP HẾT HẠN (Còn ${daysLeft} ngày)`,
        badgeStyle: 'bg-amber-100 text-amber-900 border-amber-400 font-bold dark:bg-amber-950 dark:text-amber-300',
        textStyle: 'text-amber-800 dark:text-amber-300 font-bold'
      };
    }
  }

  if (startDate) {
    startDate.setHours(0, 0, 0, 0);
    if (today.getTime() >= startDate.getTime() && (!endDate || today.getTime() <= endDate.getTime())) {
      return {
        statusKey: 'ACTIVE',
        label: 'Đang trong hạn thi công',
        badgeStyle: 'bg-sky-100 text-sky-900 border-sky-400 font-bold dark:bg-sky-950 dark:text-sky-300',
        textStyle: 'text-sky-700 dark:text-sky-300 font-bold'
      };
    }

    if (today.getTime() < startDate.getTime()) {
      return {
        statusKey: 'UPCOMING',
        label: 'Chưa đến lịch',
        badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
        textStyle: 'text-slate-600 dark:text-slate-400'
      };
    }
  }

  return {
    statusKey: 'ACTIVE',
    label: 'Đang theo dõi',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
    textStyle: 'text-slate-700'
  };
};

// Actual Time Alert States: NO_ACTUAL_TIME, UPCOMING, IN_PROGRESS, DUE_SOON, OVERDUE, COMPLETED
export interface ActualTimeAlert {
  state: 'NO_ACTUAL_TIME' | 'UPCOMING' | 'IN_PROGRESS' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
  label: string;
  badgeClass: string;
  icon: string;
}

export const getActualTimeAlert = (
  actualTime?: string,
  completionTime?: string,
  status?: string,
  isFullyCompleted?: boolean
): ActualTimeAlert => {
  const statusLower = (status || '').toLowerCase().trim();
  const isCompleted = isFullyCompleted ||
                      statusLower.includes('completed') || 
                      statusLower.includes('qc passed') ||
                      statusLower.includes('cancelled') ||
                      statusLower.includes('cancel') ||
                      statusLower.includes('hủy') ||
                      Boolean(completionTime && completionTime.trim());

  if (isCompleted) {
    return { state: 'COMPLETED', label: 'Hoàn thành', badgeClass: '', icon: '' };
  }

  if (!actualTime || !actualTime.trim() || actualTime === '—' || actualTime === 'Xem từng vị trí') {
    return {
      state: 'NO_ACTUAL_TIME',
      label: 'Chưa có Actual Time',
      badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      icon: '⏳'
    };
  }

  const cleanStr = actualTime.trim();
  const parts = cleanStr.split(/[-–—]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {
      state: 'NO_ACTUAL_TIME',
      label: 'Chưa có Actual Time',
      badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      icon: '⏳'
    };
  }

  // Handle single date (e.g. "04/08/2026") or date range (e.g. "04/08/2026 - 15/08/2026")
  const startPart = parts[0];
  const endPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];

  const endTokens = endPart.split('/');
  if (endTokens.length < 2) {
    return {
      state: 'NO_ACTUAL_TIME',
      label: 'Chưa có Actual Time',
      badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      icon: '⏳'
    };
  }

  let endD = parseInt(endTokens[0], 10);
  let endM = parseInt(endTokens[1], 10) - 1;
  let endY = endTokens.length === 3 ? parseInt(endTokens[2], 10) : new Date().getFullYear();
  if (endY < 100) endY += 2000;

  const endDate = new Date(endY, endM, endD, 23, 59, 59);

  const startTokens = startPart.split('/');
  let startD = parseInt(startTokens[0], 10);
  let startM = startTokens.length >= 2 ? parseInt(startTokens[1], 10) - 1 : endM;
  let startY = startTokens.length === 3 ? parseInt(startTokens[2], 10) : endY;
  if (startY < 100) startY += 2000;

  const startDate = new Date(startY, startM, startD, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < startDate) {
    return {
      state: 'UPCOMING',
      label: 'Đã lên lịch',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: '📅'
    };
  }

  if (today > endDate) {
    return {
      state: 'OVERDUE',
      label: 'Quá hạn',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900 font-bold animate-pulse',
      icon: '🚨'
    };
  }

  const diffMs = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return {
      state: 'DUE_SOON',
      label: 'Sắp tới hạn (còn 1 ngày)',
      badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900 font-semibold',
      icon: '⚠️'
    };
  }

  return {
    state: 'IN_PROGRESS',
    label: 'Đang thực hiện',
    badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900 font-medium',
    icon: '🔄'
  };
};

/**
 * Trích xuất tháng & năm từ các chuỗi ngày trong row
 */
export const getRowMonthYear = (row: InstallationItem) => {
  const timeStr = row.actualTime || row.plannedStartDate || row.completionTime || '';
  if (!timeStr) return { month: null, year: null };

  const parts = timeStr.split(/[-–—]/).map(p => p.trim());
  const lastPart = parts[parts.length - 1] || parts[0];
  const dateTokens = lastPart.split('/');

  if (dateTokens.length === 3) {
    const month = parseInt(dateTokens[1], 10);
    let year = parseInt(dateTokens[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(month) && !isNaN(year)) {
      return { month, year };
    }
  }
  return { month: null, year: null };
};

