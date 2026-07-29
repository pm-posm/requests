/**
 * HE THONG TU DONG HOA VA DONG BO DU LIEU BAO HANH (VERSION 2026 - FULL COL W INSTALLATION DATE)
 * Source Sheet ID: 1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU (Tab: Mer View 2026)
 * Target Sheet ID: 119LpiU1XheXgOxKWxw17E_u4vgRTBPhc-4FADDS8B1Q (Tab: BaoHanh_Model)
 */

const WARRANTY_CONFIG = {
  SOURCE_SPREADSHEET_ID: '1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU',
  SOURCE_SHEET_NAME: 'Mer View 2026',
  TARGET_SPREADSHEET_ID: '119LpiU1XheXgOxKWxw17E_u4vgRTBPhc-4FADDS8B1Q',
  TARGET_SHEET_NAME: 'BaoHanh_Model',
  
  COL_SOURCE_DATE_RQ: 2,       // B
  COL_SOURCE_MER: 4,           // D (VIS-Tech)
  COL_SOURCE_SR: 5,            // E
  COL_SOURCE_STORE_NAME: 6,    // F
  COL_SOURCE_STORE_CODE: 7,    // G
  COL_SOURCE_POSM: 11,         // K
  COL_SOURCE_CAT: 13,          // M
  COL_SOURCE_BRAND: 14,        // N
  COL_SOURCE_SR_NOTE: 15,      // O (Chi tiết lỗi)
  COL_SOURCE_PHUONG_AN: 21,    // U (Phương án)
  COL_SOURCE_DEADLINE: 20,     // T
  COL_SOURCE_STATUS: 24,       // X (Status)
  COL_SOURCE_TIEN_DO: 25,      // Y (Tiến độ dự án)
  COL_SOURCE_TITLE_MAIL: 27,   // AA
  COL_SOURCE_MA_DU_AN: 28,     // AB
  COL_SOURCE_SUPPLIER: 29,     // AC
  COL_SOURCE_REQUEST_ID: 30,   // AD
  COL_SOURCE_NOTE: 33,         // AG (Mer_note)
  
  VALUE_PHUONG_AN_BAO_HANH: 'Supplier bảo hành',
  VALUE_STATUS_BAO_HANH: 'Supplier Bảo Hành',
  VALUE_TIEN_DO_NOT_STARTED: 'Not Started',
  VALUE_TIEN_DO_DA_GUI_MAIL: 'Vis - Đã gửi RQ tới Agency',
  VALUE_HOAN_THANH: 'Hoàn Thành',
  VALUE_CANCELLED: 'Cancelled'
};

/**
 * 1. TRIGGER KHI CHỈNH SỬA TỰ ĐỘNG TRÊN MER VIEW 2026 (ONEDIT)
 */
function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const col = range.getColumn();
  const row = range.getRow();
  if (row < 2) return;

  if (sheetName === WARRANTY_CONFIG.SOURCE_SHEET_NAME) {
    if (col === WARRANTY_CONFIG.COL_SOURCE_PHUONG_AN) {
      const newValue = String(e.value || '').trim();
      const currentRequestId = String(sheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).getValue() || '').trim();
      
      if (isWarrantyOption(newValue)) {
        if (!currentRequestId) {
          pushToWarrantySheet(sheet, row);
        }
      } else {
        handleCancelOrChange(sheet, row, range, e.oldValue);
      }
    }
  }
}

/**
 * 2. TRIGGER DỒN THÔNG TIN TỪ MER VIEW 2026 SANG BAOHANH_MODEL
 */
function pushToWarrantySheet(sourceSheet, sourceRow) {
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME);
  
  if (!targetSheet) return;

  const requestId = 'BH-' + sourceRow;
  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).setValue(requestId);

  const dateRq = formatDate(sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_DATE_RQ).getValue());
  const visTech = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_MER).getValue();
  const srName = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_SR).getValue();
  const storeName = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STORE_NAME).getValue();
  const storeCode = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STORE_CODE).getValue();
  const posmType = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_POSM).getValue();
  const cat = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_CAT).getValue();
  const brand = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_BRAND).getValue();
  const srNote = sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_SR_NOTE).getValue();

  let targetRow = -1;
  const lastTargetRow = targetSheet.getLastRow();
  if (lastTargetRow > 1) {
    const dataRange = targetSheet.getRange(2, 1, lastTargetRow - 1, 2).getValues();
    for (let i = 0; i < dataRange.length; i++) {
      if (String(dataRange[i][1] || '').trim() === requestId || String(dataRange[i][0] || '').trim() == sourceRow) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow === -1) {
    targetRow = Math.max(lastTargetRow + 1, 2);
  }

  targetSheet.getRange(targetRow, 1).setValue(sourceRow);
  targetSheet.getRange(targetRow, 2).setValue(requestId);
  targetSheet.getRange(targetRow, 3).setValue(storeName);
  targetSheet.getRange(targetRow, 4).setValue(storeCode);
  targetSheet.getRange(targetRow, 5).setValue(srName);
  targetSheet.getRange(targetRow, 6).setValue(visTech);
  targetSheet.getRange(targetRow, 7).setValue(posmType);
  targetSheet.getRange(targetRow, 8).setValue(cat);
  targetSheet.getRange(targetRow, 9).setValue(brand);
  targetSheet.getRange(targetRow, 10).setValue(dateRq);
  targetSheet.getRange(targetRow, 14).setValue(srNote);
  targetSheet.getRange(targetRow, 17).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED);

  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED);
}

/**
 * 3. DỒN NGHỊCH TỪ BAOHANH_MODEL SANG MER VIEW 2026
 */
function onEditTargetSheet(e) {
  let sheet, row;
  if (e && e.range) {
    sheet = e.range.getSheet();
    row = e.range.getRow();
  } else {
    return;
  }

  if (row < 2) return;
  
  const rawRowId = sheet.getRange(row, 1).getValue();
  const reqIdVal = String(sheet.getRange(row, 2).getValue() || '').trim();
  if (!rawRowId && !reqIdVal) return;

  const sourceSs = SpreadsheetApp.openById(WARRANTY_CONFIG.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(WARRANTY_CONFIG.SOURCE_SHEET_NAME);
  if (!sourceSheet) return;

  // Dò tìm dòng chính xác trên Mer View 2026
  let sourceRow = -1;
  const lastSourceRow = sourceSheet.getLastRow();
  if (reqIdVal && lastSourceRow > 1) {
    const reqColValues = sourceSheet.getRange(2, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID, lastSourceRow - 1, 1).getValues();
    for (let i = 0; i < reqColValues.length; i++) {
      if (String(reqColValues[i][0] || '').trim().toLowerCase() === reqIdVal.toLowerCase()) {
        sourceRow = i + 2;
        break;
      }
    }
  }

  if (sourceRow === -1 && rawRowId) {
    const parsedRow = parseInt(String(rawRowId).replace(/\D/g, ''), 10);
    if (!isNaN(parsedRow) && parsedRow >= 2 && parsedRow <= lastSourceRow) {
      sourceRow = parsedRow;
    }
  }

  if (sourceRow < 2) return;

  const rowData = sheet.getRange(row, 1, 1, 23).getValues()[0];
  const maDuAnVal = String(rowData[10] || '').trim();     // Col K (Col 11 - Mã dự án)
  const supplierVal = String(rowData[11] || '').trim();   // Col L (Col 12 - Supplier)
  const titleMailVal = String(rowData[12] || '').trim();  // Col M (Col 13 - Title mail)
  const tienDoVal = String(rowData[16] || '').trim();     // Col Q (Col 17 - Tiến độ)

  // Sync Mã dự án, Supplier, Title mail về Sheet Source (Cột AB, AC, AA)
  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN).setValue(maDuAnVal);
  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_SUPPLIER).setValue(supplierVal);
  sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL).setValue(titleMailVal);

  const pLower = tienDoVal.toLowerCase();
  if (pLower === 'hoàn thành') {
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_HOAN_THANH);
  } else if (pLower === 'cancel' || pLower === 'cancelled') {
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue('Cancelled');
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_CANCELLED);
  } else if ((pLower !== 'not started' && pLower !== '') || titleMailVal !== '' || maDuAnVal !== '' || supplierVal !== '') {
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_DA_GUI_MAIL);
  } else {
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(sourceRow, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED);
  }
}

/**
 * HÀM XỬ LÝ CHUNG CHO DASHBOARD UPDATE TOÀN BỘ CÁC TRƯỜNG DỮ LIỆU CÓ CHỈNH SỬA
 */
function processSyncRequest(params) {
  const rowIdRaw = String(params.rowId || params.requestId || params.id || '').trim();
  const rowIdNum = parseInt(rowIdRaw.replace(/\D/g, ''), 10);
  const reqIdStr = rowIdRaw.indexOf('BH-') === 0 ? rowIdRaw : (rowIdNum > 0 ? ('BH-' + rowIdNum) : rowIdRaw);

  if (!rowIdRaw && !reqIdStr) {
    return { status: 'error', message: 'Thiếu thông tin rowId hoặc requestId' };
  }

  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  const targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME);
  const lastRow = targetSheet.getLastRow();

  let targetRow = -1;
  if (lastRow > 1) {
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < dataRange.length; i++) {
      const colA = String(dataRange[i][0] || '').trim();
      const colB = String(dataRange[i][1] || '').trim();
      const colANum = parseInt(colA.replace(/\D/g, ''), 10);

      if (
        (reqIdStr && colB.toLowerCase() === reqIdStr.toLowerCase()) ||
        (rowIdNum > 0 && colANum === rowIdNum) ||
        colA.toLowerCase() === reqIdStr.toLowerCase() ||
        colB.toLowerCase() === rowIdRaw.toLowerCase()
      ) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 1) {
    if (params.projectCode !== undefined) targetSheet.getRange(targetRow, 11).setValue(String(params.projectCode).trim());
    if (params.supplier !== undefined) targetSheet.getRange(targetRow, 12).setValue(String(params.supplier).trim());
    if (params.titleMail !== undefined && String(params.titleMail).trim() !== '') targetSheet.getRange(targetRow, 13).setValue(String(params.titleMail).trim());
    if (params.warrantyCoverage !== undefined) targetSheet.getRange(targetRow, 15).setValue(String(params.warrantyCoverage).trim());
    if (params.warrantyCost !== undefined) targetSheet.getRange(targetRow, 16).setValue(String(params.warrantyCost).trim());
    if (params.progress !== undefined && String(params.progress).trim() !== '') targetSheet.getRange(targetRow, 17).setValue(String(params.progress).trim());
    if (params.expectedDate !== undefined) targetSheet.getRange(targetRow, 18).setValue(String(params.expectedDate).trim());
    if (params.completedDate !== undefined) targetSheet.getRange(targetRow, 19).setValue(String(params.completedDate).trim());
    if (params.note !== undefined) targetSheet.getRange(targetRow, 21).setValue(String(params.note).trim());
    if (params.raiseMailTime !== undefined && String(params.raiseMailTime).trim() !== '') targetSheet.getRange(targetRow, 22).setValue(String(params.raiseMailTime).trim());
    if (params.installationDate !== undefined) targetSheet.getRange(targetRow, 23).setValue(String(params.installationDate).trim()); // Cột W (23 - Ngày lắp đặt)

    // Đồng bộ ngược về tab Mer View 2026
    onEditTargetSheet({ range: targetSheet.getRange(targetRow, 1) });

    return { status: 'success', message: 'Đã cập nhật dữ liệu thành công lên BaoHanh_Model (gồm Cột W Ngày Lắp Đặt) và Mer View 2026' };
  } else {
    return { status: 'error', message: 'Không tìm thấy dòng tương ứng với ' + reqIdStr + ' trên BaoHanh_Model' };
  }
}

function doGet(e) {
  try {
    const res = processSyncRequest(e.parameter || {});
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let params = e.parameter || {};
    if (e && e.postData && e.postData.contents) {
      try {
        const jsonBody = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, jsonBody);
      } catch (pErr) {}
    }
    const res = processSyncRequest(params);
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function isWarrantyOption(val) {
  if (!val) return false;
  const str = String(val).toLowerCase();
  return str.indexOf('bảo hành') !== -1 || str.indexOf('supplier bảo hành') !== -1;
}

function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(d);
}
