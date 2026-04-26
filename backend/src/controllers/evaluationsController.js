const db = require('../config/db');
const claudeService = require('../services/claudeService');

exports.liste = async (req, res, next) => {
  try {
    const evals = await db('evaluations_guides as e')
      .join('dossiers as d', 'e.dossier_id', 'd.id')
      .join('utilisateurs as td', 'e.td_id', 'td.id')
      .where('e.guide_id', req.params.guideId)
      .select('e.*', 'd.numero_dossier', 'd.nom_groupe', db.raw("CONCAT(td.prenom,' ',td.nom) as td_nom"))
      .orderBy('e.created_at', 'desc');
    res.json(evals);
  } catch (err) { next(err); }
};

exports.creer = async (req, res, next) => {
  try {
    const [eval_] = await db('evaluations_guides').insert({
      ...req.body,
      guide_id: req.params.guideId,
      td_id: req.user.id,
    }).returning('*');
    res.status(201).json(eval_);
  } catch (err) { next(err); }
};

exports.generer = async (req, res, next) => {
  try {
    const { dossier_id, ton, langue } = req.body;
    const guideId = req.params.guideId;

    // Récupérer contexte complet
    const guide    = await db('utilisateurs').where('id', guideId).first();
    const dossier  = await db('dossiers').where('id', dossier_id).first();
    const rapports = await db('rapports_journaliers').where({ dossier_id, guide_id: guideId }).orderBy('jour');

    const brouillon = await claudeService.genererEvaluation({ guide, dossier, rapports, ton, langue });

    // Calculer note suggérée à partir des rapports
    const SCORES = { bien: 2, moyen: 1, mauvais: 0 };
    const CATS   = ['petit_dejeuner','dejeuner','diner','hotel','transport','accueil_hote'];
    let total = 0, count = 0;
    for (const r of rapports) {
      for (const cat of CATS) {
        if (r[cat]) { total += SCORES[r[cat]]; count++; }
      }
    }
    const noteSuggeree = count > 0 ? parseFloat(((total / count / 2) * 10).toFixed(1)) : null;

    res.json({ brouillon, note_suggeree: noteSuggeree });
  } catch (err) { next(err); }
};
