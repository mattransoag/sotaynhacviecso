/**
 * SỔ TAY NHẮC VIỆC SỐ — KẾT NỐI ZALO BOT, KHÔNG CẦN AI
 * Thêm nguyên tệp này vào cùng dự án Google Apps Script có quyền đọc Sheet.
 * KHÔNG thay Code.gs, doGet(e), doPost(e) hiện có.
 *
 * Script Properties (Project Settings):
 *   ZALO_BOT_TOKEN       = Token của Bot tạo tại Zalo Bot Manager
 *   ZALO_CHAT_ID         = chat_id của người nhận (lấy bằng zrDiscoverChatId)
 *   TASK_SHEET_NAME      = tên sheet chứa công việc (mặc định CongViec)
 *   SPREADSHEET_ID       = ID Google Sheet (bỏ trống nếu GAS gắn sẵn)
 *   TASK_HEADER_ID       = ID
 *   TASK_HEADER_TITLE    = Công việc
 *   TASK_HEADER_DUE      = Hạn hoàn thành
 *   TASK_HEADER_STATUS   = Trạng thái
 */
var ZR_CONFIG = {
  tz: 'Asia/Ho_Chi_Minh',
  site: 'https://script.google.com/macros/s/AKfycbxQmhI6Wv7UXuSQu_hfbpZjqqC2hLifiQcRrKdxhy75UM1Qw97n4NMyIfkaQHaMuEabLw/exec',
  beforeMinutes: 60,
  overdueHours: 24
};
function zrSetting_(name, fallback) {
  return PropertiesService.getScriptProperties().getProperty(name) || fallback || '';
}
function zrRequest_(method, body) {
  var token = zrSetting_('ZALO_BOT_TOKEN');
  if (!token) throw new Error('Chưa cấu hình ZALO_BOT_TOKEN trong Script Properties.');
  var response = UrlFetchApp.fetch('https://bot-api.zaloplatforms.com/bot' + encodeURIComponent(token) + '/' + method, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(body || {}), muteHttpExceptions: true
  });
  var result;
  try { result = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Zalo API trả về nội dung không phải JSON, HTTP ' + response.getResponseCode()); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.ok !== true) {
    throw new Error('Zalo API lỗi HTTP ' + response.getResponseCode() + ': ' + (result.description || result.error_code || 'unknown'));
  }
  return result.result;
}
/** Kiểm tra token trước khi lấy chat ID. */
function zrTestBotToken() {
  var info = zrRequest_('getMe', {});
  Logger.log('Kết nối bot thành công: ' + JSON.stringify(info));
}
/** Kiểm tra trạng thái webhook (không xóa webhook). */
function zrCheckWebhook() {
  var info = zrRequest_('getWebhookInfo', {});
  Logger.log('Webhook: ' + JSON.stringify(info));
}
/** Gửi lời chào mới cho bot rồi chạy hàm này ngay. */
function zrDiscoverChatId() {
  var data;
  try {
    data = zrRequest_('getUpdates', { timeout: '1' });
  } catch (err) {
    if (String(err.message).indexOf('Request timeout') !== -1) {
      Logger.log('Zalo chưa trả bản cập nhật trong thời gian chờ. Hãy nhắn tin mới cho bot rồi chạy lại. Kiểm tra zrCheckWebhook nếu vẫn gặp lỗi.');
      return;
    }
    throw err;
  }
  // Zalo Bot API thường trả về một update; đồng thời hỗ trợ dạng mảng.
  var updates = Array.isArray(data) ? data : (data ? [data] : []);
  var found = 0;
  updates.forEach(function (update) {
    var msg = (update && (update.message || update.edited_message)) || null;
    if (msg && msg.chat && msg.chat.id != null) {
      Logger.log('ZALO_CHAT_ID=' + String(msg.chat.id));
      found++;
    }
  });
  if (!found) Logger.log('Chưa thấy chat_id. Hãy nhắn một tin mới tới bot và chạy lại zrDiscoverChatId. Nếu đã bật webhook, getUpdates có thể không nhận tin.');
}
/** Chạy thủ công để kiểm tra token và chat_id. */
function zrSendTest() {
  var chatId = zrSetting_('ZALO_CHAT_ID');
  if (!chatId) throw new Error('Chưa có ZALO_CHAT_ID.');
  zrRequest_('sendMessage', {chat_id: chatId, text: '✅ Bot Sổ tay nhắc việc số đã kết nối thử nghiệm thành công.'});
}
function zrSheet_() {
  var id = zrSetting_('SPREADSHEET_ID');
  var file = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!file) throw new Error('Thiếu SPREADSHEET_ID và dự án GAS không gắn Spreadsheet.');
  var sheetName = zrSetting_('TASK_SHEET_NAME', 'CongViec');
  var sheet = file.getSheetByName(sheetName);
  if (!sheet) throw new Error('Không thấy sheet ' + sheetName + '. Chỉnh TASK_SHEET_NAME.');
  return sheet;
}
function zrTasks_() {
  var values = zrSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  var heads = values[0].map(function (x) { return String(x).trim().toLowerCase(); });
  function col(prop, def) { return heads.indexOf(zrSetting_(prop, def).trim().toLowerCase()); }
  var ix = {
    id: col('TASK_HEADER_ID', 'ID'),
    title: col('TASK_HEADER_TITLE', 'Công việc'),
    due: col('TASK_HEADER_DUE', 'Hạn hoàn thành'),
    status: col('TASK_HEADER_STATUS', 'Trạng thái')
  };
  if (Object.keys(ix).some(function (k) {return ix[k] < 0;})) {
    throw new Error('Không khớp tiêu đề cột. Cần các cột: ID, Công việc, Hạn hoàn thành, Trạng thái hoặc cấu hình TASK_HEADER_*.');
  }
  return values.slice(1).map(function (r, index) {
    return { id: String(r[ix.id] || 'R' + (index + 2)).trim(),
      title: String(r[ix.title] || '').trim(),
      due: r[ix.due], status: String(r[ix.status] || '').trim().toLowerCase() };
  }).filter(function (t) {return t.title;});
}
function zrDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') return new Date(value);
  var raw = String(value || '').trim();
  // dd/MM/yyyy HH:mm (Vietnamese spreadsheet text)
  var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    var iso = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) + 'T' +
      ('0' + (m[4] || '0')).slice(-2) + ':' + (m[5] || '00') + ':00+07:00';
    return new Date(iso);
  }
  return new Date(raw);
}
function zrFinished_(status) {
  return ['done','completed','hoàn thành','đã hoàn thành','đã xong','xong'].indexOf(status) !== -1;
}
function zrSendTask_(task, title) {
  var when = Utilities.formatDate(zrDate_(task.due), ZR_CONFIG.tz, 'dd/MM/yyyy HH:mm');
  var appUrl = zrSetting_('ZR_APP_URL', ZR_CONFIG.site);
  var text = title + '\n📌 ' + task.title + '\n🗓 Hạn: ' + when +
    '\n🔗 Mở phần mềm: ' + appUrl;
  zrRequest_('sendMessage', {chat_id: zrSetting_('ZALO_CHAT_ID'), text: text.slice(0, 1950)});
}
/** Kiểm tra thủ công hoặc chạy 15 phút/lần bằng trigger. */
function zrCheckReminders() {
  if (!zrSetting_('ZALO_CHAT_ID')) throw new Error('Chưa có ZALO_CHAT_ID');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var now = Date.now();
    var props = PropertiesService.getScriptProperties();
    zrTasks_().forEach(function (task) {
      if (zrFinished_(task.status)) return;
      var due = zrDate_(task.due).getTime();
      if (!Number.isFinite(due)) return;
      var upcoming = due >= now && due <= now + ZR_CONFIG.beforeMinutes * 60000;
      var overdue = due < now && now - due <= ZR_CONFIG.overdueHours * 3600000;
      if (!upcoming && !overdue) return;
      var stage = upcoming ? 'soon' : 'overdue';
      // Chống lặp theo ID, hạn và giai đoạn, không lưu token trong khóa
      var key = 'zr_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
        task.id + '|' + due + '|' + stage).map(function (n) {return ('0' + (n & 255).toString(16)).slice(-2);}).join('').slice(0, 32);
      if (props.getProperty(key)) return;
      zrSendTask_(task, upcoming ? '⏰ NHẮC CÔNG VIỆC SẮP ĐẾN HẠN' : '⚠️ CÔNG VIỆC QUÁ HẠN');
      props.setProperty(key, String(now));
    });
  } finally { lock.releaseLock(); }
}
/** Chạy một lần; không tạo trigger trùng. */
function zrInstallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'zrCheckReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('zrCheckReminders').timeBased().everyMinutes(5).create();
  Logger.log('Đã cài trigger zrCheckReminders mỗi 5 phút.');
}


/**
 * Chẩn đoán nhắc việc không gửi Zalo, KHÔNG gửi tin và không đổi dữ liệu.
 * Chạy trong DỰ ÁN GAS BOT ZALO (không chạy ở cổng đồng bộ).
 */
function zrDiagnoseReminders() {
  var scriptProps = PropertiesService.getScriptProperties();
  var hasToken = !!scriptProps.getProperty('ZALO_BOT_TOKEN');
  var hasChat = !!scriptProps.getProperty('ZALO_CHAT_ID');
  var sheetId = scriptProps.getProperty('SPREADSHEET_ID') || '';
  Logger.log('BOT_TOKEN: ' + (hasToken ? 'SET' : 'MISSING'));
  Logger.log('CHAT_ID: ' + (hasChat ? 'SET' : 'MISSING'));
  Logger.log('SHEET_ID: ' + (sheetId ? 'SET' : 'MISSING_OR_BOUND'));
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === 'zrCheckReminders';
  });
  Logger.log('REMINDER_TRIGGERS: ' + triggers.length);
  var sheet, items;
  try {
    sheet = zrSheet_();
    Logger.log('TASK_SHEET: ' + sheet.getName() + ' / rows=' + Math.max(sheet.getLastRow() - 1, 0));
    items = zrTasks_();
  } catch(e) {
    Logger.log('TASK_READ: FAILED ' + String(e.message).slice(0,150));
    return;
  }
  var now = Date.now(), eligible = 0, completed = 0, invalidDate = 0, tooEarly = 0, tooOld = 0, alreadySent = 0;
  items.forEach(function(task) {
    if (zrFinished_(task.status)) { completed++; return; }
    var due = zrDate_(task.due).getTime();
    if (!Number.isFinite(due)) { invalidDate++; return; }
    var upcoming = due >= now && due <= now + ZR_CONFIG.beforeMinutes * 60000;
    var overdue = due < now && now - due <= ZR_CONFIG.overdueHours * 3600000;
    if (!upcoming && !overdue) {
      if (due > now) tooEarly++; else tooOld++;
      return;
    }
    eligible++;
    var stage = upcoming ? 'soon' : 'overdue';
    var key = 'zr_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      task.id + '|' + due + '|' + stage).map(function(n) {
        return ('0' + (n & 255).toString(16)).slice(-2);
      }).join('').slice(0, 32);
    if (scriptProps.getProperty(key)) alreadySent++;
  });
  Logger.log('TASKS: total=' + items.length +
    ', eligible_now=' + eligible +
    ', already_sent_in_stage=' + alreadySent +
    ', completed=' + completed +
    ', future_outside_60m=' + tooEarly +
    ', overdue_over_24h=' + tooOld +
    ', invalid_due=' + invalidDate);
  Logger.log('TIME_NOW: ' + Utilities.formatDate(new Date(now), ZR_CONFIG.tz, 'dd/MM/yyyy HH:mm'));
  Logger.log('NEXT_ACTION: run zrSendTest to verify Zalo delivery; only after confirmation run zrCheckReminders.');
}
