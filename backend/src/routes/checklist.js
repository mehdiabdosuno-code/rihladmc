const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser, verifierDossier } = require('../middleware/auth');
const ctrl = require('../controllers/checklistController');

const checklistSchema = Joi.object({
  appel_restaurants:  Joi.boolean(),
  appel_hotels:       Joi.boolean(),
  appel_activites:    Joi.boolean(),
  dossier_guide_pret: Joi.boolean(),
  notes:              Joi.string().max(1000).allow('', null),
});

router.get('/:id/checklist',
  authenticate, verifierDossier,
  ctrl.get
);

router.patch('/:id/checklist',
  authenticate, autoriser('TD', 'admin'), verifierDossier,
  validate(checklistSchema),
  ctrl.valider
);

module.exports = router;
