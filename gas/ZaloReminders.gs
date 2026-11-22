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
  overdueHours: 24,
  reminderGraceMinutes: 3
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
/** Mốc hỗ trợ: mặc định 60 phút cho công việc cũ, không ghi đè dữ liệu. */
function zrParseRemindMinutes_(value){
  var raw=Array.isArray(value)?value:String(value==null?'':value).split(',');
  if(!raw.length||(raw.length===1&&String(raw[0]).trim()===''))return [60];
  var allowed=[1,2,5,10,15,30,60,1440];
  return Array.from(new Set(raw.map(function(x){return Number(String(x).trim());})
    .filter(function(x){return allowed.indexOf(x)!==-1;}))).sort(function(a,b){return b-a;});
}
function zrZaloEnabled_(value){
  if(value===false)return false;
  return !['false','0','không','tat','tắt','off'].includes(String(value==null?'':value).trim().toLowerCase());
}
function zrSentMarks_(value,due){
  var expected=String(due.getTime())+':';
  return String(value||'').split('|').filter(function(item){return item.indexOf(expected)===0;});
}
function zrReminderLog_(task,stage,result){
  try{
    var book=zrSheet_().getParent();
    var sheet=book.getSheetByName('NhatKyNhac');
    if(!sheet){sheet=book.insertSheet('NhatKyNhac');sheet.appendRow(['Thời gian','ID công việc','Công việc','Mốc','Kết quả']);}
    sheet.appendRow([new Date(),task.id,task.title,stage,result]);
  }catch(e){Logger.log('Không ghi được nhật ký nhắc việc: '+String(e.message||e).slice(0,100));}
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
    status: col('TASK_HEADER_STATUS', 'Trạng thái'),
    reminder: heads.indexOf('nhắc trước (phút)'),
    enabled: heads.indexOf('bật nhắc zalo'),
    sent: heads.indexOf('đã nhắc các mốc')
  };
  if (['id','title','due','status'].some(function(k){return ix[k]<0;})) {
    throw new Error('Không khớp tiêu đề cột. Cần các cột: ID, Công việc, Hạn hoàn thành, Trạng thái hoặc cấu hình TASK_HEADER_*.');
  }
  return values.slice(1).map(function (r, index) {
    return { id: String(r[ix.id] || 'R' + (index + 2)).trim(),
      title: String(r[ix.title] || '').trim(),
      due: r[ix.due], status: String(r[ix.status] || '').trim().toLowerCase(),
      rowNumber:index+2,
      remindMinutes:zrParseRemindMinutes_(ix.reminder<0?'':r[ix.reminder]),
      zaloEnabled:zrZaloEnabled_(ix.enabled<0?'':r[ix.enabled]),
      sent:ix.sent<0?'':String(r[ix.sent]||''), sentColumn:ix.sent+1 };
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
/**
 * V3: quét 1 phút/lần, chỉ gửi trong cửa sổ mốc được chọn.
 * Mốc đã gửi được đánh dấu bằng due timestamp + mốc trong Sheet, tránh lặp.
 * Công việc cũ chưa có cột mới mặc định được nhắc 60 phút.
 */
function zrCheckReminders() {
  if(zrSetting_('ZR_REMINDER_ENABLED','true')==='false')return;
  if(!zrSetting_('ZALO_CHAT_ID'))throw new Error('Chưa có ZALO_CHAT_ID');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))return;
  try{
    var sheet=zrSheet_();
    // Lần đầu triển khai V3 tự bổ sung 3 cột ở cuối (không đổi 9 cột cũ).
    if(typeof zrEnsureV3Columns_==='function')zrEnsureV3Columns_(sheet);
    var now=Date.now();
    zrTasks_().forEach(function(task){
      if(zrFinished_(task.status)||!task.zaloEnabled)return;
      var due=zrDate_(task.due);
      if(isNaN(due.getTime()))return;
      var dueMs=due.getTime();
      var sent=zrSentMarks_(task.sent,due);
      var stage='',mark='';
      // Các mốc được xét theo thứ tự từ lớn đến nhỏ.
      // Không gửi bù mốc đã lỡ quá 3 phút, tránh gửi hàng loạt khi mới bật trigger.
      for(var i=0;i<task.remindMinutes.length;i++){
        var minutes=task.remindMinutes[i];
        var target=dueMs-minutes*60000;
        var key=dueMs+':'+minutes;
        if(now>=target && now<target+ZR_CONFIG.reminderGraceMinutes*60000 &&
            now<dueMs && sent.indexOf(key)<0){
          mark=key;stage='Trước hạn '+minutes+' phút';break;
        }
      }
      // Giữ cảnh báo quá hạn riêng, trong 3 phút đầu sau hạn để tránh báo muộn hàng giờ.
      if(!mark && now>=dueMs && now<dueMs+ZR_CONFIG.reminderGraceMinutes*60000 &&
         sent.indexOf(dueMs+':overdue')<0){
        mark=dueMs+':overdue';stage='Quá hạn';
      }
      if(!mark)return;
      try{
        zrSendTask_(task,stage==='Quá hạn'?'⚠️ CÔNG VIỆC QUÁ HẠN':'⏰ NHẮC '+stage.toUpperCase());
        if(task.sentColumn>0){
          var marks=sent.concat([mark]).join('|');
          sheet.getRange(task.rowNumber,task.sentColumn).setValue(marks);
        }
        zrReminderLog_(task,stage,'Zalo API đã nhận');
      }catch(e){
        zrReminderLog_(task,stage,'Lỗi gửi Zalo: '+String(e.message||e).slice(0,140));
        throw e;
      }
    });
  }finally{lock.releaseLock();}
}
/** Cài một trigger 1 phút, xóa trigger cũ cùng hàm do tài khoản này tạo. */
function zrInstallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='zrCheckReminders')ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('zrCheckReminders').timeBased().everyMinutes(1).create();
  Logger.log('Đã cài kiểm tra nhắc việc mỗi 1 phút.');
}

/**
 * Chẩn đoán nhắc việc không gửi Zalo, KHÔNG gửi tin và không đổi dữ liệu.
 * Chạy trong DỰ ÁN GAS BOT ZALO (không chạy ở cổng đồng bộ).
 */
function zrDiagnoseReminders() {
  var p=PropertiesService.getScriptProperties();
  Logger.log('BOT_TOKEN: '+(p.getProperty('ZALO_BOT_TOKEN')?'SET':'MISSING'));
  Logger.log('CHAT_ID: '+(p.getProperty('ZALO_CHAT_ID')?'SET':'MISSING'));
  Logger.log('REMINDER_ENABLED: '+zrSetting_('ZR_REMINDER_ENABLED','true'));
  var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='zrCheckReminders';});
  Logger.log('REMINDER_TRIGGERS: '+triggers.length);
  try {
    var items=zrTasks_(),now=Date.now(),eligible=0,already=0,disabled=0,late=0;
    items.forEach(function(task){
      if(zrFinished_(task.status))return;
      if(!task.zaloEnabled){disabled++;return;}
      var due=zrDate_(task.due);
      if(isNaN(due.getTime()))return;
      var marks=zrSentMarks_(task.sent,due);
      task.remindMinutes.forEach(function(m){
        var target=due.getTime()-m*60000;
        if(now>=target&&now<Math.min(due.getTime(),target+ZR_CONFIG.reminderGraceMinutes*60000)){
          eligible++;
          if(marks.indexOf(due.getTime()+':'+m)>=0)already++;
        }
      });
      if(now>=due.getTime()&&now<due.getTime()+ZR_CONFIG.reminderGraceMinutes*60000){
        late++;
        if(marks.indexOf(due.getTime()+':overdue')>=0)already++;
      }
    });
    Logger.log('TASKS: total='+items.length+', upcoming_eligible='+eligible+', overdue_eligible='+late+', already_sent='+already+', disabled='+disabled);
    Logger.log('NOW: '+Utilities.formatDate(new Date(now),ZR_CONFIG.tz,'dd/MM/yyyy HH:mm'));
  }catch(e){Logger.log('TASK_READ_FAILED: '+String(e.message||e).slice(0,160));}
  Logger.log('Không gửi tin trong hàm chẩn đoán. Kiểm tra NhatKyNhac để xem thông báo đã gửi.');
}
