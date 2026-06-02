// routes/transactions.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../config/db');
const { authUser } = require('../middleware/auth');

const OPS_LABEL = { mtn: 'MTN MoMo', orange: 'Orange Money', airtel: 'Airtel Money' };

// ── Generate transaction ref ────────────────────────────────
function genRef() {
  const year = new Date().getFullYear();
  return 'FP-' + year + '-' + String(Math.floor(10000+Math.random()*90000));
}

// ── POST /api/transactions/recharge ────────────────────────
router.post('/recharge', authUser, async (req, res) => {
  const { operator, amount_local, phone_number, country_code, secret_code } = req.body;
  if (!operator || !amount_local || !phone_number)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  if (!['mtn','orange','airtel'].includes(operator))
    return res.status(400).json({ error: 'Opérateur invalide' });
  if (amount_local < 500)
    return res.status(400).json({ error: 'Montant minimum: 500 XAF' });
  // Per-operator PIN length: Orange=4, MTN=5, Airtel=5
  const PIN_LENGTHS = { orange: 4, mtn: 5, airtel: 4 };
  const expectedPinLen = PIN_LENGTHS[operator];
  if (!secret_code)
    return res.status(400).json({ error: `Code secret requis (${expectedPinLen} chiffres pour ${OPS_LABEL[operator] || operator})` });
  if (!/^\d+$/.test(secret_code) || secret_code.length !== expectedPinLen)
    return res.status(400).json({ error: `Code secret invalide — ${OPS_LABEL[operator] || operator} requiert exactement ${expectedPinLen} chiffres` });

  try {
    const [rateRows] = await db.query(
      'SELECT rate FROM exchange_rates WHERE from_currency=? AND to_currency=? ORDER BY recorded_at DESC LIMIT 1',
      ['XAF','USD']);
    const rate      = rateRows[0]?.rate || 0.001667;
    const xafRate   = 1 / rate;
    const amount_usd = parseFloat((amount_local * rate).toFixed(4));
    const fee        = parseFloat((amount_local * 0.015).toFixed(2));

    const txnId  = uuidv4();
    const ref    = genRef();
    const codeId = uuidv4();
    const code   = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 86400000); // +24h

    const [userRow] = await db.query('SELECT first_name, last_name FROM users WHERE id=?', [req.user.id]);
    const user_name = userRow[0] ? userRow[0].first_name + ' ' + userRow[0].last_name : '';

    await db.query(`INSERT INTO transactions 
      (id,ref_code,user_id,user_name,type,operator,amount_local,currency_local,
       amount_usd,exchange_rate,fee,status,country_code,phone_number,ip_address,secret_code)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [txnId,ref,req.user.id,user_name,'recharge',operator,amount_local,'XAF',
       amount_usd,xafRate,fee,'pending',country_code||'CM',phone_number,
       req.ip||req.connection?.remoteAddress,
       secret_code||null]);

    await db.query('INSERT INTO payment_codes (id,transaction_id,code,expires_at) VALUES (?,?,?,?)',
      [codeId, txnId, code, expires]);

    res.json({ ok:true, transaction:{ id:txnId, ref, amount_local, amount_usd, fee, status:'pending' },
      code: { code, expires_at: expires } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/transactions/confirm ─────────────────────────
router.post('/confirm', authUser, async (req, res) => {
  const { transaction_id } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'ID transaction requis' });

  try {
    const [txnRows] = await db.query('SELECT * FROM transactions WHERE id=? AND user_id=?', [transaction_id, req.user.id]);
    if (!txnRows.length) return res.status(404).json({ error: 'Transaction introuvable' });
    const txn = txnRows[0];
    if (txn.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée' });

    // Mark complete
    await db.query('UPDATE transactions SET status=?, completed_at=NOW() WHERE id=?', ['completed', transaction_id]);
    // Invalidate code
    await db.query('UPDATE payment_codes SET is_used=1, used_at=NOW() WHERE transaction_id=?', [transaction_id]);
    // Credit balance
    await db.query('UPDATE users SET balance_usd = balance_usd + ? WHERE id=?', [txn.amount_usd, req.user.id]);

    const [updatedUser] = await db.query('SELECT balance_usd FROM users WHERE id=?', [req.user.id]);
    res.json({ ok:true, new_balance_usd: updatedUser[0].balance_usd, amount_credited: txn.amount_usd });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/transactions/convert (withdrawal request → pending, admin approves) ──
router.post('/convert', authUser, async (req, res) => {
  const { amount_usd, target_currency, operator, phone_number } = req.body;
  const validCurrencies = ['USD','EUR','GBP','CAD'];
  if (!amount_usd || amount_usd < 1)     return res.status(400).json({ error: 'Minimum $1 USD' });
  if (!validCurrencies.includes(target_currency)) return res.status(400).json({ error: 'Devise invalide' });
  if (!operator || !['mtn','orange','airtel'].includes(operator)) return res.status(400).json({ error: 'Opérateur invalide' });
  if (!phone_number)                     return res.status(400).json({ error: 'Numéro de téléphone requis' });

  try {
    const [userRow] = await db.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    const user = userRow[0];
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (parseFloat(user.balance_usd) < amount_usd)
      return res.status(400).json({ error: 'Solde insuffisant' });

    // Get rate USD → target
    const [rateRow] = await db.query(
      'SELECT rate FROM exchange_rates WHERE from_currency=? AND to_currency=? ORDER BY recorded_at DESC LIMIT 1',
      ['USD', target_currency]);
    const rate       = rateRow[0]?.rate || 1;
    const amount_fgn = parseFloat((amount_usd * rate).toFixed(4));
    const fee        = parseFloat((amount_fgn * 0.01).toFixed(4));
    const net        = parseFloat((amount_fgn - fee).toFixed(4));

    const txnId     = uuidv4();
    const ref       = genRef();
    const user_name = user.first_name + ' ' + user.last_name;

    // Create as PENDING — admin will approve and debit balance
    await db.query(`INSERT INTO transactions
      (id,ref_code,user_id,user_name,type,operator,amount_local,currency_local,
       amount_usd,target_currency,exchange_rate,fee,status,country_code,phone_number)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [txnId, ref, req.user.id, user_name, 'withdrawal',
       operator, net, target_currency,
       parseFloat(amount_usd), target_currency,
       rate, fee, 'pending',
       user.country_code, phone_number]);

    res.json({ ok: true, ref, amount_usd, target_currency, amount_converted: net, fee, status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /api/transactions ────────────────────────────────────
router.get('/', authUser, async (req, res) => {
  const { status, type, limit=20, offset=0 } = req.query;
  try {
    let q = 'SELECT * FROM transactions WHERE user_id=?';
    const params = [req.user.id];
    if (status) { q += ' AND status=?'; params.push(status); }
    if (type)   { q += ' AND type=?';   params.push(type); }
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.query(q, params);
    const [count] = await db.query('SELECT COUNT(*) as total FROM transactions WHERE user_id=?', [req.user.id]);
    res.json({ ok:true, transactions: rows, total: count[0].total });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /api/transactions/:id ────────────────────────────────
router.get('/:id', authUser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Transaction introuvable' });
    const [code] = await db.query('SELECT code, expires_at, is_used FROM payment_codes WHERE transaction_id=? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    res.json({ ok:true, transaction: rows[0], code: code[0]||null });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

// ── GET /api/transactions/rates/current ─────────────────────
router.get('/rates/current', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT from_currency, to_currency, rate, recorded_at
      FROM exchange_rates WHERE (from_currency='XAF' OR to_currency='XAF')
      AND recorded_at = (SELECT MAX(r2.recorded_at) FROM exchange_rates r2 WHERE r2.from_currency=exchange_rates.from_currency AND r2.to_currency=exchange_rates.to_currency)`);
    res.json({ ok:true, rates: rows });
  } catch { res.status(500).json({ error:'Erreur serveur' }); }
});

module.exports = router;
