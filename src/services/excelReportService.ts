import * as XLSX from 'xlsx';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import type { WarrantyItem } from '@/types/warranty';

/**
 * Service xuất Báo Cáo Bảo Hành & Checklist Chi Tiết Ca Bảo Hành (.xlsx 2-Sheet Workbook)
 */
export const exportAnalystExecutiveReport = (
  _requests: RawRequestRecord[],
  warrantyItems: WarrantyItem[],
  filenamePrefix = 'POSM_Warranty_Executive_Report'
) => {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);
  const totalWarranty = warrantyItems.length;

  // ==========================================
  // TAB 1: Warranty Analytics (Báo Cáo Phân Tích Tổng Quan)
  // ==========================================
  const wSupplierMap: Record<string, { total: number; done: number; overdue: number }> = {};
  const posmTypeMap: Record<string, number> = {};
  const projectMap: Record<string, { count: number; supplierMap: Record<string, number> }> = {};

  let earlyFail = 0;
  let midFail = 0;
  let longFail = 0;
  let unrecordedFail = 0;

  let aging1to7 = 0;
  let aging8to14 = 0;
  let agingOver14 = 0;
  let doneCount = 0;
  let activeCount = 0;

  let totalDaysToFail = 0;
  let countFailDate = 0;

  warrantyItems.forEach(item => {
    const sup = item.supplier?.trim() || 'Chưa gán thầu';
    if (!wSupplierMap[sup]) wSupplierMap[sup] = { total: 0, done: 0, overdue: 0 };
    wSupplierMap[sup].total++;

    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành');
    if (isDone) {
      doneCount++;
      wSupplierMap[sup].done++;
    } else if (!pLower.includes('cancel')) {
      activeCount++;
    }

    // POSM Type
    const posm = item.posmType?.trim() || 'POSM Khác';
    posmTypeMap[posm] = (posmTypeMap[posm] || 0) + 1;

    // Project Code Breakdown
    const prj = item.projectCode?.trim() || 'Chưa gán mã dự án';
    if (!projectMap[prj]) projectMap[prj] = { count: 0, supplierMap: {} };
    projectMap[prj].count++;
    projectMap[prj].supplierMap[sup] = (projectMap[prj].supplierMap[sup] || 0) + 1;

    // MTBF
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate);
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);

    if (pInst) {
      const diff = pSent ? Math.abs(Math.round((pSent - pInst) / (1000 * 60 * 60 * 24))) : 0;
      totalDaysToFail += diff;
      countFailDate++;
      if (diff < 30) earlyFail++;
      else if (diff <= 90) midFail++;
      else longFail++;
    } else {
      unrecordedFail++;
    }

    // Overdue / Aging & SLA Violated calculation
    const pComp = parseDateToMs(item.completedDate);
    let isOverdue = false;

    if (isDone && pComp && pExp && pComp > pExp) {
      // Đã hoàn thành nhưng nghiệm thu trễ deadline
      isOverdue = true;
    } else if (!isDone && pExp && Date.now() > pExp) {
      // Đang xử lý nhưng đã quá deadline
      isOverdue = true;
    }

    if (isOverdue) {
      wSupplierMap[sup].overdue++;
      if (!isDone && pExp) {
        const overdueDays = Math.ceil((Date.now() - pExp) / (1000 * 60 * 60 * 24));
        if (overdueDays >= 1 && overdueDays <= 7) aging1to7++;
        else if (overdueDays >= 8 && overdueDays <= 14) aging8to14++;
        else if (overdueDays > 14) agingOver14++;
      }
    }
  });

  const avgMTBF = countFailDate > 0 ? Math.round(totalDaysToFail / countFailDate) : 0;

  // ==========================================
  // Recurrent Warranty Analysis Engine
  // ==========================================
  const groupMap = new Map<string, {
    key: string;
    storeName: string;
    storeCode: string;
    projectCode: string;
    posm: string;
    brand: string;
    supplier: string;
    incidents: Array<{ requestId: string; sentDate: string; progress: string }>;
  }>();

  const parentChildMap = new Map<string, string>();
  warrantyItems.forEach(item => {
    const precId = (item.precedingRequestId || (item as any).preceding_request_id || '').trim();
    const currentReqId = (item.requestId || `BH-${item.rowId}`).trim();
    if (precId && currentReqId && precId !== currentReqId) {
      parentChildMap.set(currentReqId, precId);
    }
  });

  warrantyItems.forEach(item => {
    const currentReqId = (item.requestId || `BH-${item.rowId}`).trim();
    const storeKey = item.storeCode?.trim() || item.storeName?.trim() || 'STORE_UNKNOWN';
    const posmKey = item.posmType?.trim() || 'POSM_UNKNOWN';
    const brandKey = item.brand?.trim() || item.category?.trim() || 'BRAND_UNKNOWN';
    const projectKey = item.projectCode?.trim() || '';

    let compositeKey = '';
    if (parentChildMap.has(currentReqId)) {
      const parentId = parentChildMap.get(currentReqId)!;
      compositeKey = `PREC_PARENT__${parentId}`;
    } else if (Array.from(parentChildMap.values()).includes(currentReqId)) {
      compositeKey = `PREC_PARENT__${currentReqId}`;
    } else if (projectKey) {
      compositeKey = `${storeKey}__PROJ__${projectKey}`;
    } else {
      compositeKey = `${storeKey}__${posmKey}__${brandKey}`;
    }

    if (!groupMap.has(compositeKey)) {
      groupMap.set(compositeKey, {
        key: compositeKey,
        storeName: item.storeName || '-',
        storeCode: item.storeCode || '-',
        projectCode: item.projectCode || '-',
        posm: item.posmType || '-',
        brand: item.brand || item.category || '-',
        supplier: item.supplier || 'Chưa gán thầu',
        incidents: []
      });
    }

    const grp = groupMap.get(compositeKey)!;
    grp.incidents.push({
      requestId: currentReqId,
      sentDate: item.sentDate || '-',
      progress: item.progress || 'Not started'
    });
  });

  const recurrentGroups = Array.from(groupMap.values())
    .filter(g => g.incidents.length > 1)
    .sort((a, b) => b.incidents.length - a.incidents.length);

  const totalPosmLocations = groupMap.size;
  const recurrentPosmCount = recurrentGroups.length;
  const recurrentRatePct = totalPosmLocations > 0 ? `${((recurrentPosmCount / totalPosmLocations) * 100).toFixed(1)}%` : '0%';

  const warrantyAnalyticsRows: (string | number)[][] = [
    ['BÁO CÁO CHI TIẾT BẢO HÀNH & ĐỘ BỀN THIẾT BỊ (WARRANTY ANALYTICS)'],
    [`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    ['1. KPIS TỔNG QUAN BẢO HÀNH'],
    ['Chỉ Số', 'Giá Trị', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Ca Bảo Hành (BaoHanh_Model)', totalWarranty, '100%', 'Tất cả các ca sự cố ghi nhận'],
    ['Ca Đang Tiếp Nhận / Xử Lý', activeCount, totalWarranty > 0 ? `${((activeCount / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đang làm việc với Supplier'],
    ['Ca Đã Hoàn Thành Nghiệm Thu', doneCount, totalWarranty > 0 ? `${((doneCount / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đã khắc phục xong'],
    ['Tuổi Thọ POSM Trung Bình (MTBF)', avgMTBF, 'Ngày', 'Tính trên các ca có Ngày Lắp Đặt'],
    [''],
    ['2. CẢNH BÁO CA BẢO HÀNH TỒN ĐỌNG (BACKLOG AGING BUCKETS)'],
    ['Mức Độ Tồn Đọng / Overdue', 'Số Lượng Ca', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Quá hạn 1 - 7 ngày', aging1to7, totalWarranty > 0 ? `${((aging1to7 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Cần nhắc nhở nhà thầu'],
    ['Quá hạn 8 - 14 ngày', aging8to14, totalWarranty > 0 ? `${((aging8to14 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Cảnh báo chậm tiến độ'],
    ['Quá hạn > 14 ngày (Cảnh báo đỏ)', agingOver14, totalWarranty > 0 ? `${((agingOver14 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Vi phạm SLA nghiêm trọng'],
    ['TỔNG CA QUÁ HẠN TỒN ĐỌNG', aging1to7 + aging8to14 + agingOver14, totalWarranty > 0 ? `${(((aging1to7 + aging8to14 + agingOver14) / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Cần đôn đốc xử lý gấp'],
    [''],
    ['3. PHÂN TỔNG TUỔI THỌ POSM TRƯỚC KHI HỎNG (MTBF BREAKDOWN)'],
    ['Khoảng Thời Gian', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Đánh Giá Chất Lượng'],
    ['Hỏng sớm < 30 ngày từ khi lắp đặt', earlyFail, totalWarranty > 0 ? `${((earlyFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Thi công ẩu / Vật tư kém'],
    ['Sự cố từ 30 - 90 ngày (1 - 3 tháng)', midFail, totalWarranty > 0 ? `${((midFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Hao mòn tự nhiên'],
    ['Độ bền tốt > 90 ngày (> 3 tháng)', longFail, totalWarranty > 0 ? `${((longFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đạt tiêu chuẩn chất lượng'],
    ['Chưa ghi nhận ngày lắp đặt POSM', unrecordedFail, totalWarranty > 0 ? `${((unrecordedFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Thiếu dữ liệu ngày lắp'],
    [''],
    ['4. BÁO CÁO SỰ CỐ BẢO HÀNH LẶP LẠI (RECURRENT WARRANTY & TÁI HỎNG POSM)'],
    ['Chỉ Số Tái Hỏng', 'Số Lượng', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Vị Trí POSM Theo Dõi', totalPosmLocations, '100%', 'Số nhóm vị trí POSM duy nhất'],
    ['Số Vị Trí POSM Bị Sự Cố Lặp (>= 2 lần)', recurrentPosmCount, recurrentRatePct, 'Số vị trí POSM hỏng tái diễn'],
    ['Tỷ Lệ Tái Hỏng POSM Theo Vị Trí', recurrentRatePct, recurrentRatePct, 'Tỷ lệ tái hỏng trên tổng vị trí'],
    [''],
    ['DANH SÁCH TOP POSM BỊ SỰ CỐ BẢO HÀNH LẶP LẠI (>= 2 LẦN)'],
    ['Tên Siêu Thị / Store Name', 'Mã Store', 'Mã Dự Án', 'Loại POSM', 'Brand', 'Nhà Thầu Supplier', 'Số Lần Bảo Hành Lặp', 'Danh Sách Mã Request ID Bị Lặp']
  ];

  recurrentGroups.forEach(grp => {
    const reqIdList = grp.incidents.map(i => i.requestId).join(', ');
    warrantyAnalyticsRows.push([
      grp.storeName,
      grp.storeCode,
      grp.projectCode,
      grp.posm,
      grp.brand,
      grp.supplier,
      grp.incidents.length,
      reqIdList
    ]);
  });

  warrantyAnalyticsRows.push(['']);
  warrantyAnalyticsRows.push(['5. TOP DỰ ÁN PHÁT SINH LỖI NHIỀU NHẤT']);
  warrantyAnalyticsRows.push(['Mã Dự Án (Project Code)', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Nhà Thầu Chính Phụ Trách (Top Supplier)']);

  Object.entries(projectMap)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([projectCode, data]) => {
      const topSup = Object.entries(data.supplierMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa gán thầu';
      const pct = totalWarranty > 0 ? `${((data.count / totalWarranty) * 100).toFixed(1)}%` : '0%';
      warrantyAnalyticsRows.push([projectCode, data.count, pct, topSup]);
    });

  warrantyAnalyticsRows.push(['']);
  warrantyAnalyticsRows.push(['6. BÁO CÁO TỶ LỆ ĐẠT SLA CỦA NHÀ THẦU BẢO HÀNH']);
  warrantyAnalyticsRows.push(['Nhà Thầu (Supplier)', 'Tổng Ca Bảo Hành', 'Đã Nghiệm Thu Đúng Hạn', 'Trễ Deadline (Vi Phạm SLA)', 'Tỷ Lệ Đúng Hạn (%)']);

  Object.entries(wSupplierMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([supName, data]) => {
      const compliant = data.total - data.overdue;
      const rate = data.total > 0 ? `${((compliant / data.total) * 100).toFixed(1)}%` : '100%';
      warrantyAnalyticsRows.push([supName, data.total, compliant, data.overdue, rate]);
    });

  warrantyAnalyticsRows.push(['']);
  warrantyAnalyticsRows.push(['7. TOP LOẠI POSM PHÁT SINH SỰ CỐ NHIỀU NHẤT']);
  warrantyAnalyticsRows.push(['Loại Thiết Bị POSM', 'Số Ca Sự Cố', 'Tỷ Lệ %']);

  Object.entries(posmTypeMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([posmName, count]) => {
      const pct = totalWarranty > 0 ? `${((count / totalWarranty) * 100).toFixed(1)}%` : '0%';
      warrantyAnalyticsRows.push([posmName, count, pct]);
    });

  const wsWarrantyAnalytics = XLSX.utils.aoa_to_sheet(warrantyAnalyticsRows);
  wsWarrantyAnalytics['!cols'] = [
    { wch: 38 },
    { wch: 18 },
    { wch: 22 },
    { wch: 32 },
    { wch: 22 },
    { wch: 20 },
    { wch: 45 }
  ];
  XLSX.utils.book_append_sheet(wb, wsWarrantyAnalytics, 'Warranty Analytics');

  // ==========================================
  // TAB 2: Checklist Bảo Hành (Operational Raw Data)
  // ==========================================
  const checklistHeader = [
    'STT / Row ID',
    'Mã Request (BH ID)',
    'Mã Dự Án',
    'Tên Cửa Hàng / Store Name',
    'Mã Store',
    'SR Phụ Trách',
    'VIS-Tech Unilever',
    'Loại POSM',
    'Brand / Ngành Hàng',
    'Nhà Thầu / Supplier',
    'Chi Tiết Sự Cố POSM',
    'Ngày Lắp Đặt POSM',
    'Ngày Yêu Cầu BH',
    'Hạn Cần Xử Lý (Deadline)',
    'Ngày Xử Lý Dự Kiến',
    'Ngày Hoàn Thành Thực Tế',
    'Phân Loại MTBF Tuổi Thọ',
    'Trạng Thái Trễ Deadline',
    'Tiến Độ Vận Hành',
    'Ca Bảo Hành Lần Trước (Mã Lặp)',
    'Ghi Chú (Notes)'
  ];

  const checklistRows: (string | number)[][] = [
    ['CHECKLIST CHI TIẾT 100% CA BẢO HÀNH POSM (WARRANTY OPERATIONAL CHECKLIST)'],
    [`Tổng số ca bảo hành: ${totalWarranty} ca | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    checklistHeader
  ];

  warrantyItems.forEach((item, idx) => {
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate);
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);

    // Phân loại MTBF
    let mtbfCategory = 'Chưa ghi nhận ngày lắp';
    if (pInst) {
      const diffDays = pSent ? Math.abs(Math.round((pSent - pInst) / (1000 * 60 * 60 * 24))) : 0;
      if (diffDays < 30) mtbfCategory = `Hỏng sớm (${diffDays} ngày)`;
      else if (diffDays <= 90) mtbfCategory = `Sự cố 1-3 tháng (${diffDays} ngày)`;
      else mtbfCategory = `Độ bền tốt (${diffDays} ngày)`;
    }

    // Trạng thái Trễ Deadline
    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành');
    let overdueStatus = 'Đang xử lý (Trong hạn)';

    if (isDone) {
      if (pComp && pExp && pComp > pExp) {
        const overdueDays = Math.ceil((pComp - pExp) / (1000 * 60 * 60 * 24));
        overdueStatus = `Hoàn thành trễ ${overdueDays} ngày`;
      } else {
        overdueStatus = 'Hoàn thành đúng hạn';
      }
    } else if (pExp && Date.now() > pExp) {
      const overdueDays = Math.ceil((Date.now() - pExp) / (1000 * 60 * 60 * 24));
      overdueStatus = `Quá hạn ${overdueDays} ngày`;
    } else {
      overdueStatus = 'Đang xử lý (Trong hạn)';
    }

    checklistRows.push([
      item.rowId || idx + 1,
      item.requestId || `BH-${item.rowId}`,
      item.projectCode || '-',
      item.storeName || '-',
      item.storeCode || '-',
      item.srName || '-',
      item.visTech || '-',
      item.posmType || '-',
      item.brand || item.category || '-',
      item.supplier || 'Chưa gán thầu',
      item.errorDetail || '-',
      item.installationDate || '-',
      item.sentDate || '-',
      item.requestDeadline || item.expectedDate || '-',
      item.expectedDate || '-',
      item.completedDate || '-',
      mtbfCategory,
      overdueStatus,
      item.progress || 'Not started',
      item.precedingRequestId || '-',
      item.note || '-'
    ]);
  });

  const wsChecklist = XLSX.utils.aoa_to_sheet(checklistRows);
  wsChecklist['!cols'] = [
    { wch: 14 }, // STT / Row ID
    { wch: 18 }, // Request ID
    { wch: 14 }, // Mã Dự Án
    { wch: 28 }, // Store Name
    { wch: 16 }, // Store Code
    { wch: 18 }, // SR
    { wch: 18 }, // VIS-Tech
    { wch: 22 }, // Loại POSM
    { wch: 16 }, // Brand
    { wch: 20 }, // Supplier
    { wch: 45 }, // Chi tiết lỗi
    { wch: 16 }, // Ngày lắp đặt
    { wch: 16 }, // Ngày yêu cầu
    { wch: 16 }, // Deadline
    { wch: 16 }, // Ngày hẹn dự kiến
    { wch: 16 }, // Ngày hoàn thành
    { wch: 28 }, // Phân loại MTBF
    { wch: 25 }, // Trạng thái overdue
    { wch: 22 }, // Tiến độ
    { wch: 22 }, // Ca lặp trước
    { wch: 35 }  // Ghi chú
  ];

  XLSX.utils.book_append_sheet(wb, wsChecklist, 'Checklist Bảo Hành');

  // Export File
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
};

// Helper parsing date string to ms
const parseDateToMs = (str?: string): number | null => {
  if (!str || !str.trim()) return null;
  const trimmed = str.trim();
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
