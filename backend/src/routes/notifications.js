const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await db('notifications')
      .where('user_id', req.user.id)
      .orderBy('created_at', 'desc')
      .limit(50);
    const [{ n }] = await db('notifications').where({ user_id: req.user.id, lu: false }).count('id as n');
    res.json({ data, non_lues: parseInt(n) });
  } catch (err) { next(err); }
});

router.patch('/:id/lire', authenticate, async (req, res, next) => {
  try {
    await db('notifications').where({ id: req.params.id, user_id: req.user.id }).update({ lu: true, lu_at: new Date() });
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.patch('/lire-tout', authenticate, async (req, res, next) => {
  try {
    await db('notifications').where({ user_id: req.user.id, lu: false }).update({ lu: true, lu_at: new Date() });
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.patch('/fcm-token', authenticate, async (req, res, next) => {
  try {
    const { token } = req.body;
    await db('utilisateurs').where('id', req.user.id).update({ fcm_token: token });
    res.sendStatus(204);
  } catch (err) { next(err); }
});

module.exports = router;
