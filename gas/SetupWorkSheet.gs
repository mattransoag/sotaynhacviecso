/**
 * SỔ TAY NHẮC VIỆC SỐ — Khởi tạo Google Sheets một lần.
 * An toàn: không sửa bảng hiện có; nếu đã có SPREADSHEET_ID sẽ KHÔNG tạo mới.
 * Chạy từ Dashboard hoặc từ trình chỉnh sửa Apps Script.
 */
function zrSetupWorkSheet() {
  // Trên Dashboard (RPC) yêu cầu quyền admin như những chức năng khác.
  if (typeof zrDashboardGuard_ === 'function') zrDashboardGuard_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Có phiên thiết lập khác đang chạy. Vui lòng thử lại.');
  try {
    var props = PropertiesService.getScriptProperties();
    var existing = props.getProperty('SPREADSHEET_ID');
    if (existing) {
      var old = SpreadsheetApp.openById(existing);
      return {created:false, id:existing, url:old.getUrl(), sheet:props.getProperty('TASK_SHEET_NAME') || 'CongViec',
        message:'Đã có bảng được kết nối. Không tạo mới để tránh tách dữ liệu.'};
    }

    // Bảng mới, chưa chứa nhiệm vụ; không đụng đến dữ liệu app GAS có sẵn.
    var book = SpreadsheetApp.create('SỔ TAY NHẮC VIỆC SỐ - DỮ LIỆU CÔNG VIỆC');
    var sheet = book.getSheets()[0];
    sheet.setName('CongViec');
    var columns = [
      'ID', 'Công việc', 'Hạn hoàn thành', 'Trạng thái',
      'Người phụ trách', 'Mức ưu tiên', 'Ghi chú', 'Ngày tạo', 'Ngày hoàn thành'
    ];
    sheet.getRange(1,1,1,columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.setTabColor('#2563eb');
    sheet.getRange(1,1,1,columns.length)
      .setBackground('#15345c').setFontColor('#ffffff').setFontWeight('bold');
    sheet.getRange('C2:C').setNumberFormat('dd/MM/yyyy HH:mm');
    sheet.getRange('H2:I').setNumberFormat('dd/MM/yyyy HH:mm');
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Chưa thực hiện','Đang thực hiện','Hoàn thành','Tạm hoãn'],true)
      .setAllowInvalid(false).build();
    sheet.getRange('D2:D').setDataValidation(statusRule);
    var priorityRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Cao','Trung bình','Thấp'],true)
      .setAllowInvalid(false).build();
    sheet.getRange('F2:F').setDataValidation(priorityRule);
    sheet.setColumnWidth(1,115);
    sheet.setColumnWidth(2,320);
    sheet.setColumnWidth(3,190);
    sheet.setColumnWidth(4,155);
    sheet.setColumnWidth(5,180);
    sheet.setColumnWidth(6,125);
    sheet.setColumnWidth(7,300);
    sheet.setColumnWidth(8,175);
    sheet.setColumnWidth(9,175);
    sheet.getRange(1,1,1,columns.length).createFilter();

    // Chỉ lưu cấu hình SAU KHI tạo thành công toàn bộ bảng.
    props.setProperties({
      SPREADSHEET_ID:book.getId(),
      TASK_SHEET_NAME:'CongViec',
      TASK_HEADER_ID:'ID',
      TASK_HEADER_TITLE:'Công việc',
      TASK_HEADER_DUE:'Hạn hoàn thành',
      TASK_HEADER_STATUS:'Trạng thái'
    }, false);
    Logger.log('Đã khởi tạo bảng mới: ' + book.getUrl());
    return {created:true,id:book.getId(),url:book.getUrl(),sheet:'CongViec',
      message:'Đã tạo bảng mới trống, chưa chuyển công việc từ phần mềm cũ.'};
  } finally {
    lock.releaseLock();
  }
}
/**
 * Có thể chạy trực tiếp từ Apps Script.
 * Không tạo lịch nhắc việc tự động, chỉ tạo kho dữ liệu.
 */
function zrCreateTaskSheetOnce() {
  var result = zrSetupWorkSheet();
  Logger.log(JSON.stringify(result));
}
