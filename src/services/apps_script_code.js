/**
 * HỆ THỐNG ĐỒNG BỘ DỮ LIỆU REALTIME 2 CHIỀU CHO POSM DASHBOARD
 * Hỗ trợ 2 Tab/Sheet riêng biệt:
 * 1. Tab Lắp Đặt: "UPDATE TRACKING INSTALLATION"
 * 2. Tab Bảo Hành: "Mer View 2026" (hoặc "BaoHanh_Model")
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

function handleRequest(data) {
  try {
    if (!data) {
      return createJsonResponse({ status: 'error', message: 'Không có dữ liệu gửi lên' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
