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
  site: 'https://script.google.com/macros/s/AKfycbw93F_saU8Vw6Wd-Lg9qOYv_THGK1p8YNilJU8M933OuOP9QavproWmTMtAjMYOg7KRmA/exec',
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
/** Chạy sau khi nhắn một tin vào Bot; chỉ xem chat_id qua Execution log. */
function zrDiscoverChatId() {
  var data = zrRequest_('getUpdates', { limit: 20, timeout: 0 });
  (Array.isArray(data) ? data : []).forEach(function (update) {
    var msg = update.message || update.edited_message;
    if (msg && msg.chat && msg.chat.id) Logger.log('chat_id=' + msg.chat.id + ' text=' + String(msg.text || '').slice(0, 80));
  });
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
  var text = title + '\n📌 ' + task.title + '\n🗓 Hạn: ' + when +
    '\n🔗 Mở phần mềm: ' + ZR_CONFIG.site;
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
  ScriptApp.newTrigger('zrCheckReminders').timeBased().everyMinutes(15).create();
  Logger.log('Đã cài trigger zrCheckReminders mỗi 15 phút.');
}
