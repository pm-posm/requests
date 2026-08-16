import * as XLSX from 'xlsx';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import type { WarrantyItem } from '@/types/warranty';

// Helper parsing date string or number to ms
const parseDateToMs = (str?: string): number | null => {
  if (!str || !str.trim()) return null;
  const trimmed = str.trim();
  if (trimmed === '-' || trimmed.toLowerCase().includes('chưa') || trimmed.toLowerCase().includes('không')) {
    return null;
  }
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    return Math.floor(serial - 25569) * 86400 * 1000;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split(/[-T ]/)[0].split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
  }
  const parts = trimmed.split(/[/ -]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
    } else {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
    }
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.getTime();
};

// Helper format date string to DD/MM/YYYY
const formatDateStr = (str?: string): string => {
  if (!str || !str.trim()) return 'Chưa xác định';
  const trimmed = str.trim();
  if (trimmed.toLowerCase().includes('chưa') || trimmed === '-') return 'Chưa xác định';
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  
  const ms = parseDateToMs(trimmed);
  if (!ms) return trimmed;
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/**
 * Service xuất Báo Cáo Bảo Hành bám sát 1:1 theo Template Weekly_Report.xlsx
 * - Sheet 1: Weekly (Báo Cáo Phân Tích Sự Cố Bảo Hành POSM chuẩn Template)
 * - Sheet 2: Checklist Bảo Hành (Dữ liệu hoạt động chi tiết đầy đủ 21 cột)
 */
export const exportAnalystExecutiveReport = (
  _requests: RawRequestRecord[],
  warrantyItems: WarrantyItem[],
  filenamePrefix = 'POSM_Warranty_Report',
  targetProjectCode?: string
) => {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);

  // Filter dataset strictly by project code if requested
  const isFilteredByProject = Boolean(targetProjectCode && targetProjectCode.trim() && targetProjectCode.trim() !== 'all');
  const cleanProjectCode = isFilteredByProject ? targetProjectCode!.trim() : '';

  const activeItems = isFilteredByProject
    ? warrantyItems.filter(item => {
        const prj = (item.projectCode || '').trim();
        return prj.toLowerCase() === cleanProjectCode.toLowerCase() || prj.toLowerCase().includes(cleanProjectCode.toLowerCase());
      })
    : warrantyItems;

  const totalCount = activeItems.length;
  const finalFilename = isFilteredByProject
    ? `POSM_Warranty_Report_Project_${cleanProjectCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : filenamePrefix;

  // =========================================================================
  // 1. STATS & KPIS COMPUTATION
  // =========================================================================
  let onTimeCount = 0;
  let overdueCount = 0;
  let earlyFailCount = 0;
  let inProgressCount = 0;

  const supplierMap = new Map<string, { total: number; early: number; repeat: number; overdue: number; done: number }>();
  const causeMap = new Map<string, number>();
  const posmMap = new Map<string, number>();
  const storeMap = new Map<string, number>();
  const projectMap = new Map<string, number>();
  const catMap = new Map<string, number>();
  const activeProjectsSet = new Set<string>();

  // Aging breakdown for Overdue cases: 1-3d, 4-7d, >7d
  let delay1to3 = 0;
  let delay4to7 = 0;
  let delayOver7 = 0;

  const dateTimestamps: number[] = [];

  activeItems.forEach(item => {
    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành');
    const isCancel = pLower.includes('cancel');

    if (!isDone && !isCancel) {
      inProgressCount++;
      if (item.projectCode && item.projectCode.trim()) {
        activeProjectsSet.add(item.projectCode.trim());
      }
    }

    const sentMs = parseDateToMs(item.sentDate || item.createdAt);
    if (sentMs) dateTimestamps.push(sentMs);

    const installMs = parseDateToMs(item.installationDate);
    const expMs = parseDateToMs(item.expectedDate || item.requestDeadline);
    const compMs = parseDateToMs(item.completedDate);

    // Early fail check (<31 days)
    let isEarly = false;
    if (installMs && sentMs && sentMs >= installMs) {
      const days = Math.round((sentMs - installMs) / 86400000);
      if (days < 31) {
        earlyFailCount++;
        isEarly = true;
      }
    }

    // Overdue check
    let isOver = false;
    let overdueDays = 0;
    if (isDone && compMs && expMs && compMs > expMs) {
      isOver = true;
      overdueDays = Math.ceil((compMs - expMs) / 86400000);
    } else if (!isDone && expMs && Date.now() > expMs) {
      isOver = true;
      overdueDays = Math.ceil((Date.now() - expMs) / 86400000);
    }

    if (isOver) {
      overdueCount++;
      if (overdueDays <= 3) delay1to3++;
      else if (overdueDays <= 7) delay4to7++;
      else delayOver7++;
    } else {
      if (isDone) onTimeCount++;
    }

    // Supplier stats
    const sup = (item.supplier || '').trim() || 'Chưa gán thầu';
    if (!supplierMap.has(sup)) {
      supplierMap.set(sup, { total: 0, early: 0, repeat: 0, overdue: 0, done: 0 });
    }
    const supStat = supplierMap.get(sup)!;
    supStat.total++;
    if (isEarly) supStat.early++;
    if (item.precedingRequestId && item.precedingRequestId.trim()) supStat.repeat++;
    if (isOver) supStat.overdue++;
    if (isDone) supStat.done++;

    // Cause stats (Cột W errorType fallback to detail)
    const cause = (item.errorType || item.errorDetail || 'Chưa xác định').trim();
    causeMap.set(cause, (causeMap.get(cause) || 0) + 1);

    // POSM stats
    const posm = (item.posmType || 'Chưa xác định').trim();
    posmMap.set(posm, (posmMap.get(posm) || 0) + 1);

    // Store stats
    const store = (item.storeName || 'Chưa xác định').trim();
    storeMap.set(store, (storeMap.get(store) || 0) + 1);

    // Project stats
    const prj = (item.projectCode || 'Chưa xác định').trim();
    projectMap.set(prj, (projectMap.get(prj) || 0) + 1);

    // Cat / Brand stats
    const cat = (item.category || item.brand || 'Chưa xác định').trim();
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });

  const getTop = (map: Map<string, number>) => {
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return { name: '-', count: 0, pct: '0.0%' };
    const [name, count] = sorted[0];
    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) + '%' : '0.0%';
    return { name, count, pct };
  };

  const topSupplier = getTop(new Map(Array.from(supplierMap.entries()).map(([s, d]) => [s, d.total])));
  const topProject = getTop(projectMap);
  const topStore = getTop(storeMap);
  const topCat = getTop(catMap);
  const topPosm = getTop(posmMap);

  const onTimePct = totalCount > 0 ? ((onTimeCount / totalCount) * 100).toFixed(1) + '%' : '0.0%';
  const overduePct = totalCount > 0 ? ((overdueCount / totalCount) * 100).toFixed(1) + '%' : '0.0%';
  const earlyFailPct = totalCount > 0 ? ((earlyFailCount / totalCount) * 100).toFixed(1) + '%' : '0.0%';

  // Date Range title
  let dateRangeLabel = 'Tất cả các ca';
  if (dateTimestamps.length > 0) {
    const minD = new Date(Math.min(...dateTimestamps));
    const maxD = new Date(Math.max(...dateTimestamps));
    const d1 = String(minD.getDate()).padStart(2, '0') + '/' + String(minD.getMonth() + 1).padStart(2, '0');
    const d2 = String(maxD.getDate()).padStart(2, '0') + '/' + String(maxD.getMonth() + 1).padStart(2, '0') + '/' + maxD.getFullYear();
    dateRangeLabel = `Weekly (${d1} - ${d2})`;
  }

  // =========================================================================
  // 2. BUILD SHEET 1: "Weekly" (EXACT CLONE OF Weekly_Report.xlsx)
  // =========================================================================
  const weeklyRows: any[][] = [];

  // Row 1: Title
  weeklyRows[0] = [dateRangeLabel];
  weeklyRows[1] = [];
  weeklyRows[2] = [];

  // Row 4: Executive KPI Headers (Row index 3)
  weeklyRows[3] = [
    'TỔNG CA BẢO HÀNH',
    '% XỬ  LÝ ĐÚNG HẠN',
    null,
    '% XỬ  LÝ TRỄ HẠN',
    null,
    '% HỎNG SỚM (<30 NGÀY TỪ NGÀY LẮP ĐẶT)',
    null,
    'SUPPLIER\n(TOP SUPPLIER BY ISSUES)',
    null,
    'DỰ ÁN\n(TOP PROJECT BY ISSUES)',
    null,
    'SIÊU THỊ\n(TOP STORE BY ISSUES)',
    null,
    'NGÀNH HÀNG\n(TOP CAT BY ISSUES)',
    null,
    'LOẠI POSM\n(TOP POSM BY ISSUES)'
  ];

  // Row 5: KPI Values (Row index 4)
  weeklyRows[4] = [
    totalCount,
    totalCount > 0 ? onTimeCount / totalCount : 0,
    null,
    totalCount > 0 ? overdueCount / totalCount : 0,
    null,
    totalCount > 0 ? earlyFailCount / totalCount : 0,
    null,
    topSupplier.name,
    null,
    topProject.name,
    null,
    topStore.name,
    null,
    topCat.name,
    null,
    topPosm.name
  ];

  // Row 6: KPI Subtitles (Row index 5)
  weeklyRows[5] = [
    null,
    `⚡ ${onTimeCount}/${totalCount} ca`,
    null,
    `⚠️ ${overdueCount}/${totalCount} ca`,
    null,
    `⚠️ ${earlyFailCount}/${totalCount} ca`,
    null,
    `${topSupplier.count} ca (${topSupplier.pct})`,
    null,
    `${topProject.count} ca (${topProject.pct})`,
    null,
    `${topStore.count} ca (${topStore.pct})`,
    null,
    `${topCat.count} ca (${topCat.pct})`,
    null,
    `${topPosm.count} ca (${topPosm.pct})`
  ];

  // Row 7: Active in-progress note (Row index 6)
  const activePrjStr = Array.from(activeProjectsSet).join(', ') || 'Không có ca tồn đọng';
  weeklyRows[6] = [
    `⏳ Đang xử lí ${inProgressCount} ca thuộc dự án:`,
    null,
    null,
    activePrjStr
  ];

  weeklyRows[7] = [];
  weeklyRows[8] = [];

  // Row 10: Section Headers for 3 Evaluation Tables (Row index 9)
  weeklyRows[9] = [
    '1. BY SUPPLIER',
    null,
    null,
    null,
    null,
    null,
    null,
    '2. BY CAUSE',
    null,
    null,
    null,
    null,
    '3. BY TIMELINE'
  ];

  // Row 11: Table Column Headers (Row index 10)
  weeklyRows[10] = [
    'Nhà Thầu',
    'Total Case',
    'Số Ca Hỏng Sớm (<31d)\nCa',
    'Số Ca Tái Diễn Trên cùng 1 POSM',
    'Số Ca Trễ Hạn',
    '% Đạt Tiến Độ',
    null,
    'Nguyên Nhân Lỗi',
    null,
    'Số Ca',
    '% Tỷ Lệ',
    null,
    'Thời Gian Trễ Hạn',
    null,
    'Số Ca',
    '% Tỷ Lệ',
    'Mức Độ Cảnh Báo'
  ];

  // Prepare data rows for 3 tables
  const supplierRows = Array.from(supplierMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([sup, data]) => [
      sup,
      data.total,
      data.early,
      data.repeat,
      data.overdue,
      data.total > 0 ? ((data.total - data.overdue) / data.total) : 1
    ]);

  const causeRows = Array.from(causeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => [
      cause,
      null,
      count,
      totalCount > 0 ? count / totalCount : 0
    ]);

  const timelineRows = [
    ['1 - 3 ngày (Trễ nhẹ)', null, delay1to3, totalCount > 0 ? delay1to3 / totalCount : 0, 'Nhắc nhở'],
    ['4 - 7 ngày (Cảnh báo tiến độ)', null, delay4to7, totalCount > 0 ? delay4to7 / totalCount : 0, 'Đôn đốc xử lý gấp'],
    ['> 7 ngày (Quá hạn nghiêm trọng)', null, delayOver7, totalCount > 0 ? delayOver7 / totalCount : 0, 'Yêu cầu giải trình']
  ];

  const maxEvaluationRows = Math.max(supplierRows.length, causeRows.length, timelineRows.length, 3);

  for (let i = 0; i < maxEvaluationRows; i++) {
    const sRow = supplierRows[i] || [null, null, null, null, null, null];
    const cRow = causeRows[i] || [null, null, null, null];
    const tRow = timelineRows[i] || [null, null, null, null, null];

    weeklyRows[11 + i] = [
      sRow[0], sRow[1], sRow[2], sRow[3], sRow[4], sRow[5],
      null,
      cRow[0], cRow[1], cRow[2], cRow[3],
      null,
      tRow[0], tRow[1], tRow[2], tRow[3], tRow[4]
    ];
  }

  const rowAfterEval = 11 + maxEvaluationRows;
  weeklyRows[rowAfterEval] = [];
  weeklyRows[rowAfterEval + 1] = [];

  // Row 19 (Dynamic): 4 Breakdown Tables (BY POSM • BY STORE • BY PROJECT • BY CAT)
  weeklyRows[rowAfterEval + 2] = [
    '4. BY POSM',
    null,
    null,
    '5. BY STORE',
    null,
    null,
    '6. BY PROJECT',
    null,
    null,
    '7. BY CAT'
  ];

  weeklyRows[rowAfterEval + 3] = [
    'Loại POSM',
    'Số Ca Lỗi',
    null,
    'Store',
    'Số Ca Lỗi',
    null,
    'Mã dự án',
    'Số Ca Lỗi',
    null,
    'CAT',
    'Số Ca Lỗi'
  ];

  const sortedPosm = Array.from(posmMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedStore = Array.from(storeMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedProject = Array.from(projectMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  const maxBreakdownRows = Math.max(sortedPosm.length, sortedStore.length, sortedProject.length, sortedCat.length, 3);

  for (let i = 0; i < maxBreakdownRows; i++) {
    const p = sortedPosm[i] || [null, null];
    const s = sortedStore[i] || [null, null];
    const prj = sortedProject[i] || [null, null];
    const c = sortedCat[i] || [null, null];

    weeklyRows[rowAfterEval + 4 + i] = [
      p[0], p[1],
      null,
      s[0], s[1],
      null,
      prj[0], prj[1],
      null,
      c[0], c[1]
    ];
  }

  const rowAfterBreakdown = rowAfterEval + 4 + maxBreakdownRows;
  weeklyRows[rowAfterBreakdown] = [];
  weeklyRows[rowAfterBreakdown + 1] = [];

  // Row 28+ (Dynamic): DETAIL ACTION TABLE
  weeklyRows[rowAfterBreakdown + 2] = ['CHI TIẾT CÁC CASE BẢO HÀNH ĐÃ CÓ ACTION'];
  weeklyRows[rowAfterBreakdown + 3] = [
    'ID',
    'Store',
    'POSM',
    'Brand',
    'Cat',
    'Mã dự án',
    'Supplier',
    'Ngày lắp đặt',
    'Ngày gửi bảo hành',
    'Loại lỗi',
    null,
    'Chi tiết lỗi',
    null,
    'Ngày xử lí dự kiến',
    'Ngày hoàn thành',
    'Status',
    'Note'
  ];

  activeItems.forEach((item, idx) => {
    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành');
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate || item.createdAt);

    let noteText = item.note || 'Đang xử lý';
    if (isDone) {
      if (pComp && pExp && pComp > pExp) {
        const days = Math.ceil((pComp - pExp) / 86400000);
        noteText = `Trễ hạn ${days} ngày`;
      } else {
        noteText = 'Đúng hạn';
      }
    } else if (pExp && Date.now() > pExp) {
      const days = Math.ceil((Date.now() - pExp) / 86400000);
      noteText = `Trễ hạn ${days} ngày`;
    } else if (pInst && pSent && pSent >= pInst && Math.round((pSent - pInst) / 86400000) < 31) {
      noteText = 'Hỏng sớm';
    }

    weeklyRows[rowAfterBreakdown + 4 + idx] = [
      item.requestId || `BH-${item.rowId || idx + 1}`,
      item.storeName || 'Chưa xác định',
      item.posmType || 'Chưa xác định',
      item.brand || 'Chưa xác định',
      item.category || item.brand || 'Chưa xác định',
      item.projectCode || 'Chưa xác định',
      item.supplier || 'Chưa xác định',
      formatDateStr(item.installationDate),
      formatDateStr(item.sentDate || item.createdAt),
      item.errorType || item.errorDetail || 'Chưa xác định',
      null,
      item.errorDetail || 'Chưa xác định',
      null,
      formatDateStr(item.expectedDate || item.requestDeadline),
      formatDateStr(item.completedDate),
      item.progress || 'Not started',
      noteText
    ];
  });

  const wsWeekly = XLSX.utils.aoa_to_sheet(weeklyRows);

  // Set nice column widths matching Power BI & Excel template
  wsWeekly['!cols'] = [
    { wch: 22 }, // A: ID / Nhà thầu / Loại POSM / Tiêu đề
    { wch: 18 }, // B: Store / Total Case / Số ca
    { wch: 18 }, // C: POSM / Số ca hỏng sớm
    { wch: 18 }, // D: Brand / Số ca tái diễn / Store
    { wch: 16 }, // E: Cat / Số ca trễ hạn
    { wch: 18 }, // F: Mã dự án / % Đạt tiến độ
    { wch: 18 }, // G: Supplier / Mã dự án
    { wch: 22 }, // H: Ngày lắp đặt / Nguyên nhân lỗi
    { wch: 18 }, // I: Ngày gửi BH
    { wch: 26 }, // J: Loại lỗi / Số ca / CAT
    { wch: 16 }, // K: % Tỷ lệ / Số ca
    { wch: 16 }, // L: Dummy separator
    { wch: 30 }, // M: Thời gian trễ hạn
    { wch: 16 }, // N: Dummy separator
    { wch: 18 }, // O: Ngày xử lý dự kiến / Số ca
    { wch: 18 }, // P: Ngày hoàn thành / % Tỷ lệ
    { wch: 25 }  // Q: Status / Mức độ cảnh báo
  ];

  XLSX.utils.book_append_sheet(wb, wsWeekly, 'Weekly');

  // =========================================================================
  // 3. BUILD SHEET 2: "Checklist Bảo Hành" (FULL RAW OPERATIONAL DATA)
  // =========================================================================
  const rawHeader = [
    'STT / Row ID',
    'Mã Request (ID)',
    'Mã Dự Án',
    'Tên Siêu Thị / Store',
    'Mã Store',
    'SR Phụ Trách',
    'VIS-Tech Unilever',
    'Loại POSM',
    'Brand / Nhãn Hàng',
    'Ngành Hàng (Cat)',
    'Nhà Thầu / Supplier',
    'Loại Lỗi (Cột W)',
    'Chi Tiết Sự Cố',
    'Ngày Lắp Đặt',
    'Ngày Báo Lỗi (Sent Date)',
    'Hạn Cần Xử Lý (Deadline)',
    'Ngày Xử Lý Dự Kiến',
    'Ngày Hoàn Thành',
    'Tiến Độ (Status)',
    'Ca Bảo Hành Lặp Lại Trước',
    'Ghi Chú Vận Hành'
  ];

  const rawRows: any[][] = [
    ['DANH SÁCH CHI TIẾT 100% CA BẢO HÀNH POSM (RAW DATA)'],
    [`Dự án: ${isFilteredByProject ? cleanProjectCode : 'Tất cả dự án'} | Tổng số: ${totalCount} ca | Xuất ngày: ${new Date().toLocaleString('vi-VN')}`],
    [],
    rawHeader
  ];

  activeItems.forEach((item, idx) => {
    rawRows.push([
      item.rowId || idx + 1,
      item.requestId || `BH-${item.rowId || idx + 1}`,
      item.projectCode || '-',
      item.storeName || '-',
      item.storeCode || '-',
      item.srName || '-',
      item.visTech || '-',
      item.posmType || '-',
      item.brand || '-',
      item.category || item.brand || '-',
      item.supplier || 'Chưa gán thầu',
      item.errorType || '-',
      item.errorDetail || '-',
      formatDateStr(item.installationDate),
      formatDateStr(item.sentDate || item.createdAt),
      formatDateStr(item.requestDeadline || item.expectedDate),
      formatDateStr(item.expectedDate),
      formatDateStr(item.completedDate),
      item.progress || 'Not started',
      item.precedingRequestId || '-',
      item.note || '-'
    ]);
  });

  const wsRaw = XLSX.utils.aoa_to_sheet(rawRows);
  wsRaw['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
    { wch: 20 }, { wch: 24 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
    { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, wsRaw, 'Checklist Bảo Hành');

  // Trigger download in browser
  XLSX.writeFile(wb, `${finalFilename}_${dateStr}.xlsx`);
};
