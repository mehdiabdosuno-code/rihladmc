const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token manquant' } });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré' } });
  }
};

const autoriser = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Rôle insuffisant' } });
  }
  next();
};

const verifierDossier = async (req, res, next) => {
  const dossier = await db('dossiers').where('id', req.params.id).first();
  if (!dossier) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dossier introuvable' } });

  const { id, role } = req.user;
  const autorise = role === 'admin'
    || dossier.td_id === id
    || dossier.guide_id === id
    || role === 'comptable';

  if (!autorise) return res.status(403).json({ error: { code: 'FORBIDDEN' } });

  req.dossier = dossier;
  next();
};

module.exports = { authenticate, autoriser, verifierDossier };
