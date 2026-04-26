const db = require('../config/db');

exports.liste = async (req, res, next) => {
  try {
    const { type, ville, search } = req.query;
    let q = db('prestataires').where('actif', true);
    if (type)   q = q.where('type', type);
    if (ville)  q = q.whereILike('ville', `%${ville}%`);
    if (search) q = q.whereILike('nom', `%${search}%`);
    res.json(await q.orderBy('nom'));
  } catch (err) { next(err); }
};

exports.creer = async (req, res, next) => {
  try {
    const [p] = await db('prestataires').insert(req.body).returning('*');
    res.status(201).json(p);
  } catch (err) { next(err); }
};

exports.detail = async (req, res, next) => {
  try {
    const p = await db('prestataires').where('id', req.params.id).first();
    if (!p) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    res.json(p);
  } catch (err) { next(err); }
};

exports.modifier = async (req, res, next) => {
  try {
    const [p] = await db('prestataires').where('id', req.params.id).update(req.body).returning('*');
    res.json(p);
  } catch (err) { next(err); }
};

exports.supprimer = async (req, res, next) => {
  try {
    await db('prestataires').where('id', req.params.id).update({ actif: false });
    res.sendStatus(204);
  } catch (err) { next(err); }
};
