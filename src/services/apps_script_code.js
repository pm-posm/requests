/**
 * HE THONG TU DONG HOA VA DONG BO DU LIEU TRACKING LAP DAT 2 CHIEU (CHUẨN 28 CỘT REALTIME)
 * Sheet ID: 1Ud0eGEiyKzR9mZu1DTul-WF3rUif7ams580D9fYgung
 * Tab Name: UPDATE TRACKING INSTALLATION
 * 
 * AUDIT MA TRAN COT CHUAN THEO GOOGLE SHEET REALTIME:
 * Col A  (1)  : Tên dự án
 * Col B  (2)  : Mã Ngành hàng
 * Col C  (3)  : Mã nhãn hàng
 * Col D  (4)  : Số lượng theo mỗi AssetID
 * Col E  (5)  : Vùng
 * Col F  (6)  : Customer
 * Col G  (7)  : Mã cửa hàng (COL_STORE_CODE = 7)
 * Col H  (8)  : Hạng mục
 * Col I  (9)  : Size
 * Col J  (10) : Supplier email
 * Col K  (11) : Supplier Name
 * Col L  (12) : Email người phụ trách từ Agency
 * Col M  (13) : Dự kiến thực hiện từ ngày
 * Col N  (14) : Dự kiến thực hiện đến ngày
 * Col O  (15) : Mã dự án (COL_PROJECT_CODE = 15 hoặc Col A = 1)
 * Col P  (16) : Tên nhãn hàng
 * Col Q  (17) : Mã của loại POSM (COL_POSM_TYPE_CODE = 17)
 * Col R  (18) : Tên cửa hàng
 * Col S  (19) : POSM QC Technician (COL_TECHNICIAN = 19)
 * Col T  (20) : Dự kiến nghiệm thu xuất xưởng ngày (KHÔNG PHẢI STATUS!)
 * Col U  (21) : Thời gian giao hàng lắp đặt
 * Col V  (22) : Thời gian gửi hình nghiệm thu
 * Col W  (23) : Actual Time (COL_ACTUAL_TIME = 23)
 * Col X  (24) : >< (COL_RESULT_SIGN = 24)
 * Col Y  (25) : Completion time (COL_COMPLETION_TIME = 25)
 * Col Z  (26) : Status (COL_STATUS = 26 - CỘT Z CHUẨN FOR STATUS!)
 * Col AA (27) : Warranty - Uninstall (COL_WARRANTY = 27)
 * Col AB (28) : Note / Ghi chú (COL_NOTE = 28 - CỘT AB CHUẨN FOR NOTE!)
 */

const INSTALLATION_CONFIG = {
  SHEET_NAME: 'UPDATE TRACKING INSTALLATION',
  COL_PROJECT_CODE_PRIMARY: 15, // O: Mã dự án
  COL_PROJECT_CODE_ALT: 1,      // A: Tên/Mã dự án
  COL_STORE_CODE: 7,            // G: Mã cửa hàng
  COL_POSM_TYPE_CODE: 17,       // Q: Mã của loại POSM
  COL_PLANNED_START: 13,        // M: Dự kiến thực hiện từ ngày
  COL_PLANNED_END: 14,          // N: Dự kiến thực hiện đến ngày
  COL_TECHNICIAN: 19,           // S: POSM QC Technician
  COL_ACTUAL_TIME: 23,          // W: Actual Time
  COL_RESULT_SIGN: 24,          // X: >< (Kết quả)
  COL_COMPLETION_TIME: 25,      // Y: Completion time
  COL_STATUS: 26,               // Z: Status (Cột Z chuẩn 100% trên Sheet!)
  COL_WARRANTY: 27,             // AA: Warranty - Uninstall
  COL_NOTE: 28                  // AB: Note / Ghi chú (Cột AB chuẩn 100% trên Sheet!)
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
 * XỬ LÝ DỒNG BỘ NHIỆM VỤ DÙNG CHUNG
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

    // SAFEGUARD CHECK: Nếu có rowId, kiểm tra xem dòng đó có đúng Mã dự án không
    let isRowMatch = false;
    if (!isNaN(targetRow) && targetRow >= 2 && targetRow <= lastRow) {
      const currentPrjCode = String(sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PROJECT_CODE_PRIMARY).getValue() || sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PROJECT_CODE_ALT).getValue()).trim();
      const currentStoreCode = String(sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_STORE_CODE).getValue()).trim();

      if ((!data.projectCode || currentPrjCode.toLowerCase() === String(data.projectCode).trim().toLowerCase()) &&
          (!data.storeCode || currentStoreCode.toLowerCase() === String(data.storeCode).trim().toLowerCase())) {
        isRowMatch = true;
      }
    }

    // NẾU ROW_ID KHÔNG KHỚP (Do bị di chuyển/xóa dòng), TỰ ĐỘNG TÌM KIẾM THEO MÃ DỰ ÁN + MÃ CỬA HÀNG
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

    if (data.completionTime !== undefined && data.completionTime !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_COMPLETION_TIME).setValue(String(data.completionTime)); // Cột Y (25)
    }

    if (data.technician !== undefined && data.technician !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_TECHNICIAN).setValue(String(data.technician)); // Cột S (19)
    }

    if (data.note !== undefined && data.note !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_NOTE).setValue(String(data.note)); // Cột AB (28)
    }

    if (data.warranty !== undefined && data.warranty !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_WARRANTY).setValue(String(data.warranty)); // Cột AA (27)
    }

    if (data.plannedStartDate !== undefined && data.plannedStartDate !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PLANNED_START).setValue(String(data.plannedStartDate)); // Cột M (13)
    }

    if (data.plannedEndDate !== undefined && data.plannedEndDate !== null) {
      sheet.getRange(targetRow, INSTALLATION_CONFIG.COL_PLANNED_END).setValue(String(data.plannedEndDate)); // Cột N (14)
    }

    SpreadsheetApp.flush();

    return createJsonResponse({ 
      status: 'success', 
      ok: true,
      rowId: targetRow,
      updatedColumns: {
        statusCol: 'Z',
        actualTimeCol: 'W',
        completionTimeCol: 'Y',
        technicianCol: 'S',
        noteCol: 'AB',
        warrantyCol: 'AA'
      }
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
