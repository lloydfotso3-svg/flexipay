// middleware/auth.js
const jwt = require('jsonwebtoken');

function authUser(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ','');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
  }
}

function authAdmin(req, res, next) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ','');
  if (!token) return res.status(401).json({ error: 'Accès admin refusé' });
  try {
    req.admin = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session admin expirée' });
  }
}

module.exports = { authUser, authAdmin };
