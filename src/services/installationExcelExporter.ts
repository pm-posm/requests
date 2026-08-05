import * as XLSX from 'xlsx';
import type { InstallationItem } from './installationSyncService';
import { calculateInstallationResult } from '../components/installation/utils/statusCalculators';

export interface ExportReportOptions {
  periodText?: string;
  filenamePrefix?: string;
}

/**
 * Service Xuất Báo Cáo Excel Executive 2-Tab Cho Theo Dõi Lắp Đặt POSM
 * TAB 1: SUMMARY & SUPPLIERS (Bảng Tổng hợp Tiến độ, Supplier Matrix, Chi tiết Dự án Issue / Sự cố)
 * TAB 2: RAW DATA (Dữ liệu thô 100% ca lắp đặt theo bộ lọc)
 */
export const exportInstallationExecutiveReport = (
  items: InstallationItem[],
  options: ExportReportOptions | string = 'POSM_Installation_Executive_Report'
) => {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);

  const opts: ExportReportOptions = typeof options === 'string' 
    ? { filenamePrefix: options, periodText: 'Tất Cả Thời Gian' }
    : { periodText: 'Tất Cả Thời Gian', filenamePrefix: 'POSM_Installation_Executive_Report', ...options };

  const periodText = opts.periodText || 'Tất Cả Thời Gian';
  const filenamePrefix = opts.filenamePrefix || 'POSM_Installation_Executive_Report';
  const totalCount = items.length;

  let successCount = 0;
  let issueCount = 0;
  let noReportCount = 0;
  let cancelledCount = 0;
  let unupdatedCount = 0;

  const supplierMap: Record<string, {
    displayName: string;
    total: number;
    success: number;
    issue: number;
    noReport: number;
    cancelled: number;
    unupdated: number;
  }> = {};

  const issueRows: (string | number)[][] = [];

  items.forEach(item => {
    const statusLower = (item.status || '').toLowerCase().trim();
    const noteLower = (item.note || '').toLowerCase().trim();
    const res = calculateInstallationResult(item.actualTime, item.completionTime, item.status, item.resultSign);
    
    const supplierName = item.supplierName || 'Khác/Chưa rõ';
    const supplierKey = supplierName.toUpperCase();

    if (!supplierMap[supplierKey]) {
      supplierMap[supplierKey] = {
        displayName: supplierName,
        total: 0,
        success: 0,
        issue: 0,
        noReport: 0,
        cancelled: 0,
        unupdated: 0
      };
    }
    supplierMap[supplierKey].total++;

    const isQCFailed = statusLower.includes('installation qc failed') || statusLower.includes('qc failed') || statusLower.includes('failed') || statusLower.includes('lỗi');
    const isCancelled = statusLower.includes('cancelled') || statusLower.includes('cancel') || statusLower.includes('hủy');
    const isNoReport = noteLower.includes('chưa gửi report') || statusLower.includes('chưa gửi report') || statusLower.includes('no report');

    let resultText = '—';
    if (isCancelled) {
      resultText = 'Hủy';
      cancelledCount++;
      supplierMap[supplierKey].cancelled++;
    } else if (isNoReport) {
      resultText = 'Chưa gửi Report';
      noReportCount++;
      supplierMap[supplierKey].noReport++;
    } else if (res.isLateOrFailed || res.sign === '❌' || isQCFailed) {
      resultText = res.failReason === 'LATE' ? '❌ Trễ hạn' : res.failReason === 'QC_FAIL' ? '❌ QC Fail' : '❌ Fail';
      issueCount++;
      supplierMap[supplierKey].issue++;
    } else if (res.sign === '✔' || statusLower.includes('completed') || statusLower.includes('pass')) {
      resultText = '✔ Pass';
      successCount++;
      supplierMap[supplierKey].success++;
    } else {
      resultText = '—';
      unupdatedCount++;
      supplierMap[supplierKey].unupdated++;
    }

    // Push to Issue Rows in Tab 1 if row has issue, cancelled, no report, or fail
    if (isCancelled || isNoReport || res.isLateOrFailed || res.sign === '❌' || isQCFailed) {
      issueRows.push([
        issueRows.length + 1,
        item.projectCode || '-',
        item.item || '-',
        item.catName || item.categoryCode || '-',
        item.brandName || '-',
        item.storeName || '-',
        item.actualTime || '-',
        item.completionTime || 'Chưa hoàn thành',
        item.status || 'QC Failed',
        resultText,
        item.note || 'Lỗi nghiệm thu / Trễ tiến độ / Sự cố',
        supplierName
      ]);
    }
  });

  // ==========================================
  // TAB 1: SUMMARY & SUPPLIERS
  // ==========================================
  const summaryRows: (string | number)[][] = [
    ['BÁO CÁO TỔNG HỢP TIẾN ĐỘ LẮP ĐẶT POSM (SUMMARY & SUPPLIERS)'],
    [`Kỳ báo cáo: ${periodText}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Tổng số ca trong báo cáo: ${totalCount}`],
    [''],
    ['1. BẢNG TỔNG HỢP TIẾN ĐỘ DỰ ÁN'],
    ['Hạng mục tổng hợp', 'Số lượng dự án/asset', 'Tỷ lệ %'],
    ['Tổng số các dự án/asset được thực hiện', totalCount, '100%'],
    ['Đã hoàn thành (Pass QC & Đúng hạn)', successCount, totalCount > 0 ? `${((successCount / totalCount) * 100).toFixed(1)}%` : '0%'],
    ['Dự án trễ deadline / QC fail', issueCount, totalCount > 0 ? `${((issueCount / totalCount) * 100).toFixed(1)}%` : '0%'],
    ['Supplier chưa gửi Report', noReportCount, totalCount > 0 ? `${((noReportCount / totalCount) * 100).toFixed(1)}%` : '0%'],
    ['Dự án bị Hủy (Cancelled)', cancelledCount, totalCount > 0 ? `${((cancelledCount / totalCount) * 100).toFixed(1)}%` : '0%'],
    ['Chưa được cập nhật', unupdatedCount, totalCount > 0 ? `${((unupdatedCount / totalCount) * 100).toFixed(1)}%` : '0%'],
    [''],
    ['2. BÁO CÁO TIẾN ĐỘ THEO SUPPLIER (NHÀ THẦU)'],
    ['STT', 'Tên Supplier', 'Tổng dự án', 'Đã hoàn thành', 'Trễ / QC Fail', 'Chưa gửi Report', 'Bị Hủy (Cancelled)', 'Chưa cập nhật', 'Tỷ Lệ Đạt (%)']
  ];

  let sttSup = 1;
  Object.values(supplierMap).forEach(d => {
    const rate = d.total > 0 ? `${((d.success / d.total) * 100).toFixed(1)}%` : '0%';
    summaryRows.push([
      sttSup++,
      d.displayName,
      d.total,
      d.success,
      d.issue,
      d.noReport,
      d.cancelled,
      d.unupdated,
      rate
    ]);
  });

  summaryRows.push(['']);
  summaryRows.push(['3. CHI TIẾT CÁC DỰ ÁN SỰ CỐ / LỖI QC / TRỄ DEADLINE / HỦY (ISSUE AUDIT TABLE)']);
  summaryRows.push(['STT', 'Mã dự án', 'Hạng mục', 'CAT', 'Brand', 'Tên cửa hàng', 'Lịch lắp đặt', 'Ngày hoàn thành', 'Status', 'Kết quả ><', 'Chi tiết Issue / Ghi chú', 'Supplier']);

  if (issueRows.length === 0) {
    summaryRows.push(['-', 'Không có dự án phát sinh lỗi QC Fail hoặc trễ deadline trong kỳ báo cáo này', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
  } else {
    issueRows.forEach(row => summaryRows.push(row));
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 8 },  // STT
    { wch: 18 }, // Mã DA
    { wch: 22 }, // Hạng mục
    { wch: 12 }, // CAT
    { wch: 16 }, // Brand
    { wch: 28 }, // Store Name
    { wch: 20 }, // Lịch lắp
    { wch: 18 }, // Ngày HT
    { wch: 20 }, // Status
    { wch: 16 }, // Kết quả ><
    { wch: 35 }, // Issue Note
    { wch: 18 }  // Supplier
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY & SUPPLIERS');

  // ==========================================
  // TAB 2: RAW DATA
  // ==========================================
  const rawHeaders = [
    'STT', 'Mã dự án', 'Tên dự án', 'Mã Ngành hàng', 'Ngành hàng CAT', 'Mã nhãn hàng', 'Tên nhãn hàng',
    'Số lượng Asset', 'Vùng', 'Customer', 'Mã cửa hàng', 'Tên cửa hàng', 'Hạng mục', 'Size',
    'Supplier Name', 'Supplier Email', 'Agency Contact', 'POSM QC Technician', 'Dự kiến từ ngày',
    'Dự kiến đến ngày', 'Actual Time', 'Completion time', 'Status', 'Kết quả ><', 'Warranty', 'Note'
  ];

  const rawRows: (string | number)[][] = [
    ['RAW DATA CHI TIẾT DỮ LIỆU LẮP ĐẶT POSM (UPDATE TRACKING INSTALLATION)'],
    [`Kỳ báo cáo: ${periodText} | Tổng số ca: ${totalCount} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    rawHeaders
  ];

  items.forEach((item, idx) => {
    const res = calculateInstallationResult(item.actualTime, item.completionTime, item.status, item.resultSign);
    const statusLower = (item.status || '').toLowerCase().trim();
    const isQCFailed = statusLower.includes('installation qc failed') || statusLower.includes('qc failed') || statusLower.includes('failed') || statusLower.includes('lỗi');
    
    let resultSignText = '—';
    if (res.sign === '✔') {
      resultSignText = '✔ Pass';
    } else if (res.sign === '❌' || isQCFailed) {
      resultSignText = res.failReason === 'LATE' ? '❌ Trễ hạn' : res.failReason === 'QC_FAIL' ? '❌ QC Fail' : '❌ Fail';
    }

    rawRows.push([
      idx + 1,
      item.projectCode || '-',
      item.projectName || '-',
      item.categoryCode || '-',
      item.catName || '-',
      item.brandCode || '-',
      item.brandName || '-',
      item.qtyPerAsset || '1',
      item.region || '-',
      item.customer || '-',
      item.storeCode || '-',
      item.storeName || '-',
      item.item || '-',
      item.size || '-',
      item.supplierName || '-',
      item.supplierEmail || '-',
      item.agencyContact || '-',
      item.technician || '-',
      item.plannedStartDate || '-',
      item.plannedEndDate || '-',
      item.actualTime || '-',
      item.completionTime || '-',
      item.status || '-',
      resultSignText,
      item.warranty || '-',
      item.note || '-'
    ]);
  });

  const wsRaw = XLSX.utils.aoa_to_sheet(rawRows);
  wsRaw['!cols'] = rawHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsRaw, 'RAW DATA');

  // Export File
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
};
