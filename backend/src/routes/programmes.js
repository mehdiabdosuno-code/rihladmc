const router = require('express').Router();
const Joi = require('joi');
const validate = require('../middleware/validate');
const { authenticate, autoriser, verifierDossier } = require('../middleware/auth');
const db = require('../config/db');

const programmeSchema = Joi.object({
  jours: Joi.array().items(Joi.object({
    jour:        Joi.number().integer().min(1).required(),
    date:        Joi.date().iso().required(),
    titre:       Joi.string().max(200).allow('', null),
    description: Joi.string().max(2000).allow('', null),
    items: Joi.array().items(Joi.object({
      type:           Joi.string().valid('hotel','restaurant','activite','transport','autre').required(),
      prestataire_id: Joi.string().uuid().allow(null),
      prestataire_nom:Joi.string().max(200).allow('', null),
      heure_debut:    Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
      heure_fin:      Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null),
      lieu:           Joi.string().max(200).allow('', null),
      notes:          Joi.string().max(1000).allow('', null),
    })).default([]),
  })).required(),
});

// GET programme d'un dossier
router.get('/:id/programme', authenticate, verifierDossier, async (req, res, next) => {
  try {
    const jours = await db('programmes').where('dossier_id', req.params.id).orderBy('jour');
    for (const j of jours) {
      j.items = await db('programme_items as pi')
        .leftJoin('prestataires as pr', 'pi.prestataire_id', 'pr.id')
        .where('pi.programme_id', j.id)
        .orderBy('pi.ordre')
        .select('pi.*', 'pr.telephone', 'pr.telephone_urgence');
    }
    res.json(jours);
  } catch (err) { next(err); }
});

// PUT programme complet (remplace tout)
router.put('/:id/programme',
  authenticate, autoriser('TD','admin'), verifierDossier,
  validate(programmeSchema),
  async (req, res, next) => {
    try {
      const dossierId = req.params.id;
      await db.transaction(async (trx) => {
        // Supprimer anciens items + jours
        const anciensProgrammes = await trx('programmes').where('dossier_id', dossierId).select('id');
        if (anciensProgrammes.length) {
          await trx('programme_items').whereIn('programme_id', anciensProgrammes.map(p => p.id)).del();
          await trx('programmes').where('dossier_id', dossierId).del();
        }

        // Insérer nouveaux jours et items
        for (const jour of req.body.jours) {
          const [prog] = await trx('programmes').insert({
            dossier_id: dossierId,
            jour: jour.jour,
            date: jour.date,
            titre: jour.titre || null,
            description: jour.description || null,
          }).returning('*');

          for (let i = 0; i < (jour.items || []).length; i++) {
            const item = jour.items[i];
            await trx('programme_items').insert({
              programme_id: prog.id,
              dossier_id: dossierId,
              type: item.type,
              prestataire_id: item.prestataire_id || null,
              prestataire_nom: item.prestataire_nom || null,
              heure_debut: item.heure_debut || null,
              heure_fin: item.heure_fin || null,
              lieu: item.lieu || null,
              notes: item.notes || null,
              ordre: i,
            });
          }
        }
      });
      res.json({ message: 'Programme sauvegardé' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
