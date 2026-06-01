require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const app = express();

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ──────────────────────────────────────────────
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/auth/login',       rateLimit({ windowMs: 15*60*1000, max: 15 }));
app.use('/api/auth/admin/login', rateLimit({ windowMs: 15*60*1000, max: 10 }));
app.use('/api/auth/register',    rateLimit({ windowMs: 60*60*1000, max: 20 }));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/user',         require('./routes/user'));

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const db = require('./config/db');
    await db.query('SELECT 1');
    const [users] = await db.query('SELECT COUNT(*) as c FROM users');
    const [txns]  = await db.query('SELECT COUNT(*) as c FROM transactions');
    res.json({ ok: true, status: 'FlexiPay running', db: 'connected',
      users: users[0].c, transactions: txns[0].c, time: new Date() });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'disconnected', error: e.message });
  }
});

// ── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Page routes ────────────────────────────────────────────────
const pages = ['index','login','register','dashboard','recharge','code',
               'convert','card','transactions','profile','admin','schema'];
pages.forEach(p => {
  const route = p === 'index' ? '/' : '/' + p;
  const file  = path.join(__dirname, 'public', p + '.html');
  app.get(route, (req, res) => res.sendFile(file));
  if (p !== 'index') app.get('/' + p + '.html', (req, res) => res.sendFile(file));
});

// ── 404 / Error handlers ───────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Route introuvable' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne' });
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 FlexiPay running → http://localhost:${PORT}`);
  console.log(`🔐 Admin panel     → http://localhost:${PORT}/admin`);
  console.log(`💚 API health      → http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Database        → ${process.env.DB_HOST||'localhost'}/${process.env.DB_NAME||'flexipay'}\n`);
});
