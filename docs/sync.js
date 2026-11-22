'use strict';
/**
 * GitHub Pages -> dedicated GAS write ingress (one way).
 * Credential in memory only, never in repository, URL, or localStorage.
 * Writes are submitted as ordinary HTML forms so CORS is not required.
 */
(() => {
  const QUEUE_KEY = 'sotaynhacviecso.syncQueue.v1';
  const ENDPOINT_KEY = 'sotaynhacviecso.ingressEndpoint.v1';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyo8es5sZXxaD7PEwqEi1C0nfleP2IiFj52i0mw6-WkfGMf3J0XGN-5cLqO7NcloTt30Q/exec';
  const $ = id => document.getElementById(id);
  let secret = '', endpoint = DEFAULT_ENDPOINT, queue = [], sending = false, pending = null;
  let snapshot = new Map(tasks.map(t => [t.id, JSON.stringify(t)]));
  try { endpoint = localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT; } catch (_) {}
  try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); queue = Array.isArray(q) ? q.slice(0, 500) : []; } catch (_) {}
  function setStatus(message, kind = '') {
    $('syncStatus').textContent = message + (queue.length ? ' · ' + queue.length + ' thao tác chờ' : '');
    $('syncStatus').dataset.state = kind;
  }
  function persistQueue() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }
    catch (_) { setStatus('Không thể lưu hàng đợi đồng bộ. Hãy sao lưu JSON.', 'warn'); }
  }
  function validEndpoint(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && u.hostname === 'script.google.com' &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) &&
        !u.search && !u.hash;
    } catch (_) { return false; }
  }
  function queueChange(action, task) {
    if(!task || !task.id) return;
    // Idempotent upsert/delete by stable client task ID.
    const payload = {...task};
    if(action === 'upsert') {
      const instant = new Date(payload.due);
      if(!Number.isFinite(instant.getTime())) {
        setStatus('Hạn hoàn thành không hợp lệ, chưa thể đồng bộ.', 'error');
        return;
      }
      // Date từ datetime-local phải chuyển sang ISO để GAS không đọc sai múi giờ.
      payload.due = instant.toISOString();
    }
    queue.push({action, task: payload, id: String(task.id)});
    if (queue.length > 500) {
      queue = queue.slice(-500);
      setStatus('Hàng đợi quá dài; cần sao lưu và kiểm tra dữ liệu.', 'warn');
    }
    persistQueue();
    void flush();
  }
  function diffAndQueue() {
    const now = new Map(tasks.map(t => [t.id, JSON.stringify(t)]));
    for (const t of tasks) {
      if(snapshot.get(t.id) !== now.get(t.id)) queueChange('upsert', t);
    }
    for (const [id, value] of snapshot) {
      if(!now.has(id)) queueChange('delete', {id});
    }
    snapshot = now;
  }
  const originalPersist = window.persist;
  if (typeof originalPersist !== 'function') {
    setStatus('Không tìm thấy chức năng lưu công việc.', 'error');
    return;
  }
  window.persist = function() {
    const result = originalPersist();
    if(result) diffAndQueue();
    return result;
  };
  // The form targets a sandboxed iframe, so its response can't navigate away.
  // GAS returns a postMessage acknowledgement, never the Bot Token.
  const frame = $('syncFrame'), form = $('syncTransport');
  function submitForm(item, key, url, id) {
    const values = {
      request_id:id, ingress_key:key, action:item.action, task_json:JSON.stringify(item.task)
    };
    Object.entries(values).forEach(([name,value]) => {
      form.elements.namedItem(name).value = value;
    });
    form.action = url;
    form.submit();
    // Don't leave a secret in the DOM after submitting.
    form.elements.namedItem('ingress_key').value = '';
  }
  function clearPending() {
    if (pending) {clearTimeout(pending.timer); pending = null;}
  }
  async function flush() {
    if(sending) return;
    if(!endpoint || !secret) {
      setStatus('Chưa kết nối. Công việc đang lưu cục bộ; chưa gửi đến Google Sheets.', 'warn');
      return;
    }
    if(!queue.length) {
      setStatus('Đã nhập URL và khóa vào phiên này, nhưng CHƯA xác minh kết nối GAS. Hãy tạo một công việc rồi kiểm tra xác nhận lưu.', 'warn');
      return;
    }
    sending = true;
    while(queue.length && endpoint && secret) {
      const item = queue[0];
      const id = 'ZR'+Date.now()+'-'+Math.random().toString(36).slice(2,12);
      setStatus('Đang gửi yêu cầu tới Google Sheets…');
      const result = await new Promise(resolve => {
        const timer = setTimeout(() => {clearPending();resolve({ok:false,message:'Không nhận xác nhận từ GAS; có thể bị chặn iframe hoặc triển khai sai.'})},45000);
        pending = {id, timer, resolve};
        try { submitForm(item,secret,endpoint,id); }
        catch(e) {clearPending();resolve({ok:false,message:'Không gửi được: '+e.message})}
      });
      clearPending();
      if(!result.ok) {setStatus(result.message+' · chưa xác nhận lưu.', 'error'); break;}
      queue.shift();persistQueue();
      setStatus('GAS đã xác nhận lưu vào Google Sheets.', 'success');
    }
    sending=false;
  }
  window.addEventListener('message',event => {
    if(!pending || !event.data || event.data.channel!=='ZR_SYNC_V1' || event.data.id!==pending.id) return;
    // Do not trust messages sent by arbitrary domains.
    const origin = event.origin || '';
    if(!(/^https:\/\/script\.google\.com$/.test(origin) || /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/i.test(origin))) return;
    pending.resolve({ok: event.data.ok===true, message:String(event.data.message||'')});
  });
  $('syncConnect').onclick = () => {
    const url=$('syncEndpoint').value.trim(),key=$('syncSecret').value.trim();
    if(!validEndpoint(url)) return setStatus('Địa chỉ GAS không đúng. Dùng HTTPS và URL /exec của cổng đồng bộ riêng.', 'error');
    if(key.length<32) return setStatus('Khóa kết nối phải có ít nhất 32 ký tự.', 'error');
    endpoint=url;secret=key; // memory only; never persist secret
    $('syncSecret').value='';
    try{localStorage.setItem(ENDPOINT_KEY,url)}catch(_){}
    setStatus(queue.length ? 'Đã nhận cấu hình. Đang thử gửi các thay đổi đang chờ.' : 'Đã nhập cấu hình, nhưng chưa có công việc để kiểm tra kết nối. Hãy thêm một công việc thử.', 'warn');
    void flush();
  };
  $('syncRetry').onclick = () => { if(!endpoint || !secret) return setStatus('Nhập URL cổng đồng bộ và khóa rồi nhấn Kết nối trước.', 'warn');void flush(); };
  $('syncAll').onclick=()=>{
    if(!tasks.length)return setStatus('Chưa có công việc để gửi.', 'warn');
    if(!confirm('Gửi '+tasks.length+' công việc đang lưu trên trình duyệt sang Google Sheets? Các mã ID trùng sẽ được cập nhật.'))return;
    tasks.forEach(t=>queueChange('upsert',t));
    setStatus('Đã đưa công việc vào hàng đợi đồng bộ.');
  };
  $('syncEndpoint').value=endpoint;
  setStatus(endpoint? 'Cần nhập lại khóa kết nối để xác nhận đồng bộ.' :
    'Chưa kết nối GAS. Công việc hiện lưu cục bộ.', 'warn');
  if(queue.length) setStatus('Có thao tác chưa được GAS xác nhận. Kết nối để gửi lại.', 'warn');
})();
