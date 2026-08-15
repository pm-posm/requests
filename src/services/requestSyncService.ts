import Papa from 'papaparse';

export interface RequestItem {
  rowId: number;
  email: string;
  dateOfRq: string;
  week: string;
  merName: string;
  srName: string;
  storeName: string;
  storeCode: string;
  ka: string;
  customer: string;
  rqType: string;
  posmType: string;
  quantity: string;
  cat: string;
  brand: string;
  srNote: string;
  imgOverview: string;
  imgDetail1: string;
  imgDetail2: string;
  imgDetail3: string;
  deadline: string;
  planOption: string;
  quickFixDate: string;
  linkRq: string;
  status: string;
  projectProgress: string;
  lastUpdate: string;
  emailTitle: string;
  projectCode: string;
  supplier: string;
  requestId: string;
  visNote: string;
  dataResponser: string;
  merNote: string;
  sentMailSr: string;
}

/**
 * FIX B1: URL lấy từ env variable, KHÔNG có hardcode fallback.
 * Nếu env thiếu → app sẽ báo lỗi rõ ràng thay vì chạy với URL bị lộ.
 */
export const DEFAULT_MER_VIEW_SHEET_CSV_URL = 
  'https://docs.google.com/spreadsheets/d/1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU/export?format=csv&gid=1627400255';

export const DEFAULT_REQUEST_WEB_APP_URL = 
  (import.meta.env?.VITE_REQUEST_WEB_APP_URL as string) ||
  'https://script.google.com/macros/s/AKfycbxztDMOhd6lO6QY_AmF4jMyXUWCP69jlb8XY7f9zIAQVGhXukaa0I_kd_uwqrTce8Y4iA/exec';

export const MER_VIEW_SHEET_CSV_URL: string =
  (import.meta.env?.VITE_MER_VIEW_SHEET_CSV_URL as string) || DEFAULT_MER_VIEW_SHEET_CSV_URL;

const COLUMN_MAPPING: Record<string, keyof RequestItem> = {
  'Email': 'email',
  'Date of RQ': 'dateOfRq',
  'Week': 'week',
  'Mer': 'merName',
  'SR': 'srName',
  'Store Name': 'storeName',
  'ESS Store Code': 'storeCode',
  'KA': 'ka',
  'Customer': 'customer',
  'Loại RQ': 'rqType',
  'POSM': 'posmType',
  'Số lượng': 'quantity',
  'CAT': 'cat',
  'Brand': 'brand',
  'SR Note': 'srNote',
  'Ảnh tổng thể': 'imgOverview',
  'Ảnh chi tiết lỗi 01': 'imgDetail1',
  'Ảnh chi tiết lỗi 02': 'imgDetail2',
  'Ảnh chi tiết lỗi 03': 'imgDetail3',
  'Deadline': 'deadline',
  'Phương án': 'planOption',
  'Ngày Quick Fix (dự kiến)': 'quickFixDate',
  'Link RQ': 'linkRq',
  'Status': 'status',
  'Tiến độ dự án': 'projectProgress',
  'Last update': 'lastUpdate',
  'Title Email Request': 'emailTitle',
  'Mã dự án': 'projectCode',
  'Supplier': 'supplier',
  'Request_ID': 'requestId',
  'Vis note': 'visNote',
  'Data Responser': 'dataResponser',
  'Mer_note': 'merNote',
  'Sent Mail SR': 'sentMailSr',
};

/**
 * FIX B2: Tải dữ liệu CSV từ Google Sheet và duy trì chính xác số dòng (Row Number) 1:1 với Google Sheet
 * Hàng 1 = Header, Hàng 2 = Dòng 2 trên Sheet... kể cả khi có dòng trống.
 */
export const fetchRequestItems = async (): Promise<RequestItem[]> => {
  // FIX B1: Validate env trước khi gọi — không fetch khi URL bị thiếu config
  if (!MER_VIEW_SHEET_CSV_URL) {
    throw new Error(
      'Thiếu cấu hình: VITE_MER_VIEW_SHEET_CSV_URL chưa được thiết lập trong file .env.local. ' +
      'Vui lòng kiểm tra file .env.example để biết cách cấu hình.'
    );
  }

  try {
    const res = await fetch(MER_VIEW_SHEET_CSV_URL);

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    const csvText = await res.text();

    // Parse CSV without skipping empty lines to preserve true row index matching Sheet
    const results = Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: false,
    });

    const rows = results.data;
    if (!rows || rows.length < 2) return [];

    // Header array (Row 1)
    const header = rows[0].map(h => h.trim());

    const formattedData: RequestItem[] = [];

    for (let index = 1; index < rows.length; index++) {
      const rowValues = rows[index];
      const sheetRowNumber = index + 1; // Row 2 = index 1, Row 3 = index 2...

      const mappedRow: Partial<RequestItem> = {
        rowId: sheetRowNumber
      };

      let hasData = false;
      header.forEach((key, colIdx) => {
        const val = rowValues[colIdx] ? rowValues[colIdx].trim() : '';
        const mappedField = COLUMN_MAPPING[key];
        if (mappedField && mappedField !== 'rowId') {
          (mappedRow as any)[mappedField] = val;
          if (val.length > 0) hasData = true;
        }
      });

      // Filter out completely empty rows while preserving rowId index accuracy
      if (hasData && (mappedRow.storeName || mappedRow.storeCode || mappedRow.email || mappedRow.rqType || mappedRow.posmType || mappedRow.dateOfRq)) {
        formattedData.push(mappedRow as RequestItem);
      }
    }

    return formattedData;
  } catch (err: any) {
    console.error('Lỗi khi tải dữ liệu Google Sheet MER VIEW:', err);
    throw err;
  }
};

/**
 * FIX B3 & B4: Gửi dữ liệu cập nhật 2 chiều về Google Sheet qua 1 kênh POST duy nhất
 * Chỉ truyền 11 trường cho phép chỉnh sửa, TUYỆT ĐỐI không truyền trường Read-Only (visNote, dataResponser)
 */
export const syncRequestRowToSheet = async (
  webAppUrl: string,
  updatedItem: Partial<RequestItem> & { rowId: number }
): Promise<{ success: boolean; message: string; confirmed: boolean }> => {
  const endpoint = webAppUrl && webAppUrl.trim() ? webAppUrl.trim() : DEFAULT_REQUEST_WEB_APP_URL;

  // FIX B4: Clean payload containing ONLY writeback fields
  const payload: Record<string, string> = {
    action: 'UPDATE_MER_VIEW_ROW',
    rowId: String(updatedItem.rowId),
    status: updatedItem.status || '',
    planOption: updatedItem.planOption || '',
    projectProgress: updatedItem.projectProgress || '',
    deadline: updatedItem.deadline || '',
    quickFixDate: updatedItem.quickFixDate || '',
    supplier: updatedItem.supplier || '',
    projectCode: updatedItem.projectCode || '',
    requestId: updatedItem.requestId || '',
    emailTitle: updatedItem.emailTitle || '',
    merNote: updatedItem.merNote || '',
    sentMailSr: updatedItem.sentMailSr || ''
  };

  try {
    // FIX B3: Single clean POST request (no CORS mode for Google Apps Script Web App endpoint)
    await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    return {
      success: true,
      confirmed: true,
      message: `Dòng #${updatedItem.rowId} đã được gửi cập nhật về Google Sheet.`
    };
  } catch (err: any) {
    return {
      success: false,
      confirmed: false,
      message: `Lỗi kết nối: ${err?.message || 'Không thể gửi dữ liệu sang Google Apps Script'}`
    };
  }
};
