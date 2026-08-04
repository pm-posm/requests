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
): { sign: string; isOverdue: boolean; isLateOrFailed: boolean } => {
  const statusLower = (statusStr || '').toLowerCase().trim();
  const isQCFailed = statusLower.includes('installation qc failed') || statusLower.includes('failed') || statusLower.includes('lỗi');
  const isCompleted = statusLower.includes('completed') || statusLower.includes('hoàn thành') || statusLower.includes('pass');
  const isPendingInstall = statusLower.includes('pending install');

  if (existingResultSign === '✔' && !isQCFailed) {
    return { sign: '✔', isOverdue: false, isLateOrFailed: false };
  }
  // Sign is ONLY ❌ if sheet explicitly has ❌ or status is QC Failed
  if (existingResultSign === '❌' || isQCFailed) {
    return { sign: '❌', isOverdue: false, isLateOrFailed: true };
  }

  let deadlineDate: Date | null = null;
  if (actualTime && actualTime.trim()) {
    const parts = actualTime.split(/[-–—]/);
    const deadlineStr = parts[parts.length - 1].trim();
    const dParts = deadlineStr.split('/');
    if (dParts.length === 3) {
      let d = parseInt(dParts[0], 10);
      let m = parseInt(dParts[1], 10) - 1;
      let y = parseInt(dParts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        deadlineDate = new Date(y, m, d);
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let compDate: Date | null = null;
  if (completionTime && completionTime.trim()) {
    const cParts = completionTime.trim().split('/');
    if (cParts.length === 3) {
      let d = parseInt(cParts[0], 10);
      let m = parseInt(cParts[1], 10) - 1;
      let y = parseInt(cParts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        compDate = new Date(y, m, d);
      }
    }
  }

  if (!completionTime || !completionTime.trim()) {
    if (deadlineDate && deadlineDate.getTime() < today.getTime()) {
      return { sign: 'OVERDUE_RED', isOverdue: true, isLateOrFailed: true };
    }
    return { sign: '', isOverdue: false, isLateOrFailed: false };
  }

  if (deadlineDate && compDate) {
    if (compDate.getTime() <= deadlineDate.getTime() && isCompleted && !isQCFailed) {
      return { sign: '✔', isOverdue: false, isLateOrFailed: false };
    } else {
      return { sign: '❌', isOverdue: false, isLateOrFailed: true };
    }
  }

  return { sign: isCompleted ? '✔' : '', isOverdue: false, isLateOrFailed: isQCFailed };
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
