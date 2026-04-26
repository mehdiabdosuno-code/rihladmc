const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');

const SALT_ROUNDS = 12;

function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

async function createRefreshToken(userId, ip, userAgent) {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db('refresh_tokens').insert({ user_id: userId, token_hash: hash, expires_at: expiresAt, ip_address: ip, user_agent: userAgent });
  return raw;
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db('utilisateurs').where({ email, actif: true }).first();
    if (!user) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' } });

    const valid = await bcrypt.compare(password, user.mot_de_passe);
    if (!valid) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' } });

    await db('utilisateurs').where('id', user.id).update({ derniere_connexion: new Date() });

    const accessToken = signAccess(user);
    const refreshToken = await createRefreshToken(user.id, req.ip, req.headers['user-agent']);

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, photo_url: user.photo_url },
    });
  } catch (err) { next(err); }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const token = await db('refresh_tokens')
      .where({ token_hash: hash, revoque: false })
      .where('expires_at', '>', new Date())
      .first();

    if (!token) return res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN' } });

    const user = await db('utilisateurs').where('id', token.user_id).first();
    if (!user?.actif) return res.status(401).json({ error: { code: 'USER_INACTIVE' } });

    // Rotation : révoquer ancien token
    await db('refresh_tokens').where('id', token.id).update({ revoque: true });
    const newRefresh = await createRefreshToken(user.id, req.ip, req.headers['user-agent']);

    res.json({ access_token: signAccess(user), refresh_token: newRefresh });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await db('refresh_tokens').where('token_hash', hash).update({ revoque: true });
    }
    res.sendStatus(204);
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await db('utilisateurs').where('id', req.user.id).first();
    const nonLues = await db('notifications').where({ user_id: req.user.id, lu: false }).count('id as n').first();
    res.json({
      id: user.id, nom: user.nom, prenom: user.prenom, email: user.email,
      role: user.role, telephone: user.telephone, photo_url: user.photo_url,
      notifications_non_lues: parseInt(nonLues.n || 0),
    });
  } catch (err) { next(err); }
};
