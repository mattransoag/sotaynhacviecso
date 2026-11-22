/**
 * WEB INGRESS: tạo dự án Apps Script HOÀN TOÀN RIÊNG.
 * Chỉ dán tệp này vào dự án mới; không thêm vào GAS Zalo Bot hiện hữu.
 * Web App: Execute as me, access Anyone. Chỉ nhận POST với Google ID Token hợp lệ.
 * KHÔNG có API đọc toàn bộ công việc, không có quyền gửi Zalo.
 *
 * Script Properties:
 *  SPREADSHEET_ID: ID của bảng Google Sheets đã tạo
 *  ZR_OAUTH_CLIENT_ID: OAuth 2.0 Web Client ID cho GitHub Pages
 *  ZR_ALLOWED_EMAIL: email Google được cấp quyền (nên dùng Gmail hoặc Workspace)
 *  ZR_ALLOWED_SUB: tùy chọn Google user subject ID, an toàn hơn email
 */
function doGet() {
  return HtmlService.createHtmlOutput('<meta charset="utf-8"><p>Cổng đồng bộ Sổ tay nhắc việc số đang hoạt động. Không cung cấp chức năng đọc công việc.</p>');
}
function zrIngressReady_(){
  var p=PropertiesService.getScriptProperties();
  var id=String(p.getProperty('SPREADSHEET_ID')||'').trim();
  var clientId=String(p.getProperty('ZR_OAUTH_CLIENT_ID')||'').trim();
  var allowedEmail=String(p.getProperty('ZR_ALLOWED_EMAIL')||'').trim().toLowerCase();
  var allowedSub=String(p.getProperty('ZR_ALLOWED_SUB')||'').trim();
  if(!id||!clientId||(!allowedEmail&&!allowedSub))
    throw new Error('Thiếu SPREADSHEET_ID, ZR_OAUTH_CLIENT_ID hoặc danh tính quản trị.');
  return {id:id,clientId:clientId,email:allowedEmail,sub:allowedSub};
}
/**
 * Xác minh token tại endpoint Google. Tokeninfo phù hợp cho triển khai cá nhân lưu lượng thấp;
 * hệ thống sản xuất quy mô lớn nên xác minh JWT bằng thư viện chính thức và Google public keys.
 */
function zrVerifyGoogleIdentity_(raw,cfg){
  var credential=String(raw||'');
  if(credential.length<100||credential.length>5000||
      !/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(credential))
    throw new Error('AUTH_TOKEN_FORMAT');
  var resp;
  try {
    resp=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo',{
      method:'post',contentType:'application/x-www-form-urlencoded',
      payload:{id_token:credential},muteHttpExceptions:true,
      followRedirects:false
    });
  } catch(fetchError) {
    // Không ghi token hoặc lỗi gốc (có thể chứa thông tin riêng tư).
    throw new Error('AUTH_FETCH_FAILED');
  }
  if(resp.getResponseCode()!==200)
    throw new Error('AUTH_TOKENINFO_HTTP_'+resp.getResponseCode());
  var token;
  try { token=JSON.parse(resp.getContentText()); }
  catch(e){ throw new Error('AUTH_TOKENINFO_JSON'); }
  var now=Math.floor(Date.now()/1000);
  if(String(token.aud||'')!==cfg.clientId)throw new Error('AUTH_AUD_MISMATCH');
  if(['accounts.google.com','https://accounts.google.com'].indexOf(String(token.iss||''))<0)
    throw new Error('AUTH_ISS_INVALID');
  if(!(token.email_verified===true||token.email_verified==='true'))
    throw new Error('AUTH_EMAIL_UNVERIFIED');
  if(!token.sub)throw new Error('AUTH_SUB_MISSING');
  if(!Number(token.exp)||Number(token.exp)<=now)throw new Error('AUTH_EXPIRED');
  var email=String(token.email||'').toLowerCase();
  if(cfg.sub) {
    if(String(token.sub)!==cfg.sub)throw new Error('AUTH_SUB_DENIED');
  } else {
    // Email ngoài Gmail/Workspace có thể thay đổi quyền sở hữu sau khi được xác minh.
    if(email!==cfg.email || !(email.endsWith('@gmail.com') || !!token.hd))
      throw new Error('AUTH_EMAIL_DENIED');
  }
  return {sub:String(token.sub),email:email};
}
function zrReply_(id,ok,message){
  // Chỉ chuyển kết quả tới origin GitHub Pages xác định trước.
  var result=JSON.stringify({channel:'ZR_SYNC_V1',id:String(id||'').slice(0,90),
    ok:!!ok,message:String(message||'').slice(0,180)}).replace(/</g,'\\u003c');
  var html='<!doctype html><meta charset="utf-8"><script>window.top.postMessage('+
    result+', "https://mattransoag.github.io");</script><p>'+
    (ok?'Đã tiếp nhận công việc.':'Không thể tiếp nhận công việc.')+'</p>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Kết quả đồng bộ')
    // Chỉ trang phản hồi ngắn này được phép nhúng iframe từ GitHub Pages.
    // Không chứa mã truy cập Sheets, key hoặc dữ liệu nhạy cảm.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/**
 * Chạy thủ công hàm này trong trình chỉnh sửa cổng GAS.
 * Kiểm tra cấu hình, quyền Sheets và quyền UrlFetch; không in mã/token/ID.
 * KHÔNG chạy doPost trực tiếp để kiểm tra.
 */
function zrDiagnoseIngressConfig() {
  var cfg;
  try { cfg=zrIngressReady_(); Logger.log('CONFIG: OK'); }
  catch(e){Logger.log('CONFIG: FAIL');return;}
  try {
    var sheet=SpreadsheetApp.openById(cfg.id).getSheetByName('CongViec');
    Logger.log('SHEETS: '+(sheet?'OK':'TAB_MISSING'));
  }catch(e){Logger.log('SHEETS: ACCESS_FAILED');}
  try {
    var response=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo',{
      method:'post',contentType:'application/x-www-form-urlencoded',
      payload:{id_token:'invalid-diagnostic-token'},muteHttpExceptions:true
    });
    var status=response.getResponseCode();
    Logger.log('GOOGLE_TOKENINFO_NETWORK: '+(status===400||status===401?'OK':('HTTP_'+status)));
  }catch(e){Logger.log('GOOGLE_TOKENINFO_NETWORK: FETCH_FAILED');}
}
function doPost(e){
  var req='',action='',taskId='',stage='CONFIG';
  try{
    // Không ghi log request, khóa hoặc nội dung công việc.
    var cfg=zrIngressReady_();
    stage='REQUEST';
    if(!e||!e.parameter)throw new Error('Yêu cầu thiếu dữ liệu');
    req=String(e.parameter.request_id||'').slice(0,90);
    stage='GOOGLE_AUTH';
    zrVerifyGoogleIdentity_(e.parameter.credential,cfg);
    stage='VALIDATION';
    var raw=String(e.parameter.task_json||'');
    if(raw.length>12000)throw new Error('Dữ liệu quá lớn');
    var task=JSON.parse(raw);
    if(!task||typeof task!=='object')throw new Error('Dữ liệu không hợp lệ');
    taskId=String(task.id||'').trim();
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(taskId))throw new Error('Mã công việc không hợp lệ');
    action=String(e.parameter.action||'upsert');
    if(['upsert','delete'].indexOf(action)<0)throw new Error('Thao tác không hợp lệ');
    stage='LOCK';
    var lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))throw new Error('Hệ thống đang bận');
    try {
      stage='SHEETS';
      var sheet=SpreadsheetApp.openById(cfg.id).getSheetByName('CongViec');
      if(!sheet)throw new Error('Không tìm thấy tab CongViec');
      var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(x){return String(x).trim().toLowerCase()});
      var required=['ID','Công việc','Hạn hoàn thành','Trạng thái','Người phụ trách','Mức ưu tiên','Ghi chú','Ngày tạo','Ngày hoàn thành'];
      var col=required.map(function(x){var i=headers.indexOf(x.toLowerCase());if(i<0)throw new Error('Thiếu cột '+x);return i});
      var count=sheet.getLastRow(), rowIndex=-1;
      if(count>=2){
        var values=sheet.getRange(2,col[0]+1,count-1,1).getValues();
        for(var i=0;i<values.length;i++)if(String(values[i][0])===taskId){rowIndex=i+2;break}
      }
      if(action==='delete'){
        if(rowIndex>=2)sheet.deleteRow(rowIndex);
        return zrReply_(req,true,'Đã đồng bộ thao tác xóa.');
      }
      var name=String(task.name||'').trim();
      var due=new Date(String(task.due||''));
      var owner=String(task.owner||'').trim(),note=String(task.note||'').trim();
      var priority=String(task.priority||'Trung bình');
      if(!name||name.length>200||!isFinite(due.getTime())||
          owner.length>100||note.length>1000||
          ['Cao','Trung bình','Thấp'].indexOf(priority)<0)
        throw new Error('Thông tin công việc chưa hợp lệ');
      var row=rowIndex>=2?
        sheet.getRange(rowIndex,1,1,sheet.getLastColumn()).getValues()[0]:
        Array(sheet.getLastColumn()).fill('');
      row[col[0]]=taskId;row[col[1]]=name;row[col[2]]=due;
      row[col[3]]=task.done?'Hoàn thành':'Chưa thực hiện';
      row[col[4]]=owner;row[col[5]]=priority;row[col[6]]=note;
      if(rowIndex<2)row[col[7]]=new Date();
      row[col[8]]=task.done?(row[col[8]]||new Date()):'';
      stage='WRITE';
      sheet.getRange(rowIndex>=2?rowIndex:count+1,1,1,row.length).setValues([row]);
      return zrReply_(req,true,'Đã lưu vào Google Sheets.');
    } finally {lock.releaseLock();}
  } catch(ex){
    // Chỉ log giai đoạn + tên kiểu lỗi; không log token, email, ID Sheets hay dữ liệu công việc.
    console.error('ZR_INGRESS_FAILED stage=' + stage + ' type=' + (ex && ex.name || 'Error'));
    var hints = {
      CONFIG:'Thiếu cấu hình Script Properties.',
      REQUEST:'Yêu cầu không hợp lệ.',
      GOOGLE_AUTH:'Không xác minh được Google ID token hoặc tài khoản chưa được cấp quyền. Kiểm tra ZR_OAUTH_CLIENT_ID và ZR_ALLOWED_EMAIL.',
      VALIDATION:'Dữ liệu công việc không hợp lệ.',
      LOCK:'Hệ thống đang bận. Hãy thử lại.',
      SHEETS:'Không mở được Google Sheets hoặc cấu trúc bảng CongViec chưa đúng.',
      WRITE:'Không ghi được công việc vào Google Sheets.'
    };
    var safeAuthCodes = [
      'AUTH_TOKEN_FORMAT','AUTH_FETCH_FAILED','AUTH_TOKENINFO_JSON',
      'AUTH_AUD_MISMATCH','AUTH_ISS_INVALID','AUTH_EMAIL_UNVERIFIED',
      'AUTH_SUB_MISSING','AUTH_EXPIRED','AUTH_SUB_DENIED','AUTH_EMAIL_DENIED'
    ];
    var reason=String(ex && ex.message || '');
    var code=stage;
    if(stage==='GOOGLE_AUTH' && (safeAuthCodes.indexOf(reason)>=0 ||
        /^AUTH_TOKENINFO_HTTP_[0-9]{3}$/.test(reason)))code=reason;
    return zrReply_(req,false,'Lưu thất bại ['+code+']. '+(hints[stage]||'Kiểm tra dự án GAS.'));
  }
}
