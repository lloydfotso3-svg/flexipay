// utils.js – shared constants & helpers

// ── Per-country local currency ────────────────────────────────
// currency: ISO code, currName: full name, currSymbol: symbol
const COUNTRIES = [
  {code:'CM',flag:'🇨🇲',name:'Cameroun',      dial:'+237', currency:'XAF', currName:'Franc CFA CEMAC',   currSymbol:'FCFA'},
  {code:'CI',flag:'🇨🇮',name:"Côte d'Ivoire", dial:'+225', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'SN',flag:'🇸🇳',name:'Sénégal',       dial:'+221', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'ML',flag:'🇲🇱',name:'Mali',           dial:'+223', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'BF',flag:'🇧🇫',name:'Burkina Faso',   dial:'+226', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'GN',flag:'🇬🇳',name:'Guinée',         dial:'+224', currency:'GNF', currName:'Franc Guinéen',     currSymbol:'FG'},
  {code:'BJ',flag:'🇧🇯',name:'Bénin',          dial:'+229', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'NE',flag:'🇳🇪',name:'Niger',           dial:'+227', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'TG',flag:'🇹🇬',name:'Togo',           dial:'+228', currency:'XOF', currName:'Franc CFA UEMOA',   currSymbol:'FCFA'},
  {code:'GA',flag:'🇬🇦',name:'Gabon',          dial:'+241', currency:'XAF', currName:'Franc CFA CEMAC',   currSymbol:'FCFA'},
  {code:'CG',flag:'🇨🇬',name:'Congo',          dial:'+242', currency:'XAF', currName:'Franc CFA CEMAC',   currSymbol:'FCFA'},
  {code:'CD',flag:'🇨🇩',name:'RD Congo',       dial:'+243', currency:'CDF', currName:'Franc Congolais',   currSymbol:'FC'},
  {code:'NG',flag:'🇳🇬',name:'Nigeria',        dial:'+234', currency:'NGN', currName:'Naira',             currSymbol:'₦'},
  {code:'GH',flag:'🇬🇭',name:'Ghana',          dial:'+233', currency:'GHS', currName:'Cedi',              currSymbol:'₵'},
  {code:'KE',flag:'🇰🇪',name:'Kenya',          dial:'+254', currency:'KES', currName:'Shilling Kényan',   currSymbol:'KSh'},
  {code:'TZ',flag:'🇹🇿',name:'Tanzanie',       dial:'+255', currency:'TZS', currName:'Shilling Tanzanien',currSymbol:'TSh'},
  {code:'UG',flag:'🇺🇬',name:'Ouganda',        dial:'+256', currency:'UGX', currName:'Shilling Ougandais',currSymbol:'USh'},
  {code:'RW',flag:'🇷🇼',name:'Rwanda',         dial:'+250', currency:'RWF', currName:'Franc Rwandais',    currSymbol:'RF'},
  {code:'ZA',flag:'🇿🇦',name:'Afrique du Sud', dial:'+27',  currency:'ZAR', currName:'Rand',              currSymbol:'R'},
];

// USD exchange rates for each local currency (approx, fallback)
const CURRENCY_TO_USD = {
  XAF: 0.001667, XOF: 0.001667, GNF: 0.000116, CDF: 0.000350,
  NGN: 0.000650, GHS: 0.068,    KES: 0.0078,   TZS: 0.000390,
  UGX: 0.000270, RWF: 0.000720, ZAR: 0.054,
};

// Local currency → XAF equivalent for display (approx)
const CURRENCY_RATES_XAF = {
  XAF: 1, XOF: 1, GNF: 0.07, CDF: 0.21,
  NGN: 0.39, GHS: 40.8, KES: 4.7, TZS: 0.23,
  UGX: 0.16, RWF: 0.43, ZAR: 32.4,
};

function getCountry(code) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

// ── Foreign target currencies for conversion ─────────────────
const RATES_STATIC = {
  usd:{r:600,  f:'🇺🇸',c:'USD',n:'Dollar américain', s:'$'},
  eur:{r:655,  f:'🇪🇺',c:'EUR',n:'Euro',              s:'€'},
  gbp:{r:762,  f:'🇬🇧',c:'GBP',n:'Livre Sterling',    s:'£'},
  cad:{r:440,  f:'🇨🇦',c:'CAD',n:'Dollar canadien',   s:'CA$'},
};

const OPS = { mtn:'MTN Mobile Money', orange:'Orange Money', airtel:'Airtel Money' };

// ── User session ──────────────────────────────────────────────
let _currentUser = null;
async function getUser(force=false) {
  if (_currentUser && !force) return _currentUser;
  try { const d = await API.me(); _currentUser = d.user; return _currentUser; } catch { return null; }
}
function setUser(u) { _currentUser = u; }

async function requireAuth() {
  const u = await getUser();
  if (!u) { window.location.href = '/login'; return null; }
  return u;
}

// ── Formatting ────────────────────────────────────────────────
function fmtLocalCurrency(n, currencyCode) {
  const c = COUNTRIES.find(x => x.currency === currencyCode);
  const sym = c?.currSymbol || currencyCode || 'FCFA';
  return Number(n||0).toLocaleString('fr-FR') + ' ' + sym;
}
function fmtXAF(n)  { return Number(n||0).toLocaleString('fr-FR') + ' FCFA'; }
function fmtUSD(n)  { return '$' + Number(n||0).toFixed(2); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ── Toast ─────────────────────────────────────────────────────
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

function togglePwd(id) { const e=document.getElementById(id); e.type=e.type==='password'?'text':'password'; }

function populateCountrySelect(sel, flagEl, codeEl) {
  sel.innerHTML = COUNTRIES.map(c=>`<option value="${c.code}">${c.flag} ${c.name} (${c.dial}) — ${c.currency}</option>`).join('');
  sel.addEventListener('change',()=>{
    const c=COUNTRIES.find(x=>x.code===sel.value);
    if(flagEl) flagEl.textContent=c.flag;
    if(codeEl) codeEl.innerHTML=`<option>${c.flag} ${c.dial}</option>`;
  });
}

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
