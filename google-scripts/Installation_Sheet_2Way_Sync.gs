/**
 * HE THONG TU DONG HOA VA DONG BO DU LIEU TRACKING LAP DAT 2 CHIEU (CHUẨN 28 CỘT REALTIME)
 * Sheet ID: 1Ud0eGEiyKzR9mZu1DTul-WF3rUif7ams580D9fYgung
 * Tab Name: UPDATE TRACKING INSTALLATION
 */

const INSTALLATION_CONFIG = {
  SHEET_NAME: 'UPDATE TRACKING INSTALLATION',
  COL_PROJECT_CODE_PRIMARY: 15, // O: Mã dự án
  COL_PROJECT_CODE_ALT: 1,      // A: Tên/Mã dự án
  COL_STORE_CODE: 7,            // G: Mã cửa hàng
  COL_POSM_TYPE_CODE: 17,       // Q: Mã của loại POSM
  COL_PLANNED_START: 11,        // K: Dự kiến thực hiện từ ngày
  COL_PLANNED_END: 12,          // L: Dự kiến thực hiện đến ngày
  COL_TECHNICIAN: 19,           // S: POSM QC Technician
  COL_ACTUAL_TIME: 23,          // W: Actual Time
  COL_RESULT_SIGN: 24,          // X: >< (Kết quả)
  COL_COMPLETION_TIME: 25,      // Y: Completion time
  COL_STATUS: 26,               // Z: Status (Cột Z chuẩn 100% trên Sheet!)
  COL_NOTE: 27,                 // AA: Note / Ghi chú (Cột AA chuẩn 100% trên Sheet!)
  COL_WARRANTY: 28              // AB: Warranty - Uninstall (Cột AB chuẩn 100% trên Sheet!)
};

/**
 * HỖ TRỢ CẢ GET VÀ POST REQUEST
 */
function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

function doPost(e) {
  let data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    if (e && e.parameter) {
      data = e.parameter;
    }
  }
  return handleRequest(data);
}

/**
 * XỬ LÝ ĐỒNG BỘ NHIỆM VỤ DÙNG CHUNG
 */
function handleRequest(data) {
  try {
    if (!data) {
      return createJsonResponse({ status: 'error', message: 'No request data provided' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(INSTALLATION_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.getSheets()[0]; // Fallback lấy tab đầu tiên
    }

    if (!sheet) {
      return createJsonResponse({ status: 'error', message: 'Sheet tab not found: ' + INSTALLATION_CONFIG.SHEET_NAME });
    }

    let targetRow = parseInt(data.rowId, 10);
    const lastRow = sheet.getLastRow();

    // SAFEGUARD CHECK: Kiểm tra xem dòng đó có đúng Mã dự án & Mã cửa hàng không
    let isRowMatch = false;
    if (!isNaN(targetRow) && targetRow >= 2 && targetRow <= lastRow) {
      const currentPrjCode = String(sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PROJECT_CODE_PRIMARY).getValue() || sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PROJECT_CODE_ALT).getValue()).trim();
      const currentStoreCode = String(sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_STORE_CODE).getValue()).trim();

      if ((!data.projectCode || currentPrjCode.toLowerCase() === String(data.projectCode).trim().toLowerCase()) &&
          (!data.storeCode || currentStoreCode.toLowerCase() === String(data.storeCode).trim().toLowerCase())) {
        isRowMatch = true;
      }
    }

    // NẾU ROW_ID KHÔNG KHỚP, TỰ ĐỘNG TÌM KIẾM THEO MÃ DỰ ÁN + MÃ CỬA HÀNG
    if (!isRowMatch && lastRow >= 2) {
      const prjCodes = sheet.getRange(2, INSTALLATION_CONFIG.COL_PROJECT_CODE_PRIMARY, lastRow - 1, 1).getValues();
      const storeCodes = sheet.getRange(2, INSTALLATION_CONFIG.COL_STORE_CODE, lastRow - 1, 1).getValues();

      for (let i = 0; i < prjCodes.length; i++) {
        const prj = String(prjCodes[i][0]).trim();
        const store = String(storeCodes[i][0]).trim();

        if (data.projectCode && (prj.toLowerCase() === String(data.projectCode).trim().toLowerCase()) &&
            (!data.storeCode || store.toLowerCase() === String(data.storeCode).trim().toLowerCase())) {
          targetRow = i + 2;
          isRowMatch = true;
          break;
        }
      }
    }

    if (!isRowMatch || !targetRow || targetRow < 2) {
      return createJsonResponse({ 
        status: 'error', 
        message: 'Không tìm thấy dòng phù hợp cho Mã DA: ' + (data.projectCode || 'N/A') + ' & Mã CH: ' + (data.storeCode || 'N/A')
      });
    }

    // GHI CẬP NHẬT THEO CỘT MA TRẬN CHUẨN:
    if (data.status !== undefined && data.status !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_STATUS).setValue(String(data.status)); // Cột Z (26)
    }

    if (data.actualTime !== undefined && data.actualTime !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_ACTUAL_TIME).setValue(String(data.actualTime)); // Cột W (23)
    }

    // CẬP NHẬT NGÀY HOÀN THÀNH CHUẨN DATE OBJECT
    if (data.completionTime !== undefined && data.completionTime !== null) {
      var compStr = String(data.completionTime).trim();
      if (compStr) {
        var dateObj = parseDateDDMMYYYY_(compStr);
        if (dateObj) {
          sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_COMPLETION_TIME).setValue(dateObj); // Ghi Date Object
        } else {
          sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_COMPLETION_TIME).setValue(compStr);
        }
      } else {
        sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_COMPLETION_TIME).setValue('');
      }
    }

    if (data.technician !== undefined && data.technician !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_TECHNICIAN).setValue(String(data.technician)); // Cột S (19)
    }

    if (data.note !== undefined && data.note !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_NOTE).setValue(String(data.note)); // Cột AA (27)
    }

    if (data.warranty !== undefined && data.warranty !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_WARRANTY).setValue(String(data.warranty)); // Cột AB (28)
    }

    if (data.plannedStartDate !== undefined && data.plannedStartDate !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PLANNED_START).setValue(String(data.plannedStartDate)); // Cột K (11)
    }

    if (data.plannedEndDate !== undefined && data.plannedEndDate !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PLANNED_END).setValue(String(data.plannedEndDate)); // Cột L (12)
    }

    SpreadsheetApp.flush();

    // 🎯 TỰ ĐỘNG TÍNH LẠI CỘT X (><) VÀ XÓA MÀU NỀN ĐỎ NGAY SAU KHI GHI TỪ DASHBOARD
    recalculateResultSign_(sheet, targetRow);

    return createJsonResponse({ 
      status: 'success', 
      ok: true,
      rowId: targetRow,
      updatedColumns: {
        statusCol: 'Z',
        actualTimeCol: 'W',
        completionTimeCol: 'Y',
        resultCol: 'X',
        technicianCol: 'S',
        noteCol: 'AA',
        warrantyCol: 'AB'
      }
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * HÀM PHỤ: TÍNH LẠI CỘT X (><) VÀ XÓA NỀN ĐỎ QUÁ HẠN
 */
function recalculateResultSign_(sheet, row) {
  var actualValue = sheet.getRange(row, INSTALLATION_CONFIG.COL_ACTUAL_TIME).getValue();
  var compValue = sheet.getRange(row, INSTALLATION_CONFIG.COL_COMPLETION_TIME).getValue();
  var statusValue = sheet.getRange(row, INSTALLATION_CONFIG.COL_STATUS).getValue();

  var actualStr = String(actualValue || "").trim();
  var compStr = String(compValue || "").trim();
  var statusStr = String(statusValue || "").trim().toLowerCase();
  var targetRange = sheet.getRange(row, INSTALLATION_CONFIG.COL_RESULT_SIGN);

  if (!actualStr) {
    targetRange.setValue("").setBackground(null);
    return;
  }

  var actualParts = actualStr.split(/[-–—]/);
  var deadlineStr = actualParts[actualParts.length - 1].trim();
  var deadlineDate = parseDateDDMMYYYY_(deadlineStr);

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  if (compStr === "" || !compValue) {
    if (deadlineDate && deadlineDate.getTime() < today.getTime()) {
      targetRange.setValue("").setBackground("#EA4335");
    } else {
      targetRange.setValue("").setBackground(null);
    }
    return;
  }

  var compDate = null;
  if (compValue instanceof Date) {
    compDate = new Date(compValue.getFullYear(), compValue.getMonth(), compValue.getDate());
  } else {
    compDate = parseDateDDMMYYYY_(compStr);
  }

  if (deadlineDate && compDate) {
    targetRange.setBackground(null); // XÓA NỀN ĐỎ QUÁ HẠN

    if (compDate.getTime() <= deadlineDate.getTime() && statusStr.indexOf("completed") !== -1) {
      targetRange.setValue("✔").setFontColor("#34A853").setHorizontalAlignment("center");
    } else {
      targetRange.setValue("❌").setFontColor("#EA4335").setHorizontalAlignment("center");
    }
  } else {
    targetRange.setValue("").setBackground(null);
  }
}

/**
 * PARSE CHUỖI NGÀY DD/MM/YYYY THÀNH DATE OBJECT
 */
function parseDateDDMMYYYY_(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  var s = String(str).trim();
  var parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    var d = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m, d);
    }
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
