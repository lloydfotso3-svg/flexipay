// routes/user.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { authUser } = require('../middleware/auth');

router.use(authUser);

// ── GET /api/user/profile ───────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id,first_name,last_name,email,phone,country_code,balance_usd,kyc_status,card_number,card_expiry,card_frozen,daily_limit_usd,created_at FROM users WHERE id=?',
      [req.user.id]);
    res.json({ ok:true, user: rows[0] });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/user/card/freeze ─────────────────────────────
router.patch('/card/freeze', async (req, res) => {
  const { frozen } = req.body;
  try {
    await db.query('UPDATE users SET card_frozen=? WHERE id=?', [frozen?1:0, req.user.id]);
    res.json({ ok:true, frozen: !!frozen });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── GET /api/user/card/cvv ──────────────────────────────────
router.post('/card/cvv', async (req, res) => {
  const { pin } = req.body;
  try {
    const [rows] = await db.query('SELECT pin_hash, card_cvv_hash FROM users WHERE id=?', [req.user.id]);
    const ok = await bcrypt.compare(pin, rows[0].pin_hash);
    if (!ok) return res.status(401).json({ error:'PIN incorrect' });
    // In production: decrypt card_cvv from secure vault
    // Here we just confirm auth so frontend shows CVV from secure session
    res.json({ ok:true, authorized:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/user/profile ─────────────────────────────────
router.patch('/profile', async (req, res) => {
  const { first_name, last_name } = req.body;
  try {
    await db.query('UPDATE users SET first_name=?, last_name=? WHERE id=?', [first_name, last_name, req.user.id]);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── PATCH /api/user/password ────────────────────────────────
router.patch('/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error:'Mot de passe trop court' });
  try {
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error:'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id]);
    res.json({ ok:true });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

module.exports = router;
