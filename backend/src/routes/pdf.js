const router = require('express').Router();
const { authenticate, autoriser, verifierDossier } = require('../middleware/auth');
const ctrl = require('../controllers/pdfController');

router.post('/:id/pdf/generer',    authenticate, autoriser('TD','admin'), verifierDossier, ctrl.generer);
router.get('/:id/pdf/statut',      authenticate, verifierDossier, ctrl.statut);
router.get('/:id/pdf/telecharger', authenticate, verifierDossier, ctrl.telecharger);

module.exports = router;
