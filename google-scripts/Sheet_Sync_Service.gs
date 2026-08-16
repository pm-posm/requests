/**
 * ==============================================================================
 * HỆ THỐNG ĐỒNG BỘ 2 CHIỀU GOOGLE SHEET (MER VIEW 2026 <-> BAOHANH_MODEL)
 * Độc lập, chuyên biệt cho vận hành Sheet & Dashboard Drawer (23 Cột chuẩn)
 * ==============================================================================
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
  VALUE_TIEN_DO_NOT_STARTED: 'Not started',
  VALUE_TIEN_DO_DA_GUI_MAIL: 'Vis - Đã gửi RQ tới Agency',
  VALUE_HOAN_THANH: 'Hoàn Thành',
  VALUE_CANCELLED: 'Cancelled'
};

/**
 * 1. TRIGGER KHI CHỈNH SỬA TỰ ĐỘNG (ONEDIT)
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
        if (!currentRequestId) pushToWarrantySheet(sheet, row);
      } else {
        handleCancelOrChange(sheet, row, range, e.oldValue);
      }
    }
    
    if (col === WARRANTY_CONFIG.COL_SOURCE_STATUS ||
        col === WARRANTY_CONFIG.COL_SOURCE_TIEN_DO ||
        col === WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL || 
        col === WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN || 
        col === WARRANTY_CONFIG.COL_SOURCE_SUPPLIER ||
        col === WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID) {
        
      const currentPhuongAn = String(sheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_PHUONG_AN).getValue() || '').trim();
      if (isWarrantyOption(currentPhuongAn)) {
        if (e.oldValue !== undefined && String(e.oldValue).trim() !== '') {
          range.setValue(e.oldValue);
        } else {
          range.setValue('');
          range.clearContent();
        }
        SpreadsheetApp.flush();
      }
    }
  } else if (sheetName === WARRANTY_CONFIG.TARGET_SHEET_NAME) {
    onEditTargetSheet(e);
  }
}

function pushToWarrantySheet(sourceSheet, row) {
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME) || targetSs.getSheets()[0];
  
  const rowId = row;
  const requestId = 'BH-' + rowId;
  const sourceRowData = sourceSheet.getRange(row, 1, 1, 35).getValues()[0];
  const targetData = targetSheet.getDataRange().getValues();
  let existingTargetRow = -1;
  let existingPrecedingId = '';
  let existingErrorType = '';

  for (let i = 1; i < targetData.length; i++) {
    if (String(targetData[i][0]) === String(rowId) || String(targetData[i][1]) === requestId) {
      existingTargetRow = i + 1;
      existingPrecedingId = String(targetData[i][21] || '').trim();
      existingErrorType = String(targetData[i][22] || '').trim();
      break;
    }
  }
  
  const tienDoGoc = String(sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TIEN_DO - 1] || '').trim();
  let tienDoTarget = WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED;
  let statusSource = WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH;
  let tienDoSource = WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED;

  if (tienDoGoc.toLowerCase() === WARRANTY_CONFIG.VALUE_HOAN_THANH.toLowerCase() || tienDoGoc.toLowerCase() === 'hoàn thành') {
    tienDoTarget = 'Hoàn thành';
    statusSource = WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH;
    tienDoSource = WARRANTY_CONFIG.VALUE_HOAN_THANH;
  } else if (sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL - 1]) {
    tienDoSource = WARRANTY_CONFIG.VALUE_TIEN_DO_DA_GUI_MAIL;
  }
  
  // Mảng 23 cột (Cột V = 22 Mã BH lần trước, Cột W = 23 Loại lỗi)
  const newTargetRow = [
    rowId, requestId,
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_STORE_NAME - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_STORE_CODE - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SR - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_MER - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_POSM - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_CAT - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_BRAND - 1] || '',
    formatDate(sourceRowData[WARRANTY_CONFIG.COL_SOURCE_DATE_RQ - 1]),
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SUPPLIER - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL - 1] || '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SR_NOTE - 1] || '',
    tienDoTarget, '', '', '',
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_NOTE - 1] || '',
    '', '', existingPrecedingId, existingErrorType
  ];
  
  if (existingTargetRow === -1) {
    targetSheet.appendRow(newTargetRow);
  } else {
    targetSheet.getRange(existingTargetRow, 1, 1, newTargetRow.length).setValues([newTargetRow]);
  }
  
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).setValue(requestId);
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(statusSource);
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(tienDoSource);
  SpreadsheetApp.flush();
}

function handleCancelOrChange(sourceSheet, row, rangePhuongAn, oldValue) {
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME) || targetSs.getSheets()[0];
  const rowId = row;
  const requestId = 'BH-' + rowId;
  const targetData = targetSheet.getDataRange().getValues();
  let foundTargetRow = -1;
  let hasProcessedData = false;
  
  for (let i = 1; i < targetData.length; i++) {
    if (String(targetData[i][0]) === String(rowId) || String(targetData[i][1]) === requestId) {
      foundTargetRow = i + 1;
      const supplierVal = String(targetData[i][11] || '').trim();
      const titleMailVal = String(targetData[i][12] || '').trim();
      const tienDoBH = String(targetData[i][14] || '').trim();
      const dateExpected = String(targetData[i][15] || '').trim();
      if (supplierVal !== '' || titleMailVal !== '' || dateExpected !== '' || (tienDoBH.toLowerCase() !== 'not started' && tienDoBH !== '')) {
        hasProcessedData = true;
      }
      break;
    }
  }
  
  if (hasProcessedData) {
    rangePhuongAn.setValue(WARRANTY_CONFIG.VALUE_PHUONG_AN_BAO_HANH);
    SpreadsheetApp.flush();
  } else {
    if (foundTargetRow !== -1) targetSheet.deleteRow(foundTargetRow);
    sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).setValue('');
    SpreadsheetApp.flush();
  }
}

function onEditTargetSheet(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  if (row < 2) return;
  
  const rawRowId = sheet.getRange(row, 1).getValue();
  if (!rawRowId) return;
  const rowId = parseInt(String(rawRowId).replace(/\D/g, ''), 10);
  if (isNaN(rowId) || rowId < 2) return;

  const sourceSs = SpreadsheetApp.openById(WARRANTY_CONFIG.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(WARRANTY_CONFIG.SOURCE_SHEET_NAME);
  if (!sourceSheet) return;

  const rowData = sheet.getRange(row, 1, 1, 23).getValues()[0];
  const maDuAnVal = String(rowData[10] || '').trim();
  const supplierVal = String(rowData[11] || '').trim();
  const titleMailVal = String(rowData[12] || '').trim();
  const tienDoVal = String(rowData[14] || '').trim();
  const dateExpected = String(rowData[15] || '').trim();

  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN).setValue(maDuAnVal);
  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_SUPPLIER).setValue(supplierVal);
  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL).setValue(titleMailVal);

  const pLower = tienDoVal.toLowerCase();
  if (pLower === 'hoàn thành') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_HOAN_THANH);
  } else if (pLower === 'cancel' || pLower === 'cancelled') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue('Cancelled');
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_CANCELLED);
  } else if ((pLower !== 'not started' && pLower !== '') || titleMailVal !== '' || dateExpected !== '' || maDuAnVal !== '' || supplierVal !== '') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_DA_GUI_MAIL);
  } else {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED);
  }
  SpreadsheetApp.flush();
}

function processSyncRequest(params) {
  const rowIdRaw = String(params.rowId || params.requestId || params.id || '').trim();
  const rowIdNum = parseInt(rowIdRaw.replace(/\D/g, ''), 10);
  const reqIdStr = rowIdRaw.indexOf('BH-') === 0 ? rowIdRaw : ('BH-' + rowIdNum);

  if (!rowIdRaw && !rowIdNum) return { status: 'error', message: 'Thiếu thông tin rowId hoặc requestId' };

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

      if ((rowIdNum > 0 && colANum === rowIdNum) || colB.toLowerCase() === reqIdStr.toLowerCase() || colA.toLowerCase() === reqIdStr.toLowerCase() || colB.toLowerCase() === rowIdRaw.toLowerCase()) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 1) {
    if (params.projectCode !== undefined && String(params.projectCode).trim() !== '') targetSheet.getRange(targetRow, 11).setValue(String(params.projectCode).trim());
    if (params.supplier !== undefined && String(params.supplier).trim() !== '') targetSheet.getRange(targetRow, 12).setValue(String(params.supplier).trim());
    if (params.titleMail !== undefined && String(params.titleMail).trim() !== '') targetSheet.getRange(targetRow, 13).setValue(String(params.titleMail).trim());
    if (params.progress !== undefined && String(params.progress).trim() !== '') targetSheet.getRange(targetRow, 15).setValue(String(params.progress).trim());
    if (params.expectedDate !== undefined && String(params.expectedDate).trim() !== '') targetSheet.getRange(targetRow, 16).setValue(String(params.expectedDate).trim());
    if (params.completedDate !== undefined && String(params.completedDate).trim() !== '') targetSheet.getRange(targetRow, 17).setValue(String(params.completedDate).trim());
    if (params.note !== undefined && String(params.note).trim() !== '') targetSheet.getRange(targetRow, 19).setValue(String(params.note).trim());
    if (params.raiseMailTime !== undefined && String(params.raiseMailTime).trim() !== '') targetSheet.getRange(targetRow, 20).setValue(String(params.raiseMailTime).trim());
    if (params.installationDate !== undefined && String(params.installationDate).trim() !== '') targetSheet.getRange(targetRow, 21).setValue(String(params.installationDate).trim());

    // Cột V (Cột 22) - Mã bảo hành lần trước
    const precVal = params.precedingRequestId !== undefined ? params.precedingRequestId : (params.preceding_request_id !== undefined ? params.preceding_request_id : params.maBaoHanhLanTruoc);
    if (precVal !== undefined) targetSheet.getRange(targetRow, 22).setValue(String(precVal).trim());

    // Cột W (Cột 23) - Loại lỗi (Đồng bộ 2 chiều)
    const errTypeVal = params.errorType !== undefined ? params.errorType : (params.loaiLoi !== undefined ? params.loaiLoi : params.error_type);
    if (errTypeVal !== undefined) targetSheet.getRange(targetRow, 23).setValue(String(errTypeVal).trim());

    SpreadsheetApp.flush();
    onEditTargetSheet({ range: targetSheet.getRange(targetRow, 1) });
    return { status: 'success', message: 'Đã cập nhật dữ liệu thành công lên BaoHanh_Model (bao gồm Cột W Loại Lỗi) và Mer View 2026' };
  } else {
    return { status: 'error', message: 'Không tìm thấy dòng ' + rowIdRaw + ' trên BaoHanh_Model' };
  }
}

/**
 * 2. HTTP WEB APP ENDPOINTS CHO DASHBOARD SYNC VỀ SHEET
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const syncRes = processSyncRequest(params);
    return ContentService.createTextOutput(JSON.stringify(syncRes)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let params = (e && e.parameter) ? e.parameter : {};
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
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  return String(d);
}
