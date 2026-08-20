/**
 * ==============================================================================
 * HỆ THỐNG ĐỒNG BỘ TỔNG HỢP GMAIL 4 TRONG 1 -> SUPABASE CLOUD (ALL-IN-ONE)
 * 1. Hỗ trợ đầy đủ cả 4 luồng: BẢO HÀNH, LẮP ĐẶT, NTXX, REQUEST
 * 2. Cơ chế Quét Gia Tăng Thông Minh (Smart Incremental): 0.01s bỏ qua mail cũ
 * 3. 1 Trigger duy nhất autoSyncAllGmailToSupabase() quét cả 4 luồng cùng lúc
 * 4. 1 Web App URL duy nhất phục vụ toàn bộ Dashboard
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// CẤU HÌNH SUPABASE CHO 4 BẢNG
// ------------------------------------------------------------------------------
var SUPABASE_GLOBAL_CONFIG = {
  PROJECT_URL: 'https://ikfychmglmunznceopnh.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnljaG1nbG11bnpuY2VvcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njc0MjAsImV4cCI6MjEwMjQ0MzQyMH0.2eMYy8NPMC66OldPPtmm606zlqOByPv-_zbcNKioM_Y'
};

var WARRANTY_CONFIG = {
  TABLE_NAME: 'warranty_emails',
  DEFAULT_QUERY: 'subject:"bảo hành" OR subject:"ĐĂNG KÝ LỊCH BẢO HÀNH"',
  DEFAULT_LIMIT: 50
};

var INSTALLATION_CONFIG = {
  TABLE_NAME: 'installation_emails',
  DEFAULT_QUERY: 'subject:"lắp đặt" OR subject:"LẮP ĐẶT" OR subject:"triển khai" OR subject:"tiến độ lắp đặt" OR label:"LAPDAT"',
  DEFAULT_LIMIT: 50
};

var NTXX_CONFIG = {
  TABLE_NAME: 'ntxx_emails',
  DEFAULT_QUERY: 'subject:"NTXX" OR subject:"nghiệm thu xuất xưởng" OR subject:"nghiệm thu" OR subject:"BBNT" OR label:"NTXX"',
  DEFAULT_LIMIT: 50
};

var REQUEST_CONFIG = {
  TABLE_NAME: 'request_emails',
  DEFAULT_QUERY: 'subject:"request" OR subject:"REQUEST" OR subject:"yêu cầu" OR subject:"POSM"',
  DEFAULT_LIMIT: 50
};

// ==============================================================================
// 1. HÀM TRIGGER TỰ ĐỘNG CHẠY 24/7 (CÀI ĐẶT 5 - 10 PHÚT/LẦN)
// ==============================================================================

/**
 * TRIGGER TỔNG HỢP: Quét cả 4 danh mục (Bảo Hành, Lắp Đặt, NTXX, Request) trong 1 lần chạy
 */
function autoSyncAllGmailToSupabase() {
  Logger.log('>>> BẮT ĐẦU ĐỒNG BỘ TOÀN BỘ GMAIL (BẢO HÀNH + LẮP ĐẶT + NTXX + REQUEST) <<<');
  var resWarranty = autoSyncWarrantyGmailToSupabase();
  var resInstallation = autoSyncInstallationGmailToSupabase();
  var resNtxx = autoSyncNtxxGmailToSupabase();
  var resRequest = autoSyncRequestGmailToSupabase();
  return {
    status: 'success',
    warranty: resWarranty,
    installation: resInstallation,
    ntxx: resNtxx,
    request: resRequest
  };
}

/**
 * Trigger riêng từng module nếu bạn muốn cài đặt lịch riêng
 */
function autoSyncWarrantyGmailToSupabase() {
  return syncGenericGmailModule(WARRANTY_CONFIG, { q: WARRANTY_CONFIG.DEFAULT_QUERY, limit: 50, incremental: true });
}

function autoSyncInstallationGmailToSupabase() {
  return syncGenericGmailModule(INSTALLATION_CONFIG, { q: INSTALLATION_CONFIG.DEFAULT_QUERY, limit: 50, incremental: true });
}

function autoSyncNtxxGmailToSupabase() {
  return syncGenericGmailModule(NTXX_CONFIG, { q: NTXX_CONFIG.DEFAULT_QUERY, limit: 50, incremental: true });
}

function autoSyncRequestGmailToSupabase() {
  return syncGenericGmailModule(REQUEST_CONFIG, { q: REQUEST_CONFIG.DEFAULT_QUERY, limit: 50, incremental: true });
}

// ==============================================================================
// 2. CORE ENGINE ĐỒNG BỘ GMAIL (CHUNG CHO CẢ 4 BẢNG)
// ==============================================================================

function getModuleExistingMap(tableName) {
  try {
    var endpoint = SUPABASE_GLOBAL_CONFIG.PROJECT_URL + '/rest/v1/' + tableName + '?select=thread_id,last_updated';
    var options = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_GLOBAL_CONFIG.ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_GLOBAL_CONFIG.ANON_KEY
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
    Logger.log('Lỗi đọc bảng ' + tableName + ': ' + e.toString());
  }
  return {};
}

function syncGenericGmailModule(config, params) {
  var query = params.q ? decodeURIComponent(params.q) : config.DEFAULT_QUERY;
  var limit = parseInt(params.limit || String(config.DEFAULT_LIMIT), 10);
  var isIncremental = params.incremental !== false && params.incremental !== 'false';

  var existingMap = isIncremental ? getModuleExistingMap(config.TABLE_NAME) : {};
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

    if (isIncremental && existingMap[threadId] === lastUpdatedIso) {
      skippedCount++;
      continue;
    }

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
      var rawHtml = msg.getBody() || '';
      var msgHtml = rawHtml.length > 100000 ? rawHtml.substring(0, 100000) : rawHtml;

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

  var supabaseStatus = 'skipped (không có mail mới)';
  if (supabasePayload.length > 0) {
    try {
      var endpoint = SUPABASE_GLOBAL_CONFIG.PROJECT_URL + '/rest/v1/' + config.TABLE_NAME + '?on_conflict=thread_id';
      var supaOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'apikey': SUPABASE_GLOBAL_CONFIG.ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_GLOBAL_CONFIG.ANON_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        payload: JSON.stringify(supabasePayload),
        muteHttpExceptions: true
      };

      var supaRes = UrlFetchApp.fetch(endpoint, supaOptions);
      supabaseStatus = supaRes.getResponseCode() >= 200 && supaRes.getResponseCode() < 300 
        ? ('success (' + supabasePayload.length + ' rows)') 
        : ('error: ' + supaRes.getContentText());
    } catch (e) {
      supabaseStatus = 'exception: ' + e.toString();
    }
  }

  return {
    status: 'success',
    table: config.TABLE_NAME,
    query: query,
    newOrUpdatedFound: results.length,
    skippedUnchanged: skippedCount,
    supabaseSynced: supabaseStatus,
    data: results
  };
}

// ==============================================================================
// 3. TẢI HÌNH ẢNH / FILE THEO YÊU CẦU (ON-DEMAND)
// ==============================================================================
function getGlobalAttachmentData(params) {
  try {
    var msgId = params.msgId;
    var attIdx = parseInt(params.attIdx || '0', 10);
    if (!msgId) return { status: 'error', message: 'Thiếu msgId' };

    var msg = GmailApp.getMessageById(msgId);
    if (!msg) return { status: 'error', message: 'Không tìm thấy email' };

    var atts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
    if (!atts || !atts[attIdx]) return { status: 'error', message: 'Không tìm thấy file' };

    var att = atts[attIdx];
    var contentType = att.getContentType() || 'image/jpeg';
    var b64 = Utilities.base64Encode(att.getBytes());

    return {
      status: 'success',
      name: att.getName(),
      contentType: contentType,
      dataUri: 'data:' + contentType + ';base64,' + b64
    };
  } catch(err) {
    return { status: 'error', message: err.toString() };
  }
}

// ==============================================================================
// 4. BỘ ĐIỀU PHỐI WEB APP ĐA NĂNG (ROUTER)
// ==============================================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    
    // Tải ảnh
    if (params.action === 'getAttachmentData') {
      return ContentService.createTextOutput(JSON.stringify(getGlobalAttachmentData(params))).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Quét theo module hoặc từ khóa
    var action = String(params.action || '').toLowerCase();
    var table = String(params.table || '').toLowerCase();
    
    if (action === 'request' || action === 'get_request_emails' || table === 'request_emails') {
      return ContentService.createTextOutput(JSON.stringify(syncGenericGmailModule(REQUEST_CONFIG, params))).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'installation' || action === 'get_installation_emails' || table === 'installation_emails') {
      return ContentService.createTextOutput(JSON.stringify(syncGenericGmailModule(INSTALLATION_CONFIG, params))).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'ntxx' || action === 'get_ntxx_emails' || table === 'ntxx_emails') {
      return ContentService.createTextOutput(JSON.stringify(syncGenericGmailModule(NTXX_CONFIG, params))).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Mặc định là Warranty hoặc khi có query tìm kiếm chung
    if (params.q !== undefined || action === 'gmail' || action === 'warranty' || table === 'warranty_emails') {
      return ContentService.createTextOutput(JSON.stringify(syncGenericGmailModule(WARRANTY_CONFIG, params))).setMimeType(ContentService.MimeType.JSON);
    }

    // Nếu gọi không tham số -> Chạy đồng bộ toàn bộ (Cả 4 module)
    return ContentService.createTextOutput(JSON.stringify(autoSyncAllGmailToSupabase())).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (e && e.postData && e.postData.contents) {
      try {
        var jsonBody = JSON.parse(e.postData.contents);
        params = Object.assign({}, params, jsonBody);
      } catch (pErr) {}
    }
    return doGet({ parameter: params });
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
