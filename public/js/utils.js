// utils.js – shared constants & helpers
const RATES_STATIC = {
  usd:{r:600,f:'🇺🇸',c:'USD',n:'Dollar américain',s:'$'},
  eur:{r:655,f:'🇪🇺',c:'EUR',n:'Euro',s:'€'},
  gbp:{r:762,f:'🇬🇧',c:'GBP',n:'Livre Sterling',s:'£'},
  cad:{r:440,f:'🇨🇦',c:'CAD',n:'Dollar canadien',s:'CA$'}
};
const OPS = { mtn:'MTN Mobile Money', orange:'Orange Money', airtel:'Airtel Money' };
const COUNTRIES = [
  {code:'CM',flag:'🇨🇲',name:'Cameroun',dial:'+237'},
  {code:'CI',flag:'🇨🇮',name:"Côte d'Ivoire",dial:'+225'},
  {code:'SN',flag:'🇸🇳',name:'Sénégal',dial:'+221'},
  {code:'ML',flag:'🇲🇱',name:'Mali',dial:'+223'},
  {code:'BF',flag:'🇧🇫',name:'Burkina Faso',dial:'+226'},
  {code:'GN',flag:'🇬🇳',name:'Guinée',dial:'+224'},
  {code:'BJ',flag:'🇧🇯',name:'Bénin',dial:'+229'},
  {code:'NE',flag:'🇳🇪',name:'Niger',dial:'+227'},
  {code:'TG',flag:'🇹🇬',name:'Togo',dial:'+228'},
  {code:'GA',flag:'🇬🇦',name:'Gabon',dial:'+241'},
  {code:'CG',flag:'🇨🇬',name:'Congo',dial:'+242'},
  {code:'CD',flag:'🇨🇩',name:'RD Congo',dial:'+243'},
  {code:'NG',flag:'🇳🇬',name:'Nigeria',dial:'+234'},
  {code:'GH',flag:'🇬🇭',name:'Ghana',dial:'+233'},
  {code:'KE',flag:'🇰🇪',name:'Kenya',dial:'+254'},
  {code:'TZ',flag:'🇹🇿',name:'Tanzanie',dial:'+255'},
  {code:'UG',flag:'🇺🇬',name:'Ouganda',dial:'+256'},
  {code:'RW',flag:'🇷🇼',name:'Rwanda',dial:'+250'},
  {code:'ZA',flag:'🇿🇦',name:'Afrique du Sud',dial:'+27'}
];

// ── User session (in-memory after /api/auth/me) ─────────────
let _currentUser = null;
async function getUser(force=false) {
  if (_currentUser && !force) return _currentUser;
  try { const d = await API.me(); _currentUser = d.user; return _currentUser; } catch { return null; }
}
function setUser(u) { _currentUser = u; }

// ── Require auth ─────────────────────────────────────────────
async function requireAuth() {
  const u = await getUser();
  if (!u) { window.location.href = '/login'; return null; }
  return u;
}

// ── Formatting ───────────────────────────────────────────────
function fmtXAF(n)  { return Number(n||0).toLocaleString('fr-FR')+' XAF'; }
function fmtUSD(n)  { return '$'+Number(n||0).toFixed(2); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ── Toast ────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type='green') {
  let el = document.getElementById('toast');
  if (!el) { el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent=msg;
  el.style.borderColor = type==='err'?'#ff5050':'var(--green)';
  el.style.color       = type==='err'?'#ff5050':'var(--green)';
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('on'),2800);
}

// ── Modal ────────────────────────────────────────────────────
function showModal(ico,h1,h2,cb) {
  document.getElementById('m-ico').textContent=ico;
  document.getElementById('m-h1').textContent=h1;
  document.getElementById('m-h2').textContent=h2;
  document.getElementById('modal-bg')._cb=cb;
  document.getElementById('modal-bg').classList.add('on');
}
function closeModal() {
  const bg=document.getElementById('modal-bg');
  bg.classList.remove('on');
  if(typeof bg._cb==='function') bg._cb();
}

// ── Toggle password ──────────────────────────────────────────
function togglePwd(id) { const e=document.getElementById(id); e.type=e.type==='password'?'text':'password'; }

// ── Country select ───────────────────────────────────────────
function populateCountrySelect(sel, flagEl, codeEl) {
  sel.innerHTML = COUNTRIES.map(c=>`<option value="${c.code}">${c.flag} ${c.name} (${c.dial})</option>`).join('');
  sel.addEventListener('change',()=>{
    const c=COUNTRIES.find(x=>x.code===sel.value);
    if(flagEl) flagEl.textContent=c.flag;
    if(codeEl) codeEl.innerHTML=`<option>${c.flag} ${c.dial}</option>`;
  });
}

// ── Countdown timer ──────────────────────────────────────────
function startCountdown(isoDate, elId) {
  function tick() {
    const diff=new Date(isoDate)-Date.now();
    const el=document.getElementById(elId); if(!el) return;
    if(diff<=0){el.textContent='Expiré';return;}
    const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
    el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    setTimeout(tick,1000);
  }
  tick();
}

// ── Standard modal HTML ──────────────────────────────────────
function injectModal() {
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <div class="modal-ico" id="m-ico">✅</div>
        <div class="modal-h1" id="m-h1">Succès</div>
        <div class="modal-h2" id="m-h2"></div>
        <button class="btn btn-blue" id="m-btn" onclick="closeModal()">Continuer</button>
      </div>
    </div>
    <div id="toast"></div>
  `);
}
