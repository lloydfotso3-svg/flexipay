// middleware/auth.js
const jwt = require('jsonwebtoken');

function extractToken(req, cookieName) {
  // 1. Cookie (primary)
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  // 2. Authorization header fallback (for Railway / HTTPS cookie issues)
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function authUser(req, res, next) {
  const token = extractToken(req, 'token');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function authAdmin(req, res, next) {
  const token = extractToken(req, 'admin_token');
  if (!token) return res.status(401).json({ error: 'Accès admin requis' });
  try {
    req.admin = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token admin invalide ou expiré' });
  }
}

module.exports = { authUser, authAdmin };
