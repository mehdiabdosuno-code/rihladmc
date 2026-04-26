const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser, verifierDossier } = require('../middleware/auth');
const ctrl = require('../controllers/rapportsController');

const rapportSchema = Joi.object({
  jour:           Joi.number().integer().min(1).max(30).required(),
  date_rapport:   Joi.date().iso().required(),
  petit_dejeuner: Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  dejeuner:       Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  diner:          Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  hotel:          Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  transport:      Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  accueil_hote:   Joi.string().valid('bien', 'moyen', 'mauvais').allow(null),
  commentaire:    Joi.string().max(2000).allow('', null),
});

router.post('/:id/rapports',
  authenticate,
  autoriser('guide'),
  verifierDossier,
  validate(rapportSchema),
  ctrl.soumettre
);

router.get('/:id/rapports',
  authenticate,
  verifierDossier,
  ctrl.liste
);

router.get('/:id/rapports/:jour',
  authenticate,
  verifierDossier,
  ctrl.detail
);

module.exports = router;
