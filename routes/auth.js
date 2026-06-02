// routes/auth.js
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db       = require('../config/db');
const { authUser } = require('../middleware/auth');

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, password, pin, phone,
          country_code, date_of_birth, kyc_doc_type, kyc_doc_num } = req.body;

  if (!first_name || !last_name || !email || !password || !pin || !phone || !date_of_birth)
    return res.status(400).json({ error: 'Tous les champs obligatoires sont requis' });

  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });

  if (!/^\d{4}$/.test(pin))
    return res.status(400).json({ error: 'PIN invalide (4 chiffres)' });

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email=? OR phone=?', [email, phone]);
    if (existing.length) return res.status(409).json({ error: 'Email ou téléphone déjà utilisé' });

    const id           = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);
    const pin_hash      = await bcrypt.hash(pin, 10);

    // Generate virtual card number
    const card_number = '4821 ' + Array(3).fill(null)
      .map(() => Math.floor(1000 + Math.random() * 9000)).join(' ');
    const card_expiry = '09/28';
    const card_cvv    = String(Math.floor(100 + Math.random() * 900));
    const card_cvv_hash = await bcrypt.hash(card_cvv, 10);

    await db.query(
      `INSERT INTO users
       (id, first_name, last_name, email, phone, country_code, date_of_birth,
        password_hash, pin_hash, kyc_status, kyc_doc_type, kyc_doc_num,
        card_number, card_expiry, card_cvv_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, first_name, last_name, email, phone,
       country_code || 'CM', date_of_birth,
       password_hash, pin_hash, 'pending',
       kyc_doc_type || null, kyc_doc_num || null,
       card_number, card_expiry, card_cvv_hash]
    );

    const token = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT, maxAge: 7*24*3600*1000, sameSite: 'lax' });

    res.json({
      ok: true,
      user: { id, first_name, last_name, email, phone, country_code: country_code||'CM',
               kyc_status: 'pending', balance_usd: 0, card_number, card_expiry }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    await db.query('UPDATE users SET last_login=NOW() WHERE id=?', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT, maxAge: 7*24*3600*1000, sameSite: 'lax' });

    const { password_hash, pin_hash, card_cvv_hash, ...safeUser } = user;
    res.json({ ok: true, user: safeUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authUser, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id,first_name,last_name,email,phone,country_code,balance_usd,kyc_status,card_number,card_expiry,card_frozen,daily_limit_usd,created_at FROM users WHERE id=? AND is_active=1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/admin/login ──────────────────────────────
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs requis' });

  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email=? AND is_active=1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Identifiants incorrects' });

    const admin = rows[0];
    const ok    = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

    await db.query('UPDATE admins SET last_login=NOW() WHERE id=?', [admin.id]);

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT, maxAge: 8*3600*1000, sameSite: 'lax' });

    res.json({ ok: true, token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/admin/logout ─────────────────────────────
router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

// ── POST /api/auth/upload-kyc (stub) ───────────────────────
router.post('/upload-kyc', authUser, (req, res) => {
  // In production: upload to S3/Cloudinary, update kyc fields
  res.json({ ok: true, message: 'Documents reçus, vérification en cours' });
});

module.exports = router;
