import ExcelJS from 'exceljs';
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

/**
 * Service xuất Báo Cáo Bảo Hành trực tiếp bằng ExcelJS
 * - Giữ nguyên 100% màu sắc, viền khung (borders), font chữ, background fills, merged cells của template gốc Weekly_Report.xlsx
 * - Tab 1: Weekly (Template gốc kèm dữ liệu thực tế)
 * - Tab 2: Raw Data (Toàn bộ 21 cột chi tiết)
 */
export const exportAnalystExecutiveReport = async (
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
  // 2. LOAD TEMPLATE WORKBOOK VIA EXCELJS (PRESERVING 100% STYLES)
  // =========================================================================
  const wb = new ExcelJS.Workbook();
  
  // Convert base64 to buffer for ExcelJS
  const binaryString = atob(WEEKLY_REPORT_TEMPLATE_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await wb.xlsx.load(bytes.buffer);

  const ws = wb.getWorksheet('Weekly') || wb.worksheets[0];

  // 1. Title Header
  ws.getCell('A1').value = dateRangeLabel;

  // 2. Row 5: KPI Values
  ws.getCell('A5').value = totalCount;
  ws.getCell('B5').value = totalCount > 0 ? onTimeCount / totalCount : 0;
  ws.getCell('B5').numFmt = '0.0%';
  ws.getCell('D5').value = totalCount > 0 ? overdueCount / totalCount : 0;
  ws.getCell('D5').numFmt = '0.0%';
  ws.getCell('F5').value = totalCount > 0 ? earlyFailCount / totalCount : 0;
  ws.getCell('F5').numFmt = '0.0%';
  ws.getCell('H5').value = topSupplier.name;
  ws.getCell('J5').value = topProject.name;
  ws.getCell('L5').value = topStore.name;
  ws.getCell('N5').value = topCat.name;
  ws.getCell('P5').value = topPosm.name;

  // 3. Row 6: KPI Subtitles
  ws.getCell('B6').value = `⚡ ${onTimeCount}/${totalCount} ca`;
  ws.getCell('D6').value = `⚠️ ${overdueCount}/${totalCount} ca`;
  ws.getCell('F6').value = `⚠️ ${earlyFailCount}/${totalCount} ca`;
  ws.getCell('H6').value = `${topSupplier.count} ca (${topSupplier.pct})`;
  ws.getCell('J6').value = `${topProject.count} ca (${topProject.pct})`;
  ws.getCell('L6').value = `${topStore.count} ca (${topStore.pct})`;
  ws.getCell('N6').value = `${topCat.count} ca (${topCat.pct})`;
  ws.getCell('P6').value = `${topPosm.count} ca (${topPosm.pct})`;

  // 4. Row 7: Active in-progress note
  const activePrjStr = Array.from(activeProjectsSet).join(', ') || 'Không có ca tồn đọng';
  ws.getCell('A7').value = `⏳ Đang xử lí ${inProgressCount} ca thuộc dự án:`;
  ws.getCell('D7').value = activePrjStr;

  // 5. Rows 12-16: 3 Evaluation Tables (BY SUPPLIER, BY CAUSE, BY TIMELINE)
  // Clear rows 12 to 17
  for (let r = 12; r <= 17; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'M', 'O', 'P', 'Q'].forEach(col => {
      ws.getCell(`${col}${r}`).value = null;
    });
  }

  // Populate Bảng 1: BY SUPPLIER
  const sortedSuppliers = Array.from(supplierMap.entries()).sort((a, b) => b[1].total - a[1].total);
  sortedSuppliers.forEach(([sup, d], idx) => {
    const r = 12 + idx;
    ws.getCell(`A${r}`).value = sup;
    ws.getCell(`B${r}`).value = d.total;
    ws.getCell(`C${r}`).value = d.early;
    ws.getCell(`D${r}`).value = d.repeat;
    ws.getCell(`E${r}`).value = d.overdue;
    ws.getCell(`F${r}`).value = d.total > 0 ? (d.total - d.overdue) / d.total : 1;
    ws.getCell(`F${r}`).numFmt = '0.0%';
  });

  // Populate Bảng 2: BY CAUSE
  const sortedCauses = Array.from(causeMap.entries()).sort((a, b) => b[1].count - a[1].count);
  sortedCauses.slice(0, 6).forEach(([cause, d], idx) => {
    const r = 12 + idx;
    ws.getCell(`H${r}`).value = cause;
    ws.getCell(`J${r}`).value = `${d.count}\n(${d.topSupplier}>>)`;
    ws.getCell(`K${r}`).value = totalCount > 0 ? d.count / totalCount : 0;
    ws.getCell(`K${r}`).numFmt = '0.0%';
  });

  // Populate Bảng 3: BY TIMELINE
  const timelineData = [
    { label: '1 - 3 ngày (Trễ nhẹ)', count: delay1to3, badge: 'Nhắc nhở' },
    { label: '4 - 7 ngày (Cảnh báo tiến độ)', count: delay4to7, badge: 'Đôn đốc xử lý gấp' },
    { label: '> 7 ngày (Quá hạn nghiêm trọng)', count: delayOver7, badge: 'Yêu cầu giải trình' }
  ];
  timelineData.forEach((t, idx) => {
    const r = 12 + idx;
    ws.getCell(`M${r}`).value = t.label;
    ws.getCell(`O${r}`).value = t.count;
    ws.getCell(`P${r}`).value = totalCount > 0 ? t.count / totalCount : 0;
    ws.getCell(`P${r}`).numFmt = '0.0%';
    ws.getCell(`Q${r}`).value = t.badge;
  });

  // 6. Rows 21-25: 4 Breakdown Tables (BY POSM, BY STORE, BY PROJECT, BY CAT)
  for (let r = 21; r <= 27; r++) {
    ['A', 'B', 'D', 'E', 'G', 'H', 'J', 'K'].forEach(col => {
      ws.getCell(`${col}${r}`).value = null;
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
      ws.getCell(`A${r}`).value = sortedPosm[i][0];
      ws.getCell(`B${r}`).value = sortedPosm[i][1];
    }
    if (sortedStore[i]) {
      ws.getCell(`D${r}`).value = sortedStore[i][0];
      ws.getCell(`E${r}`).value = sortedStore[i][1];
    }
    if (sortedProject[i]) {
      ws.getCell(`G${r}`).value = sortedProject[i][0];
      ws.getCell(`H${r}`).value = sortedProject[i][1];
    }
    if (sortedCat[i]) {
      ws.getCell(`J${r}`).value = sortedCat[i][0];
      ws.getCell(`K${r}`).value = sortedCat[i][1];
    }
  }

  // 7. Rows 31+: Detail Action Table
  // Clear any existing dummy rows from row 31 to 1000
  for (let r = 31; r <= 1000; r++) {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach(col => {
      ws.getCell(`${col}${r}`).value = null;
    });
  }

  // Inject all active items with styling
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    bottom: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    left: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    right: { style: 'thin', color: { argb: 'FFD2D0CE' } }
  };

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

    ws.getCell(`A${r}`).value = item.requestId || `BH-${item.rowId || idx + 1}`;
    ws.getCell(`B${r}`).value = item.storeName || 'Chưa xác định';
    ws.getCell(`C${r}`).value = item.posmType || 'Chưa xác định';
    ws.getCell(`D${r}`).value = item.brand || 'Chưa xác định';
    ws.getCell(`E${r}`).value = item.category || item.brand || 'Chưa xác định';
    ws.getCell(`F${r}`).value = item.projectCode || 'Chưa xác định';
    ws.getCell(`G${r}`).value = item.supplier || 'Chưa xác định';
    ws.getCell(`H${r}`).value = formatDateStr(item.installationDate);
    ws.getCell(`I${r}`).value = formatDateStr(item.sentDate || item.createdAt);
    ws.getCell(`J${r}`).value = item.errorType || item.errorDetail || 'Chưa xác định';
    ws.getCell(`L${r}`).value = item.errorDetail || 'Chưa xác định';
    ws.getCell(`N${r}`).value = formatDateStr(item.expectedDate || item.requestDeadline);
    ws.getCell(`O${r}`).value = formatDateStr(item.completedDate);
    ws.getCell(`P${r}`).value = item.progress || 'Not started';
    ws.getCell(`Q${r}`).value = noteText;

    // Apply borders & font styling
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'N', 'O', 'P', 'Q'].forEach(c => {
      const cell = ws.getCell(`${c}${r}`);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Merge J:K and L:M for row
    try {
      ws.mergeCells(`J${r}:K${r}`);
      ws.mergeCells(`L${r}:M${r}`);
    } catch {
      // Ignore if already merged
    }
  });

  // =========================================================================
  // 3. BUILD SHEET 2: "Raw Data" (FULL 21 COLUMNS WITH CLEAN STYLING)
  // =========================================================================
  const existingRaw = wb.getWorksheet('Raw Data');
  if (existingRaw) wb.removeWorksheet(existingRaw.id);

  const rawWs = wb.addWorksheet('Raw Data');

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

  // Header banner
  rawWs.addRow(['DANH SÁCH CHI TIẾT 100% CA BẢO HÀNH POSM (RAW DATA)']);
  rawWs.mergeCells('A1:U1');
  const titleCell = rawWs.getCell('A1');
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  rawWs.getRow(1).height = 30;

  rawWs.addRow([`Dự án: ${isFilteredByProject ? cleanProjectCode : 'Tất cả dự án'} | Tổng số: ${totalCount} ca | Xuất ngày: ${new Date().toLocaleString('vi-VN')}`]);
  rawWs.mergeCells('A2:U2');
  rawWs.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF605E5C' } };

  rawWs.addRow([]);

  // Table header
  const headerRow = rawWs.addRow(rawHeader);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Table rows
  activeItems.forEach((item, idx) => {
    const row = rawWs.addRow([
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

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: colNumber === 13 || colNumber === 21 };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // Column widths for Raw Data
  rawWs.columns = [
    { width: 12 }, { width: 16 }, { width: 14 }, { width: 28 }, { width: 14 },
    { width: 18 }, { width: 18 }, { width: 20 }, { width: 16 }, { width: 16 },
    { width: 20 }, { width: 24 }, { width: 42 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 20 },
    { width: 30 }
  ];

  // =========================================================================
  // 4. GENERATE BINARY & TRIGGER BROWSER DOWNLOAD
  // =========================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${finalFilename}_${dateStr}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
