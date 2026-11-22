'use strict';
/**
 * GitHub Pages -> dedicated GAS write ingress (one way).
 * Credential in memory only, never in repository, URL, or localStorage.
 * Writes are submitted as ordinary HTML forms so CORS is not required.
 */
(() => {
  const QUEUE_KEY = 'sotaynhacviecso.syncQueue.v1';
  const ENDPOINT_KEY = 'sotaynhacviecso.ingressEndpoint.v1';
  const CLIENT_KEY = 'sotaynhacviecso.googleClientId.v1';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyo8es5sZXxaD7PEwqEi1C0nfleP2IiFj52i0mw6-WkfGMf3J0XGN-5cLqO7NcloTt30Q/exec';
  const $ = id => document.getElementById(id);
  let identityToken = '', expiresAt = 0, clientId = '', endpoint = DEFAULT_ENDPOINT, queue = [], sending = false, pending = null;
  let snapshot = new Map(tasks.map(t => [t.id, JSON.stringify(t)]));
  try { endpoint = localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT; } catch (_) {}
  try { clientId = localStorage.getItem(CLIENT_KEY) || ''; } catch (_) {}
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
  function submitForm(item, token, url, id) {
    const values = {
      request_id:id, credential:token, action:item.action, task_json:JSON.stringify(item.task)
    };
    Object.entries(values).forEach(([name,value]) => {
      form.elements.namedItem(name).value = value;
    });
    form.action = url;
    form.submit();
    // Google ID token is only held in memory and removed from DOM after submission.
    form.elements.namedItem('credential').value = '';
  }
  function clearPending() {
    if (pending) {clearTimeout(pending.timer); pending = null;}
  }
  async function flush() {
    if(sending) return;
    if(!endpoint || !identityToken || Date.now() >= expiresAt) {
      if(identityToken && Date.now() >= expiresAt) identityToken = '';
      setStatus('Cần đăng nhập bằng Google để gửi công việc. Dữ liệu vẫn lưu cục bộ.', 'warn');
      return;
    }
    if(!queue.length) {
      setStatus('Đã đăng nhập Google. Chưa có thao tác đồng bộ để xác minh kết nối Sheets.', 'warn');
      return;
    }
    sending = true;
    while(queue.length && endpoint && identityToken && Date.now() < expiresAt) {
      const item = queue[0];
      const id = 'ZR'+Date.now()+'-'+Math.random().toString(36).slice(2,12);
      setStatus('Đang gửi yêu cầu tới Google Sheets…');
      const result = await new Promise(resolve => {
        const timer = setTimeout(() => {clearPending();resolve({ok:false,message:'Không nhận xác nhận từ GAS; có thể bị chặn iframe hoặc triển khai sai.'})},45000);
        pending = {id, timer, resolve};
        try { submitForm(item,identityToken,endpoint,id); }
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
  function googleReady() {
    return !!(window.google && google.accounts && google.accounts.id);
  }
  function decodeExpiry(jwt){
    try {
      const p = jwt.split('.')[1];
      const s = atob(p.replace(/-/g,'+').replace(/_/g,'/'));
      const exp = JSON.parse(s).exp;
      return Number(exp)*1000;
    } catch(_) {return 0;}
  }
  function initializeLogin(){
    const url = $('syncEndpoint').value.trim();
    const cid = $('syncClientId').value.trim();
    if(!validEndpoint(url))return setStatus('URL cổng GAS không hợp lệ.', 'error');
    if(!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(cid))
      return setStatus('Google OAuth Client ID chưa đúng định dạng.', 'error');
    if(!googleReady())return setStatus('Không tải được Google Identity Services. Kiểm tra kết nối mạng hoặc chặn quảng cáo/cookie.', 'error');
    endpoint = url;clientId = cid;
    try {localStorage.setItem(ENDPOINT_KEY,endpoint);localStorage.setItem(CLIENT_KEY,clientId);}catch(_){}
    identityToken = '';expiresAt=0;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if(!response || !response.credential)return setStatus('Không nhận được xác thực Google.', 'error');
        identityToken = response.credential;
        expiresAt = decodeExpiry(identityToken);
        if(expiresAt <= Date.now()) {identityToken='';return setStatus('Google ID token hết hạn. Hãy đăng nhập lại.', 'error');}
        // Only the GAS backend can actually verify this Google credential.
        setStatus('Đã nhận phiên Google, đang kiểm tra quyền qua GAS. Tạo công việc thử để xác minh.', 'warn');
        void flush();
      },
      auto_select: false,
      ux_mode: 'popup'
    });
    const area = $('googleSignInButton');
    area.replaceChildren();
    google.accounts.id.renderButton(area,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular',locale:'vi'});
    setStatus('Hãy nhấn “Đăng nhập bằng Google” phía dưới để cấp quyền ghi công việc.', 'warn');
  }
  $('syncConnect').onclick=initializeLogin;
  $('syncRetry').onclick=()=>{
    if(!endpoint||!identityToken||Date.now()>=expiresAt)
      return setStatus('Đăng nhập bằng Google trước khi gửi lại thao tác chờ.', 'warn');
    void flush();
  };
  $('syncAll').onclick=()=>{
    if(!tasks.length)return setStatus('Chưa có công việc để gửi.', 'warn');
    if(!confirm('Gửi '+tasks.length+' công việc đang lưu trên trình duyệt sang Google Sheets? Các mã ID trùng sẽ được cập nhật.'))return;
    tasks.forEach(t=>queueChange('upsert',t));
    setStatus('Đã đưa công việc vào hàng đợi đồng bộ.');
  };
  $('syncEndpoint').value=endpoint;
  $('syncClientId').value=clientId;
  setStatus(endpoint? 'Chưa đăng nhập Google. Nhập OAuth Client ID và đăng nhập để đồng bộ.' :
    'Chưa thiết lập Google OAuth Client ID. Công việc hiện lưu cục bộ.', 'warn');
  if(queue.length) setStatus('Có thao tác chưa được GAS xác nhận. Đăng nhập Google để gửi lại.', 'warn');
})();
