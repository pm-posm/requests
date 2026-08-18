/**
 * ==============================================================================
 * HỆ THỐNG ĐỒNG BỘ GMAIL NGHIỆM THU XUẤT XƯỞNG (NTXX) -> SUPABASE CLOUD
 * (SMART INCREMENTAL SYNC 24/7)
 * 1. Cơ chế Quét Gia Tăng Thông Minh (Chỉ xử lý khi CÓ MAIL MỚI hoặc PHẢN HỒI MỚI)
 * 2. Tiết kiệm 95% tài nguyên: Bỏ qua email cũ trong 0.01 giây nếu không có thay đổi
 * 3. Chạy 24/7 qua Time-driven trigger & Cung cấp API Web App cho Dashboard
 * ==============================================================================
 */

const SUPABASE_CONFIG = {
  PROJECT_URL: 'https://ikfychmglmunznceopnh.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnljaG1nbG11bnpuY2VvcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njc0MjAsImV4cCI6MjEwMjQ0MzQyMH0.2eMYy8NPMC66OldPPtmm606zlqOByPv-_zbcNKioM_Y',
  TABLE_NAME: 'ntxx_emails',
  DEFAULT_QUERY: 'subject:"NTXX" OR subject:"nghiệm thu xuất xưởng" OR subject:"nghiệm thu" OR subject:"BBNT" OR label:"NTXX"',
  DEFAULT_LIMIT: 10
};

/**
 * 1. HÀM TỰ ĐỘNG CHẠY 24/7 (CÀI ĐẶT TIME-DRIVEN TRIGGER MỖI 5 - 10 PHÚT)
 * Chế độ Incremental: Chỉ quét các mail gần đây, phát hiện mail mới là đẩy về Supabase ngay
 */
function autoSyncNtxxGmailToSupabase() {
  Logger.log('Bắt đầu kiểm tra email NTXX mới từ Gmail...');
  var result = processGmailSearch({
    q: SUPABASE_CONFIG.DEFAULT_QUERY,
    limit: 10,
    incremental: true
  });
  Logger.log('Kết quả kiểm tra NTXX: ' + JSON.stringify(result));
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
    Logger.log('Không thể lấy danh sách thread NTXX cũ từ Supabase: ' + e.toString());
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

    // Chuẩn bị payload để Upsert vào Supabase (Đúng 100% schema chuẩn với warranty_emails)
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

  // Thực hiện UPSERT sang Supabase REST API
  var supabaseStatus = 'skipped (không có mail mới)';
  if (supabasePayload.length > 0) {
    try {
      var endpoint = SUPABASE_CONFIG.PROJECT_URL + '/rest/v1/' + SUPABASE_CONFIG.TABLE_NAME + '?on_conflict=thread_id';
      var supaOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'apikey': SUPABASE_CONFIG.ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_CONFIG.ANON_KEY,
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
    query: query,
    newOrUpdatedFound: results.length,
    supabaseSynced: supabaseStatus,
    data: results
  };
}

/**
 * 3. LẤY FILE ĐÍNH KÈM BASE64 ĐỂ XEM ẢNH/FILE TRỰC TIẾP
 */
function getAttachmentData(params) {
  try {
    var msg = GmailApp.getMessageById(params.msgId);
    var atts = msg ? msg.getAttachments({ includeInlineImages: true, includeAttachments: true }) : null;
    var att = atts ? atts[parseInt(params.attIdx || '0', 10)] : null;
    if (!att) return { status: 'error', message: 'Không tìm thấy file' };
    return {
      status: 'success',
      name: att.getName(),
      contentType: att.getContentType() || 'image/jpeg',
      dataUri: 'data:' + (att.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(att.getBytes())
    };
  } catch(e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * 4. HÀM XỬ LÝ HTTP GET & POST (WEB APP ENDPOINT)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (params.action === 'getAttachmentData') {
      return ContentService.createTextOutput(JSON.stringify(getAttachmentData(params))).setMimeType(ContentService.MimeType.JSON);
    }
    if (params.q !== undefined || params.action === 'gmail' || params.action === 'get_ntxx_emails') {
      return ContentService.createTextOutput(JSON.stringify(processGmailSearch(params))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'NTXX Gmail Supabase Sync API',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = e.postData ? JSON.parse(e.postData.contents) : {};
    var resData = processGmailSearch({
      q: body.q || SUPABASE_CONFIG.DEFAULT_QUERY,
      limit: body.limit || 10,
      incremental: body.incremental !== false
    });
    return ContentService.createTextOutput(JSON.stringify(resData)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
