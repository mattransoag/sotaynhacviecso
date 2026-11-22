/**
 * WEB INGRESS: tạo dự án Apps Script HOÀN TOÀN RIÊNG.
 * Chỉ dán tệp này vào dự án mới; không thêm vào GAS Zalo Bot hiện hữu.
 * Web App: Execute as me, access Anyone. Chỉ nhận POST với khóa bí mật mạnh.
 * KHÔNG có API đọc toàn bộ công việc, không có quyền gửi Zalo.
 *
 * Script Properties:
 *  SPREADSHEET_ID: ID của bảng Google Sheets đã tạo
 *  ZR_INGRESS_KEY: khóa riêng >= 32 ký tự do người dùng tự tạo, KHÔNG viết vào GitHub
 */
function doGet() {
  return HtmlService.createHtmlOutput('<meta charset="utf-8"><p>Cổng đồng bộ Sổ tay nhắc việc số đang hoạt động. Không cung cấp chức năng đọc công việc.</p>');
}
function zrIngressReady_(){
  var p=PropertiesService.getScriptProperties();
  var id=p.getProperty('SPREADSHEET_ID');
  var key=p.getProperty('ZR_INGRESS_KEY');
  if(!id||!key||key.length<32)throw new Error('Cấu hình SPREADSHEET_ID và ZR_INGRESS_KEY (ít nhất 32 ký tự) trước.');
  return {id:id,key:key};
}
function zrConstantTimeEqual_(a,b) {
  a=String(a||'');b=String(b||'');
  var ok=a.length===b.length,diff=0,n=Math.max(a.length,b.length);
  for(var i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return !!ok&&diff===0;
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
function doPost(e){
  var req='',action='',taskId='';
  try{
    // Không ghi log request, khóa hoặc nội dung công việc.
    var cfg=zrIngressReady_();
    if(!e||!e.parameter)throw new Error('Yêu cầu thiếu dữ liệu');
    req=String(e.parameter.request_id||'').slice(0,90);
    var key=String(e.parameter.ingress_key||'');
    if(!zrConstantTimeEqual_(key,cfg.key))throw new Error('Không có quyền ghi dữ liệu');
    var raw=String(e.parameter.task_json||'');
    if(raw.length>12000)throw new Error('Dữ liệu quá lớn');
    var task=JSON.parse(raw);
    if(!task||typeof task!=='object')throw new Error('Dữ liệu không hợp lệ');
    taskId=String(task.id||'').trim();
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(taskId))throw new Error('Mã công việc không hợp lệ');
    action=String(e.parameter.action||'upsert');
    if(['upsert','delete'].indexOf(action)<0)throw new Error('Thao tác không hợp lệ');
    var lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))throw new Error('Hệ thống đang bận');
    try {
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
      sheet.getRange(rowIndex>=2?rowIndex:count+1,1,1,row.length).setValues([row]);
      return zrReply_(req,true,'Đã lưu vào Google Sheets.');
    } finally {lock.releaseLock();}
  } catch(ex){
    // Không tiết lộ khóa, ID bảng tính hoặc chi tiết nội bộ cho người dùng công khai.
    return zrReply_(req,false,'Lưu thất bại. Kiểm tra khóa kết nối, quyền Google Sheets và định dạng dữ liệu.');
  }
}
