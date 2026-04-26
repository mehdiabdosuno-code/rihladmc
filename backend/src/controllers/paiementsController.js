const db = require('../config/db');
const notificationService = require('../services/notificationService');

exports.liste = async (req, res, next) => {
  try {
    const { guide_id, dossier_id, statut, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('paiements_guides as p')
      .join('dossiers as d', 'p.dossier_id', 'd.id')
      .join('utilisateurs as g', 'p.guide_id', 'g.id')
      .join('utilisateurs as c', 'p.effectue_par', 'c.id')
      .select(
        'p.*',
        'd.numero_dossier', 'd.nom_groupe',
        db.raw("CONCAT(g.prenom,' ',g.nom) as guide_nom"),
        db.raw("CONCAT(c.prenom,' ',c.nom) as comptable_nom")
      );

    // Guide ne voit que ses propres paiements
    if (req.user.role === 'guide') query = query.where('p.guide_id', req.user.id);

    if (guide_id)  query = query.where('p.guide_id', guide_id);
    if (dossier_id)query = query.where('p.dossier_id', dossier_id);
    if (statut)    query = query.where('p.statut', statut);

    const [{ count }] = await query.clone().count('p.id as count');
    const data = await query.orderBy('p.created_at', 'desc').limit(limit).offset(offset);

    res.json({ data, pagination: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

exports.creer = async (req, res, next) => {
  try {
    const [paiement] = await db('paiements_guides').insert({
      ...req.body,
      effectue_par: req.user.id,
      statut: 'effectue',
    }).returning('*');

    res.locals.entiteId = paiement.id;
    res.locals.auditData = { montant: paiement.montant, guide_id: paiement.guide_id, dossier_id: paiement.dossier_id };

    // Récupérer infos dossier pour notification
    const dossier = await db('dossiers').where('id', paiement.dossier_id).first();

    // Notifier guide
    await notificationService.envoyerNotification({
      userId: paiement.guide_id,
      type: 'paiement',
      titre: `${paiement.montant} ${paiement.devise} versés`,
      corps: `Dossier ${dossier.numero_dossier} — ${dossier.nom_groupe}`,
      dossierId: paiement.dossier_id,
      push: true,
      pushPriority: 'normal',
    });

    // Notifier TD
    await notificationService.envoyerNotification({
      userId: dossier.td_id,
      type: 'paiement',
      titre: `Paiement guide effectué — ${dossier.numero_dossier}`,
      corps: `${paiement.montant} ${paiement.devise} — Réf: ${paiement.reference_bancaire || 'N/A'}`,
      dossierId: paiement.dossier_id,
      push: false,
    });

    // WebSocket
    req.redis.publish('paiement', JSON.stringify({
      id: paiement.id,
      guide_id: paiement.guide_id,
      td_id: dossier.td_id,
      montant: paiement.montant,
      devise: paiement.devise,
      reference: paiement.reference_bancaire,
      dossier: dossier.numero_dossier,
    }));

    res.status(201).json(paiement);
  } catch (err) { next(err); }
};

exports.detail = async (req, res, next) => {
  try {
    const p = await db('paiements_guides as p')
      .join('dossiers as d', 'p.dossier_id', 'd.id')
      .join('utilisateurs as g', 'p.guide_id', 'g.id')
      .where('p.id', req.params.id)
      .select('p.*', 'd.numero_dossier', 'd.nom_groupe', db.raw("CONCAT(g.prenom,' ',g.nom) as guide_nom"))
      .first();
    if (!p) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    // Guide ne peut voir que ses paiements
    if (req.user.role === 'guide' && p.guide_id !== req.user.id)
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    res.json(p);
  } catch (err) { next(err); }
};

exports.confirmer = async (req, res, next) => {
  try {
    const [p] = await db('paiements_guides')
      .where('id', req.params.id)
      .update({ statut: 'confirme', confirme_at: new Date(), note: req.body.note })
      .returning('*');
    res.json(p);
  } catch (err) { next(err); }
};
