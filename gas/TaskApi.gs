/**
 * SỔ TAY NHẮC VIỆC SỐ — API quản lý công việc, dùng chung Google Sheets + Zalo Bot.
 * ĐẶT CÙNG DỰ ÁN GAS ĐÃ CÓ ZaloReminders.gs, Dashboard.gs, SetupWorkSheet.gs.
 * Không khai báo doGet/doPost mới. Chỉ cho phép truy cập bằng Dashboard giới hạn Only myself.
 */
function zrTasksAuth_(){
  // Bảo vệ tất cả lời gọi từ trình duyệt; tránh public CRUD.
  zrDashboardGuard_();
}
/**
 * Bổ sung cột mới ở cuối bảng CongViec, giữ nguyên 9 cột cũ và dữ liệu hiện có.
 * Tự áp dụng khi truy cập màn hình công việc V3.
 */
function zrEnsureV3Columns_(sheet){
  var existing=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(x){return String(x).trim().toLowerCase()});
  ['Nhắc trước (phút)','Bật nhắc Zalo','Đã nhắc các mốc'].forEach(function(name){
    if(existing.indexOf(name.toLowerCase())<0){
      var next=sheet.getLastColumn()+1;
      sheet.getRange(1,next).setValue(name);
      sheet.getRange(1,next).setFontWeight('bold').setBackground('#15345c').setFontColor('#ffffff');
      existing.push(name.toLowerCase());
    }
  });
}
function zrTaskColumns_(){
  var sheet=zrSheet_();
  zrEnsureV3Columns_(sheet);
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(x){return String(x).trim().toLowerCase()});
  var labels=['ID','Công việc','Hạn hoàn thành','Trạng thái','Người phụ trách','Mức ưu tiên','Ghi chú','Ngày tạo','Ngày hoàn thành'];
  var indices=labels.map(function(label){
    var at=headers.indexOf(label.toLowerCase());
    if(at<0)throw new Error('Thiếu cột "'+label+'". Kiểm tra Google Sheets đã khởi tạo.');
    return at;
  });
  return {sheet:sheet,indices:indices.concat(['Nhắc trước (phút)','Bật nhắc Zalo','Đã nhắc các mốc'].map(function(n){return headers.indexOf(n.toLowerCase())}))};
}
function zrTaskReadRow_(row, col){
  function at(i){return row[col[i]]}
  var date=at(2);
  var iso=(Object.prototype.toString.call(date)==='[object Date]' && !isNaN(date.getTime()))?
    date.toISOString():(function(){var d=zrDate_(date);return isNaN(d.getTime())?'':d.toISOString()})();
  var status=String(at(3)||'');
  return {id:String(at(0)||''),name:String(at(1)||''),due:iso,
    status:status,done:zrFinished_(status.trim().toLowerCase()),
    owner:String(at(4)||''),priority:String(at(5)||'Trung bình'),note:String(at(6)||''),
    remindMinutes:zrParseRemindMinutes_(at(9)),zaloEnabled:zrZaloEnabled_(at(10)),
    reminderSent:String(at(11)||'')};
}
function zrApiListTasks(){
  zrTasksAuth_();
  var data=zrTaskColumns_(),s=data.sheet,cols=data.indices;
  if(s.getLastRow()<2)return [];
  return s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues()
    .map(function(row){return zrTaskReadRow_(row,cols)})
    .filter(function(t){return t.id && t.name});
}
function zrValidateTask_(input){
  if(!input||typeof input!=='object')throw new Error('Dữ liệu công việc không hợp lệ');
  var name=String(input.name||'').trim();
  if(!name||name.length>200)throw new Error('Tên công việc từ 1 đến 200 ký tự');
  var iso=String(input.due||'');
  var due=new Date(iso);
  if(!iso||isNaN(due.getTime()))throw new Error('Ngày giờ không hợp lệ');
  var priority=String(input.priority||'Trung bình');
  if(['Cao','Trung bình','Thấp'].indexOf(priority)<0)throw new Error('Mức ưu tiên không hợp lệ');
  var owner=String(input.owner||'').trim(),note=String(input.note||'').trim();
  if(owner.length>100||note.length>1000)throw new Error('Thông tin vượt độ dài cho phép');
  var reminders=zrParseRemindMinutes_(input.remindMinutes);
  if(input.remindMinutes != null && String(input.remindMinutes).trim()!=='' && !reminders.length)
    throw new Error('Chọn ít nhất một mốc nhắc hợp lệ');
  return {name:name,due:due,priority:priority,owner:owner,note:note,
    remindMinutes:reminders,zaloEnabled:input.zaloEnabled!==false};
}
function zrApiSaveTask(input){
  zrTasksAuth_();
  var task=zrValidateTask_(input),lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Dữ liệu đang được cập nhật. Thử lại.');
  try{
    var source=zrTaskColumns_(),s=source.sheet,col=source.indices,last=s.getLastRow(),id=String(input.id||'').trim();
    var rowNum=-1, row;
    if(id){
      if(id.length>100)throw new Error('ID không hợp lệ');
      if(last>=2){
        var ids=s.getRange(2,col[0]+1,last-1,1).getValues();
        for(var k=0;k<ids.length;k++)if(String(ids[k][0])===id){rowNum=k+2;break}
      }
      if(rowNum<0)throw new Error('Không tìm thấy công việc cần sửa');
      row=s.getRange(rowNum,1,1,s.getLastColumn()).getValues()[0];
    }else{
      id='CV-'+Utilities.getUuid();
      rowNum=last+1;
      row=Array(s.getLastColumn()).fill('');
      row[col[0]]=id;
      row[col[7]]=new Date();
      row[col[3]]='Chưa thực hiện';
    }
    var previousDue=row[col[2]];
    row[col[1]]=task.name;
    row[col[2]]=task.due;
    row[col[4]]=task.owner;
    row[col[5]]=task.priority;
    row[col[6]]=task.note;
    row[col[9]]=task.remindMinutes.join(',');
    row[col[10]]=task.zaloEnabled;
    // Khi đổi hạn, làm rỗng dấu nhắc cũ. Dấu có cả thời hạn để tránh nhắc sai.
    if(input.id && zrDate_(previousDue).getTime()!==task.due.getTime()) row[col[11]]='';
    s.getRange(rowNum,1,1,row.length).setValues([row]);
    return zrTaskReadRow_(row,col);
  }finally{lock.releaseLock()}
}
function zrApiSetDone(id,done){
  zrTasksAuth_();
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Dữ liệu đang bận');
  try{
    var source=zrTaskColumns_(),s=source.sheet,c=source.indices,last=s.getLastRow();
    if(last<2)throw new Error('Không có công việc');
    var ids=s.getRange(2,c[0]+1,last-1,1).getValues();
    var index=ids.findIndex(function(x){return String(x[0])===String(id)});
    if(index<0)throw new Error('Không tìm thấy công việc');
    var row=index+2;
    s.getRange(row,c[3]+1).setValue(done?'Hoàn thành':'Chưa thực hiện');
    s.getRange(row,c[8]+1).setValue(done?new Date():'');
    return {ok:true};
  }finally{lock.releaseLock()}
}
function zrApiDeleteTask(id){
  zrTasksAuth_();
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Dữ liệu đang bận');
  try{
    var source=zrTaskColumns_(),s=source.sheet,c=source.indices,last=s.getLastRow();
    if(last<2)throw new Error('Không có công việc');
    var ids=s.getRange(2,c[0]+1,last-1,1).getValues();
    var index=ids.findIndex(function(x){return String(x[0])===String(id)});
    if(index<0)throw new Error('Không tìm thấy công việc');
    s.deleteRow(index+2);
    return {ok:true};
  }finally{lock.releaseLock()}
}
/** Nhập JSON từ website tĩnh; luôn thêm ID mới, không thay thế dữ liệu có sẵn. */
function zrApiImportTasks(items){
  zrTasksAuth_();
  if(!Array.isArray(items)||items.length<1||items.length>100)throw new Error('Chỉ nhập 1 đến 100 công việc mỗi lần');
  var parsed=items.map(zrValidateTask_);
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Dữ liệu đang bận');
  try{
    var source=zrTaskColumns_(),s=source.sheet,c=source.indices,width=s.getLastColumn();
    var created=new Date();
    var rows=parsed.map(function(t,index){
      var r=Array(width).fill('');
      r[c[0]]='CV-'+Utilities.getUuid();
      r[c[1]]=t.name;r[c[2]]=t.due;r[c[3]]=items[index] && items[index].done ? 'Hoàn thành' : 'Chưa thực hiện';
      r[c[4]]=t.owner;r[c[5]]=t.priority;r[c[6]]=t.note;r[c[7]]=created;
      r[c[9]]=t.remindMinutes.join(',');r[c[10]]=t.zaloEnabled;
      return r;
    });
    s.getRange(s.getLastRow()+1,1,rows.length,width).setValues(rows);
    return {ok:true,count:rows.length};
  }finally{lock.releaseLock()}
}
/** Trả về trang quản lý công việc đã xác thực; gọi qua doGet(e) hiện hữu. */
function zrTaskManagerView(){
  return HtmlService.createHtmlOutputFromFile('TaskManagerUI')
    .setTitle('Sổ tay nhắc việc số — Đồng bộ Google Sheets');
}


/** Trạng thái kết nối an toàn, không bao giờ trả về token/chat ID. */
function zrApiReminderStatus() {
  zrTasksAuth_();
  var p=PropertiesService.getScriptProperties();
  var tokenSet=!!p.getProperty('ZALO_BOT_TOKEN');
  var chatSet=!!p.getProperty('ZALO_CHAT_ID');
  var triggers=ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction()==='zrCheckReminders';
  });
  var sheetOk=false,rows=0,eligible=0,unreadable='';
  try {
    var sheet=zrSheet_();sheetOk=true;
    var tasks=zrTasks_(),now=Date.now();
    rows=tasks.length;
    tasks.forEach(function(task){
      if(zrFinished_(task.status))return;
      var due=zrDate_(task.due).getTime();
      var reminders=task.remindMinutes||[60];
      if(!task.zaloEnabled)return;
      if(Number.isFinite(due) && ((due>=now&&reminders.some(function(m){var target=due-m*60000;return now>=target&&now<target+ZR_CONFIG.reminderGraceMinutes*60000;})) ||
          (due<now&&now-due<ZR_CONFIG.reminderGraceMinutes*60000)))eligible++;
    });
  }catch(ex){unreadable=String(ex.message||ex).slice(0,150)}
  var lastSend='',lastError='';
  try{
    var log=zrSheet_().getParent().getSheetByName('NhatKyNhac');
    if(log&&log.getLastRow()>1){
      var record=log.getRange(log.getLastRow(),1,1,5).getValues()[0];
      lastSend=Utilities.formatDate(new Date(record[0]),'Asia/Ho_Chi_Minh','dd/MM/yyyy HH:mm');
      if(/^Lỗi/.test(String(record[4]||'')))lastError='Gửi thất bại, kiểm tra nhật ký Sheets';
    }
  }catch(e){}
  return {
    lastSend:lastSend,lastError:lastError,
    tokenConfigured:tokenSet,chatConfigured:chatSet,
    triggerCount:triggers.length, sheetConnected:sheetOk,
    taskCount:rows, eligibleCount:eligible, sheetError:unreadable,
    checkFrequencyNote:'Cần có một trigger 1 phút; việc gửi có thể dao động theo Apps Script.',
    beforeMinutes:ZR_CONFIG.beforeMinutes,
    reminderEnabled:zrSetting_('ZR_REMINDER_ENABLED','true')!=='false'
  };
}
/** Gửi tin thử theo tài khoản đã cấu hình. Không tiết lộ ID người nhận. */
function zrApiReminderSendTest() {
  zrTasksAuth_();
  zrSendTest();
  return {ok:true,message:'Đã gọi Zalo API gửi tin thử. Hãy kiểm tra tài khoản Zalo nhận tin.'};
}
/** Cài lịch chạy mỗi 1 phút; người quản trị có thể bật/tắt nhắc việc. */
function zrApiReminderInstallOneMinute(){
  zrTasksAuth_();
  if(!zrSetting_('ZALO_BOT_TOKEN')||!zrSetting_('ZALO_CHAT_ID'))
    throw new Error('Cần có Bot Token và Chat ID trước khi bật lịch.');
  zrSheet_();
  zrInstallTrigger();
  PropertiesService.getScriptProperties().setProperty('ZR_REMINDER_ENABLED','true');
  return {ok:true,message:'Đã bật nhắc Zalo và cài lịch kiểm tra khoảng 1 phút/lần.'};
}
function zrApiReminderToggle(enabled){
  zrTasksAuth_();
  PropertiesService.getScriptProperties().setProperty('ZR_REMINDER_ENABLED', enabled===true?'true':'false');
  return {ok:true,enabled:enabled===true};
}
/** Giữ tương thích nút cũ, nay dùng lịch 1 phút. */
function zrApiReminderInstallFiveMinutes(){return zrApiReminderInstallOneMinute();}


/**
 * QUẢN LÝ BOT TRỰC TIẾP TỪ WEB GAS
 * Không trả Token/Chat ID về browser. Không cần tạo lại deployment để đổi bot.
 * Bảo vệ bằng guard quản trị đã có, cộng thêm kiểm tra email khi được cấu hình.
 */
function zrBotAdmin_() {
  zrTasksAuth_();
  var admin = String(PropertiesService.getScriptProperties().getProperty('ZR_ADMIN_EMAIL')||'').trim().toLowerCase();
  var actor = String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if(!admin)throw new Error('Chưa cài ZR_ADMIN_EMAIL trong Script Properties. Không thể sửa cấu hình bot.');
  if(!actor || actor!==admin)throw new Error('Không xác minh được tài khoản quản trị. Chỉ người quản trị được đổi bot.');
}
function zrApiBotSettings(){
  zrBotAdmin_();
  var props=PropertiesService.getScriptProperties();
  var token=props.getProperty('ZALO_BOT_TOKEN')||'';
  var chat=props.getProperty('ZALO_CHAT_ID')||'';
  return {tokenConfigured:!!token,chatConfigured:!!chat,
    // Không bao giờ xuất token hoặc Chat ID đầy đủ.
    botChangeNote:'Để đổi bot, nhập cả Bot Token mới và Chat ID của tài khoản đã nhắn với bot mới.'};
}
function zrBotMessage_(token,chatId,method,body){
  var response;
  try{
    response=UrlFetchApp.fetch('https://bot-api.zaloplatforms.com/bot'+encodeURIComponent(token)+'/'+method,{
      method:'post',contentType:'application/json',payload:JSON.stringify(body||{}),
      muteHttpExceptions:true
    });
  }catch(e){throw new Error('Không thể kết nối Zalo Bot API. Kiểm tra quyền UrlFetchApp và kết nối mạng.');}
  var result;
  try{result=JSON.parse(response.getContentText());}
  catch(e){throw new Error('Zalo API trả phản hồi không hợp lệ (HTTP '+response.getResponseCode()+').');}
  if(response.getResponseCode()<200||response.getResponseCode()>=300||result.ok!==true){
    // Không hiển thị body phản hồi từ bên thứ ba vì có thể chứa thông tin bí mật.
    throw new Error('Zalo Bot API không chấp nhận cấu hình hoặc tài khoản nhận tin (HTTP '+response.getResponseCode()+').');
  }
  return result.result;
}
/** Lưu một cặp token/chat ID mới, chỉ sau khi API thực sự gửi thành công tin thử. */
function zrApiSaveBotSettings(input){
  zrBotAdmin_();
  if(!input||typeof input!=='object')throw new Error('Thiếu dữ liệu cấu hình.');
  var token=String(input.token||'').trim();
  var chat=String(input.chatId||'').trim();
  if(token.length<15||token.length>1024||/\s/.test(token))
    throw new Error('Bot Token mới không hợp lệ. Hãy sao chép token từ Zalo Bot Manager.');
  if(!/^[A-Za-z0-9:_-]{5,160}$/.test(chat))
    throw new Error('Chat ID mới không hợp lệ. Hãy lấy từ bot mới.');
  // Kiểm tra token và gửi tin trước khi chuyển cấu hình thực.
  zrBotMessage_(token,chat,'getMe',{});
  zrBotMessage_(token,chat,'sendMessage',{
    chat_id:chat,text:'✅ Xác nhận kết nối bot mới cho Sổ tay nhắc việc số. Từ giờ bot này sẽ nhận thông báo công việc.'
  });
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw new Error('Đang có thao tác thay đổi bot khác. Hãy thử lại.');
  try{
    // Trước khi lưu, không xóa cấu hình cũ và không thay đổi lịch.
    PropertiesService.getScriptProperties().setProperties({
      ZALO_BOT_TOKEN:token,ZALO_CHAT_ID:chat
    },false);
    return {ok:true,message:'Đã đổi bot thành công và Zalo API đã chấp nhận tin thử. Lịch nhắc hiện tại tiếp tục sử dụng cấu hình mới.'};
  }finally{lock.releaseLock();}
}
/** Chỉ gửi test tới bot ĐANG LƯU, không làm lộ thông tin bot. */
function zrApiTestSavedBot(){
  zrBotAdmin_();
  zrSendTest();
  return {ok:true,message:'Zalo API đã xác nhận tin gửi thử tới bot hiện tại.'};
}
