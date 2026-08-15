import * as XLSX from 'xlsx';
import type { RawRequestRecord } from '@/services/sheetSyncService';
import type { WarrantyItem } from '@/types/warranty';

/**
 * Service xuất Báo Cáo Bảo Hành 3-Tab BI Architecture (.xlsx 3-Sheet Workbook)
 * TAB 1: Warranty Analytics (Báo Cáo Phân Tích Tổng Quan)
 * TAB 2: Analyst Drilldown Detail (Chi tiết dẫn chứng cho các mục Báo cáo)
 * TAB 3: Checklist Bảo Hành (Dữ liệu thô 100% ca bảo hành)
 */
export const exportAnalystExecutiveReport = (
  _requests: RawRequestRecord[],
  warrantyItems: WarrantyItem[],
  filenamePrefix = 'POSM_Warranty_Executive_Report',
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

  const totalWarranty = activeItems.length;
  const finalFilename = isFilteredByProject
    ? `POSM_Warranty_Report_Project_${cleanProjectCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : filenamePrefix;

  // ==========================================
  // TAB 1: Warranty Analytics (Báo Cáo Phân Tích Tổng Quan)
  // ==========================================
  const wSupplierMap: Record<string, { total: number; done: number; overdue: number }> = {};
  const posmTypeMap: Record<string, number> = {};
  const projectMap: Record<string, { count: number; supplierMap: Record<string, number>; itemIds: string[] }> = {};

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

  activeItems.forEach(item => {
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
    if (!projectMap[prj]) projectMap[prj] = { count: 0, supplierMap: {}, itemIds: [] };
    projectMap[prj].count++;
    projectMap[prj].supplierMap[sup] = (projectMap[prj].supplierMap[sup] || 0) + 1;
    projectMap[prj].itemIds.push(item.requestId || `BH-${item.rowId}`);

    // Tuổi thọ POSM trước khi hỏng & Mốc Thời Hạn Xử Lý (Cột T Deadline từ Mer View 2026 làm mốc chính)
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate);
    const pExp = parseDateToMs(item.requestDeadline || item.expectedDate);

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

    // Đánh giá Trễ thời hạn cam kết
    const pComp = parseDateToMs(item.completedDate);
    let isOverdue = false;

    if (isDone && pComp && pExp && pComp > pExp) {
      isOverdue = true;
    } else if (!isDone && pExp && Date.now() > pExp) {
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

  // Recurrent Warranty Analysis Engine
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
  activeItems.forEach(item => {
    const precId = (item.precedingRequestId || (item as any).preceding_request_id || '').trim();
    const currentReqId = (item.requestId || `BH-${item.rowId}`).trim();
    if (precId && currentReqId && precId !== currentReqId) {
      parentChildMap.set(currentReqId, precId);
    }
  });

  activeItems.forEach(item => {
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

  const reportHeaderTitle = isFilteredByProject
    ? `BÁO CÁO CHI TIẾT BẢO HÀNH & ĐỘ BỀN POSM - DỰ ÁN ${cleanProjectCode}`
    : 'BÁO CÁO CHI TIẾT BẢO HÀNH & ĐỘ BỀN THIẾT BỊ (WARRANTY ANALYTICS)';

  const warrantyAnalyticsRows: (string | number)[][] = [
    [reportHeaderTitle],
    [`Mã Dự Án: ${isFilteredByProject ? cleanProjectCode : 'Tất cả dự án'} | Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Tổng số ca bảo hành: ${totalWarranty} ca`],
    [''],
    ['1. KPIS TỔNG QUAN BẢO HÀNH DỰ ÁN'],
    ['Chỉ Số', 'Giá Trị', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Ca Bảo Hành (BaoHanh_Model)', totalWarranty, '100%', 'Tất cả các ca sự cố ghi nhận'],
    ['Ca Đang Tiếp Nhận / Xử Lý', activeCount, totalWarranty > 0 ? `${((activeCount / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đang làm việc với Supplier'],
    ['Ca Đã Hoàn Thành Nghiệm Thu', doneCount, totalWarranty > 0 ? `${((doneCount / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đã khắc phục xong'],
    ['Tuổi Thọ POSM Trung Bình Trước Khi Hỏng', avgMTBF, 'Ngày', 'Tính trên các ca có Ngày Lắp Đặt'],
    [''],
    ['2. CẢNH BÁO CA BẢO HÀNH TỒN ĐỌNG (QUÁ HẠN XỬ LÝ)'],
    ['Mức Độ Tồn Đọng Quá Hạn', 'Số Lượng Ca', 'Tỷ Lệ %', 'Hướng Dẫn Xem Chi Tiết Bằng Chứng'],
    ['Quá hạn 1 - 7 ngày', aging1to7, totalWarranty > 0 ? `${((aging1to7 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Xem chi tiết danh sách ca trễ tại Tab 2 (Mục 2)'],
    ['Quá hạn 8 - 14 ngày', aging8to14, totalWarranty > 0 ? `${((aging8to14 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Xem chi tiết danh sách ca trễ tại Tab 2 (Mục 2)'],
    ['Quá hạn > 14 ngày (Cảnh báo đỏ)', agingOver14, totalWarranty > 0 ? `${((agingOver14 / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Vi phạm thời hạn nghiêm trọng - Xem Tab 2 (Mục 2)'],
    ['TỔNG CA QUÁ HẠN TỒN ĐỌNG', aging1to7 + aging8to14 + agingOver14, totalWarranty > 0 ? `${(((aging1to7 + aging8to14 + agingOver14) / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Cần đôn đốc xử lý gấp'],
    [''],
    ['3. PHÂN LOẠI TUỔI THỌ POSM TRƯỚC KHI HỎNG (ĐỘ BỀN THIẾT BỊ)'],
    ['Khoảng Thời Gian Tuổi Thọ', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Đánh Giá Chất Lượng & Dẫn Chứng'],
    ['Hỏng sớm < 30 ngày từ khi lắp đặt', earlyFail, totalWarranty > 0 ? `${((earlyFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Thi công ẩu / Vật tư kém - Xem danh sách Tab 2 (Mục 3)'],
    ['Sự cố từ 30 - 90 ngày (1 - 3 tháng)', midFail, totalWarranty > 0 ? `${((midFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Hao mòn tự nhiên'],
    ['Độ bền tốt > 90 ngày (> 3 tháng)', longFail, totalWarranty > 0 ? `${((longFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Đạt tiêu chuẩn chất lượng'],
    ['Chưa ghi nhận ngày lắp đặt POSM', unrecordedFail, totalWarranty > 0 ? `${((unrecordedFail / totalWarranty) * 100).toFixed(1)}%` : '0%', 'Thiếu dữ liệu ngày lắp'],
    [''],
    ['4. BÁO CÁO SỰ CỐ BẢO HÀNH LẶP LẠI (SỰ CỐ TÁI HỎNG)'],
    ['Chỉ Số Tái Hỏng', 'Số Lượng', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Vị Trí POSM Theo Dõi', totalPosmLocations, '100%', 'Số nhóm vị trí POSM duy nhất'],
    ['Số Vị Trí POSM Bị Sự Cố Lặp (>= 2 lần)', recurrentPosmCount, recurrentRatePct, 'Xem chi tiết các vị trí tại Tab 2 (Mục 4)'],
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
  warrantyAnalyticsRows.push(['5. TOP DỰ ÁN PHÁT SINH LỖI NHIỀU NHẤT (>= 2 CA SỰ CỐ)']);
  warrantyAnalyticsRows.push(['Mã Dự Án (Project Code)', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Nhà Thầu Phụ Trách & Phân Bổ Ca (Supplier Breakdown)', 'Danh Sách Mã Request Dẫn Chứng']);

  const topProjectsList = Object.entries(projectMap)
    .filter(([_, data]) => isFilteredByProject || data.count > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (topProjectsList.length === 0) {
    warrantyAnalyticsRows.push(['Không có dự án phát sinh ca bảo hành', 0, '0%', 'N/A', 'N/A']);
  } else {
    topProjectsList.forEach(([projectCode, data]) => {
      const supplierBreakdown = Object.entries(data.supplierMap)
        .sort((a, b) => b[1] - a[1])
        .map(([supName, count]) => `${supName} (${count} ca)`)
        .join(', ');

      const pct = totalWarranty > 0 ? `${((data.count / totalWarranty) * 100).toFixed(1)}%` : '0%';
      const reqIdSample = data.itemIds.slice(0, 5).join(', ') + (data.itemIds.length > 5 ? ` ... (+${data.itemIds.length - 5} ca)` : '');
      warrantyAnalyticsRows.push([projectCode, data.count, pct, supplierBreakdown || 'Chưa gán thầu', reqIdSample]);
    });
  }

  warrantyAnalyticsRows.push(['']);
  warrantyAnalyticsRows.push(['6. BÁO CÁO TỶ LỆ HOÀN THÀNH ĐÚNG HẠN CỦA NHÀ THẦU']);
  warrantyAnalyticsRows.push(['Nhà Thầu (Supplier)', 'Tổng Ca Bảo Hành', 'Đã Nghiệm Thu Đúng Hạn', 'Trễ Thời Hạn Xử Lý', 'Tỷ Lệ Đúng Hạn (%)', 'Ghi Chú Dẫn Chứng']);

  Object.entries(wSupplierMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([supName, data]) => {
      const compliant = data.total - data.overdue;
      const rate = data.total > 0 ? `${((compliant / data.total) * 100).toFixed(1)}%` : '100%';
      const note = data.overdue > 0 ? `Có ${data.overdue} ca trễ hạn - Xem chi tiết tại Tab 2 (Mục 6)` : 'Đạt 100% đúng hạn';
      warrantyAnalyticsRows.push([supName, data.total, compliant, data.overdue, rate, note]);
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
    { wch: 55 },
    { wch: 35 },
    { wch: 20 },
    { wch: 45 }
  ];

  // Only append Warranty Analytics tab for Consolidated All-Projects Executive Export
  if (!isFilteredByProject) {
    XLSX.utils.book_append_sheet(wb, wsWarrantyAnalytics, 'Warranty Analytics');
  }

  // Helper to extract true Raise Mail date (actual email timestamp to supplier)
  const getRaiseMailDate = (item: WarrantyItem): string => {
    if (item.raiseMailTime && item.raiseMailTime.trim() && item.raiseMailTime.trim() !== '-' && item.raiseMailTime.trim().toLowerCase() !== 'null' && item.raiseMailTime.trim().toLowerCase() !== 'undefined') {
      return item.raiseMailTime.trim();
    }
    if ((item as any).raiseMailTime && String((item as any).raiseMailTime).trim()) {
      return String((item as any).raiseMailTime).trim();
    }
    if ((item as any).raise_mail_time && String((item as any).raise_mail_time).trim()) {
      return String((item as any).raise_mail_time).trim();
    }
    return item.sentDate || '-';
  };

  // ==========================================
  // TAB: Analyst Drilldown Detail (Chi Tiết Dẫn Chứng Cho Các Mục Báo Cáo)
  // ==========================================
  const drilldownHeaderTitle = isFilteredByProject
    ? `BÁO CÁO DẪN CHỨNG CHI TIẾT CA BẢO HÀNH DỰ ÁN ${cleanProjectCode}`
    : 'BÁO CÁO DẪN CHỨNG CHI TIẾT CHO CÁC MỤC BẢO HÀNH (ANALYST DRILLDOWN DETAIL)';

  const drilldownRows: (string | number)[][] = [
    [drilldownHeaderTitle],
    [`Mã Dự Án: ${isFilteredByProject ? cleanProjectCode : 'Tất cả dự án'} | Ngày khởi tạo: ${new Date().toLocaleString('vi-VN')} | Tổng số ca: ${totalWarranty} ca`],
    ['']
  ];

  // 1. CHI TIẾT CÁC CA BẢO HÀNH TỒN ĐỌNG QUÁ HẠN XỬ LÝ
  let sttA = 1;
  const overdueRows: (string | number)[][] = [];
  activeItems.forEach(item => {
    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành') || pLower.includes('cancel');
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    
    if (!isDone && pExp && Date.now() > pExp) {
      const overdueDays = Math.ceil((Date.now() - pExp) / (1000 * 60 * 60 * 24));
      let bucket = 'Quá hạn 1 - 7 ngày';
      if (overdueDays >= 8 && overdueDays <= 14) bucket = 'Quá hạn 8 - 14 ngày';
      else if (overdueDays > 14) bucket = 'Quá hạn > 14 ngày (Cảnh báo đỏ)';

      overdueRows.push([
        sttA++,
        item.requestId || `BH-${item.rowId}`,
        item.projectCode || '-',
        item.storeName || '-',
        item.storeCode || '-',
        item.supplier || 'Chưa gán thầu',
        item.posmType || '-',
        getRaiseMailDate(item),
        item.requestDeadline || item.expectedDate || '-',
        `${overdueDays} ngày`,
        bucket,
        item.progress || 'Not started',
        item.errorDetail || '-'
      ]);
    }
  });

  if (!isFilteredByProject || overdueRows.length > 0) {
    drilldownRows.push(['CHI TIẾT CÁC CA BẢO HÀNH TỒN ĐỌNG QUÁ HẠN XỬ LÝ']);
    drilldownRows.push(['STT', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Raise Mail', 'Hạn Cần Xử Lý', 'Số Ngày Quá Hạn', 'Mức Độ Tồn Đọng', 'Tiến Độ Vận Hành', 'Ghi Chú Lỗi']);
    if (overdueRows.length > 0) {
      drilldownRows.push(...overdueRows);
    } else {
      drilldownRows.push(['-', 'Không có ca tồn đọng quá hạn', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
    }
    drilldownRows.push(['']);
  }

  // 2. CHI TIẾT CÁC CA HỎNG SỚM (< 30 NGÀY TỪ KHI LẮP ĐẶT)
  drilldownRows.push(['CHI TIẾT CÁC CA HỎNG SỚM (< 30 NGÀY TỪ KHI LẮP ĐẶT)']);
  drilldownRows.push(['STT', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Lắp Đặt POSM', 'Ngày Raise Mail', 'Tuổi Thọ (Số Ngày)', 'Ghi Chú Lỗi']);

  let sttB = 1;
  activeItems.forEach(item => {
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(getRaiseMailDate(item));
    if (pInst) {
      const diffDays = pSent ? Math.abs(Math.round((pSent - pInst) / (1000 * 60 * 60 * 24))) : 0;
      if (diffDays < 30) {
        drilldownRows.push([
          sttB++,
          item.requestId || `BH-${item.rowId}`,
          item.projectCode || '-',
          item.storeName || '-',
          item.storeCode || '-',
          item.supplier || 'Chưa gán thầu',
          item.posmType || '-',
          item.installationDate || '-',
          getRaiseMailDate(item),
          `${diffDays} ngày`,
          item.errorDetail || '-'
        ]);
      }
    }
  });
  if (sttB === 1) {
    drilldownRows.push(['-', 'Không có ca hỏng sớm dưới 30 ngày', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
  }

  drilldownRows.push(['']);

  // 3. CHI TIẾT VỊ TRÍ POSM BỊ SỰ CỐ LẶP LẠI (>= 2 LẦN)
  drilldownRows.push(['CHI TIẾT VỊ TRÍ POSM BỊ SỰ CỐ LẶP LẠI (>= 2 LẦN)']);
  drilldownRows.push(['STT', 'Tên Cửa Hàng / Store Name', 'Mã Store', 'Mã Dự Án', 'Loại POSM', 'Brand', 'Nhà Thầu Supplier', 'Số Lần Lặp', 'Danh Sách Mã Request ID Bị Lặp']);

  let sttC = 1;
  recurrentGroups.forEach(grp => {
    const reqIdList = grp.incidents.map(i => i.requestId).join(', ');
    drilldownRows.push([
      sttC++,
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
  if (sttC === 1) {
    drilldownRows.push(['-', 'Không có vị trí POSM bị hỏng lặp lại', '-', '-', '-', '-', '-', '-', '-']);
  }

  drilldownRows.push(['']);

  // 4. CHI TIẾT CÁC CA SỰ CỐ THUỘC DỰ ÁN
  const section4Title = isFilteredByProject
    ? `CHI TIẾT CÁC CA SỰ CỐ THUỘC DỰ ÁN`
    : `CHI TIẾT CÁC CA SỰ CỐ THUỘC TOP DỰ ÁN LỖI NHIỀU NHẤT`;

  drilldownRows.push([section4Title]);
  drilldownRows.push(['STT', 'Mã Dự Án', 'Mã Request ID', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Lắp Đặt', 'Ngày Raise Mail', 'Hạn Cần Xử Lý', 'Ngày Hoàn Thành', 'Tiến Độ Vận Hành', 'Lỗi Chi Tiết']);

  let sttD = 1;
  if (isFilteredByProject) {
    activeItems.forEach(item => {
      const prj = item.projectCode?.trim() || 'Chưa gán mã dự án';
      drilldownRows.push([
        sttD++,
        prj,
        item.requestId || `BH-${item.rowId}`,
        item.storeName || '-',
        item.storeCode || '-',
        item.supplier || 'Chưa gán thầu',
        item.posmType || '-',
        item.installationDate || '-',
        getRaiseMailDate(item),
        item.requestDeadline || item.expectedDate || '-',
        item.completedDate || '-',
        item.progress || 'Not started',
        item.errorDetail || '-'
      ]);
    });
  } else {
    const topProjectCodes = topProjectsList.map(([p]) => p);
    topProjectCodes.forEach(targetProjCode => {
      activeItems.forEach(item => {
        const prj = item.projectCode?.trim() || 'Chưa gán mã dự án';
        if (prj.toLowerCase() === targetProjCode.toLowerCase()) {
          drilldownRows.push([
            sttD++,
            prj,
            item.requestId || `BH-${item.rowId}`,
            item.storeName || '-',
            item.storeCode || '-',
            item.supplier || 'Chưa gán thầu',
            item.posmType || '-',
            item.installationDate || '-',
            getRaiseMailDate(item),
            item.requestDeadline || item.expectedDate || '-',
            item.completedDate || '-',
            item.progress || 'Not started',
            item.errorDetail || '-'
          ]);
        }
      });
    });
  }

  if (sttD === 1) {
    drilldownRows.push(['-', 'Không có dữ liệu sự cố thuộc Dự Án', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
  }

  drilldownRows.push(['']);

  // 5. CHI TIẾT CÁC CA TRỄ THỜI HẠN XỬ LÝ CỦA NHÀ THẦU
  drilldownRows.push(['CHI TIẾT CÁC CA TRỄ THỜI HẠN XỬ LÝ CỦA NHÀ THẦU']);
  drilldownRows.push(['STT', 'Nhà Thầu Supplier', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Loại POSM', 'Hạn Cần Xử Lý', 'Ngày Hoàn Thành Thực Tế', 'Số Ngày Trễ', 'Tiến Độ Vận Hành']);

  let sttE = 1;
  activeItems.forEach(item => {
    const pLower = (item.progress || '').toLowerCase();
    const isDone = pLower.includes('hoàn thành');
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);
    
    let isOverdue = false;
    let overdueDays = 0;

    if (isDone && pComp && pExp && pComp > pExp) {
      isOverdue = true;
      overdueDays = Math.ceil((pComp - pExp) / (1000 * 60 * 60 * 24));
    } else if (!isDone && pExp && Date.now() > pExp) {
      isOverdue = true;
      overdueDays = Math.ceil((Date.now() - pExp) / (1000 * 60 * 60 * 24));
    }

    if (isOverdue) {
      drilldownRows.push([
        sttE++,
        item.supplier || 'Chưa gán thầu',
        item.requestId || `BH-${item.rowId}`,
        item.projectCode || '-',
        item.storeName || '-',
        item.storeCode || '-',
        item.posmType || '-',
        item.requestDeadline || item.expectedDate || '-',
        item.completedDate || (isDone ? 'Đã xong' : 'Chưa xong'),
        `${overdueDays} ngày`,
        item.progress || 'Not started'
      ]);
    }
  });
  if (sttE === 1) {
    drilldownRows.push(['-', 'Không có nhà thầu trễ thời hạn xử lý', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
  }

  const wsDrilldown = XLSX.utils.aoa_to_sheet(drilldownRows);
  wsDrilldown['!cols'] = [
    { wch: 8 },  // STT
    { wch: 18 }, // Mã Request / Mã Dự Án
    { wch: 18 }, // Mã Request ID / Mã Dự Án
    { wch: 28 }, // Store Name
    { wch: 16 }, // Store Code
    { wch: 22 }, // Supplier
    { wch: 22 }, // POSM Type
    { wch: 16 }, // Ngày Lắp Đặt
    { wch: 18 }, // Ngày Raise Mail
    { wch: 16 }, // Hạn Cần Xử Lý
    { wch: 18 }, // Ngày Hoàn Thành
    { wch: 22 }, // Tiến Độ Vận Hành
    { wch: 45 }, // Lỗi Chi Tiết / Ghi Chú Lỗi
    { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDrilldown, 'Analyst Drilldown Detail');

  // ==========================================
  // TAB 3: Checklist Bảo Hành (Operational Raw Data 100%)
  // ==========================================
  const checklistHeaderTitle = isFilteredByProject
    ? `CHECKLIST BẢO HÀNH CHI TIẾT DỰ ÁN ${cleanProjectCode}`
    : 'CHECKLIST CHI TIẾT 100% CA BẢO HÀNH POSM (WARRANTY OPERATIONAL CHECKLIST)';

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
    'Ngày Raise Mail',
    'Hạn Cần Xử Lý (Deadline)',
    'Ngày Xử Lý Dự Kiến',
    'Ngày Hoàn Thành Thực Tế',
    'Phân Loại Tuổi Thọ POSM',
    'Trạng Thái Thời Hạn Xử Lý',
    'Tiến Độ Vận Hành',
    'Ca Bảo Hành Lần Trước (Mã Lặp)',
    'Ghi Chú (Notes)'
  ];

  const checklistRows: (string | number)[][] = [
    [checklistHeaderTitle],
    [`Mã Dự Án: ${isFilteredByProject ? cleanProjectCode : 'Tất cả dự án'} | Tổng số ca bảo hành: ${totalWarranty} ca | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    checklistHeader
  ];

  activeItems.forEach((item, idx) => {
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(getRaiseMailDate(item));
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);

    // Phân loại tuổi thọ POSM
    let mtbfCategory = 'Chưa ghi nhận ngày lắp';
    if (pInst) {
      const diffDays = pSent ? Math.abs(Math.round((pSent - pInst) / (1000 * 60 * 60 * 24))) : 0;
      if (diffDays < 30) mtbfCategory = `Hỏng sớm (${diffDays} ngày)`;
      else if (diffDays <= 90) mtbfCategory = `Sự cố 1-3 tháng (${diffDays} ngày)`;
      else mtbfCategory = `Độ bền tốt (${diffDays} ngày)`;
    }

    // Trạng thái Thời hạn Cam kết
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
      getRaiseMailDate(item),
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
  XLSX.writeFile(wb, `${finalFilename}_${dateStr}.xlsx`);
};

// Helper parsing date string to ms
const parseDateToMs = (str?: string): number | null => {
  if (!str || !str.trim()) return null;
  const trimmed = str.trim();
  if (trimmed === '-' || trimmed.toLowerCase().includes('không tìm') || trimmed.toLowerCase().includes('data 2025')) {
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
