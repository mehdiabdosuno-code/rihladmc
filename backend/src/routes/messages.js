const router = require('express').Router();
const { authenticate, verifierDossier } = require('../middleware/auth');
const db = require('../config/db');

// Historique des messages d'un dossier
router.get('/:id/messages', authenticate, verifierDossier, async (req, res, next) => {
  try {
    const messages = await db('messages as m')
      .join('utilisateurs as u', 'm.expediteur_id', 'u.id')
      .where('m.dossier_id', req.params.id)
      .orderBy('m.created_at', 'asc')
      .limit(200)
      .select(
        'm.id', 'm.contenu', 'm.lu', 'm.created_at',
        db.raw("json_build_object('id', u.id, 'nom', CONCAT(u.prenom,' ',u.nom), 'role', u.role) as expediteur")
      );

    // Marquer comme lus les messages destinés à l'utilisateur courant
    await db('messages')
      .where('dossier_id', req.params.id)
      .where('destinataire_id', req.user.id)
      .where('lu', false)
      .update({ lu: true, lu_at: new Date() });

    res.json(messages);
  } catch (err) { next(err); }
});

module.exports = router;
