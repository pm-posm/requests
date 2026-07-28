/**
 * HE THONG TU DONG HOA VA DONG BO DU LIEU BAO HANH
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

  // A. Xử lý trên Tab Mer View 2026 (Sheet Source)
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
    
    if (col === WARRANTY_CONFIG.COL_SOURCE_STATUS ||
        col === WARRANTY_CONFIG.COL_SOURCE_TIEN_DO ||
        col === WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL || 
        col === WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN || 
        col === WARRANTY_CONFIG.COL_SOURCE_SUPPLIER ||
        col === WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID) {
        
      const currentPhuongAn = String(sheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_PHUONG_AN).getValue() || '').trim();
      
      if (isWarrantyOption(currentPhuongAn)) {
        const requestId = sheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).getValue() || ('BH-' + row);
        
        if (e.oldValue !== undefined && String(e.oldValue).trim() !== '') {
          range.setValue(e.oldValue);
        } else {
          range.setValue('');
          range.clearContent();
        }
        
        SpreadsheetApp.flush();
        
        try {
          const ui = SpreadsheetApp.getUi();
          ui.alert(
            '⚠️ CẢNH BÁO QUY TRÌNH BẢO HÀNH!',
            'Dòng này thuộc luồng Bảo hành (Mã: ' + requestId + ').\n\n' +
            'Status, Tiến độ dự án, Mã dự án và Supplier được quản lý tự động từ Sheet Bảo hành / Dashboard.\n' +
            'Vui lòng chỉnh sửa trực tiếp trên Dashboard hoặc tab "BaoHanh_Model"!',
            ui.ButtonSet.OK
          );
        } catch(err) {
          Logger.log(err);
        }
      }
    }
  }

  // B. Xử lý trên Tab BaoHanh_Model (Sheet Bảo hành)
  else if (sheetName === WARRANTY_CONFIG.TARGET_SHEET_NAME) {
    onEditTargetSheet(e);
  }
}

/**
 * HÀM ĐẨY DATA SANG SHEET BẢO HÀNH (BaoHanh_Model)
 */
function pushToWarrantySheet(sourceSheet, row) {
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME);
  if (!targetSheet) {
    targetSheet = targetSs.getSheets()[0];
  }
  
  const rowId = row;
  const requestId = 'BH-' + rowId;
  
  const sourceRowData = sourceSheet.getRange(row, 1, 1, 35).getValues()[0];
  const targetData = targetSheet.getDataRange().getValues();
  let existingTargetRow = -1;
  for (let i = 1; i < targetData.length; i++) {
    if (String(targetData[i][0]) === String(rowId) || String(targetData[i][1]) === requestId) {
      existingTargetRow = i + 1;
      break;
    }
  }
  
  const tienDoGoc = String(sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TIEN_DO - 1] || '').trim();
  let tienDoTarget = WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED;
  let statusSource = WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH;
  let tienDoSource = WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED;

  if (tienDoGoc.toLowerCase() === WARRANTY_CONFIG.VALUE_HOAN_THANH.toLowerCase() || 
      tienDoGoc.toLowerCase() === 'hoàn thành') {
    tienDoTarget = 'Hoàn thành';
    statusSource = WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH;
    tienDoSource = WARRANTY_CONFIG.VALUE_HOAN_THANH;
  } else if (sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL - 1]) {
    tienDoSource = WARRANTY_CONFIG.VALUE_TIEN_DO_DA_GUI_MAIL;
  }
  
  const newTargetRow = [
    rowId,                                                              // Row_ID (Col A)
    requestId,                                                          // Request ID (Col B)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_STORE_NAME - 1] || '',      // Store name (Col C)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_STORE_CODE - 1] || '',      // Store code (Col D)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SR - 1] || '',              // SR (Col E)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_MER - 1] || '',             // VIS-Tech (Col F)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_POSM - 1] || '',            // POSM (Col G)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_CAT - 1] || '',             // CAT (Col H)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_BRAND - 1] || '',           // BRAND (Col I)
    formatDate(sourceRowData[WARRANTY_CONFIG.COL_SOURCE_DATE_RQ - 1]),   // Ngày gửi (Col J)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN - 1] || '',       // Mã dự án (Col K)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SUPPLIER - 1] || '',        // Supplier (Col L)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL - 1] || '',      // Title mail (Col M)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_SR_NOTE - 1] || '',         // Chi tiết lỗi (Col N)
    '',                                                                 // Trạng thái bảo hành (Col O)
    'Miễn phí',                                                         // Chi phí bảo hành (Col P)
    tienDoTarget,                                                       // Tiến độ (Col Q)
    '',                                                                 // Ngày xử lý dự kiến (Col R)
    '',                                                                 // Ngày hoàn thành thực tế (Col S)
    '',                                                                 // Hình ảnh nghiệm thu (Col T)
    sourceRowData[WARRANTY_CONFIG.COL_SOURCE_NOTE - 1] || '',            // Note (Col U)
    ''                                                                  // Ngày raise mail (Col V)
  ];
  
  if (existingTargetRow === -1) {
    targetSheet.appendRow(newTargetRow);
  } else {
    targetSheet.getRange(existingTargetRow, 1, 1, newTargetRow.length).setValues([newTargetRow]);
  }
  
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).setValue(requestId);
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(statusSource);
  sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(tienDoSource);
}

/**
 * XỬ LÝ CHẶT CHẼ KHI CHỌN NHẦM / ĐỔI PHƯƠNG ÁN
 */
function handleCancelOrChange(sourceSheet, row, rangePhuongAn, oldValue) {
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME);
  if (!targetSheet) targetSheet = targetSs.getSheets()[0];
  
  const rowId = row;
  const requestId = 'BH-' + rowId;
  
  const targetData = targetSheet.getDataRange().getValues();
  let foundTargetRow = -1;
  let hasProcessedData = false;
  
  for (let i = 1; i < targetData.length; i++) {
    if (String(targetData[i][0]) === String(rowId) || String(targetData[i][1]) === requestId) {
      foundTargetRow = i + 1;
      
      const supplierVal = String(targetData[i][11] || '').trim();     // Supplier (Col L)
      const titleMailVal = String(targetData[i][12] || '').trim();    // Title Mail (Col M)
      const statusBH = String(targetData[i][14] || '').trim();        // Trạng thái BH (Col O)
      const costBH = String(targetData[i][15] || '').trim();          // Chi phí BH (Col P)
      const tienDoBH = String(targetData[i][16] || '').trim();        // Tiến độ (Col Q)
      const dateExpected = String(targetData[i][17] || '').trim();    // Ngày hẹn (Col R)
      
      if (supplierVal !== '' || titleMailVal !== '' || statusBH !== '' || costBH !== '' || dateExpected !== '' ||
          (tienDoBH.toLowerCase() !== 'not started' && tienDoBH !== '')) {
        hasProcessedData = true;
      }
      break;
    }
  }
  
  if (hasProcessedData) {
    rangePhuongAn.setValue(WARRANTY_CONFIG.VALUE_PHUONG_AN_BAO_HANH);
    SpreadsheetApp.flush();
    
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '⚠️ KHÔNG THỂ ĐỔI PHƯƠNG ÁN!',
        'Yêu cầu này (' + requestId + ') đã được Team Bảo hành tiếp nhận & xử lý (đã có Supplier, Mail, hoặc Chi phí...).\n\n' +
        'Bạn KHÔNG THỂ thay đổi Phương án trực tiếp ở đây để tránh làm sai lệch dữ liệu.\n' +
        'Nếu muốn hủy, vui lòng mở tab "BaoHanh_Model" hoặc Dashboard và chuyển Tiến độ sang Cancel!',
        ui.ButtonSet.OK
      );
    } catch(err) {
      Logger.log(err);
    }
  } else {
    if (foundTargetRow !== -1) {
      targetSheet.deleteRow(foundTargetRow);
    }
    sourceSheet.getRange(row, WARRANTY_CONFIG.COL_SOURCE_REQUEST_ID).setValue('');
  }
}

/**
 * 2. TRIGGER KHI THAO TÁC TRÊN SHEET BẢO HÀNH HOẶC TỪ DASHBOARD (SYNC NGHỊCH VỀ MER VIEW 2026)
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
  if (!rawRowId) return;
  
  const rowId = parseInt(String(rawRowId).replace(/\D/g, ''), 10);
  if (isNaN(rowId) || rowId < 2) return;

  const sourceSs = SpreadsheetApp.openById(WARRANTY_CONFIG.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(WARRANTY_CONFIG.SOURCE_SHEET_NAME);
  if (!sourceSheet) return;

  const rowData = sheet.getRange(row, 1, 1, 22).getValues()[0];
  const maDuAnVal = String(rowData[10] || '').trim();     // Col K (Col 11 - Mã dự án)
  const supplierVal = String(rowData[11] || '').trim();   // Col L (Col 12 - Supplier)
  const titleMailVal = String(rowData[12] || '').trim();  // Col M (Col 13 - Title mail)
  const trangThaiBH = String(rowData[14] || '').trim();   // Col O (Col 15 - Trạng thái bảo hành)
  const chiPhiBH = String(rowData[15] || '').trim();     // Col P (Col 16 - Chi phí bảo hành)
  const tienDoVal = String(rowData[16] || '').trim();     // Col Q (Col 17 - Tiến độ)
  const dateExpected = String(rowData[17] || '').trim();  // Col R (Col 18 - Ngày hẹn)

  // 1. Sync Mã dự án, Supplier, Title mail về Sheet Source (Cột AB, AC, AA)
  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_MA_DU_AN).setValue(maDuAnVal);
  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_SUPPLIER).setValue(supplierVal);
  sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TITLE_MAIL).setValue(titleMailVal);

  const pLower = tienDoVal.toLowerCase();

  // A. Nếu Tiến độ = "Hoàn thành"
  if (pLower === 'hoàn thành') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_HOAN_THANH);
  } 
  // B. Nếu Tiến độ = "Cancel"
  else if (pLower === 'cancel' || pLower === 'cancelled') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue('Cancelled');
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_CANCELLED);
  }
  // C. Với BẤT KỲ trạng thái trung gian nào
  else if ((pLower !== 'not started' && pLower !== '') || 
           titleMailVal !== '' || trangThaiBH !== '' || chiPhiBH !== '' || dateExpected !== '' || maDuAnVal !== '' || supplierVal !== '') {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_DA_GUI_MAIL);
  }
  // D. Nếu vẫn Not started
  else {
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_STATUS).setValue(WARRANTY_CONFIG.VALUE_STATUS_BAO_HANH);
    sourceSheet.getRange(rowId, WARRANTY_CONFIG.COL_SOURCE_TIEN_DO).setValue(WARRANTY_CONFIG.VALUE_TIEN_DO_NOT_STARTED);
  }
}

/**
 * HÀM XỬ LÝ CHUNG CHO DASHBOARD UPDATE TOÀN BỘ CÁC TRƯỜNG DỮ LIỆU CÓ CHỈNH SỬA
 */
function processSyncRequest(params) {
  const rowIdRaw = String(params.rowId || params.requestId || params.id || '').trim();
  const rowIdNum = parseInt(rowIdRaw.replace(/\D/g, ''), 10);
  const reqIdStr = rowIdRaw.indexOf('BH-') === 0 ? rowIdRaw : ('BH-' + rowIdNum);

  if (!rowIdRaw && !rowIdNum) {
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
        (rowIdNum > 0 && colANum === rowIdNum) ||
        colB.toLowerCase() === reqIdStr.toLowerCase() ||
        colA.toLowerCase() === reqIdStr.toLowerCase() ||
        colB.toLowerCase() === rowIdRaw.toLowerCase()
      ) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 1) {
    // 1. Cập nhật Mã dự án (Cột K - 11)
    if (params.projectCode !== undefined) {
      targetSheet.getRange(targetRow, 11).setValue(String(params.projectCode).trim());
    }

    // 2. Cập nhật Supplier (Cột L - 12)
    if (params.supplier !== undefined) {
      targetSheet.getRange(targetRow, 12).setValue(String(params.supplier).trim());
    }

    // 3. Cập nhật Title Mail (Cột M - 13)
    if (params.titleMail !== undefined && String(params.titleMail).trim() !== '') {
      targetSheet.getRange(targetRow, 13).setValue(String(params.titleMail).trim());
    }

    // 4. Cập nhật Trạng thái bảo hành (Cột O - 15)
    if (params.warrantyCoverage !== undefined) {
      targetSheet.getRange(targetRow, 15).setValue(String(params.warrantyCoverage).trim());
    }

    // 5. Cập nhật Chi phí bảo hành (Cột P - 16)
    if (params.warrantyCost !== undefined) {
      targetSheet.getRange(targetRow, 16).setValue(String(params.warrantyCost).trim());
    }

    // 6. Cập nhật Tiến độ (Cột Q - 17)
    if (params.progress !== undefined && String(params.progress).trim() !== '') {
      targetSheet.getRange(targetRow, 17).setValue(String(params.progress).trim());
    }

    // 7. Cập nhật Ngày hẹn xử lý dự kiến (Cột R - 18)
    if (params.expectedDate !== undefined) {
      targetSheet.getRange(targetRow, 18).setValue(String(params.expectedDate).trim());
    }

    // 8. Cập nhật Ngày hoàn thành thực tế (Cột S - 19)
    if (params.completedDate !== undefined) {
      targetSheet.getRange(targetRow, 19).setValue(String(params.completedDate).trim());
    }

    // 9. Cập nhật Note (Cột U - 21)
    if (params.note !== undefined) {
      targetSheet.getRange(targetRow, 21).setValue(String(params.note).trim());
    }

    // 10. Cập nhật Ngày raise mail (Cột V - 22)
    if (params.raiseMailTime !== undefined && String(params.raiseMailTime).trim() !== '') {
      targetSheet.getRange(targetRow, 22).setValue(String(params.raiseMailTime).trim());
    }

    // Đồng bộ ngược về tab Mer View 2026
    onEditTargetSheet({ range: targetSheet.getRange(targetRow, 1) });

    return { status: 'success', message: 'Đã cập nhật dữ liệu thành công lên BaoHanh_Model và Mer View 2026' };
  } else {
    return { status: 'error', message: 'Không tìm thấy dòng ' + rowIdRaw + ' trên BaoHanh_Model' };
  }
}

/**
 * HTTP WEB APP ENDPOINT (DÙNG CẢ GET LẪN POST CHỐNG BỊ CHẶN BỞI BẤT KỲ TRÌNH DUYỆT NÀO)
 */
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

/**
 * 4. HÀM CHẠY MIGRATION DATA LỊCH SỬ
 */
function migrateHistoricalData() {
  const sourceSs = SpreadsheetApp.openById(WARRANTY_CONFIG.SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSs.getSheetByName(WARRANTY_CONFIG.SOURCE_SHEET_NAME);
  
  const targetSs = SpreadsheetApp.openById(WARRANTY_CONFIG.TARGET_SPREADSHEET_ID);
  let targetSheet = targetSs.getSheetByName(WARRANTY_CONFIG.TARGET_SHEET_NAME);
  
  if (!targetSheet) {
    Logger.log('Không tìm thấy tab BaoHanh_Model!');
    return;
  }

  const lastTargetRow = targetSheet.getLastRow();
  if (lastTargetRow > 1) {
    targetSheet.getRange(2, 1, lastTargetRow - 1, 22).clearContent();
  }
  
  const lastRow = sourceSheet.getLastRow();
  let count = 0;
  
  for (let r = 2; r <= lastRow; r++) {
    const phuongAn = String(sourceSheet.getRange(r, WARRANTY_CONFIG.COL_SOURCE_PHUONG_AN).getValue() || '').trim();
    if (isWarrantyOption(phuongAn)) {
      pushToWarrantySheet(sourceSheet, r);
      count++;
    }
  }
  Logger.log('Đã chuyển đổi thành công ' + count + ' dòng dữ liệu lịch sử vào tab BaoHanh_Model!');
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
