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
function zrDashboardCollectChat() {
  return zrDashboardSafe_(function(){
    // Không gọi deleteWebhook hay setWebhook: tránh ảnh hưởng bot hiện tại.
    var result;
    try {
      result = zrRequest_('getUpdates', {timeout: '1'});
    } catch(e) {
      var msg = String(e.message || e);
      if (/Request timeout|timeout/i.test(msg)) return {found:false, message:'Chưa có tin nhắn mới. Nhắn /start hoặc CHAO cho bot rồi thử lại. Nếu bot có webhook, hãy dùng Chat ID đã biết.'};
      throw e;
    }
    var updates = Array.isArray(result) ? result : (result ? [result] : []);
    var chats = [];
    updates.forEach(function (item) {
      var m = item && (item.message || item.edited_message);
      var chat = m && m.chat;
      if (chat && chat.id != null) chats.push({id:String(chat.id), name:String(chat.title || m.from && m.from.name || 'Cuộc trò chuyện')});
    });
    return chats.length ? {found:true, chats: chats} : {found:false, message:'API chưa trả về cuộc trò chuyện. Hãy gửi tin nhắn mới đến bot.'};
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
