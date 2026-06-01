// routes/admin.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../config/db');
const { authAdmin } = require('../middleware/auth');

// All routes require admin auth
router.use(authAdmin);

// ── GET /api/admin/stats ────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[{ total_users }]]    = await db.query('SELECT COUNT(*) as total_users FROM users');
    const [[{ pending_txns }]]   = await db.query("SELECT COUNT(*) as pending_txns FROM transactions WHERE status='pending'");
    const [[{ total_vol }]]      = await db.query("SELECT COALESCE(SUM(amount_usd),0) as total_vol FROM transactions WHERE status='completed'");
    const [[{ fraud_alerts }]]   = await db.query('SELECT COUNT(*) as fraud_alerts FROM fraud_logs WHERE action_taken="none"');
    const [[{ vol_24h }]]        = await db.query("SELECT COALESCE(SUM(amount_usd),0) as vol_24h FROM transactions WHERE status='completed' AND created_at >= NOW() - INTERVAL 24 HOUR");
    const [country_stats]        = await db.query("SELECT country_code, SUM(amount_usd) as volume FROM transactions WHERE status='completed' GROUP BY country_code ORDER BY volume DESC LIMIT 8");
    const [recent_txns]          = await db.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50');
    res.json({ ok:true, stats:{ total_users, pending_txns, total_vol, fraud_alerts, vol_24h }, country_stats, recent_txns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Erreur serveur' });
  }
});

// ── GET /api/admin/transactions ─────────────────────────────
router.get('/transactions', async (req, res) => {
  const { status, country, operator, search, limit=50, offset=0 } = req.query;
  try {
    let q = 'SELECT t.*, u.email as user_email FROM transactions t LEFT JOIN users u ON t.user_id=u.id WHERE 1=1';
    const p = [];
    if (status)   { q += ' AND t.status=?';       p.push(status); }
    if (country)  { q += ' AND t.country_code=?'; p.push(country); }
    if (operator) { q += ' AND t.operator=?';     p.push(operator); }
    if (search)   { q += ' AND (t.ref_code LIKE ? OR t.user_name LIKE ? OR t.phone_number LIKE ?)'; p.push('%'+search+'%','%'+search+'%','%'+search+'%'); }
    q += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    p.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(q, p);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM transactions');
    res.json({ ok:true, transactions: rows, total });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/admin/transactions/:id ──────────────────────
router.patch('/transactions/:id', async (req, res) => {
  const { status } = req.body;
  if (!['pending','completed','failed','flagged'].includes(status))
    return res.status(400).json({ error: 'Statut invalide' });
  try {
    const [txnRows] = await db.query('SELECT * FROM transactions WHERE id=?', [req.params.id]);
    if (!txnRows.length) return res.status(404).json({ error: 'Transaction introuvable' });
    const txn = txnRows[0];
    await db.query('UPDATE transactions SET status=?, completed_at=? WHERE id=?',
      [status, status==='completed'?new Date():null, req.params.id]);

    if (status === 'completed' && txn.status === 'pending' && txn.type === 'recharge') {
      await db.query('UPDATE users SET balance_usd = balance_usd + ? WHERE id=?', [txn.amount_usd, txn.user_id]);
      await db.query('UPDATE payment_codes SET is_used=1, used_at=NOW() WHERE transaction_id=?', [req.params.id]);
    }
    if (status === 'flagged') {
      await db.query('INSERT INTO fraud_logs (id,user_id,transaction_id,risk_score,flag_reason) VALUES (?,?,?,?,?)',
        [uuidv4(), txn.user_id, req.params.id, 65, 'Signalé manuellement par admin']);
    }
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── GET /api/admin/users ────────────────────────────────────
router.get('/users', async (req, res) => {
  const { kyc_status, search, limit=50, offset=0 } = req.query;
  try {
    let q = 'SELECT id,first_name,last_name,email,phone,country_code,balance_usd,kyc_status,is_active,created_at FROM users WHERE 1=1';
    const p = [];
    if (kyc_status) { q += ' AND kyc_status=?'; p.push(kyc_status); }
    if (search)     { q += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)'; p.push('%'+search+'%','%'+search+'%','%'+search+'%','%'+search+'%'); }
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    p.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(q, p);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM users');
    res.json({ ok:true, users: rows, total });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/admin/users/:id ──────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { kyc_status, is_active } = req.body;
  try {
    const updates = [];
    const params  = [];
    if (kyc_status !== undefined) {
      updates.push('kyc_status=?');
      params.push(kyc_status);
      if (kyc_status === 'verified') { updates.push('kyc_verified_at=NOW()'); }
    }
    if (is_active !== undefined) { updates.push('is_active=?'); params.push(is_active ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
    params.push(req.params.id);
    await db.query('UPDATE users SET ' + updates.join(',') + ' WHERE id=?', params);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── GET /api/admin/codes ────────────────────────────────────
router.get('/codes', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT pc.*, t.ref_code, t.amount_usd, t.user_name, t.operator
      FROM payment_codes pc JOIN transactions t ON pc.transaction_id=t.id
      WHERE pc.is_used=0 AND pc.expires_at > NOW() ORDER BY pc.created_at DESC`);
    res.json({ ok:true, codes: rows });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── DELETE /api/admin/codes/:id ─────────────────────────────
router.delete('/codes/:id', async (req, res) => {
  try {
    await db.query('UPDATE payment_codes SET is_used=1 WHERE id=?', [req.params.id]);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── GET /api/admin/fraud ────────────────────────────────────
router.get('/fraud', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM fraud_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ ok:true, logs: rows });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/admin/fraud/:id ──────────────────────────────
router.patch('/fraud/:id', async (req, res) => {
  const { action_taken } = req.body;
  try {
    await db.query('UPDATE fraud_logs SET action_taken=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
      [action_taken, req.admin.id, req.params.id]);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/admin/rates ──────────────────────────────────
router.patch('/rates', async (req, res) => {
  const { from_currency, to_currency, rate } = req.body;
  try {
    await db.query('INSERT INTO exchange_rates (id,from_currency,to_currency,rate,source) VALUES (?,?,?,?,?)',
      [uuidv4(), from_currency, to_currency, rate, 'admin']);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

module.exports = router;
