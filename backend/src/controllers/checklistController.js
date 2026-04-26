const db = require('../config/db');

exports.get = async (req, res, next) => {
  try {
    const checklist = await db('checklist_24h').where('dossier_id', req.params.id).first();
    if (!checklist) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

    const complete = checklist.appel_restaurants && checklist.appel_hotels
      && checklist.appel_activites && checklist.dossier_guide_pret;

    res.json({ ...checklist, complete });
  } catch (err) { next(err); }
};

exports.valider = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    const existant = await db('checklist_24h').where('dossier_id', req.params.id).first();

    // Marquer validé_par si tout sera coché après cette mise à jour
    const merged = { ...existant, ...updates };
    const complete = merged.appel_restaurants && merged.appel_hotels
      && merged.appel_activites && merged.dossier_guide_pret;

    if (complete && !existant.valide_par) {
      updates.valide_par = req.user.id;
    }

    const [updated] = await db('checklist_24h')
      .where('dossier_id', req.params.id)
      .update(updates)
      .returning('*');

    res.json({ ...updated, complete });
  } catch (err) { next(err); }
};
