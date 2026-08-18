/**
 * ==============================================================================
 * HỆ THỐNG ĐỒNG BỘ GMAIL NGHIỆM THU XUẤT XƯỞNG (NTXX) -> SUPABASE CLOUD
 * (SMART INCREMENTAL SYNC 24/7)
 * 1. Cơ chế Quét Gia Tăng Thông Minh (Chỉ xử lý khi CÓ MAIL MỚI hoặc PHẢN HỒI MỚI)
 * 2. Tự động trích xuất: Mã Dự Án, Nhà Thầu, Nhãn Hàng, Kết Quả Đạt/KĐ
 * 3. Chạy 24/7 qua Time-driven trigger & Cung cấp API Web App cho Dashboard
 * ==============================================================================
 */

const NTXX_CONFIG = {
  PROJECT_URL: 'https://ikfychmglmunznceopnh.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnljaG1nbG11bnpuY2VvcG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Njc0MjAsImV4cCI6MjEwMjQ0MzQyMH0.2eMYy8NPMC66OldPPtmm606zlqOByPv-_zbcNKioM_Y',
  TABLE_NAME: 'ntxx_emails',
  DEFAULT_QUERY: 'subject:"NTXX" OR subject:"nghiệm thu xuất xưởng" OR subject:"nghiệm thu" OR subject:"BBNT" OR label:"NTXX"',
  DEFAULT_LIMIT: 20
};

/**
 * 1. HÀM TỰ ĐỘNG CHẠY 24/7 (CÀI ĐẶT TIME-DRIVEN TRIGGER MỖI 5 - 10 PHÚT)
 * Chế độ Incremental: Chỉ quét các mail gần đây, phát hiện mail mới là đẩy về Supabase ngay
 */
function autoSyncNtxxToSupabase() {
  Logger.log('Bắt đầu kiểm tra email NTXX mới từ Gmail...');
  var result = processNtxxGmailSearch({
    q: NTXX_CONFIG.DEFAULT_QUERY,
    limit: 20,
    incremental: true
  });
  Logger.log('Kết quả kiểm tra NTXX: ' + JSON.stringify(result));
  return result;
}

/**
 * Lấy danh sách map { [thread_id]: last_updated } hiện có trên Supabase để so khớp siêu tốc
 */
function getExistingNtxxThreadsMap() {
  try {
    var endpoint = NTXX_CONFIG.PROJECT_URL + '/rest/v1/' + NTXX_CONFIG.TABLE_NAME + '?select=thread_id,last_updated';
    var options = {
      method: 'get',
      headers: {
        'apikey': NTXX_CONFIG.ANON_KEY,
        'Authorization': 'Bearer ' + NTXX_CONFIG.ANON_KEY
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
 * Trích xuất Mã Dự Án, Nhà Thầu, Kết Quả từ tiêu đề & nội dung email
 */
function extractNtxxMetadata(subject, body) {
  var fullText = (subject + ' ' + body).trim();
  
  // 1. Mã dự án (6 số hoặc mã dự án kèm hậu tố)
  var projectCode = '';
  var prjMatch = subject.match(/(?:NTXX|Dự án|DA|Project|Mã)\s*[-:]?\s*\[?([0-9]{6}[A-Z0-9_-]*|[0-9]{6})\]?/i);
  if (prjMatch && prjMatch[1]) {
    projectCode = prjMatch[1].trim();
  } else {
    var codeMatch = subject.match(/\b([0-9]{6})\b/);
    if (codeMatch && codeMatch[1]) {
      projectCode = codeMatch[1].trim();
    }
  }

  // 2. Nhà thầu
  var supplierName = '';
  var supMatch = fullText.match(/\b(Link4|Smart|CTM|Infinity|Keycom|SDC|TLV)\b/i);
  if (supMatch && supMatch[1]) {
    supplierName = supMatch[1].trim();
  }

  // 3. Kết quả nghiệm thu
  var result = 'IN_PROGRESS';
  if (/đạt 100%|kết quả:?\s*đạt|kết luận:?\s*đạt|nghiệm thu đạt|pass/i.test(fullText)) {
    result = 'PASSED';
  } else if (/không đạt|tạm hoãn|chưa đạt|fail|lỗi in|lệch màu|sửa lại/i.test(fullText)) {
    result = 'FAILED';
  }

  // 4. Nhãn hàng / Brand
  var brand = '';
  var brandMatch = fullText.match(/\b(Dove|CloseUp|Close Up|P\/S|Clear|Sunsilk|Lifebuoy|Omo|Comfort|Knorr|Vaseline|Rexona)\b/i);
  if (brandMatch && brandMatch[1]) {
    brand = brandMatch[1].trim();
  }

  return {
    projectCode: projectCode,
    supplierName: supplierName,
    result: result,
    brand: brand
  };
}

/**
 * 2. HÀM QUÉT GMAIL NTXX THÔNG MINH (CHỈ XỬ LÝ MAIL MỚI / THAY ĐỔI)
 */
function processNtxxGmailSearch(params) {
  var query = params.q ? decodeURIComponent(params.q) : NTXX_CONFIG.DEFAULT_QUERY;
  var limit = parseInt(params.limit || String(NTXX_CONFIG.DEFAULT_LIMIT), 10);
  var isIncremental = params.incremental !== false && params.incremental !== 'false';

  var existingMap = isIncremental ? getExistingNtxxThreadsMap() : {};
  
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

    // BỎ QUA trong 0.01s nếu luồng thư không có phản hồi mới
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
            name: att.getName() || ('BBNT_' + (k + 1)),
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

    var meta = extractNtxxMetadata(threadSubject, lastPlain);

    var threadObj = {
      threadId: threadId,
      projectCode: meta.projectCode,
      supplierName: meta.supplierName,
      brand: meta.brand,
      status: meta.result,
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

    // Chuẩn bị payload để Upsert vào Supabase
    supabasePayload.push({
      thread_id: threadId,
      project_code: meta.projectCode || null,
      supplier_name: meta.supplierName || null,
      brand: meta.brand || null,
      result: meta.result,
      subject: threadSubject,
      from_email: lastFrom,
      from_name: fromName,
      last_updated: lastUpdatedIso,
      snippet: lastPlain.substring(0, 200),
      messages: msgsData,
      has_attachments: totalAttachments.length > 0,
      attachments_count: totalAttachments.length,
      updated_at: new Date().toISOString()
    });
  }

  // Thực hiện UPSERT sang Supabase REST API
  var supabaseStatus = 'skipped';
  if (supabasePayload.length > 0) {
    try {
      var upsertEndpoint = NTXX_CONFIG.PROJECT_URL + '/rest/v1/' + NTXX_CONFIG.TABLE_NAME + '?on_conflict=thread_id';
      var supaOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'apikey': NTXX_CONFIG.ANON_KEY,
          'Authorization': 'Bearer ' + NTXX_CONFIG.ANON_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        payload: JSON.stringify(supabasePayload),
        muteHttpExceptions: true
      };

      var supaRes = UrlFetchApp.fetch(upsertEndpoint, supaOptions);
      supabaseStatus = supaRes.getResponseCode() >= 200 && supaRes.getResponseCode() < 300 
        ? 'success (' + supabasePayload.length + ' threads updated)' 
        : 'error ' + supaRes.getResponseCode() + ': ' + supaRes.getContentText();
    } catch (err) {
      supabaseStatus = 'fail: ' + err.toString();
    }
  }

  return {
    processed: results.length,
    skipped: skippedCount,
    totalFound: threads.length,
    supabaseStatus: supabaseStatus,
    threads: results
  };
}

/**
 * 3. HÀM XỬ LÝ HTTP GET (WEB APP ENDPOINT)
 */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  
  if (action === 'sync_ntxx_now' || action === 'get_ntxx_emails') {
    var query = e.parameter.q || NTXX_CONFIG.DEFAULT_QUERY;
    var limit = e.parameter.limit || 20;
    var resData = processNtxxGmailSearch({ q: query, limit: limit, incremental: false });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: resData
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'NTXX Gmail Supabase Sync API',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 4. HÀM XỬ LÝ HTTP POST (WEB APP ENDPOINT)
 */
function doPost(e) {
  try {
    var body = e.postData ? JSON.parse(e.postData.contents) : {};
    var action = body.action || '';

    if (action === 'sync_ntxx_now') {
      var resData = processNtxxGmailSearch({
        q: body.q || NTXX_CONFIG.DEFAULT_QUERY,
        limit: body.limit || 20,
        incremental: body.incremental !== false
      });
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: resData
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: 'Unknown action'
  })).setMimeType(ContentService.MimeType.JSON);
}
