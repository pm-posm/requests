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

// Normalize cause matching 100% with Dashboard
const normalizeCauseKey = (item: WarrantyItem): string => {
  let causeKey = (item.errorType || '').trim();
  if (!causeKey) {
    const err = (item.errorDetail || (item as any).reason || item.note || '').toLowerCase();
    if (err.includes('cầu chì') || err.includes('đèn led') || err.includes('led') || err.includes('đèn') || err.includes('tắt đèn') || err.includes('sáng')) {
      causeKey = 'Tắt, hỏng hệ thống cầu chì/Đèn LED';
    } else if (err.includes('nguồn') || err.includes('điện') || err.includes('adapter') || err.includes('chập')) {
      causeKey = 'Thiết bị nguồn/Điện thông minh hư hại';
    } else if (err.includes('keo') || err.includes('in màu') || err.includes('sơn') || err.includes('bong tróc') || err.includes('vệ sinh')) {
      causeKey = 'Chất lượng keo dán/In màu AW/Sơn bong tróc (Không đạt vệ sinh)';
    } else if (err.includes('xe đẩy') || err.includes('ngoại lực') || err.includes('khách') || err.includes('va đập') || err.includes('gãy') || err.includes('vỡ') || err.includes('móp')) {
      causeKey = 'Tác động ngoại lực (Xe đẩy siêu thị, khách hàng)';
    } else if (err.includes('kết cấu') || err.includes('biến dạng') || err.includes('khung')) {
      causeKey = 'Kết cấu hư hỏng, biến dạng';
    } else {
      causeKey = 'Khác / Chưa phân loại';
    }
  }
  return causeKey;
};

/**
 * Service xuất Báo Cáo Bảo Hành trực tiếp bằng ExcelJS
 * - ĐỒNG BỘ 100% SỐ LIỆU VÀ GIAO DIỆN VỚI DASHBOARD
 * - Tab 1: Weekly (Template gốc với số liệu chuẩn hóa, reset sạch định dạng residual)
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
  // 1. STATS & KPIS COMPUTATION (EXACTLY MATCHING DASHBOARD 1:1)
  // =========================================================================
  let onTimeCount = 0;
  let overdueCount = 0;
  let earlyFailCount = 0;
  let inProgressCount = 0;

  const supplierMap = new Map<string, {
    supplier: string;
    total: number;
    earlyFail: number;
    recurrent: number;
    overdue: number;
    onTime: number;
  }>();

  const causeMap = new Map<string, { count: number; suppliers: Set<string> }>();
  const posmMap = new Map<string, number>();
  const storeMap = new Map<string, number>();
  const projectMap = new Map<string, number>();
  const catMap = new Map<string, number>();
  const activeProjectsSet = new Set<string>();

  // Track recurrent by store + posm (Exactly matching Dashboard lines 427-431)
  const storePosmCounts = new Map<string, number>();
  activeItems.forEach(item => {
    const key = `${(item.storeName || '').trim()}__${(item.posmType || '').trim()}`;
    storePosmCounts.set(key, (storePosmCounts.get(key) || 0) + 1);
  });

  // Delay Tiers breakdown (Exactly matching Dashboard lines 521-542)
  let delay1to3 = 0;
  let delay4to7 = 0;
  let delayOver7 = 0;

  const dateTimestamps: number[] = [];

  activeItems.forEach(item => {
    // Exactly matching Dashboard lines 441-471:
    const sentMs = parseDateToMs(item.sentDate || item.createdAt);
    const installMs = parseDateToMs(item.installationDate);
    const doneMs = parseDateToMs(item.completedDate);
    const schedMs = parseDateToMs(item.scheduledDate);
    const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;

    if (sentMs) dateTimestamps.push(sentMs);

    // 1. Check Early Fail (<30 days from install to fault)
    let isEarly = false;
    if (installMs && sentMs && sentMs >= installMs && (sentMs - installMs) < 30 * 86400000) {
      earlyFailCount++;
      isEarly = true;
    }

    // 2. Check On-time vs Overdue (Exact match with Dashboard lines 345-364)
    let isOver = false;
    if (isDone) {
      if (doneMs && schedMs && doneMs > schedMs + 86400000) {
        overdueCount++;
        isOver = true;
      } else if (sentMs && doneMs && (doneMs - sentMs) > 7 * 86400000) {
        overdueCount++;
        isOver = true;
      } else {
        onTimeCount++;
      }
    } else {
      inProgressCount++;
      const now = Date.now();
      if (sentMs && (now - sentMs) > 7 * 86400000) {
        overdueCount++;
        isOver = true;
      } else {
        onTimeCount++;
      }
      if (item.projectCode && item.projectCode.trim()) {
        activeProjectsSet.add(item.projectCode.trim());
      }
    }

    // 3. Delay Tiers (Exact match with Dashboard lines 531-542)
    let delayDays = 0;
    if (isDone && doneMs && schedMs && doneMs > schedMs) {
      delayDays = Math.round((doneMs - schedMs) / 86400000);
    } else if (!isDone && sentMs) {
      const diff = Math.round((Date.now() - sentMs) / 86400000);
      if (diff > 3) delayDays = diff - 3;
    }

    if (delayDays >= 1 && delayDays <= 3) delay1to3++;
    else if (delayDays >= 4 && delayDays <= 7) delay4to7++;
    else if (delayDays > 7) delayOver7++;

    // 4. Supplier stats
    const sup = (item.supplier || 'Chưa gán').trim();
    if (!supplierMap.has(sup)) {
      supplierMap.set(sup, { supplier: sup, total: 0, earlyFail: 0, recurrent: 0, overdue: 0, onTime: 0 });
    }
    const supStat = supplierMap.get(sup)!;
    supStat.total++;
    if (isEarly) supStat.earlyFail++;
    const key = `${(item.storeName || '').trim()}__${(item.posmType || '').trim()}`;
    if ((storePosmCounts.get(key) || 0) > 1) {
      supStat.recurrent++;
    }
    if (isOver) {
      supStat.overdue++;
    } else {
      supStat.onTime++;
    }

    // 5. Cause stats (Exact match with Dashboard lines 478-517)
    const cause = normalizeCauseKey(item);
    if (!causeMap.has(cause)) {
      causeMap.set(cause, { count: 0, suppliers: new Set<string>() });
    }
    const causeEntry = causeMap.get(cause)!;
    causeEntry.count++;
    if (sup) causeEntry.suppliers.add(sup);

    // 6. POSM / Store / Project / Cat
    const posm = (item.posmType || 'Chưa gán').trim();
    posmMap.set(posm, (posmMap.get(posm) || 0) + 1);

    const store = (item.storeName || 'Chưa gán').trim();
    storeMap.set(store, (storeMap.get(store) || 0) + 1);

    const prj = (item.projectCode || 'Chưa gán').trim();
    projectMap.set(prj, (projectMap.get(prj) || 0) + 1);

    const cat = (item.category || item.brand || 'Chưa gán').trim();
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
  // 2. LOAD TEMPLATE WORKBOOK VIA EXCELJS
  // =========================================================================
  const wb = new ExcelJS.Workbook();
  const binaryString = atob(WEEKLY_REPORT_TEMPLATE_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await wb.xlsx.load(bytes.buffer);

  const ws = wb.getWorksheet('Weekly') || wb.worksheets[0];

  // =========================================================================
  // 3. SET EXPANDED COLUMN WIDTHS & ROW HEIGHTS
  // =========================================================================
  ws.columns = [
    { width: 22 }, // A: Nhà Thầu / Loại POSM / ID
    { width: 14 }, // B: Total Case / Số ca POSM
    { width: 16 }, // C: Hỏng sớm (<30d)
    { width: 18 }, // D: Tái diễn / Store
    { width: 14 }, // E: Trễ hạn / Số ca Store
    { width: 16 }, // F: % Đạt tiến độ / Mã dự án
    { width: 18 }, // G: Mã dự án
    { width: 38 }, // H: Nguyên nhân lỗi / Ngày lắp đặt
    { width: 16 }, // I: Ngày gửi BH
    { width: 16 }, // J: Số ca lỗi
    { width: 14 }, // K: % Tỷ lệ lỗi / Ngành hàng
    { width: 32 }, // L: Chi tiết lỗi
    { width: 28 }, // M: Thời gian trễ hạn
    { width: 16 }, // N: Hạn xử lý
    { width: 16 }, // O: Số ca trễ / Ngày hoàn thành
    { width: 16 }, // P: % Tỷ lệ trễ / Tiến độ
    { width: 26 }  // Q: Ghi chú
  ];

  // Set row heights
  ws.getRow(1).height = 36;
  ws.getRow(2).height = 10;
  ws.getRow(3).height = 10;
  ws.getRow(4).height = 28;
  ws.getRow(5).height = 42;
  ws.getRow(6).height = 24;
  ws.getRow(7).height = 26;
  ws.getRow(8).height = 10;
  ws.getRow(10).height = 28;
  ws.getRow(11).height = 26;
  ws.getRow(21).height = 28;
  ws.getRow(22).height = 26;
  ws.getRow(31).height = 28;
  ws.getRow(32).height = 26;

  // Common Reusable Styles
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    bottom: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    left: { style: 'thin', color: { argb: 'FFD2D0CE' } },
    right: { style: 'thin', color: { argb: 'FFD2D0CE' } }
  };

  const navyHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' }
  };

  const greenHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB7E1CD' }
  };

  const softGreenItemFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F4EA' }
  };

  const numberCellFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8F9FA' }
  };

  // 1. Title Header in Row 1
  ws.getCell('A1').value = dateRangeLabel;
  ws.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  // Fill entire top KPI area (Rows 2-8, Cols A-Q) with uniform green
  for (let r = 2; r <= 8; r++) {
    for (let c = 1; c <= 17; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.fill = greenHeaderFill;
    }
  }

  // 2. Row 4: KPI Titles
  const kpiHeaders: { col: string; title: string }[] = [
    { col: 'A', title: 'TỔNG CA BẢO HÀNH' },
    { col: 'B', title: '% XỬ LÝ ĐÚNG HẠN' },
    { col: 'D', title: '% XỬ LÝ TRỄ HẠN' },
    { col: 'F', title: '% HỎNG SỚM (<30 NGÀY)' },
    { col: 'H', title: 'TOP NHÀ THẦU' },
    { col: 'J', title: 'TOP DỰ ÁN' },
    { col: 'L', title: 'TOP SIÊU THỊ' },
    { col: 'N', title: 'TOP NGÀNH HÀNG' },
    { col: 'P', title: 'TOP LOẠI POSM' }
  ];
  kpiHeaders.forEach(({ col, title }) => {
    const cell = ws.getCell(`${col}4`);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  // 3. Row 5: KPI Large Numbers
  ws.getCell('A5').value = totalCount;
  ws.getCell('A5').numFmt = '#,##0';
  ws.getCell('A5').font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

  const onTimeRate = totalCount > 0 ? onTimeCount / totalCount : 0;
  ws.getCell('B5').value = onTimeRate;
  ws.getCell('B5').numFmt = '0.0%';
  ws.getCell('B5').font = { name: 'Calibri', size: 24, bold: true, color: { argb: onTimeRate >= 0.8 ? 'FF57BB8A' : 'FFD93025' } };
  ws.getCell('B5').alignment = { horizontal: 'center', vertical: 'middle' };

  const overdueRate = totalCount > 0 ? overdueCount / totalCount : 0;
  ws.getCell('D5').value = overdueRate;
  ws.getCell('D5').numFmt = '0.0%';
  ws.getCell('D5').font = { name: 'Calibri', size: 24, bold: true, color: { argb: overdueCount > 0 ? 'FFD93025' : 'FF57BB8A' } };
  ws.getCell('D5').alignment = { horizontal: 'center', vertical: 'middle' };

  const earlyRate = totalCount > 0 ? earlyFailCount / totalCount : 0;
  ws.getCell('F5').value = earlyRate;
  ws.getCell('F5').numFmt = '0.0%';
  ws.getCell('F5').font = { name: 'Calibri', size: 24, bold: true, color: { argb: earlyFailCount > 0 ? 'FFE37400' : 'FF57BB8A' } };
  ws.getCell('F5').alignment = { horizontal: 'center', vertical: 'middle' };

  const formatTopKpiCell = (col: string, text: string) => {
    const cell = ws.getCell(`${col}5`);
    cell.value = text;
    cell.numFmt = '@';
    cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  };

  formatTopKpiCell('H', topSupplier.name);
  formatTopKpiCell('J', topProject.name);
  formatTopKpiCell('L', topStore.name);
  formatTopKpiCell('N', topCat.name);
  formatTopKpiCell('P', topPosm.name);

  // 4. Row 6: KPI Subtitles
  const formatSubtitle = (col: string, text: string, color = 'FF1F4E79') => {
    const cell = ws.getCell(`${col}6`);
    cell.value = text;
    cell.numFmt = '@';
    cell.font = { name: 'Calibri', size: 10, color: { argb: color } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  };

  formatSubtitle('B', `⚡ ${onTimeCount}/${totalCount} ca`, onTimeRate >= 0.8 ? 'FF1F4E79' : 'FFD93025');
  formatSubtitle('D', `⚠️ ${overdueCount}/${totalCount} ca`, overdueCount > 0 ? 'FFD93025' : 'FF57BB8A');
  formatSubtitle('F', `⚠️ ${earlyFailCount}/${totalCount} ca`, earlyFailCount > 0 ? 'FFE37400' : 'FF57BB8A');
  formatSubtitle('H', `${topSupplier.count} ca (${topSupplier.pct})`);
  formatSubtitle('J', `${topProject.count} ca (${topProject.pct})`);
  formatSubtitle('L', `${topStore.count} ca (${topStore.pct})`);
  formatSubtitle('N', `${topCat.count} ca (${topCat.pct})`);
  formatSubtitle('P', `${topPosm.count} ca (${topPosm.pct})`);

  // 5. Row 7: Active in-progress note
  const activePrjStr = Array.from(activeProjectsSet).join(', ') || 'Không có ca tồn đọng';
  ws.getCell('A7').value = `⏳ Đang xử lí ${inProgressCount} ca thuộc dự án:`;
  ws.getCell('A7').numFmt = '@';
  ws.getCell('A7').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('A7').alignment = { vertical: 'middle', horizontal: 'left' };

  ws.getCell('D7').value = activePrjStr;
  ws.getCell('D7').numFmt = '@';
  ws.getCell('D7').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF252423' } };
  ws.getCell('D7').alignment = { vertical: 'middle', horizontal: 'left' };

  // =========================================================================
  // 6. ROWS 10-20: 3 EVALUATION TABLES (BY SUPPLIER, BY CAUSE, BY TIMELINE)
  // =========================================================================

  // Fully reset rows 10 to 20 to remove ALL residual template formats
  for (let r = 10; r <= 20; r++) {
    for (let c = 1; c <= 17; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.value = null;
      cell.fill = { type: 'pattern', pattern: 'none' };
      cell.border = {};
      cell.numFmt = '@';
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      cell.alignment = { vertical: 'middle' };
    }
  }

  // Section Headers (Row 10)
  ws.getCell('A10').value = '1. BY SUPPLIER';
  ws.getCell('A10').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('H10').value = '2. BY CAUSE';
  ws.getCell('H10').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('M10').value = '3. BY TIMELINE (TRỄ HẠN)';
  ws.getCell('M10').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };

  // Table 1 Headers (Row 11)
  const t1Headers = [
    { col: 'A', title: 'Nhà Thầu' },
    { col: 'B', title: 'Total Case' },
    { col: 'C', title: 'Hỏng Sớm (<30d)' },
    { col: 'D', title: 'Tái Diễn' },
    { col: 'E', title: 'Trễ Hạn' },
    { col: 'F', title: '% Đạt Tiến Độ' }
  ];
  t1Headers.forEach(({ col, title }) => {
    const cell = ws.getCell(`${col}11`);
    cell.value = title;
    cell.fill = navyHeaderFill;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  // Table 2 Headers (Row 11)
  ws.getCell('H11').value = 'Nguyên Nhân Hư Hỏng';
  ws.getCell('H11').fill = navyHeaderFill;
  ws.getCell('H11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('H11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('H11').border = thinBorder;

  ws.getCell('J11').value = 'Số Ca';
  ws.getCell('J11').fill = navyHeaderFill;
  ws.getCell('J11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('J11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('J11').border = thinBorder;

  ws.getCell('K11').value = '% Tỷ Lệ';
  ws.getCell('K11').fill = navyHeaderFill;
  ws.getCell('K11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('K11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('K11').border = thinBorder;

  // Table 3 Headers (Row 11) - Clean 3 columns without subjective warning note
  ws.getCell('M11').value = 'Thời Gian Trễ Hạn';
  ws.getCell('M11').fill = navyHeaderFill;
  ws.getCell('M11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('M11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('M11').border = thinBorder;

  ws.getCell('O11').value = 'Số Ca';
  ws.getCell('O11').fill = navyHeaderFill;
  ws.getCell('O11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('O11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('O11').border = thinBorder;

  ws.getCell('P11').value = '% Tỷ Lệ';
  ws.getCell('P11').fill = navyHeaderFill;
  ws.getCell('P11').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('P11').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('P11').border = thinBorder;

  // Populate Bảng 1: BY SUPPLIER (All 8 suppliers with clean formatting)
  const sortedSuppliers = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total);
  sortedSuppliers.forEach((d, idx) => {
    const r = 12 + idx;
    ws.getRow(r).height = 22;

    ws.getCell(`A${r}`).value = d.supplier;
    ws.getCell(`A${r}`).numFmt = '@';
    ws.getCell(`A${r}`).border = thinBorder;
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF252423' } };
    ws.getCell(`A${r}`).fill = softGreenItemFill;
    ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getCell(`B${r}`).value = d.total;
    ws.getCell(`B${r}`).numFmt = '#,##0';
    ws.getCell(`B${r}`).border = thinBorder;
    ws.getCell(`B${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    ws.getCell(`B${r}`).fill = numberCellFill;
    ws.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`C${r}`).value = d.earlyFail > 0 ? d.earlyFail : '-';
    ws.getCell(`C${r}`).numFmt = d.earlyFail > 0 ? '#,##0' : '@';
    ws.getCell(`C${r}`).border = thinBorder;
    ws.getCell(`C${r}`).font = { name: 'Calibri', size: 11, bold: d.earlyFail > 0, color: { argb: d.earlyFail > 0 ? 'FFD93025' : 'FF808080' } };
    ws.getCell(`C${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`D${r}`).value = d.recurrent > 0 ? d.recurrent : '-';
    ws.getCell(`D${r}`).numFmt = d.recurrent > 0 ? '#,##0' : '@';
    ws.getCell(`D${r}`).border = thinBorder;
    ws.getCell(`D${r}`).font = { name: 'Calibri', size: 11, bold: d.recurrent > 0, color: { argb: d.recurrent > 0 ? 'FFD93025' : 'FF808080' } };
    ws.getCell(`D${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(`E${r}`).value = d.overdue > 0 ? d.overdue : '-';
    ws.getCell(`E${r}`).numFmt = d.overdue > 0 ? '#,##0' : '@';
    ws.getCell(`E${r}`).border = thinBorder;
    ws.getCell(`E${r}`).font = { name: 'Calibri', size: 11, bold: d.overdue > 0, color: { argb: d.overdue > 0 ? 'FFD93025' : 'FF808080' } };
    ws.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    const rate = d.total > 0 ? (d.total - d.overdue) / d.total : 1;
    ws.getCell(`F${r}`).value = rate;
    ws.getCell(`F${r}`).numFmt = '0%';
    ws.getCell(`F${r}`).border = thinBorder;
    ws.getCell(`F${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: rate >= 0.75 ? 'FF57BB8A' : 'FFD93025' } };
    ws.getCell(`F${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Populate Bảng 2: BY CAUSE (Exact categories & numeric counts, zero percentages in count column!)
  const sortedCauses = Array.from(causeMap.entries()).sort((a, b) => b[1].count - a[1].count);
  sortedCauses.slice(0, 6).forEach(([cause, d], idx) => {
    const r = 12 + idx;
    ws.getRow(r).height = 22;

    ws.getCell(`H${r}`).value = cause;
    ws.getCell(`H${r}`).numFmt = '@';
    ws.getCell(`H${r}`).border = thinBorder;
    ws.getCell(`H${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
    ws.getCell(`H${r}`).fill = softGreenItemFill;
    ws.getCell(`H${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getCell(`J${r}`).value = d.count;
    ws.getCell(`J${r}`).numFmt = '#,##0';
    ws.getCell(`J${r}`).border = thinBorder;
    ws.getCell(`J${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    ws.getCell(`J${r}`).fill = numberCellFill;
    ws.getCell(`J${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    const pct = totalCount > 0 ? d.count / totalCount : 0;
    ws.getCell(`K${r}`).value = pct;
    ws.getCell(`K${r}`).numFmt = '0.0%';
    ws.getCell(`K${r}`).border = thinBorder;
    ws.getCell(`K${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
    ws.getCell(`K${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Populate Bảng 3: BY TIMELINE (Exact 1-3d, 4-7d, >7d matching Dashboard)
  const timelineData = [
    { label: '1 - 3 ngày (Trễ nhẹ)', count: delay1to3, color: 'FFD9B300' },
    { label: '4 - 7 ngày (Cảnh báo tiến độ)', count: delay4to7, color: 'FFE66C37' },
    { label: '> 7 ngày (Quá hạn nghiêm trọng)', count: delayOver7, color: 'FFD64550' }
  ];
  timelineData.forEach((t, idx) => {
    const r = 12 + idx;
    ws.getRow(r).height = 22;

    ws.getCell(`M${r}`).value = t.label;
    ws.getCell(`M${r}`).numFmt = '@';
    ws.getCell(`M${r}`).border = thinBorder;
    ws.getCell(`M${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
    ws.getCell(`M${r}`).fill = softGreenItemFill;
    ws.getCell(`M${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

    ws.getCell(`O${r}`).value = t.count;
    ws.getCell(`O${r}`).numFmt = '#,##0';
    ws.getCell(`O${r}`).border = thinBorder;
    ws.getCell(`O${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: t.count > 0 ? t.color : 'FF57BB8A' } };
    ws.getCell(`O${r}`).fill = numberCellFill;
    ws.getCell(`O${r}`).alignment = { horizontal: 'center', vertical: 'middle' };

    const pct = totalCount > 0 ? t.count / totalCount : 0;
    ws.getCell(`P${r}`).value = pct;
    ws.getCell(`P${r}`).numFmt = '0.0%';
    ws.getCell(`P${r}`).border = thinBorder;
    ws.getCell(`P${r}`).font = { name: 'Calibri', size: 11 };
    ws.getCell(`P${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // =========================================================================
  // 7. ROWS 21-29: 4 BREAKDOWN TABLES (BY POSM, BY STORE, BY PROJECT, BY CAT)
  // =========================================================================

  // Fully reset rows 21 to 30 first
  for (let r = 21; r <= 30; r++) {
    for (let c = 1; c <= 17; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.value = null;
      cell.fill = { type: 'pattern', pattern: 'none' };
      cell.border = {};
      cell.numFmt = '@';
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      cell.alignment = { vertical: 'middle' };
    }
  }

  // Section Headers (Row 21)
  ws.getCell('A21').value = '4. BY POSM';
  ws.getCell('A21').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('D21').value = '5. BY STORE';
  ws.getCell('D21').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('G21').value = '6. BY PROJECT';
  ws.getCell('G21').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
  ws.getCell('J21').value = '7. BY CAT';
  ws.getCell('J21').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };

  // Subheaders (Row 22)
  const subheaders: { col1: string; label1: string; col2: string; label2: string }[] = [
    { col1: 'A', label1: 'Loại POSM', col2: 'B', label2: 'Số ca' },
    { col1: 'D', label1: 'Tên Siêu Thị', col2: 'E', label2: 'Số ca' },
    { col1: 'G', label1: 'Mã Dự Án', col2: 'H', label2: 'Số ca' },
    { col1: 'J', label1: 'Ngành Hàng / Brand', col2: 'K', label2: 'Số ca' }
  ];
  subheaders.forEach(({ col1, label1, col2, label2 }) => {
    const c1 = ws.getCell(`${col1}22`);
    c1.value = label1;
    c1.fill = navyHeaderFill;
    c1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.border = thinBorder;

    const c2 = ws.getCell(`${col2}22`);
    c2.value = label2;
    c2.fill = navyHeaderFill;
    c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c2.alignment = { horizontal: 'center', vertical: 'middle' };
    c2.border = thinBorder;
  });

  const sortedPosm = Array.from(posmMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedStore = Array.from(storeMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedProject = Array.from(projectMap.entries()).sort((a, b) => b[1] - a[1]);
  const sortedCat = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  const maxBreakdown = Math.max(sortedPosm.length, sortedStore.length, sortedProject.length, sortedCat.length, 3);
  
  // Format each row (rows 23 to 29) with uniform soft green label and light gray count
  for (let i = 0; i < maxBreakdown && i < 7; i++) {
    const r = 23 + i;
    ws.getRow(r).height = 22;

    // Col A & B (Loại POSM)
    if (sortedPosm[i]) {
      ws.getCell(`A${r}`).value = sortedPosm[i][0];
      ws.getCell(`A${r}`).numFmt = '@';
      ws.getCell(`A${r}`).fill = softGreenItemFill;
      ws.getCell(`A${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      ws.getCell(`A${r}`).border = thinBorder;
      ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getCell(`B${r}`).value = sortedPosm[i][1];
      ws.getCell(`B${r}`).numFmt = '#,##0';
      ws.getCell(`B${r}`).fill = numberCellFill;
      ws.getCell(`B${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
      ws.getCell(`B${r}`).border = thinBorder;
      ws.getCell(`B${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Col D & E (Store)
    if (sortedStore[i]) {
      ws.getCell(`D${r}`).value = sortedStore[i][0];
      ws.getCell(`D${r}`).numFmt = '@';
      ws.getCell(`D${r}`).fill = softGreenItemFill;
      ws.getCell(`D${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      ws.getCell(`D${r}`).border = thinBorder;
      ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getCell(`E${r}`).value = sortedStore[i][1];
      ws.getCell(`E${r}`).numFmt = '#,##0';
      ws.getCell(`E${r}`).fill = numberCellFill;
      ws.getCell(`E${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
      ws.getCell(`E${r}`).border = thinBorder;
      ws.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Col G & H (Mã dự án)
    if (sortedProject[i]) {
      ws.getCell(`G${r}`).value = sortedProject[i][0];
      ws.getCell(`G${r}`).numFmt = '@';
      ws.getCell(`G${r}`).fill = softGreenItemFill;
      ws.getCell(`G${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      ws.getCell(`G${r}`).border = thinBorder;
      ws.getCell(`G${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getCell(`H${r}`).value = sortedProject[i][1];
      ws.getCell(`H${r}`).numFmt = '#,##0';
      ws.getCell(`H${r}`).fill = numberCellFill;
      ws.getCell(`H${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
      ws.getCell(`H${r}`).border = thinBorder;
      ws.getCell(`H${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Col J & K (CAT / Brand)
    if (sortedCat[i]) {
      ws.getCell(`J${r}`).value = sortedCat[i][0];
      ws.getCell(`J${r}`).numFmt = '@';
      ws.getCell(`J${r}`).fill = softGreenItemFill;
      ws.getCell(`J${r}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF252423' } };
      ws.getCell(`J${r}`).border = thinBorder;
      ws.getCell(`J${r}`).alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getCell(`K${r}`).value = sortedCat[i][1];
      ws.getCell(`K${r}`).numFmt = '#,##0';
      ws.getCell(`K${r}`).fill = numberCellFill;
      ws.getCell(`K${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
      ws.getCell(`K${r}`).border = thinBorder;
      ws.getCell(`K${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // =========================================================================
  // 8. ROWS 31+: DETAIL ACTION TABLE (17 COLUMNS DRILL-DOWN)
  // =========================================================================

  // Section Header (Row 31)
  ws.getCell('A31').value = `CHI TIẾT CÁC CA BẢO HÀNH (${totalCount} CA)`;
  ws.getCell('A31').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A31').fill = navyHeaderFill;
  ws.getCell('A31').alignment = { vertical: 'middle', horizontal: 'left' };

  // Table Headers (Row 32)
  const detailHeaders = [
    { col: 'A', title: 'Mã Ca (ID)' },
    { col: 'B', title: 'Tên Siêu Thị' },
    { col: 'C', title: 'Loại POSM' },
    { col: 'D', title: 'Brand' },
    { col: 'E', title: 'Ngành Hàng' },
    { col: 'F', title: 'Mã Dự Án' },
    { col: 'G', title: 'Nhà Thầu' },
    { col: 'H', title: 'Ngày Lắp Đặt' },
    { col: 'I', title: 'Ngày Báo Lỗi' },
    { col: 'J', title: 'Loại Lỗi (Cột W)' },
    { col: 'L', title: 'Chi Tiết Lỗi' },
    { col: 'N', title: 'Hạn Xử Lý' },
    { col: 'O', title: 'Ngày Hoàn Thành' },
    { col: 'P', title: 'Tiến Độ' },
    { col: 'Q', title: 'Ghi Chú' }
  ];

  detailHeaders.forEach(({ col, title }) => {
    const cell = ws.getCell(`${col}32`);
    cell.value = title;
    cell.fill = navyHeaderFill;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  // Clear any existing dummy rows from row 33 to 1000
  for (let r = 33; r <= 1000; r++) {
    for (let c = 1; c <= 17; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.value = null;
      cell.fill = { type: 'pattern', pattern: 'none' };
      cell.border = {};
      cell.numFmt = '@';
    }
  }

  // Inject all active items with styling
  activeItems.forEach((item, idx) => {
    const r = 33 + idx;
    ws.getRow(r).height = 22;

    const isDone = (item.status || '').toLowerCase().includes('hoàn thành') || !!item.completedDate;
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
    } else if (pInst && pSent && pSent >= pInst && Math.round((pSent - pInst) / 86400000) < 30) {
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
    ws.getCell(`J${r}`).value = normalizeCauseKey(item);
    ws.getCell(`L${r}`).value = item.errorDetail || 'Chưa xác định';
    ws.getCell(`N${r}`).value = formatDateStr(item.expectedDate || item.requestDeadline);
    ws.getCell(`O${r}`).value = formatDateStr(item.completedDate);
    ws.getCell(`P${r}`).value = item.progress || 'Not started';
    ws.getCell(`Q${r}`).value = noteText;

    // Apply borders & font styling
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach(c => {
      const cell = ws.getCell(`${c}${r}`);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF252423' } };
      cell.alignment = { vertical: 'middle', wrapText: c === 'L' || c === 'Q' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
  });

  // =========================================================================
  // 9. BUILD SHEET 2: "Raw Data" (FULL 21 COLUMNS)
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
  titleCell.fill = navyHeaderFill;
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
    cell.fill = navyHeaderFill;
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
      normalizeCauseKey(item),
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
  // 10. GENERATE BINARY & TRIGGER BROWSER DOWNLOAD
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
