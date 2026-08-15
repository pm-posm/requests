/**
 * ==============================================================================
 * HE THONG TU DONG HOA VA DONG BO DU LIEU 2 CHIEU (POSM DASHBOARD <-> SHEET MER VIEW 2026)
 * Target Sheet: MER VIEW 2026
 * ID Sheet: 1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU
 * ==============================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: '1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU',
  SHEET_NAME: 'Mer View 2026',

  // Cột fallback cố định trên Sheet MER VIEW 2026 (nếu không tìm thấy tên Header)
  COLUMNS: {
    DEADLINE: 20,       // T - Deadline
    PHUONG_AN: 21,      // U - Phương án
    QUICK_FIX_DATE: 22, // V - Ngày Quick Fix (dự kiến)
    STATUS: 24,         // X - Status
    TIEN_DO: 25,        // Y - Tiến độ dự án
    LAST_UPDATE: 26,    // Z - Last update
    TITLE_MAIL: 27,     // AA - Title Email Request
    MA_DU_AN: 28,       // AB - Mã dự án
    SUPPLIER: 29,       // AC - Supplier
    REQUEST_ID: 30,     // AD - Request_ID
    MER_NOTE: 33,       // AG - Mer_note
    SENT_MAIL_SR: 34    // AH - Sent Mail SR
  }
};

/**
 * WEB APP ENDPOINTS (POST & GET)
 */
function doPost(e) {
  return handleHttpRequest(e);
}

function doGet(e) {
  return handleHttpRequest(e);
}

function handleHttpRequest(e) {
  try {
    let params = {};
    
    if (e && e.parameter) {
      params = Object.assign({}, e.parameter);
    }
    
    if (e && e.postData && e.postData.contents) {
      try {
        const jsonBody = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, jsonBody);
      } catch (jsonErr) {}
    }

    const result = updateMerViewRow(params);

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * CẬP NHẬT TRỰC TIẾP DÒNG TRÊN SHEET MER VIEW 2026 (CHỈ GHI 11 TRƯỜNG CHO PHÉP SỬA)
 */
function updateMerViewRow(params) {
  const rowIdRaw = params.rowId || params.id;
  if (!rowIdRaw) {
    return { status: 'error', message: 'Thiếu thông tin rowId' };
  }

  const rowId = parseInt(String(rowIdRaw), 10);
  if (isNaN(rowId) || rowId < 2) {
    return { status: 'error', message: 'rowId không hợp lệ: ' + rowIdRaw };
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    // Tìm kiếm mờ không phân biệt chữ hoa/thường hoặc khoảng trắng thừa
    const allSheets = ss.getSheets();
    for (let i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName().trim().toLowerCase() === CONFIG.SHEET_NAME.trim().toLowerCase() ||
          allSheets[i].getName().trim().toLowerCase().includes('mer view')) {
        sheet = allSheets[i];
        break;
      }
    }
  }
  if (!sheet) {
    return { status: 'error', message: 'Không tìm thấy sheet: ' + CONFIG.SHEET_NAME };
  }

  const maxRows = sheet.getLastRow();
  if (rowId > maxRows) {
    return { status: 'error', message: 'rowId vượt quá số dòng hiện tại của Sheet: ' + rowId + ' / ' + maxRows };
  }

  // Đọc Header dòng 1 để map động vị trí cột (chống lệch cột khi chèn/di chuyển cột trên Sheet)
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMap = {};
  for (let i = 0; i < headerRow.length; i++) {
    const name = String(headerRow[i] || '').trim();
    if (name) colMap[name] = i + 1;
  }

  // Danh sách 11 trường được phép ghi ngược về Sheet từ Dashboard Request Tab
  const updates = [
    { field: 'status', key: 'Status', fallbackCol: CONFIG.COLUMNS.STATUS },
    { field: 'planOption', key: 'Phương án', fallbackCol: CONFIG.COLUMNS.PHUONG_AN },
    { field: 'projectProgress', key: 'Tiến độ dự án', fallbackCol: CONFIG.COLUMNS.TIEN_DO },
    { field: 'deadline', key: 'Deadline', fallbackCol: CONFIG.COLUMNS.DEADLINE },
    { field: 'quickFixDate', key: 'Ngày Quick Fix (dự kiến)', fallbackCol: CONFIG.COLUMNS.QUICK_FIX_DATE },
    { field: 'supplier', key: 'Supplier', fallbackCol: CONFIG.COLUMNS.SUPPLIER },
    { field: 'projectCode', key: 'Mã dự án', fallbackCol: CONFIG.COLUMNS.MA_DU_AN },
    { field: 'requestId', key: 'Request_ID', fallbackCol: CONFIG.COLUMNS.REQUEST_ID },
    { field: 'emailTitle', key: 'Title Email Request', fallbackCol: CONFIG.COLUMNS.TITLE_MAIL },
    { field: 'merNote', key: 'Mer_note', fallbackCol: CONFIG.COLUMNS.MER_NOTE },
    { field: 'sentMailSr', key: 'Sent Mail SR', fallbackCol: CONFIG.COLUMNS.SENT_MAIL_SR }
  ];

  let updatedCount = 0;

  updates.forEach(function(u) {
    if (params[u.field] !== undefined) {
      const colIdx = colMap[u.key] || u.fallbackCol;
      if (colIdx > 0) {
        try {
          const val = String(params[u.field]);
          sheet.getRange(rowId, colIdx).setValue(val);
          updatedCount++;
        } catch (cellErr) {
          console.warn('Lỗi ghi ' + u.key + ' tại dòng ' + rowId + ': ' + cellErr);
        }
      }
    }
  });

  // Tự động cập nhật thời gian Last Update (Cột Z)
  const lastUpdateCol = colMap['Last update'] || CONFIG.COLUMNS.LAST_UPDATE;
  if (lastUpdateCol > 0) {
    try {
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
      sheet.getRange(rowId, lastUpdateCol).setValue(nowStr);
    } catch (e) {}
  }

  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Đã cập nhật thành công dòng #' + rowId + ' trên Sheet ' + sheet.getName(),
    rowId: rowId,
    updatedFieldsCount: updatedCount
  };
}
