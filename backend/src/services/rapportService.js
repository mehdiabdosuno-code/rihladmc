const db = require('../config/db');
const notificationService = require('./notificationService');
const logger = require('../config/logger');

const CATEGORIES = ['petit_dejeuner', 'dejeuner', 'diner', 'hotel', 'transport', 'accueil_hote'];
const LABELS = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  hotel: 'Hôtel',
  transport: 'Transport',
  accueil_hote: 'Accueil / Hôte',
};

async function soumettre(dossierId, guideId, data, io, redis) {
  // Identifier catégories avec évaluation 'mauvais'
  const categoriesAlertes = CATEGORIES.filter((cat) => data[cat] === 'mauvais');
  const alerteDeclenchee  = categoriesAlertes.length > 0;

  const [rapport] = await db('rapports_journaliers').insert({
    dossier_id: dossierId,
    guide_id: guideId,
    ...data,
    categories_alertes: categoriesAlertes,
    alerte_envoyee: false,
  }).returning('*');

  // Diffuser rapport via Redis Pub/Sub → Socket.io
  redis.publish('rapport', JSON.stringify({ dossier_id: dossierId, rapport }));

  // Déclencher alerte de façon asynchrone (ne bloque pas la réponse)
  if (alerteDeclenchee) {
    setImmediate(() => declencherAlerte(rapport, categoriesAlertes, redis).catch(
      (e) => logger.error('[RapportService] Erreur alerte:', e.message)
    ));
  }

  return { rapport, alerteDeclenchee, categoriesAlertes };
}

async function declencherAlerte(rapport, categories, redis) {
  const dossier = await db('dossiers as d')
    .join('utilisateurs as g', 'd.guide_id', 'g.id')
    .where('d.id', rapport.dossier_id)
    .select('d.id', 'd.numero_dossier', 'd.nom_groupe', 'd.td_id', 'g.telephone as guide_telephone')
    .first();

  if (!dossier) return;

  const labelsStr  = categories.map((c) => LABELS[c]).join(', ');
  const titre      = `⚠️ ALERTE — ${dossier.numero_dossier} Jour ${rapport.jour}`;
  const corps      = `Problème : ${labelsStr}. Groupe : ${dossier.nom_groupe}`;

  // 1. Notification BDD + Push FCM
  await notificationService.envoyerNotification({
    userId: dossier.td_id,
    type: 'alerte_rapport',
    titre,
    corps,
    dossierId: rapport.dossier_id,
    rapportId: rapport.id,
    push: true,
    pushPriority: 'high',
    pushSound: 'alerte',
  });

  // 2. Événement WebSocket alerte_critique
  redis.publish('alerte', JSON.stringify({
    td_id: dossier.td_id,
    dossier_id: rapport.dossier_id,
    numero_dossier: dossier.numero_dossier,
    nom_groupe: dossier.nom_groupe,
    jour: rapport.jour,
    categories,
    guide_telephone: dossier.guide_telephone,
    timestamp: new Date().toISOString(),
  }));

  // 3. Marquer alerte envoyée
  await db('rapports_journaliers').where('id', rapport.id).update({ alerte_envoyee: true });

  logger.info(`[Alerte] Dossier ${dossier.numero_dossier} Jour ${rapport.jour} — ${labelsStr}`);
}

module.exports = { soumettre };
