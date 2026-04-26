const db = require('../config/db');
const rapportService = require('../services/rapportService');

const EMOJI_MAP = {
  bien:    { emoji: '😊', score: 2 },
  moyen:   { emoji: '😐', score: 1 },
  mauvais: { emoji: '😞', score: 0 },
};

const CATEGORIES = ['petit_dejeuner', 'dejeuner', 'diner', 'hotel', 'transport', 'accueil_hote'];

function enrichirRapport(rapport) {
  const evaluations = {};
  let total = 0, count = 0;

  for (const cat of CATEGORIES) {
    const val = rapport[cat];
    if (val) {
      evaluations[cat] = { valeur: val, ...EMOJI_MAP[val] };
      total += EMOJI_MAP[val].score;
      count++;
    } else {
      evaluations[cat] = null;
    }
  }

  return {
    ...rapport,
    evaluations,
    score_global: count > 0 ? parseFloat(((total / count / 2) * 5).toFixed(1)) : null,
  };
}

exports.soumettre = async (req, res, next) => {
  try {
    const dossierId = req.params.id;
    const guideId   = req.user.id;

    // Vérifier que ce guide est bien assigné au dossier
    if (req.dossier.guide_id !== guideId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Vous n\'êtes pas le guide de ce dossier' } });
    }

    const { rapport, alerteDeclenchee, categoriesAlertes } = await rapportService.soumettre(
      dossierId, guideId, req.body, req.io, req.redis
    );

    res.status(201).json({
      ...enrichirRapport(rapport),
      alerte_declenchee: alerteDeclenchee,
      categories_alertes: categoriesAlertes,
      message: alerteDeclenchee
        ? `Rapport soumis. Alerte envoyée au TD pour : ${categoriesAlertes.join(', ')}`
        : 'Rapport soumis avec succès',
    });
  } catch (err) { next(err); }
};

exports.liste = async (req, res, next) => {
  try {
    const rapports = await db('rapports_journaliers')
      .where('dossier_id', req.params.id)
      .orderBy('jour');
    res.json(rapports.map(enrichirRapport));
  } catch (err) { next(err); }
};

exports.detail = async (req, res, next) => {
  try {
    const rapport = await db('rapports_journaliers')
      .where({ dossier_id: req.params.id, jour: req.params.jour })
      .first();
    if (!rapport) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    res.json(enrichirRapport(rapport));
  } catch (err) { next(err); }
};
