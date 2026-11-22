/**
 * SỔ TAY NHẮC VIỆC SỐ — API quản lý công việc, dùng chung Google Sheets + Zalo Bot.
 * ĐẶT CÙNG DỰ ÁN GAS ĐÃ CÓ ZaloReminders.gs, Dashboard.gs, SetupWorkSheet.gs.
 * Không khai báo doGet/doPost mới. Chỉ cho phép truy cập bằng Dashboard giới hạn Only myself.
 */
function zrTasksAuth_(){
  // Bảo vệ tất cả lời gọi từ trình duyệt; tránh public CRUD.
  zrDashboardGuard_();
}
function zrTaskColumns_(){
  var sheet=zrSheet_();
  var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(x){return String(x).trim().toLowerCase()});
  var labels=['ID','Công việc','Hạn hoàn thành','Trạng thái','Người phụ trách','Mức ưu tiên','Ghi chú','Ngày tạo','Ngày hoàn thành'];
  var indices=labels.map(function(label){
    var at=headers.indexOf(label.toLowerCase());
    if(at<0)throw new Error('Thiếu cột "'+label+'". Kiểm tra Google Sheets đã khởi tạo.');
    return at;
  });
  return {sheet:sheet,indices:indices};
}
function zrTaskReadRow_(row, col){
  function at(i){return row[col[i]]}
  var date=at(2);
  var iso=(Object.prototype.toString.call(date)==='[object Date]' && !isNaN(date.getTime()))?
    date.toISOString():(function(){var d=zrDate_(date);return isNaN(d.getTime())?'':d.toISOString()})();
  var status=String(at(3)||'');
  return {id:String(at(0)||''),name:String(at(1)||''),due:iso,
    status:status,done:zrFinished_(status.trim().toLowerCase()),
    owner:String(at(4)||''),priority:String(at(5)||'Trung bình'),note:String(at(6)||'')};
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
  return {name:name,due:due,priority:priority,owner:owner,note:note};
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
    row[col[1]]=task.name;
    row[col[2]]=task.due;
    row[col[4]]=task.owner;
    row[col[5]]=task.priority;
    row[col[6]]=task.note;
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
/** Trả về trang quản lý công việc đã xác thực; gọi qua doGet(e) hiện hữu. */
function zrTaskManagerView(){
  return HtmlService.createHtmlOutputFromFile('TaskManagerUI')
    .setTitle('Sổ tay nhắc việc số — Đồng bộ Google Sheets');
}
