const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser, verifierDossier } = require('../middleware/auth');
const ctrl = require('../controllers/dossiersController');

const createSchema = Joi.object({
  nom_groupe:      Joi.string().max(200).required(),
  date_debut:      Joi.date().iso().required(),
  date_fin:        Joi.date().iso().min(Joi.ref('date_debut')).required(),
  guide_id:        Joi.string().uuid().allow(null),
  nb_participants: Joi.number().integer().min(1).default(1),
  notes_internes:  Joi.string().max(2000).allow('', null),
});

const updateSchema = Joi.object({
  nom_groupe:      Joi.string().max(200),
  date_debut:      Joi.date().iso(),
  date_fin:        Joi.date().iso(),
  guide_id:        Joi.string().uuid().allow(null),
  nb_participants: Joi.number().integer().min(1),
  notes_internes:  Joi.string().max(2000).allow('', null),
  statut:          Joi.string().valid('brouillon', 'confirme', 'pret', 'en_cours', 'termine'),
});

router.get('/',      authenticate, autoriser('TD', 'comptable', 'admin'), ctrl.liste);
router.post('/',     authenticate, autoriser('TD', 'admin'), validate(createSchema), ctrl.creer);
router.get('/:id',   authenticate, verifierDossier, ctrl.detail);
router.patch('/:id', authenticate, autoriser('TD', 'admin'), verifierDossier, validate(updateSchema), ctrl.modifier);
router.delete('/:id',authenticate, autoriser('admin'), ctrl.archiver);

module.exports = router;
