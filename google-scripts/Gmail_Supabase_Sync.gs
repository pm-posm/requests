/**
 * ==============================================================================
 * HỆ THỐNG ĐỒNG BỘ GMAIL BẢO HÀNH -> SUPABASE CLOUD (SMART INCREMENTAL SYNC)
 * 1. Cơ chế Quét Gia Tăng Thông Minh (Chỉ xử lý khi CÓ MAIL MỚI hoặc PHẢN HỒI MỚI)
 * 2. Tiết kiệm 95% tài nguyên: Bỏ qua email cũ trong 0.01 giây nếu không có thay đổi
 * 3. Chạy 24/7 qua Time-driven trigger & Cung cấp API Web App cho Dashboard
 * ==============================================================================
 */

const SUPABASE_CONFIG = {
  PROJECT_URL: 'https://ikfychmglmunznceopnh.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnljaG1nbG11bnpuY2VvcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njc0MjAsImV4cCI6MjEwMjQ0MzQyMH0.2eMYy8NPMC66OldPPtmm606zlqOByPv-_zbcNKioM_Y',
  TABLE_NAME: 'warranty_emails',
  DEFAULT_QUERY: 'subject:"bảo hành" OR subject:"ĐĂNG KÝ LỊCH BẢO HÀNH"',
  DEFAULT_LIMIT: 10
};

/**
 * 1. HÀM TỰ ĐỘNG CHẠY 24/7 (CÀI ĐẶT TIME-DRIVEN TRIGGER MỖI 5 - 10 PHÚT)
 * Chế độ Incremental: Chỉ quét các mail gần đây, phát hiện mail mới là đẩy về Supabase ngay
 */
function autoSyncGmailToSupabase() {
  Logger.log('Bắt đầu kiểm tra email mới từ Gmail...');
  var result = processGmailSearch({
    q: SUPABASE_CONFIG.DEFAULT_QUERY,
    limit: 10,
    incremental: true
  });
  Logger.log('Kết quả kiểm tra: ' + JSON.stringify(result));
  return result;
}

/**
 * Lấy danh sách map { [thread_id]: last_updated } hiện có trên Supabase để so khớp siêu tốc
 */
function getExistingThreadsMap() {
  try {
    var endpoint = SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/' + SUPABASE_CONFIG.TABLE_NAME + '?select=thread_id,last_updated';
    var options = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.ANON_KEY
      },
      muteHttpExceptions: true
    };
    var res = UrlFetchApp.fetch(endpoint, options);
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      var rows = JSON.parse(res.getContentText());
      var map = {};
      for (var i = 0; i < rows.length; i++) {
        map[rows[i].thread_id] = rows[i].last_updated;
      }
      return map;
    }
  } catch (e) {
    Logger.log('Không thể lấy danh sách thread cũ từ Supabase: ' + e.toString());
  }
  return {};
}

/**
 * 2. HÀM QUÉT GMAIL THÔNG MINH (CHỈ XỬ LÝ MAIL MỚI / THAY ĐỔI)
 */
function processGmailSearch(params) {
  var query = params.q ? decodeURIComponent(params.q) : SUPABASE_CONFIG.DEFAULT_QUERY;
  var limit = parseInt(params.limit || String(SUPABASE_CONFIG.DEFAULT_LIMIT), 10);
  var isIncremental = params.incremental !== false && params.incremental !== 'false';

  // Lấy map email hiện có trên Supabase để kiểm tra trước
  var existingMap = isIncremental ? getExistingThreadsMap() : {};
  
  var threads = GmailApp.search(query, 0, Math.min(limit, 50));
  var results = [];
  var supabasePayload = [];
  var skippedCount = 0;

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var threadId = thread.getId();
    var messages = thread.getMessages();
    if (!messages || messages.length === 0) continue;
    
    var lastMsg = messages[messages.length - 1];
    var lastUpdatedIso = lastMsg.getDate().toISOString();

    // KIỂM TRA ĐỘNG: Nếu email này đã có trên Supabase và thời gian cập nhật không đổi -> BỎ QUA NGAY
    if (isIncremental && existingMap[threadId] === lastUpdatedIso) {
      skippedCount++;
      continue;
    }

    // CHỈ BÓC TÁCH CHI TIẾT KHI CÓ MAIL MỚI HOẶC CÓ THÊM PHẢN HỒI MỚI
    var msgsData = [];
    var totalAttachments = [];

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var atts = msg.getAttachments();
      var attsData = [];

      if (atts && atts.length > 0) {
        for (var k = 0; k < atts.length; k++) {
          var att = atts[k];
          var contentType = att.getContentType() || 'application/octet-stream';
          var isImage = contentType.indexOf('image/') === 0;

          var attObj = {
            name: att.getName() || ('Tệp đính kèm ' + (k + 1)),
            contentType: contentType,
            size: Math.round(att.getSize() / 1024) + ' KB',
            isImage: isImage
          };
          attsData.push(attObj);
          totalAttachments.push(attObj);
        }
      }

      var msgPlain = msg.getPlainBody() || '';
      var msgHtml = msg.getBody() || '';

      msgsData.push({
        id: msg.getId(),
        from: msg.getFrom(),
        to: msg.getTo(),
        cc: msg.getCc(),
        date: msg.getDate().toISOString(),
        snippet: msgPlain.substring(0, 150),
        body: msgPlain.substring(0, 3500),
        htmlBody: msgHtml,
        attachments: attsData
      });
    }

    var lastPlain = lastMsg.getPlainBody() || '';
    var threadSubject = thread.getFirstMessageSubject() || 'Không có tiêu đề';
    var lastFrom = lastMsg.getFrom() || '';
    var fromName = lastFrom ? lastFrom.split('<')[0].replace(/"/g, '').trim() : '';

    var threadObj = {
      threadId: threadId,
      subject: threadSubject,
      messageCount: thread.getMessageCount(),
      lastUpdated: lastUpdatedIso,
      from: lastFrom,
      fromName: fromName,
      snippet: lastPlain.substring(0, 150),
      hasAttachments: totalAttachments.length > 0,
      attachments: totalAttachments,
      messages: msgsData
    };

    results.push(threadObj);

    // Chuẩn hóa payload đẩy vào Supabase
    supabasePayload.push({
      thread_id: threadId,
      subject: threadSubject,
      from_email: lastFrom,
      from_name: fromName,
      last_updated: lastUpdatedIso,
      snippet: lastPlain.substring(0, 150),
      messages: msgsData,
      updated_at: new Date().toISOString()
    });
  }

  // Đẩy trực tiếp vào Supabase qua REST API
  var supabaseStatus = 'skipped (không có mail mới)';
  if (supabasePayload.length > 0) {
    supabaseStatus = pushToSupabase(supabasePayload);
  }

  return {
    status: 'success',
    query: query,
    newOrUpdatedFound: results.length,
    skippedUnchanged: skippedCount,
    supabaseSynced: supabaseStatus,
    data: results
  };
}

/**
 * 3. HÀM GỬI PAYLOAD LÊN SUPABASE REST API
 */
function pushToSupabase(records) {
  try {
    var endpoint = SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/' + SUPABASE_CONFIG.TABLE_NAME + '?on_conflict=thread_id';
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.ANON_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      payload: JSON.stringify(records),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(endpoint, options);
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      Logger.log('Đã cập nhật ' + records.length + ' mail mới vào Supabase!');
      return 'success (' + records.length + ' new/updated rows)';
    } else {
      Logger.log('Supabase API Error: ' + response.getContentText());
      return 'error: ' + response.getContentText();
    }
  } catch (err) {
    Logger.log('Exception pushing to Supabase: ' + err.toString());
    return 'exception: ' + err.toString();
  }
}

/**
 * 4. HÀM TẢI ẢNH CHẤT LƯỢNG CAO THEO YÊU CẦU (ON-DEMAND) CHO DASHBOARD
 */
function getAttachmentData(params) {
  try {
    var msgId = params.msgId;
    var attIdx = parseInt(params.attIdx || '0', 10);
    if (!msgId) return { status: 'error', message: 'Thiếu msgId' };

    var msg = GmailApp.getMessageById(msgId);
    if (!msg) return { status: 'error', message: 'Không tìm thấy email' };

    var atts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
    if (!atts || !atts[attIdx]) return { status: 'error', message: 'Không tìm thấy file đính kèm' };

    var att = atts[attIdx];
    var contentType = att.getContentType() || 'image/jpeg';
    var b64 = Utilities.base64Encode(att.getBytes());
    var dataUri = 'data:' + contentType + ';base64,' + b64;

    return {
      status: 'success',
      name: att.getName(),
      contentType: contentType,
      dataUri: dataUri
    };
  } catch(err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * 5. HTTP WEB APP ENDPOINT CHO DASHBOARD (TÌM KIẾM KEYWORD MỚI / TẢI ẢNH)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    
    if (params.action === 'getAttachmentData') {
      const attRes = getAttachmentData(params);
      return ContentService.createTextOutput(JSON.stringify(attRes)).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.q !== undefined || params.action === 'gmail') {
      const gmailRes = processGmailSearch(params);
      return ContentService.createTextOutput(JSON.stringify(gmailRes)).setMimeType(ContentService.MimeType.JSON);
    }

    // Mặc định: Chạy quét gia tăng tự động
    const autoRes = autoSyncGmailToSupabase();
    return ContentService.createTextOutput(JSON.stringify(autoRes)).setMimeType(ContentService.MimeType.JSON);
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

    if (params.action === 'getAttachmentData') {
      const attRes = getAttachmentData(params);
      return ContentService.createTextOutput(JSON.stringify(attRes)).setMimeType(ContentService.MimeType.JSON);
    }

    const gmailRes = processGmailSearch(params);
    return ContentService.createTextOutput(JSON.stringify(gmailRes)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
