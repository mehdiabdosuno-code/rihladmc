const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/prestatairesController');

const schema = Joi.object({
  nom:               Joi.string().max(200).required(),
  type:              Joi.string().valid('hotel','restaurant','activite','transport','autre').required(),
  ville:             Joi.string().max(100).allow(null),
  adresse:           Joi.string().allow('', null),
  telephone:         Joi.string().max(20).allow(null),
  telephone_urgence: Joi.string().max(20).allow(null),
  email:             Joi.string().email().allow(null),
  notes:             Joi.string().max(1000).allow('', null),
});

router.get('/',    authenticate, ctrl.liste);
router.post('/',   authenticate, autoriser('TD','admin'), validate(schema), ctrl.creer);
router.get('/:id', authenticate, ctrl.detail);
router.patch('/:id',authenticate, autoriser('TD','admin'), validate(schema.fork(Object.keys(schema.describe().keys), f => f.optional())), ctrl.modifier);
router.delete('/:id',authenticate, autoriser('admin'), ctrl.supprimer);

module.exports = router;
