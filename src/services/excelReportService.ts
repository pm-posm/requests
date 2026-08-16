import * as XLSX from 'xlsx';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import type { WarrantyItem } from '@/types/warranty';
import { WEEKLY_REPORT_TEMPLATE_BASE64 } from './weeklyReportTemplate';

// Helper parsing date string or serial number to ms
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

// Helper to set cell value cleanly
const setCellValue = (ws: XLSX.WorkSheet, cellAddr: string, val: any, numFmt?: string) => {
  if (val === null || val === undefined) {
    delete ws[cellAddr];
    return;
  }
  if (!ws[cellAddr]) {
    ws[cellAddr] = {};
  }
  ws[cellAddr].v = val;
  if (typeof val === 'number') {
    ws[cellAddr].t = 'n';
    if (numFmt) ws[cellAddr].z = numFmt;
  } else if (typeof val === 'boolean') {
    ws[cellAddr].t = 'b';
  } else {
    ws[cellAddr].t = 's';
  }
};

/**
 * Service xuất Báo Cáo Bảo Hành trực tiếp từ File Template gốc Weekly_Report.xlsx
 * - Sheet 1: Weekly (Giữ 100% định dạng, màu sắc, font chữ, merged cells và banner của file template gốc)
 * - Sheet 2: Raw Data (Dữ liệu thô 100% ca bảo hành với 21 cột chi tiết)
 */
export const exportAnalystExecutiveReport = (
  _requests: RawRequestRecord[],
  warrantyItems: WarrantyItem[],
  filenamePrefix = 'Weekly_Report',
  targetProjectCode?: string
) => {
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
    ? `Weekly_Report_Project_${cleanProjectCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : filenamePrefix;

  // =========================================================================
  // 1. STATS & KPIS COMPUTATION
  // =========================================================================
  let onTimeCount = 0;
  let overdueCount = 0;
  let earlyFailCount = 0;
  let inProgressCount = 0;

  const supplierMap = new Map<string, { total: number; early: number; repeat: number; overdue: number; done: number }>();
  const causeMap = new Map<string, { count: number; topSupplier: string }>();
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
    if (!causeMap.has(cause)) {
      causeMap.set(cause, { count: 0, topSupplier: sup });
    }
    causeMap.get(cause)!.count++;

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

  // Date Range title
  let dateRangeLabel = 'Weekly (Toàn bộ dữ liệu)';
  if (dateTimestamps.length > 0) {
    const minD = new Date(Math.min(...dateTimestamps));
    const maxD = new Date(Math.max(...dateTimestamps));
    const d1 = String(minD.getDate()).padStart(2, '0') + '/' + String(minD.getMonth() + 1).padStart(2, '0');
    const d2 = String(maxD.getDate()).padStart(2, '0') + '/' + String(maxD.getMonth() + 1).padStart(2, '0') + '/' + maxD.getFullYear();
    dateRangeLabel = `Weekly (${d1} - ${d2})`;
  }

  // =========================================================================
  // 2. LOAD ORIGINAL TEMPLATE WORKBOOK & INJECT DATA
  // =========================================================================
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(WEEKLY_REPORT_TEMPLATE_BASE64, { type: 'base64', cellStyles: true });
  } catch (err) {
    wb = XLSX.utils.book_new();
    wb.Sheets['Weekly'] = XLSX.utils.aoa_to_sheet([]);
    wb.SheetNames = ['Weekly'];
  }

  const ws = wb.Sheets['Weekly'];

  // Row 1: Header title
  setCellValue(ws, 'A1', dateRangeLabel);

  // Row 5: KPI values
  setCellValue(ws, 'A5', totalCount);
  setCellValue(ws, 'B5', totalCount > 0 ? onTimeCount / totalCount : 0, '0.0%');
  setCellValue(ws, 'D5', totalCount > 0 ? overdueCount / totalCount : 0, '0.0%');
  setCellValue(ws, 'F5', totalCount > 0 ? earlyFailCount / totalCount : 0, '0.0%');
  setCellValue(ws, 'H5', topSupplier.name);
  setCellValue(ws, 'J5', topProject.name);
  setCellValue(ws, 'L5', topStore.name);
  setCellValue(ws, 'N5', topCat.name);
  setCellValue(ws, 'P5', topPosm.name);

  // Row 6: KPI subtitles
  setCellValue(ws, 'B6', `⚡ ${onTimeCount}/${totalCount} ca`);
  setCellValue(ws, 'D6', `⚠️ ${overdueCount}/${totalCount} ca`);
  setCellValue(ws, 'F6', `⚠️ ${earlyFailCount}/${totalCount} ca`);
  setCellValue(ws, 'H6', `${topSupplier.count} ca (${topSupplier.pct})`);
  setCellValue(ws, 'J6', `${topProject.count} ca (${topProject.pct})`);
  setCellValue(ws, 'L6', `${topStore.count} ca (${topStore.pct})`);
  setCellValue(ws, 'N6', `${topCat.count} ca (${topCat.pct})`);
  setCellValue(ws, 'P6', `${topPosm.count} ca (${topPosm.pct})`);

  // Row 7: In-progress note
  const activePrjStr = Array.from(activeProjectsSet).join(', ') || 'Không có ca tồn đọng';
  setCellValue(ws, 'A7', `⏳ Đang xử lí ${inProgressCount} ca thuộc dự án:`);
  setCellValue(ws, 'D7', activePrjStr);

  // Rows 12-16: 3 Evaluation tables (BY SUPPLIER, BY CAUSE, BY TIMELINE)
  // Clear rows 12-17
  for (let r = 12; r <= 17; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'M', 'O', 'P', 'Q'].forEach(col => {
      setCellValue(ws, `${col}${r}`, null);
    });
  }

  // Populate Bảng 1: BY SUPPLIER
  const sortedSuppliers = Array.from(supplierMap.entries()).sort((a, b) => b[1].total - a[1].total);
  sortedSuppliers.forEach(([sup, d], idx) => {
    const r = 12 + idx;
    setCellValue(ws, `A${r}`, sup);
    setCellValue(ws, `B${r}`, d.total);
    setCellValue(ws, `C${r}`, d.early);
    setCellValue(ws, `D${r}`, d.repeat);
    setCellValue(ws, `E${r}`, d.overdue);
    setCellValue(ws, `F${r}`, d.total > 0 ? (d.total - d.overdue) / d.total : 1, '0.0%');
  });

  // Populate Bảng 2: BY CAUSE
  const sortedCauses = Array.from(causeMap.entries()).sort((a, b) => b[1].count - a[1].count);
  sortedCauses.slice(0, 6).forEach(([cause, d], idx) => {
    const r = 12 + idx;
    setCellValue(ws, `H${r}`, cause);
    setCellValue(ws, `J${r}`, `${d.count}\n(${d.topSupplier}>>)`);
    setCellValue(ws, `K${r}`, totalCount > 0 ? d.count / totalCount : 0, '0.0%');
  });

  // Populate Bảng 3: BY TIMELINE
  const timelineData = [
    { label: '1 - 3 ngày (Trễ nhẹ)', count: delay1to3, badge: 'Nhắc nhở' },
    { label: '4 - 7 ngày (Cảnh báo tiến độ)', count: delay4to7, badge: 'Đôn đốc xử lý gấp' },
    { label: '> 7 ngày (Quá hạn nghiêm trọng)', count: delayOver7, badge: 'Yêu cầu giải trình' }
  ];
  timelineData.forEach((t, idx) => {
    const r = 12 + idx;
    setCellValue(ws, `M${r}`, t.label);
    setCellValue(ws, `O${r}`, t.count);
    setCellValue(ws, `P${r}`, totalCount > 0 ? t.count / totalCount : 0, '0.0%');
    setCellValue(ws, `Q${r}`, t.badge);
  });

  // Rows 21-25: 4 Breakdown tables (BY POSM, BY STORE, BY PROJECT, BY CAT)
  for (let r = 21; r <= 27; r++) {
    ['A', 'B', 'D', 'E', 'G', 'H', 'J', 'K'].forEach(col => {
      setCellValue(ws, `${col}${r}`, null);
    });
  }

  const sortedPosm = Array.from(posmMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedStore = Array.from(storeMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedProject = Array.from(projectMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  const maxBreakdown = Math.max(sortedPosm.length, sortedStore.length, sortedProject.length, sortedCat.length, 3);
  for (let i = 0; i < maxBreakdown && i < 6; i++) {
    const r = 21 + i;
    if (sortedPosm[i]) {
      setCellValue(ws, `A${r}`, sortedPosm[i][0]);
      setCellValue(ws, `B${r}`, sortedPosm[i][1]);
    }
    if (sortedStore[i]) {
      setCellValue(ws, `D${r}`, sortedStore[i][0]);
      setCellValue(ws, `E${r}`, sortedStore[i][1]);
    }
    if (sortedProject[i]) {
      setCellValue(ws, `G${r}`, sortedProject[i][0]);
      setCellValue(ws, `H${r}`, sortedProject[i][1]);
    }
    if (sortedCat[i]) {
      setCellValue(ws, `J${r}`, sortedCat[i][0]);
      setCellValue(ws, `K${r}`, sortedCat[i][1]);
    }
  }

  // Row 29+: Clear existing detail rows from row 31 upwards to 1000
  for (let r = 31; r <= 1000; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach(col => {
      setCellValue(ws, `${col}${r}`, null);
    });
  }

  // Ensure merges list has merges for new detail rows
  if (!ws['!merges']) ws['!merges'] = [];
  const existingMerges = ws['!merges'];

  // Inject all active items into Row 31+
  activeItems.forEach((item, idx) => {
    const r = 31 + idx;
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

    setCellValue(ws, `A${r}`, item.requestId || `BH-${item.rowId || idx + 1}`);
    setCellValue(ws, `B${r}`, item.storeName || 'Chưa xác định');
    setCellValue(ws, `C${r}`, item.posmType || 'Chưa xác định');
    setCellValue(ws, `D${r}`, item.brand || 'Chưa xác định');
    setCellValue(ws, `E${r}`, item.category || item.brand || 'Chưa xác định');
    setCellValue(ws, `F${r}`, item.projectCode || 'Chưa xác định');
    setCellValue(ws, `G${r}`, item.supplier || 'Chưa xác định');
    setCellValue(ws, `H${r}`, formatDateStr(item.installationDate));
    setCellValue(ws, `I${r}`, formatDateStr(item.sentDate || item.createdAt));
    setCellValue(ws, `J${r}`, item.errorType || item.errorDetail || 'Chưa xác định');
    setCellValue(ws, `L${r}`, item.errorDetail || 'Chưa xác định');
    setCellValue(ws, `N${r}`, formatDateStr(item.expectedDate || item.requestDeadline));
    setCellValue(ws, `O${r}`, formatDateStr(item.completedDate));
    setCellValue(ws, `P${r}`, item.progress || 'Not started');
    setCellValue(ws, `Q${r}`, noteText);

    // Merge J:K and L:M for each detail row
    const rowIdx0 = r - 1;
    existingMerges.push({ s: { r: rowIdx0, c: 9 }, e: { r: rowIdx0, c: 10 } }); // J:K
    existingMerges.push({ s: { r: rowIdx0, c: 11 }, e: { r: rowIdx0, c: 12 } }); // L:M
  });

  const lastRow = Math.max(32 + activeItems.length, 40);
  ws['!ref'] = `A1:Q${lastRow}`;

  // =========================================================================
  // 3. BUILD SHEET 2: "Raw Data" (100% OPERATIONAL RAW DATA - 21 COLUMNS)
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

  // Remove existing Raw Data sheet if any and append fresh one
  const rawSheetName = 'Raw Data';
  const existingRawIdx = wb.SheetNames.indexOf(rawSheetName);
  if (existingRawIdx >= 0) {
    wb.SheetNames.splice(existingRawIdx, 1);
    delete wb.Sheets[rawSheetName];
  }
  XLSX.utils.book_append_sheet(wb, wsRaw, rawSheetName);

  // Trigger download in browser
  XLSX.writeFile(wb, `${finalFilename}_${dateStr}.xlsx`);
};
