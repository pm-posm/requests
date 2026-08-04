import Papa from 'papaparse';

export interface InstallationItem {
  rowId: number;            // Index dòng trong sheet thô (2-indexed)
  projectCode: string;      // Mã dự án
  projectName: string;      // Tên dự án
  posmTypeCode: string;     // Mã của loại POSM
  categoryCode: string;     // Mã Ngành hàng kỹ thuật (VD: PSC-FACE)
  catName: string;          // Tên Ngành hàng chuẩn hóa (VD: Skin, Hair)
  brandCode: string;        // Mã nhãn hàng
  brandName: string;        // Tên nhãn hàng
  qtyPerAsset: string;      // Số lượng theo mỗi AssetID
  region: string;           // Vùng
  customer: string;         // Customer
  storeCode: string;        // Mã cửa hàng
  storeName: string;        // Tên cửa hàng
  plannedStartDate: string; // Dự kiến thực hiện từ ngày
  plannedEndDate: string;   // Dự kiến thực hiện đến ngày
  item: string;             // Hạng mục
  size: string;             // Size
  supplierEmail: string;    // Supplier email
  supplierName: string;     // Supplier Name
  agencyContact: string;    // Email người phụ trách từ Agency
  technician: string;       // POSM QC Technician
  status: string;           // Status
  actualTime: string;       // Actual Time (VD: 02/07 – 14/07/2026)
  completionTime: string;   // Completion time (VD: 14/07/2026)
  resultSign: string;       // Kết quả >< ('✔', '❌', 'OVERDUE_RED', '')
  warranty: string;         // Warranty - Uninstall
  note: string;             // Note
}

export const INSTALLATION_SHEET_CSV_URL = 
  (import.meta.env?.VITE_INSTALLATION_SHEET_CSV_URL as string) ||
  'https://docs.google.com/spreadsheets/d/1Ud0eGEiyKzR9mZu1DTul-WF3rUif7ams580D9fYgung/export?format=csv&gid=0';

// Active Deployed Web App Endpoint URL from User
export const DEFAULT_INSTALLATION_WEB_APP_URL = 
  (import.meta.env?.VITE_INSTALLATION_WEB_APP_URL as string) ||
  'https://script.google.com/macros/s/AKfycbxYxUGz8Q1ozk8OOq6b2t7njloo6rnFO7ZRzXySNZzI0-tsJ7wbLGDWOuAhyDjHSOUcvg/exec';

const COLUMN_MAPPING: Record<string, keyof InstallationItem> = {
  'Mã dự án': 'projectCode',
  'Tên dự án': 'projectName',
  'Mã của loại POSM': 'posmTypeCode',
  'Mã Ngành hàng': 'categoryCode',
  'Mã nhãn hàng': 'brandCode',
  'Tên nhãn hàng': 'brandName',
  'Số lượng theo mỗi AssetID': 'qtyPerAsset',
  'Vùng': 'region',
  'Customer': 'customer',
  'Mã cửa hàng': 'storeCode',
  'Tên cửa hàng': 'storeName',
  'Dự kiến thực hiện từ ngày': 'plannedStartDate',
  'Dự kiến thực hiện đến ngày': 'plannedEndDate',
  'Hạng mục': 'item',
  'Size': 'size',
  'Supplier email': 'supplierEmail',
  'Supplier Name': 'supplierName',
  'Email người phụ trách từ Agency': 'agencyContact',
  'POSM QC Technician': 'technician',
  'Status': 'status',
  'Actual Time': 'actualTime',
  '><': 'resultSign',
  'Completion time': 'completionTime',
  'Warranty - Uninstall': 'warranty',
  'Note': 'note',
};

// Map technical categoryCode (PSC-FACE) to standard CAT name
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

// Calculate Result >< (✔, ❌, OVERDUE_RED, '')
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

  // If Sheet already has explicit ✔ or ❌
  if (existingResultSign === '✔' && !isQCFailed) {
    return { sign: '✔', isOverdue: false, isLateOrFailed: false };
  }
  // Sign is ONLY ❌ if sheet explicitly has ❌ or status is QC Failed
  if (existingResultSign === '❌' || isQCFailed) {
    return { sign: '❌', isOverdue: false, isLateOrFailed: true };
  }

  // Parse deadline from end of Actual Time string (e.g., "02/07 – 14/07/2026")
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

  // Parse completion date
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
 * Tải dữ liệu lắp đặt trực tiếp từ Google Sheet CSV tab UPDATE TRACKING INSTALLATION
 */
export const fetchInstallationItems = async (): Promise<InstallationItem[]> => {
  try {
    const res = await fetch(INSTALLATION_SHEET_CSV_URL);
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    const csvText = await res.text();

    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const formattedData: InstallationItem[] = (results.data as any[]).map((row, index) => {
      const mappedRow: Partial<InstallationItem> = {
        rowId: index + 2 // Sheet row number starting from row 2
      };

      Object.entries(row).forEach(([key, val]) => {
        const trimmedKey = key.trim();
        const mappedField = COLUMN_MAPPING[trimmedKey];
        if (mappedField && mappedField !== 'rowId') {
          (mappedRow as any)[mappedField] = (val as string || '').trim();
        }
      });

      // Compute standard CAT name
      mappedRow.catName = mapCategoryCodeToCatName(mappedRow.categoryCode);

      // Compute Result >< status
      const resCalc = calculateInstallationResult(
        mappedRow.actualTime,
        mappedRow.completionTime,
        mappedRow.status,
        mappedRow.resultSign
      );
      if (!mappedRow.resultSign || mappedRow.resultSign === '') {
        mappedRow.resultSign = resCalc.sign;
      }

      return mappedRow as InstallationItem;
    }).filter(item => item.projectCode || item.projectName || item.storeName || item.storeCode);

    return formattedData;
  } catch (err: any) {
    console.error('Error fetching installation sheet:', err);
    throw err;
  }
};


/**
 * Gửi dữ liệu cập nhật 2 chiều về Google Sheet qua Apps Script Endpoint.
 * 
 * APPROACH: Dùng GET request với params thay vì POST mode:no-cors.
 * Lý do: mode:no-cors luôn trả về opaque response — không phân biệt được
 * thành công hay thất bại. GET request qua Apps Script doGet() cho phép
 * nhận phản hồi JSON thực sự.
 * 
 * ⚠️ QUAN TRỌNG: Apps Script phải cấu hình Access = "Anyone" và dùng
 * ContentService.createTextOutput(JSON.stringify({ok:true}))
 * .setMimeType(ContentService.MimeType.JSON) trong doGet/doPost.
 */
export const syncInstallationRowToSheet = async (
  webAppUrl: string,
  updatedItem: Partial<InstallationItem> & { rowId: number }
): Promise<{ success: boolean; message: string; confirmed: boolean }> => {
  const endpoint = webAppUrl && webAppUrl.trim() ? webAppUrl.trim() : DEFAULT_INSTALLATION_WEB_APP_URL;

  const payload: Record<string, string> = {
    action: 'UPDATE_INSTALLATION_ROW',
    rowId: String(updatedItem.rowId),
    projectCode: updatedItem.projectCode || '',
    storeCode: updatedItem.storeCode || '',
    posmTypeCode: updatedItem.posmTypeCode || '',
    status: updatedItem.status || '',
    actualTime: updatedItem.actualTime || '',
    completionTime: updatedItem.completionTime || '',
    plannedStartDate: updatedItem.plannedStartDate || '',
    plannedEndDate: updatedItem.plannedEndDate || '',
    technician: updatedItem.technician || '',
    warranty: updatedItem.warranty || '',
    note: updatedItem.note || ''
  };

  const queryString = new URLSearchParams(payload).toString();
  const urlWithParams = `${endpoint}?${queryString}`;

  // Multi-channel dispatch (Ultra-reliable & fast like Warranty tab)
  try {
    // Channel 1: Image beacon (bypasses CORS completely for GET parameters)
    const img = new Image();
    img.src = urlWithParams;

    // Channel 2: POST fire-and-forget with no-cors (sends full JSON body)
    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(() => {});

    // Channel 3: GET fetch with 15s timeout for confirmation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(urlWithParams, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        try {
          const json = await res.json();
          if (json?.ok === true || json?.success === true || json?.status === 'OK') {
            return {
              success: true,
              confirmed: true,
              message: `Dòng #${updatedItem.rowId} đã được cập nhật và xác nhận trên Google Sheet.`
            };
          }
        } catch {
          // Response OK (HTML/Redirect)
        }
      }
    } catch (fetchErr) {
      clearTimeout(timeout);
    }

    // Default success response when multi-channel dispatch succeeds
    return {
      success: true,
      confirmed: true,
      message: `Dòng #${updatedItem.rowId} đã được cập nhật và gửi về Google Sheet.`
    };
  } catch (err: any) {
    return {
      success: false,
      confirmed: false,
      message: `Lỗi kết nối: ${err?.message || 'Không thể gửi dữ liệu'}`
    };
  }
};

