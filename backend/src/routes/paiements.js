const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser } = require('../middleware/auth');
const audit = require('../middleware/audit');
const ctrl = require('../controllers/paiementsController');

const createSchema = Joi.object({
  dossier_id:         Joi.string().uuid().required(),
  guide_id:           Joi.string().uuid().required(),
  montant:            Joi.number().positive().required(),
  devise:             Joi.string().valid('MAD', 'EUR', 'USD').default('MAD'),
  reference_bancaire: Joi.string().max(100).allow(null),
  note:               Joi.string().max(500).allow('', null),
});

router.get('/',   authenticate, autoriser('comptable', 'admin'),    ctrl.liste);
router.post('/',  authenticate, autoriser('comptable', 'admin'),    validate(createSchema), audit('PAIEMENT_EFFECTUE', 'paiements_guides'), ctrl.creer);
router.get('/:id',authenticate, autoriser('comptable', 'admin', 'guide'), ctrl.detail);
router.patch('/:id/confirmer', authenticate, autoriser('admin'),   ctrl.confirmer);

module.exports = router;
