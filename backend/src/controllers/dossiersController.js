const db = require('../config/db');

exports.liste = async (req, res, next) => {
  try {
    const { statut, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('dossiers as d')
      .join('utilisateurs as td', 'd.td_id', 'td.id')
      .leftJoin('utilisateurs as g', 'd.guide_id', 'g.id')
      .select(
        'd.*',
        db.raw("CONCAT(td.prenom, ' ', td.nom) as td_nom"),
        'td.telephone as td_telephone',
        db.raw("CONCAT(g.prenom, ' ', g.nom) as guide_nom"),
        'g.telephone as guide_telephone',
        db.raw("(d.date_fin - CURRENT_DATE) as jours_restants")
      )
      .whereNot('d.statut', 'archive');

    // Filtre par rôle
    if (req.user.role === 'TD') query = query.where('d.td_id', req.user.id);

    if (statut) query = query.where('d.statut', statut);
    if (search) query = query.whereILike('d.nom_groupe', `%${search}%`);

    const [{ count }] = await query.clone().count('d.id as count');
    const dossiers = await query.orderBy('d.date_debut', 'desc').limit(limit).offset(offset);

    res.json({
      data: dossiers,
      pagination: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) },
    });
  } catch (err) { next(err); }
};

exports.creer = async (req, res, next) => {
  try {
    const [dossier] = await db('dossiers').insert({
      ...req.body,
      td_id: req.user.id,
      numero_dossier: '',
    }).returning('*');

    // Créer checklist vide
    await db('checklist_24h').insert({ dossier_id: dossier.id });

    res.locals.entiteId = dossier.id;
    res.locals.auditData = dossier;
    res.status(201).json(dossier);
  } catch (err) { next(err); }
};

exports.detail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dossier = await db('dossiers as d')
      .join('utilisateurs as td', 'd.td_id', 'td.id')
      .leftJoin('utilisateurs as g', 'd.guide_id', 'g.id')
      .where('d.id', id)
      .select(
        'd.*',
        db.raw("json_build_object('id', td.id, 'nom', CONCAT(td.prenom,' ',td.nom), 'email', td.email, 'telephone', td.telephone) as td"),
        db.raw("CASE WHEN g.id IS NOT NULL THEN json_build_object('id', g.id, 'nom', CONCAT(g.prenom,' ',g.nom), 'email', g.email, 'telephone', g.telephone) ELSE NULL END as guide")
      )
      .first();

    if (!dossier) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

    const checklist = await db('checklist_24h').where('dossier_id', id).first();
    const rapports  = await db('rapports_journaliers').where('dossier_id', id).orderBy('jour').select('jour', 'date_rapport', 'alerte_envoyee', 'categories_alertes');
    const paiement  = await db('paiements_guides').where('dossier_id', id).orderBy('created_at', 'desc').first();

    res.json({ ...dossier, checklist, rapports, paiement });
  } catch (err) { next(err); }
};

exports.modifier = async (req, res, next) => {
  try {
    const [updated] = await db('dossiers')
      .where('id', req.params.id)
      .update(req.body)
      .returning('*');
    res.json(updated);
  } catch (err) { next(err); }
};

exports.archiver = async (req, res, next) => {
  try {
    await db('dossiers').where('id', req.params.id).update({ statut: 'archive' });
    res.sendStatus(204);
  } catch (err) { next(err); }
};
