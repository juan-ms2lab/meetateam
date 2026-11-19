const WARN_MS = 5 * 60e3;
let deadline;
let idleTimer = null;
let blankTimer = null;
let pinEntry = '';
let activeService = null;
let cfg = { idleBlank: 180, screenBlank: 3600, roomName: '', pin: '0000',
            enableMeet: true, enableTeams: true, enableZoom: true, homeUrl: '' };

const host = document.createElement('div');
const root = host.attachShadow({ mode: 'closed' });
root.innerHTML = `<style>
  *{box-sizing:border-box}
  .bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;align-items:center;padding:10px 16px;background:rgba(30,30,30,.88);backdrop-filter:blur(12px);font:600 16px system-ui,sans-serif;color:#fff}
  .room-label{flex:1;font-size:17px;opacity:.85}
  .btns{display:flex;gap:8px;align-items:center}
  button{font:600 14px system-ui,sans-serif;border:0;border-radius:999px;padding:10px 18px;cursor:pointer}
  .out{background:#c62828;color:#fff}
  .ext{background:#fff;color:#111}
  .meet{background:#1a73e8;color:#fff}
  .teams{background:#5b5fc7;color:#fff}
  .zoom{background:#2d8cff;color:#fff}
  .gear{background:0 0;color:#fff9;padding:10px;font-size:18px;border-radius:50%}
  .gear:hover{color:#fff}
  .warn{color:#fff;padding:10px 14px;border-radius:12px;font-size:14px;background:rgba(0,0,0,.7)}
  .overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
  .dlg{background:#fff;border-radius:16px;padding:28px 32px;width:min(440px,92vw);font:400 15px system-ui,sans-serif;color:#111}
  .dlg h2{margin:0 0 16px;font-size:20px}
  .dlg input[type=text],.dlg input[type=number]{width:100%;font:inherit;padding:12px 14px;border:2px solid #ddd;border-radius:10px;outline:0;margin-bottom:10px}
  .dlg input:focus{border-color:#1a73e8}
  .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  .acts button{font-size:15px;padding:10px 18px}
  .cancel{background:#eee;color:#333}
  .primary{background:#1a73e8;color:#fff}
  .field{margin-bottom:14px}
  .field label{display:block;font-weight:600;margin-bottom:4px;font-size:13px;color:#555}
  .toggle{display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;font-size:15px}
  .toggle input{appearance:none;-webkit-appearance:none;width:40px;height:22px;background:#ccc;border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
  .toggle input:checked{background:#1a73e8}
  .toggle input::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s}
  .toggle input:checked::after{transform:translateX(18px)}
  .pin-dots{display:flex;gap:10px;justify-content:center;margin:16px 0}
  .dot{width:14px;height:14px;border-radius:50%;border:2px solid #ccc;background:#fff}
  .dot.on{background:#1a73e8;border-color:#1a73e8}
  .numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:260px;margin:0 auto}
  .numpad button{font:400 22px system-ui,sans-serif;padding:14px;border-radius:10px;background:#f5f5f5;color:#111}
  .numpad button:active{background:#e0e0e0}
  .pin-err{color:#c62828;text-align:center;font-size:13px;margin-top:6px;min-height:18px}
  .saver{position:fixed;inset:0;z-index:2147483647;background:#111;cursor:none}
  .saver-box{position:absolute;background:#222;border-radius:24px;padding:40px 48px;color:#fff;font:300 20px system-ui,sans-serif;animation:drift 120s ease-in-out infinite alternate}
  .saver-box .time{font-size:64px;font-weight:200;letter-spacing:2px}
  .saver-box .room{margin-top:8px;font-size:24px;opacity:.8}
  .saver-box .status{margin-top:12px;font-size:18px;opacity:.5}
  @keyframes drift{0%{top:10%;left:10%}25%{top:60%;left:70%}50%{top:20%;left:50%}75%{top:50%;left:15%}100%{top:30%;left:60%}}
  [hidden]{display:none}
</style>
<div class="bar">
  <span class="room-label"></span>
  <div class="btns">
    <span class="warn" hidden></span>
    <button class="ext" hidden>Stay signed in</button>
    <button class="out" hidden>Sign out</button>
    <button class="meet">Join Google Meet</button>
    <button class="teams">Join Microsoft Teams</button>
    <button class="zoom">Join Zoom</button>
    <button class="gear">⚙</button>
  </div>
</div>
<div class="overlay join-ov" hidden><div class="dlg">
  <h2 class="j-title"></h2>
  <input type="text" class="j-code" autocomplete="off" spellcheck="false">
  <input type="text" class="j-pass" placeholder="Passcode (optional)" autocomplete="off" spellcheck="false" hidden>
  <div class="acts"><button class="cancel">Cancel</button><button class="primary j-go">Join</button></div>
</div></div>
<div class="overlay pin-ov" hidden><div class="dlg">
  <h2>Enter PIN</h2>
  <div class="pin-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  <div class="numpad">
    <button>1</button><button>2</button><button>3</button>
    <button>4</button><button>5</button><button>6</button>
    <button>7</button><button>8</button><button>9</button>
    <button></button><button>0</button><button>⌫</button>
  </div>
  <div class="pin-err"></div>
  <div class="acts"><button class="cancel">Cancel</button></div>
</div></div>
<div class="overlay cfg-ov" hidden><div class="dlg">
  <h2>Configuration</h2>
  <div class="field"><label>Room Name</label><input type="text" class="c-room" placeholder="e.g. Main Conference"></div>
  <div class="field"><label>Calendar URL</label><input type="text" class="c-url" placeholder="https://..."></div>
  <div class="field"><label>Screensaver (minutes)</label><input type="number" class="c-idle" min="1" max="60"></div>
  <div class="field"><label>Screen Off (minutes)</label><input type="number" class="c-blank" min="1" max="120"></div>
  <label class="toggle"><input type="checkbox" class="c-meet"><span>Google Meet</span></label>
  <label class="toggle"><input type="checkbox" class="c-teams"><span>Microsoft Teams</span></label>
  <label class="toggle"><input type="checkbox" class="c-zoom"><span>Zoom</span></label>
  <div class="field"><label>New PIN (leave blank to keep)</label><input type="text" class="c-pin" placeholder="4 digits" maxlength="4" inputmode="numeric"></div>
  <div class="acts"><button class="cancel">Cancel</button><button class="primary c-save">Save</button></div>
</div></div>
<div class="saver" hidden><div class="saver-box">
  <div class="time"></div><div class="room"></div><div class="status"></div>
</div></div>`;

const $ = s => root.querySelector(s);
const bar = $('.bar'), roomLabel = $('.room-label'), warn = $('.warn');
const ext = $('.ext'), out = $('.out');
const meetBtn = $('.meet'), teamsBtn = $('.teams'), zoomBtn = $('.zoom'), gearBtn = $('.gear');
const joinOv = $('.join-ov'), jTitle = $('.j-title'), jCode = $('.j-code'), jPass = $('.j-pass'), jGo = $('.j-go');
const pinOv = $('.pin-ov'), pinErr = $('.pin-err'), numpad = $('.numpad');
const pinDots = root.querySelectorAll('.dot');
const cfgOv = $('.cfg-ov');
const cRoom = $('.c-room'), cUrl = $('.c-url'), cIdle = $('.c-idle'), cBlank = $('.c-blank');
const cMeet = $('.c-meet'), cTeams = $('.c-teams'), cZoom = $('.c-zoom'), cPin = $('.c-pin');
const saver = $('.saver'), saverBox = $('.saver-box');
const saverTime = $('.saver-box .time'), saverRoom = $('.saver-box .room'), saverStatus = $('.saver-box .status');

function closeOverlays() {
  joinOv.hidden = pinOv.hidden = cfgOv.hidden = true;
  pinEntry = ''; updatePinDots(); pinErr.textContent = '';
}
root.querySelectorAll('.cancel').forEach(b => { b.onclick = closeOverlays; });
[joinOv, pinOv, cfgOv].forEach(o => o.addEventListener('click', e => { if (e.target === o) closeOverlays(); }));

out.onclick = () => chrome.runtime.sendMessage('signout');
ext.onclick = () => chrome.runtime.sendMessage('extend');

// --- join ---
const services = {
  meet:  { title: 'Join Google Meet',       ph: 'Meeting code (e.g. abc-defg-hij)', color: '#1a73e8', pass: false },
  teams: { title: 'Join Microsoft Teams',   ph: 'Meeting link or ID',               color: '#5b5fc7', pass: true },
  zoom:  { title: 'Join Zoom Meeting',      ph: 'Meeting ID (e.g. 123 456 7890)',   color: '#2d8cff', pass: true },
};
function openJoin(svc) {
  const s = services[svc]; activeService = svc;
  jTitle.textContent = s.title; jCode.placeholder = s.ph; jPass.hidden = !s.pass;
  jGo.style.background = s.color; jCode.value = ''; if (s.pass) jPass.value = '';
  joinOv.hidden = false; jCode.focus();
}
meetBtn.onclick  = () => openJoin('meet');
teamsBtn.onclick = () => openJoin('teams');
zoomBtn.onclick  = () => openJoin('zoom');

function doJoin() {
  const v = jCode.value.trim(); if (!v) return;
  joinOv.hidden = true;
  const pass = jPass.value.trim();
  if (activeService === 'meet') {
    location.href = 'https://meet.google.com/' + v.replace(/^https?:\/\/meet\.google\.com\//, '').split('?')[0];
  } else if (activeService === 'teams') {
    if (v.startsWith('http')) {
      const url = new URL(v); if (pass) url.searchParams.set('passcode', pass);
      location.href = url.href;
    } else {
      const u = 'https://teams.microsoft.com/meet/' + v;
      location.href = pass ? u + '?passcode=' + encodeURIComponent(pass) : u;
    }
  } else {
    const id = v.replace(/[\s-]/g, '').replace(/^https?:\/\/.*zoom\.us\/j\//, '').split('?')[0];
    const u = 'https://zoom.us/wc/join/' + id;
    location.href = pass ? u + '?pwd=' + encodeURIComponent(pass) : u;
  }
}
jGo.onclick = doJoin;
jCode.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
jPass.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

// --- PIN ---
function updatePinDots() { pinDots.forEach((d, i) => d.classList.toggle('on', i < pinEntry.length)); }

gearBtn.onclick = () => { pinEntry = ''; pinErr.textContent = ''; updatePinDots(); pinOv.hidden = false; };

numpad.addEventListener('click', e => {
  const btn = e.target.closest('button'); if (!btn) return;
  const val = btn.textContent;
  if (val === '⌫') { pinEntry = pinEntry.slice(0, -1); updatePinDots(); return; }
  if (!val || pinEntry.length >= 4) return;
  pinEntry += val; updatePinDots();
  if (pinEntry.length === 4) {
    if (pinEntry === cfg.pin) {
      pinOv.hidden = true; openConfig();
    } else {
      pinErr.textContent = 'Incorrect PIN';
      setTimeout(() => { pinEntry = ''; updatePinDots(); pinErr.textContent = ''; }, 1000);
    }
  }
});

// --- config ---
function openConfig() {
  cRoom.value = cfg.roomName;
  cUrl.value = cfg.homeUrl;
  cIdle.value = Math.round(cfg.idleBlank / 60);
  cBlank.value = Math.round(cfg.screenBlank / 60);
  cMeet.checked = cfg.enableMeet;
  cTeams.checked = cfg.enableTeams;
  cZoom.checked = cfg.enableZoom;
  cPin.value = '';
  cfgOv.hidden = false; cRoom.focus();
}

$('.c-save').onclick = () => {
  const changes = {};
  const r = cRoom.value.trim(); if (r !== cfg.roomName) changes.roomName = cfg.roomName = r;
  const idle = Math.max(1, parseInt(cIdle.value) || 3) * 60;
  if (idle !== cfg.idleBlank) changes.idleBlank = cfg.idleBlank = idle;
  const blank = Math.max(1, parseInt(cBlank.value) || 60) * 60;
  if (blank !== cfg.screenBlank) changes.screenBlank = cfg.screenBlank = blank;
  if (cMeet.checked !== cfg.enableMeet) changes.enableMeet = cfg.enableMeet = cMeet.checked;
  if (cTeams.checked !== cfg.enableTeams) changes.enableTeams = cfg.enableTeams = cTeams.checked;
  if (cZoom.checked !== cfg.enableZoom) changes.enableZoom = cfg.enableZoom = cZoom.checked;
  const p = cPin.value.trim(); if (p && /^\d{4}$/.test(p)) changes.pin = cfg.pin = p;
  const u = cUrl.value.trim();
  if (u && u !== cfg.homeUrl) { changes.homeUrl = cfg.homeUrl = u; }
  if (Object.keys(changes).length) chrome.storage.local.set(changes);
  cfgOv.hidden = true;
  roomLabel.textContent = cfg.roomName;
  tick();
  resetIdle();
  if (changes.homeUrl) location.href = changes.homeUrl;
};

// --- screensaver ---
function resetIdle() {
  if (!saver.hidden) {
    saver.hidden = true; saverBox.hidden = false; bar.hidden = false;
    clearTimeout(blankTimer); tick(); return;
  }
  clearTimeout(idleTimer); clearTimeout(blankTimer);
  if (deadline) return;
  idleTimer = setTimeout(showSaver, cfg.idleBlank * 1000);
}

function showSaver() {
  bar.hidden = true;
  saverRoom.textContent = cfg.roomName || (document.body?.innerText?.match(/^(.+?)(?:\n|$)/) || [])[1]?.trim() || '';
  const body = document.body?.innerText || '';
  if (/free/i.test(body) && /nothing.+booked/i.test(body)) {
    saverStatus.textContent = 'No meetings scheduled for today';
  } else if (/free/i.test(body)) {
    const m = body.match(/NEXT\s*\n(.+)/i);
    saverStatus.textContent = m ? 'Next: ' + m[1].trim() : 'Free';
  } else { saverStatus.textContent = ''; }
  updateClock(); saver.hidden = false;
  if (cfg.screenBlank > cfg.idleBlank) {
    blankTimer = setTimeout(() => { saverBox.hidden = true; }, (cfg.screenBlank - cfg.idleBlank) * 1000);
  }
}

function updateClock() {
  if (saver.hidden) return;
  saverTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 10000);

for (const ev of ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'])
  document.addEventListener(ev, resetIdle, { passive: true, capture: true });

// --- session timer ---
function tick() {
  const inSession = !!deadline;
  out.hidden = !inSession;
  meetBtn.hidden  = !cfg.enableMeet  || inSession;
  teamsBtn.hidden = !cfg.enableTeams || inSession;
  zoomBtn.hidden  = !cfg.enableZoom  || inSession;
  if (!host.isConnected) document.documentElement.append(host);
  if (!inSession) { warn.hidden = ext.hidden = true; return; }
  clearTimeout(idleTimer);
  const left = Math.max(0, deadline - Date.now());
  const warning = left < WARN_MS;
  warn.hidden = ext.hidden = !warning;
  if (warning) {
    const s = Math.ceil(left / 1000);
    warn.textContent = `Auto sign-out in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
chrome.storage.local.get('deadline', r => { deadline = r.deadline; tick(); });
chrome.storage.onChanged.addListener(c => { if (c.deadline) { deadline = c.deadline.newValue; tick(); } });
setInterval(tick, 1000);

// --- init ---
chrome.storage.local.get(Object.keys(cfg), r => {
  for (const k of Object.keys(cfg)) if (r[k] !== undefined) cfg[k] = r[k];
  roomLabel.textContent = cfg.roomName;
  tick();
  resetIdle();
});
