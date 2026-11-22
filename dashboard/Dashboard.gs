/**
 * Dashboard Sổ tay nhắc việc số.
 * Sao chép vào CÙNG dự án GAS với ZaloReminders.gs để dùng chung Script Properties.
 * Web app chỉ triển khai quyền truy cập "Chỉ mình tôi".
 * Tuyệt đối không tạo public dashboard chạy bằng quyền tài khoản sở hữu.
 */
function zrDashboardView() {
  return HtmlService.createHtmlOutputFromFile('DashboardUI')
    .setTitle('Sổ tay nhắc việc số | Dashboard Zalo');
}
function zrDashboardGuard_() {
  // Chỉ chủ sở hữu dự án được sử dụng các RPC quản trị.
  // Khi execute as me, effective user là chủ sở hữu. Vì thế luôn triển khai web app "Only myself".
  var allowed = PropertiesService.getScriptProperties().getProperty('ZR_ADMIN_EMAIL');
  if (!allowed) throw new Error('Chưa cài ZR_ADMIN_EMAIL trong Script Properties (email tài khoản Google của bạn).');
  var actor = Session.getActiveUser().getEmail();
  if (!actor || actor.toLowerCase() !== allowed.trim().toLowerCase()) {
    throw new Error('Không có quyền truy cập Dashboard. Triển khai Chỉ mình tôi và đăng nhập đúng tài khoản.');
  }
}
function zrDashboardSafe_(fn) {
  zrDashboardGuard_();
  try { return fn(); } catch(e) { throw new Error(String(e.message || e).replace(/bot\d+:[^\/\s]+/ig, 'bot***')); }
}
function zrDashboardStatus() {
  return zrDashboardSafe_(function(){
    var p = PropertiesService.getScriptProperties();
    return {
      tokenConfigured: !!p.getProperty('ZALO_BOT_TOKEN'),
      chatId: p.getProperty('ZALO_CHAT_ID') || '',
      sheet: p.getProperty('TASK_SHEET_NAME') || 'CongViec',
      spreadsheetConfigured: !!p.getProperty('SPREADSHEET_ID'),
      webhookWarning: 'getUpdates không nhận được tin nhắn nếu bot có webhook đang hoạt động',
      dashboardUrl: ZR_CONFIG.site
    };
  });
}
function zrDashboardTestBot() {
  return zrDashboardSafe_(function(){
    var data = zrRequest_('getMe', {});
    return {ok: true, bot: data};
  });
}
/**
 * Chẩn đoán polling mà không xóa webhook, không đưa token lên trang.
 * Trả về mã lỗi API và dạng kết quả đã lược bỏ nội dung tin nhắn.
 */
function zrDashboardDiagnostic() {
  return zrDashboardSafe_(function() {
    var info = {checkedAt: new Date().toISOString(), bot: 'unknown', webhook: 'unknown', polling: 'unknown'};
    try {
      var me = zrRequest_('getMe', {});
      info.bot = 'ok';
      info.botName = String(me && (me.account_name || me.name || me.username || me.first_name) || 'Không có tên');
      info.botId = String(me && me.id || '');
    } catch(e) {info.bot = 'error: ' + String(e.message || e).slice(0,160);}
    try {
      var w = zrRequest_('getWebhookInfo', {});
      info.webhook = w && w.url ? 'configured' : 'none';
      // Chỉ hiển thị có/không, không phơi bày URL webhook.
    } catch(e) {info.webhook = /Not Found/i.test(String(e.message || e)) ? 'API không hỗ trợ kiểm tra (Not Found)' : 'unknown: ' + String(e.message || e).slice(0,130);}
    return info;
  });
}
function zrDashboardCollectChat() {
  return zrDashboardSafe_(function() {
    var data;
    try {
      // timeout là thời gian chờ (giây), không phải mã lỗi.
      data = zrRequest_('getUpdates', {timeout: '20'});
    } catch(e) {
      var error = String(e.message || e);
      if (/Request timeout|timeout/i.test(error)) return {
        found:false, code:'NO_UPDATE',
        message:'Không có cập nhật trong thời gian chờ. Hãy kiểm tra đúng cuộc trò chuyện với bot, gửi tin mới trong lúc bấm nút và kiểm tra trạng thái webhook.'
      };
      return {found:false,code:'API_ERROR',message:error.slice(0,250)};
    }
    // Có thể trả object đơn lẻ, array, hoặc object bao bên ngoài.
    var updates = Array.isArray(data) ? data : (data && Array.isArray(data.updates) ? data.updates : (data ? [data] : []));
    var chats = [];
    updates.forEach(function (item) {
      var payload = item && (item.result || item);
      var msg = payload && (payload.message || payload.edited_message);
      if (msg && msg.chat && msg.chat.id != null) {
        var chatType = String(msg.chat.chat_type || '');
        chats.push({id:String(msg.chat.id),name:chatType==='GROUP'?'Nhóm Zalo':'Zalo cá nhân',chatType:chatType});
      }
    });
    if (chats.length) return {found:true,code:'FOUND',chats:chats};
    var shapes = updates.slice(0,3).map(function(item) {
      var payload = item && (item.result || item);
      return payload && typeof payload==='object' ? Object.keys(payload).slice(0,8) : [];
    });
    return {found:false, code:'UNRECOGNIZED_UPDATE', message:'API có phản hồi nhưng chưa thấy message.chat.id. Cấu trúc trường nhận được: '+JSON.stringify(shapes)};
  });
}
function zrDashboardSaveChatId(chatId) {
  return zrDashboardSafe_(function(){
    var value=String(chatId || '').trim();
    if (!/^[\w-]{1,100}$/.test(value)) throw new Error('Chat ID không hợp lệ.');
    PropertiesService.getScriptProperties().setProperty('ZALO_CHAT_ID',value);
    return {ok:true, chatId:value};
  });
}
function zrDashboardTestSend() {
  return zrDashboardSafe_(function(){
    zrSendTest();
    return {ok:true, message:'Đã gửi yêu cầu thử nghiệm tới Zalo; hãy kiểm tra cuộc trò chuyện.'};
  });
}
function zrDashboardTasksPreview() {
  return zrDashboardSafe_(function(){
    var tasks=zrTasks_();
    var active=tasks.filter(function(t){return !zrFinished_(t.status);});
    return {total:tasks.length, active:active.length, preview:active.slice(0,8).map(function(t){
      var d=zrDate_(t.due);
      return {id:t.id,title:t.title,due:isNaN(d.getTime())?'Không hợp lệ':Utilities.formatDate(d,ZR_CONFIG.tz,'dd/MM/yyyy HH:mm'),status:t.status};
    })};
  });
}
