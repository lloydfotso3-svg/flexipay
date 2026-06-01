// ============================================================
//  FlexiPay Frontend – API Client (talks to real server)
// ============================================================
const BASE = '';  // same origin

const API = {
  async call(method, path, body) {
    try {
      const res = await fetch(BASE + '/api' + path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur réseau');
      return data;
    } catch (err) {
      throw err;
    }
  },
  get(path)         { return this.call('GET',    path); },
  post(path, body)  { return this.call('POST',   path, body); },
  patch(path, body) { return this.call('PATCH',  path, body); },
  del(path)         { return this.call('DELETE', path); },

  // ── Auth ──────────────────────────────────────────────────
  login(email, password)    { return this.post('/auth/login', { email, password }); },
  register(data)            { return this.post('/auth/register', data); },
  logout()                  { return this.post('/auth/logout'); },
  me()                      { return this.get('/auth/me'); },
  adminLogin(e,p)           { return this.post('/auth/admin/login', { email:e, password:p }); },
  adminLogout()             { return this.post('/auth/admin/logout'); },

  // ── Transactions ──────────────────────────────────────────
  recharge(data)            { return this.post('/transactions/recharge', data); },
  confirm(transaction_id)   { return this.post('/transactions/confirm', { transaction_id }); },
  convert(data)             { return this.post('/transactions/convert', data); },
  getTransactions(params)   {
    const q = params ? '?'+new URLSearchParams(params) : '';
    return this.get('/transactions'+q);
  },
  getTransaction(id)        { return this.get('/transactions/'+id); },
  getRates()                { return this.get('/transactions/rates/current'); },

  // ── User ─────────────────────────────────────────────────
  getProfile()              { return this.get('/user/profile'); },
  freezeCard(frozen)        { return this.patch('/user/card/freeze', { frozen }); },
  updateProfile(data)       { return this.patch('/user/profile', data); },
  changePassword(data)      { return this.patch('/user/password', data); },

  // ── Admin ─────────────────────────────────────────────────
  adminStats()              { return this.get('/admin/stats'); },
  adminTransactions(params) {
    const q = params ? '?'+new URLSearchParams(params) : '';
    return this.get('/admin/transactions'+q);
  },
  adminUpdateTxn(id,status) { return this.patch('/admin/transactions/'+id, { status }); },
  adminUsers(params)        {
    const q = params ? '?'+new URLSearchParams(params) : '';
    return this.get('/admin/users'+q);
  },
  adminUpdateUser(id,data)  { return this.patch('/admin/users/'+id, data); },
  adminCodes()              { return this.get('/admin/codes'); },
  adminDeleteCode(id)       { return this.del('/admin/codes/'+id); },
  adminFraud()              { return this.get('/admin/fraud'); },
  adminUpdateFraud(id,act)  { return this.patch('/admin/fraud/'+id, { action_taken:act }); },
  adminUpdateRate(data)     { return this.patch('/admin/rates', data); },
};
