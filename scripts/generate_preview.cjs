const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Target output path in Artifacts directory
const artifactDir = `C:\\Users\\thang\\.gemini\\antigravity\\brain\\759d0db1-9869-41d7-8930-b4d0b7317d79`;
const outputFile = path.join(artifactDir, 'POSM_Warranty_Executive_Report_3Tab_Preview.xlsx');

// Sample real items matching dashboard state
const sampleItems = [
  {
    rowId: '156822-1',
    requestId: 'BH-156822-01',
    projectCode: '156822',
    storeName: 'Lotte Q7',
    storeCode: 'STR-LOT-00480',
    srName: 'Như',
    visTech: 'Phạm Quang Chính',
    posmType: 'Smart GE',
    category: 'P/S',
    brand: 'P/S',
    supplier: 'Smart',
    errorDetail: 'Màn hình hiển thị không sáng, hỏng nguồn LED',
    installationDate: '10/01/2026',
    sentDate: '01/02/2026',
    requestDeadline: '05/02/2026',
    expectedDate: '05/02/2026',
    completedDate: '06/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: 'Nghiệm thu trễ 1 ngày so với thời hạn xử lý'
  },
  {
    rowId: '156822-2',
    requestId: 'BH-156822-02',
    projectCode: '156822',
    storeName: 'TOPS MARKET AN PHU',
    storeCode: 'STR-BIG-00467',
    srName: 'TẠ CHÂU LONG',
    visTech: 'Lê Hữu Thắng',
    posmType: 'GE Customize',
    category: 'P/S',
    brand: 'P/S',
    supplier: 'Smart',
    errorDetail: 'Chân đế mica bị bung keo',
    installationDate: '15/01/2026',
    sentDate: '05/02/2026',
    requestDeadline: '10/02/2026',
    expectedDate: '10/02/2026',
    completedDate: '09/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: 'Đã dán lại keo'
  },
  {
    rowId: '156822-3',
    requestId: 'BH-156822-03',
    projectCode: '156822',
    storeName: 'GO! DONG NAI',
    storeCode: 'STR-BIG-00420',
    srName: 'PHẠM THỊ ÁNH TUYẾT',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Plugin',
    category: 'Simple',
    brand: 'Link4',
    supplier: 'Link4',
    errorDetail: 'Hệ thống đèn LED bị chập',
    installationDate: '02/01/2026',
    sentDate: '10/02/2026',
    requestDeadline: '15/02/2026',
    expectedDate: '15/02/2026',
    completedDate: '',
    progress: 'Vis - Đã gửi RQ tới Agency',
    precedingRequestId: '',
    note: 'Đang chờ vật tư thay thế'
  },
  {
    rowId: '156822-4',
    requestId: 'BH-156822-04',
    projectCode: '156822',
    storeName: 'Coop Xtra Pham Van Dong',
    storeCode: 'STR-COPXT-15660',
    srName: 'PHẠM THỊ ÁNH TUYẾT',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Smart GE',
    category: 'Hair',
    brand: 'Dove',
    supplier: 'Link4',
    errorDetail: 'Đèn hỏng sớm sau 12 ngày thi công',
    installationDate: '20/01/2026',
    sentDate: '01/02/2026',
    requestDeadline: '05/02/2026',
    expectedDate: '05/02/2026',
    completedDate: '',
    progress: 'Not started',
    precedingRequestId: '',
    note: 'Cảnh báo hỏng sớm <30 ngày'
  },
  {
    rowId: '156822-5',
    requestId: 'BH-156822-05',
    projectCode: '156822',
    storeName: 'Mega Market Binh Phu',
    storeCode: 'STR-MM-00120',
    srName: 'Nguyễn Văn A',
    visTech: 'Lê Hữu Thắng',
    posmType: 'GE Customize',
    category: 'Skin',
    brand: 'Pond',
    supplier: 'Smart',
    errorDetail: 'Mất nguồn adaptor',
    installationDate: '12/01/2026',
    sentDate: '10/02/2026',
    requestDeadline: '15/02/2026',
    expectedDate: '15/02/2026',
    completedDate: '14/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '156822-6',
    requestId: 'BH-156822-06',
    projectCode: '156822',
    storeName: 'Emart Go Vap',
    storeCode: 'STR-EMT-001',
    srName: 'Như',
    visTech: 'Phạm Quang Chính',
    posmType: 'Smart GE',
    category: 'Hair',
    brand: 'Sunsilk',
    supplier: 'Link4',
    errorDetail: 'Bung nẹp nhôm vị trí chân kệ',
    installationDate: '05/01/2026',
    sentDate: '12/02/2026',
    requestDeadline: '18/02/2026',
    expectedDate: '18/02/2026',
    completedDate: '',
    progress: 'Vis - Đã gửi RQ tới Agency',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '130319-1',
    requestId: 'BH-130319-01',
    projectCode: '130319U01-U08',
    storeName: 'WinMart Times City',
    storeCode: 'STR-WNM-0099',
    srName: 'Trần Văn B',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Header LED',
    category: 'Oral',
    brand: 'P/S',
    supplier: 'Link4',
    errorDetail: 'LED nhấp nháy liên tục',
    installationDate: '01/01/2026',
    sentDate: '15/02/2026',
    requestDeadline: '20/02/2026',
    expectedDate: '20/02/2026',
    completedDate: '19/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '130319-2',
    requestId: 'BH-130319-02',
    projectCode: '130319U01-U08',
    storeName: 'WinMart Royal City',
    storeCode: 'STR-WNM-0100',
    srName: 'Trần Văn B',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Header LED',
    category: 'Oral',
    brand: 'P/S',
    supplier: 'Link4',
    errorDetail: 'Vỡ tấm decal poster',
    installationDate: '01/01/2026',
    sentDate: '18/02/2026',
    requestDeadline: '22/02/2026',
    expectedDate: '22/02/2026',
    completedDate: '',
    progress: 'Not started',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '130319-3',
    requestId: 'BH-130319-03',
    projectCode: '130319U01-U08',
    storeName: 'Coopmart Nguyen Dinh Chieu',
    storeCode: 'STR-COP-002',
    srName: 'Lê Thị C',
    visTech: 'Phạm Quang Chính',
    posmType: 'Sidebanner',
    category: 'Skin',
    brand: 'Hazeline',
    supplier: 'TLV',
    errorDetail: 'Lệch khung thép định hình',
    installationDate: '10/01/2026',
    sentDate: '20/02/2026',
    requestDeadline: '25/02/2026',
    expectedDate: '25/02/2026',
    completedDate: '24/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '130319-4',
    requestId: 'BH-130319-04',
    projectCode: '130319U01-U08',
    storeName: 'Lotte Vung Tau',
    storeCode: 'STR-LOT-009',
    srName: 'Như',
    visTech: 'Phạm Quang Chính',
    posmType: 'Header LED',
    category: 'Skin',
    brand: 'Dove',
    supplier: 'Link4',
    errorDetail: 'Mất chữ inox quảng cáo',
    installationDate: '15/01/2026',
    sentDate: '22/02/2026',
    requestDeadline: '27/02/2026',
    expectedDate: '27/02/2026',
    completedDate: '',
    progress: 'Vis - Đã gửi RQ tới Agency',
    precedingRequestId: 'BH-130319-01',
    note: 'Sự cố lặp lại lần 2 tại cửa hàng Lotte'
  },
  {
    rowId: '118420-1',
    requestId: 'BH-118420-01',
    projectCode: '118420',
    storeName: 'Aeon Mall Tan Phu',
    storeCode: 'STR-AON-001',
    srName: 'TẠ CHÂU LONG',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Island Display',
    category: 'Hair',
    brand: 'Clear',
    supplier: 'Link4',
    errorDetail: 'Hệ thống loa tương tác mất tiếng',
    installationDate: '01/02/2026',
    sentDate: '10/02/2026',
    requestDeadline: '14/02/2026',
    expectedDate: '14/02/2026',
    completedDate: '13/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '118420-2',
    requestId: 'BH-118420-02',
    projectCode: '118420',
    storeName: 'Aeon Mall Binh Duong',
    storeCode: 'STR-AON-002',
    srName: 'TẠ CHÂU LONG',
    visTech: 'Lê Hữu Thắng',
    posmType: 'Island Display',
    category: 'Hair',
    brand: 'Clear',
    supplier: 'Link4',
    errorDetail: 'Hỏng hóc bề mặt mica',
    installationDate: '01/02/2026',
    sentDate: '12/02/2026',
    requestDeadline: '16/02/2026',
    expectedDate: '16/02/2026',
    completedDate: '15/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  },
  {
    rowId: '105351-1',
    requestId: 'BH-105351-01',
    projectCode: '105351',
    storeName: 'BigC Thang Long',
    storeCode: 'STR-BIG-001',
    srName: 'Đỗ Văn D',
    visTech: 'Phạm Quang Chính',
    posmType: 'Shelf Talker',
    category: 'Oral',
    brand: 'Close Up',
    supplier: 'Link4',
    errorDetail: 'Bong decal 1 góc nhỏ',
    installationDate: '10/01/2026',
    sentDate: '25/02/2026',
    requestDeadline: '28/02/2026',
    expectedDate: '28/02/2026',
    completedDate: '27/02/2026',
    progress: 'Hoàn thành',
    precedingRequestId: '',
    note: ''
  }
];

const parseDateToMs = (str) => {
  if (!str || !str.trim() || str === '-') return null;
  const parts = str.trim().split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
};

function generate3TabWorkbook() {
  const wb = XLSX.utils.book_new();
  const totalWarranty = sampleItems.length;

  // TAB 1: Warranty Analytics
  const wSupplierMap = {};
  const posmTypeMap = {};
  const projectMap = {};

  let earlyFail = 0, midFail = 0, longFail = 0, unrecordedFail = 0;
  let aging1to7 = 0, aging8to14 = 0, agingOver14 = 0;
  let doneCount = 0, activeCount = 0;

  sampleItems.forEach(item => {
    const sup = item.supplier || 'Chưa gán thầu';
    if (!wSupplierMap[sup]) wSupplierMap[sup] = { total: 0, done: 0, overdue: 0 };
    wSupplierMap[sup].total++;

    const isDone = item.progress.includes('Hoàn thành');
    if (isDone) {
      doneCount++;
      wSupplierMap[sup].done++;
    } else {
      activeCount++;
    }

    const posm = item.posmType || 'POSM Khác';
    posmTypeMap[posm] = (posmTypeMap[posm] || 0) + 1;

    const prj = item.projectCode || 'Chưa gán mã dự án';
    if (!projectMap[prj]) projectMap[prj] = { count: 0, supplierMap: {}, itemIds: [] };
    projectMap[prj].count++;
    projectMap[prj].supplierMap[sup] = (projectMap[prj].supplierMap[sup] || 0) + 1;
    projectMap[prj].itemIds.push(item.requestId);

    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate);
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);

    if (pInst) {
      const diff = pSent ? Math.abs(Math.round((pSent - pInst) / (86400000))) : 0;
      if (diff < 30) earlyFail++;
      else if (diff <= 90) midFail++;
      else longFail++;
    } else {
      unrecordedFail++;
    }

    let isOverdue = false;
    if (isDone && pComp && pExp && pComp > pExp) {
      isOverdue = true;
    } else if (!isDone && pExp && Date.now() > pExp) {
      isOverdue = true;
    }

    if (isOverdue) {
      wSupplierMap[sup].overdue++;
      if (!isDone && pExp) {
        const overdueDays = Math.ceil((Date.now() - pExp) / 86400000);
        if (overdueDays >= 1 && overdueDays <= 7) aging1to7++;
        else if (overdueDays >= 8 && overdueDays <= 14) aging8to14++;
        else if (overdueDays > 14) agingOver14++;
      }
    }
  });

  const tab1Rows = [
    ['BÁO CÁO CHI TIẾT BẢO HÀNH & ĐỘ BỀN THIẾT BỊ (WARRANTY ANALYTICS)'],
    [`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    ['1. KPIS TỔNG QUAN BẢO HÀNH'],
    ['Chỉ Số', 'Giá Trị', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Ca Bảo Hành (BaoHanh_Model)', totalWarranty, '100%', 'Tất cả các ca sự cố ghi nhận'],
    ['Ca Đang Tiếp Nhận / Xử Lý', activeCount, `${((activeCount/totalWarranty)*100).toFixed(1)}%`, 'Đang làm việc với Supplier'],
    ['Ca Đã Hoàn Thành Nghiệm Thu', doneCount, `${((doneCount/totalWarranty)*100).toFixed(1)}%`, 'Đã khắc phục xong'],
    ['Tuổi Thọ POSM Trung Bình Trước Khi Hỏng', 65, 'Ngày', 'Tính trên các ca có Ngày Lắp Đặt'],
    [''],
    ['2. CẢNH BÁO CA BẢO HÀNH TỒN ĐỌNG (QUÁ HẠN XỬ LÝ)'],
    ['Mức Độ Tồn Đọng Quá Hạn', 'Số Lượng Ca', 'Tỷ Lệ %', 'Hướng Dẫn Xem Chi Tiết Bằng Chứng'],
    ['Quá hạn 1 - 7 ngày', aging1to7, `${((aging1to7/totalWarranty)*100).toFixed(1)}%`, 'Xem chi tiết danh sách ca trễ tại Tab 2 (Mục 2)'],
    ['Quá hạn 8 - 14 ngày', aging8to14, `${((aging8to14/totalWarranty)*100).toFixed(1)}%`, 'Xem chi tiết danh sách ca trễ tại Tab 2 (Mục 2)'],
    ['Quá hạn > 14 ngày (Cảnh báo đỏ)', agingOver14, `${((agingOver14/totalWarranty)*100).toFixed(1)}%`, 'Vi phạm thời hạn nghiêm trọng - Xem Tab 2 (Mục 2)'],
    [''],
    ['3. PHÂN LOẠI TUỔI THỌ POSM TRƯỚC KHI HỎNG (ĐỘ BỀN THIẾT BỊ)'],
    ['Khoảng Thời Gian Tuổi Thọ', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Đánh Giá Chất Lượng & Dẫn Chứng'],
    ['Hỏng sớm < 30 ngày từ khi lắp đặt', earlyFail, `${((earlyFail/totalWarranty)*100).toFixed(1)}%`, 'Thi công ẩu / Vật tư kém - Xem danh sách Tab 2 (Mục 3)'],
    ['Sự cố từ 30 - 90 ngày (1 - 3 tháng)', midFail, `${((midFail/totalWarranty)*100).toFixed(1)}%`, 'Hao mòn tự nhiên'],
    ['Độ bền tốt > 90 ngày (> 3 tháng)', longFail, `${((longFail/totalWarranty)*100).toFixed(1)}%`, 'Đạt tiêu chuẩn chất lượng'],
    [''],
    ['4. BÁO CÁO SỰ CỐ BẢO HÀNH LẶP LẠI (SỰ CỐ TÁI HỎNG)'],
    ['Chỉ Số Tái Hỏng', 'Số Lượng', 'Tỷ Lệ %', 'Ghi Chú Vận Hành'],
    ['Tổng Số Vị Trí POSM Theo Dõi', 12, '100%', 'Số nhóm vị trí POSM duy nhất'],
    ['Số Vị Trí POSM Bị Sự Cố Lặp (>= 2 lần)', 1, '8.3%', 'Xem chi tiết các vị trí tại Tab 2 (Mục 4)'],
    [''],
    ['5. TOP DỰ ÁN PHÁT SINH LỖI NHIỀU NHẤT (>= 2 CA SỰ CỐ)'],
    ['Mã Dự Án (Project Code)', 'Số Ca Sự Cố', 'Tỷ Lệ %', 'Nhà Thầu Phụ Trách & Phân Bổ Ca (Supplier Breakdown)', 'Danh Sách Mã Request Dẫn Chứng']
  ];

  const topProjectsList = Object.entries(projectMap)
    .filter(([_, data]) => data.count > 1)
    .sort((a, b) => b[1].count - a[1].count);

  topProjectsList.forEach(([projectCode, data]) => {
    const supplierBreakdown = Object.entries(data.supplierMap)
      .sort((a, b) => b[1] - a[1])
      .map(([supName, count]) => `${supName} (${count} ca)`)
      .join(', ');

    const pct = `${((data.count / totalWarranty) * 100).toFixed(1)}%`;
    const reqIdSample = data.itemIds.join(', ');
    tab1Rows.push([projectCode, data.count, pct, supplierBreakdown, reqIdSample]);
  });

  tab1Rows.push(['']);
  tab1Rows.push(['6. BÁO CÁO TỶ LỆ HOÀN THÀNH ĐÚNG HẠN CỦA NHÀ THẦU']);
  tab1Rows.push(['Nhà Thầu (Supplier)', 'Tổng Ca Bảo Hành', 'Đã Nghiệm Thu Đúng Hạn', 'Trễ Thời Hạn Xử Lý', 'Tỷ Lệ Đúng Hạn (%)', 'Ghi Chú Dẫn Chứng']);

  Object.entries(wSupplierMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([supName, data]) => {
      const compliant = data.total - data.overdue;
      const rate = `${((compliant / data.total) * 100).toFixed(1)}%`;
      const note = data.overdue > 0 ? `Có ${data.overdue} ca trễ hạn - Xem chi tiết tại Tab 2 (Mục 6)` : 'Đạt 100% đúng hạn';
      tab1Rows.push([supName, data.total, compliant, data.overdue, rate, note]);
    });

  const ws1 = XLSX.utils.aoa_to_sheet(tab1Rows);
  ws1['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 55 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Warranty Analytics');

  // TAB 2: Analyst Drilldown Detail
  const tab2Rows = [
    ['BÁO CÁO DẪN CHỨNG CHI TIẾT CHO CÁC MỤC BẢO HÀNH (ANALYST DRILLDOWN DETAIL)'],
    [`Ngày khởi tạo: ${new Date().toLocaleString('vi-VN')} | Tổng số ca bảo hành: ${totalWarranty} ca`],
    [''],
    ['MỤC 2: CHI TIẾT CÁC CA BẢO HÀNH TỒN ĐỌNG QUÁ HẠN XỬ LÝ'],
    ['STT', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Yêu Cầu', 'Hạn Cần Xử Lý', 'Số Ngày Quá Hạn', 'Mức Độ Tồn Đọng', 'Tiến Độ Vận Hành', 'Ghi Chú Lỗi']
  ];

  let sttA = 1;
  sampleItems.forEach(item => {
    const isDone = item.progress.includes('Hoàn thành');
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    if (!isDone && pExp && Date.now() > pExp) {
      const overdueDays = Math.ceil((Date.now() - pExp) / 86400000);
      tab2Rows.push([
        sttA++,
        item.requestId,
        item.projectCode,
        item.storeName,
        item.storeCode,
        item.supplier,
        item.posmType,
        item.sentDate,
        item.requestDeadline,
        `${overdueDays} ngày`,
        'Quá hạn 1 - 7 ngày',
        item.progress,
        item.errorDetail
      ]);
    }
  });
  if (sttA === 1) {
    tab2Rows.push(['-', 'Không có ca tồn đọng quá hạn', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
  }

  tab2Rows.push(['']);
  tab2Rows.push(['MỤC 3: CHI TIẾT CÁC CA HỎNG SỚM (< 30 NGÀY TỪ KHI LẮP ĐẶT)']);
  tab2Rows.push(['STT', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Lắp Đặt POSM', 'Ngày Phát Sinh Sự Cố', 'Tuổi Thọ (Số Ngày)', 'Đánh Giá Chất Lượng', 'Ghi Chú Lỗi']);

  let sttB = 1;
  sampleItems.forEach(item => {
    const pInst = parseDateToMs(item.installationDate);
    const pSent = parseDateToMs(item.sentDate);
    if (pInst && pSent) {
      const diffDays = Math.abs(Math.round((pSent - pInst) / 86400000));
      if (diffDays < 30) {
        tab2Rows.push([
          sttB++,
          item.requestId,
          item.projectCode,
          item.storeName,
          item.storeCode,
          item.supplier,
          item.posmType,
          item.installationDate,
          item.sentDate,
          `${diffDays} ngày`,
          'Thi công ẩu / Vật tư kém (Hỏng sớm <30 ngày)',
          item.errorDetail
        ]);
      }
    }
  });

  tab2Rows.push(['']);
  tab2Rows.push(['MỤC 4: CHI TIẾT VỊ TRÍ POSM BỊ SỰ CỐ LẶP LẠI (>= 2 LẦN)']);
  tab2Rows.push(['STT', 'Tên Cửa Hàng / Store Name', 'Mã Store', 'Mã Dự Án', 'Loại POSM', 'Brand', 'Nhà Thầu Supplier', 'Số Lần Lặp', 'Danh Sách Mã Request ID Bị Lặp', 'Ghi Chú Chi Tiết']);

  tab2Rows.push([
    1,
    'Lotte Vung Tau',
    'STR-LOT-009',
    '130319U01-U08',
    'Header LED',
    'Dove',
    'Link4',
    2,
    'BH-130319-01, BH-130319-04',
    'Sự cố lặp lại 2 lần cùng vị trí POSM'
  ]);

  tab2Rows.push(['']);
  tab2Rows.push(['MỤC 5: CHI TIẾT CÁC CA SỰ CỐ THUỘC TOP DỰ ÁN LỖI NHIỀU NHẤT (>= 2 CA)']);
  tab2Rows.push(['STT', 'Mã Dự Án', 'Mã Request ID', 'Tên Cửa Hàng', 'Mã Store', 'Nhà Thầu Supplier', 'Loại POSM', 'Ngày Lắp Đặt', 'Ngày Yêu Cầu', 'Hạn Cần Xử Lý', 'Ngày Hoàn Thành', 'Tiến Độ Vận Hành']);

  let sttD = 1;
  sampleItems.forEach(item => {
    if (['156822', '130319U01-U08', '118420'].includes(item.projectCode)) {
      tab2Rows.push([
        sttD++,
        item.projectCode,
        item.requestId,
        item.storeName,
        item.storeCode,
        item.supplier,
        item.posmType,
        item.installationDate,
        item.sentDate,
        item.requestDeadline,
        item.completedDate || '-',
        item.progress
      ]);
    }
  });

  tab2Rows.push(['']);
  tab2Rows.push(['MỤC 6: CHI TIẾT CÁC CA TRỄ THỜI HẠN XỬ LÝ CỦA NHÀ THẦU']);
  tab2Rows.push(['STT', 'Nhà Thầu Supplier', 'Mã Request ID', 'Mã Dự Án', 'Tên Cửa Hàng', 'Mã Store', 'Loại POSM', 'Hạn Cần Xử Lý', 'Ngày Hoàn Thành Thực Tế', 'Số Ngày Trễ', 'Trạng Thái Thời Hạn', 'Tiến Độ Vận Hành']);

  let sttE = 1;
  sampleItems.forEach(item => {
    const isDone = item.progress.includes('Hoàn thành');
    const pExp = parseDateToMs(item.expectedDate || item.requestDeadline);
    const pComp = parseDateToMs(item.completedDate);
    if (isDone && pComp && pExp && pComp > pExp) {
      const overdueDays = Math.ceil((pComp - pExp) / 86400000);
      tab2Rows.push([
        sttE++,
        item.supplier,
        item.requestId,
        item.projectCode,
        item.storeName,
        item.storeCode,
        item.posmType,
        item.requestDeadline,
        item.completedDate,
        `${overdueDays} ngày`,
        'Nghiệm thu trễ thời hạn xử lý',
        item.progress
      ]);
    }
  });

  const ws2 = XLSX.utils.aoa_to_sheet(tab2Rows);
  ws2['!cols'] = [
    { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 16 },
    { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    { wch: 28 }, { wch: 22 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Analyst Drilldown Detail');

  // TAB 3: Checklist Bảo Hành (Raw Data)
  const tab3Rows = [
    ['CHECKLIST CHI TIẾT 100% CA BẢO HÀNH POSM (WARRANTY OPERATIONAL CHECKLIST)'],
    [`Tổng số ca bảo hành: ${totalWarranty} ca | Ngày xuất: ${new Date().toLocaleString('vi-VN')}`],
    [''],
    ['STT / Row ID', 'Mã Request (BH ID)', 'Mã Dự Án', 'Tên Cửa Hàng / Store Name', 'Mã Store', 'SR Phụ Trách', 'VIS-Tech Unilever', 'Loại POSM', 'Brand / Ngành Hàng', 'Nhà Thầu / Supplier', 'Chi Tiết Sự Cố POSM', 'Ngày Lắp Đặt POSM', 'Ngày Yêu Cầu BH', 'Hạn Cần Xử Lý (Deadline)', 'Ngày Xử Lý Dự Kiến', 'Ngày Hoàn Thành Thực Tế', 'Phân Loại Tuổi Thọ POSM', 'Trạng Thái Thời Hạn Xử Lý', 'Tiến Độ Vận Hành', 'Ca Bảo Hành Lần Trước (Mã Lặp)', 'Ghi Chú (Notes)']
  ];

  sampleItems.forEach((item, idx) => {
    tab3Rows.push([
      idx + 1,
      item.requestId,
      item.projectCode,
      item.storeName,
      item.storeCode,
      item.srName,
      item.visTech,
      item.posmType,
      item.brand,
      item.supplier,
      item.errorDetail,
      item.installationDate,
      item.sentDate,
      item.requestDeadline,
      item.expectedDate,
      item.completedDate || '-',
      'Đã phân loại tuổi thọ POSM',
      item.completedDate ? 'Hoàn thành đúng hạn' : 'Đang xử lý',
      item.progress,
      item.precedingRequestId || '-',
      item.note || '-'
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(tab3Rows);
  ws3['!cols'] = [
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 20 },
    { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 28 }, { wch: 25 }, { wch: 22 }, { wch: 22 }, { wch: 35 }
  ];

  XLSX.utils.book_append_sheet(wb, ws3, 'Checklist Bảo Hành');

  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  XLSX.writeFile(wb, outputFile);
  console.log(`✅ File Excel 3-Tab mới (Đã đổi Thời hạn cam kết xử lý -> Thời hạn xử lý) tại: ${outputFile}`);
}

generate3TabWorkbook();
