const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/evaluationsController');

const evalSchema = Joi.object({
  dossier_id:  Joi.string().uuid().required(),
  note:        Joi.number().min(0).max(10).required(),
  critique:    Joi.string().min(10).max(5000).required(),
  source_aide: Joi.string().valid('manuel', 'claude').default('manuel'),
});

const genSchema = Joi.object({
  dossier_id: Joi.string().uuid().required(),
  ton:        Joi.string().valid('professionnel', 'constructif', 'encourageant').default('professionnel'),
  langue:     Joi.string().valid('fr', 'ar', 'en').default('fr'),
});

router.get('/:guideId/evaluations',         authenticate, ctrl.liste);
router.post('/:guideId/evaluations',        authenticate, autoriser('TD', 'admin'), validate(evalSchema), ctrl.creer);
router.post('/:guideId/evaluations/generer',authenticate, autoriser('TD', 'admin'), validate(genSchema),  ctrl.generer);

module.exports = router;
