const cron = require('node-cron');
const db = require('./config/db');
const notificationService = require('./services/notificationService');
const logger = require('./config/logger');

function startCronJobs() {
  // Chaque matin à 8h00 : notification J-1 checklist
  cron.schedule('0 8 * * *', async () => {
    logger.info('[Cron] Vérification dossiers J-1');
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const dateStr = demain.toISOString().split('T')[0];

    const dossiers = await db('dossiers')
      .where('date_debut', dateStr)
      .whereIn('statut', ['confirme', 'pret'])
      .select('id', 'numero_dossier', 'nom_groupe', 'td_id');

    for (const d of dossiers) {
      await notificationService.envoyerNotification({
        userId: d.td_id,
        type: 'checklist_j1',
        titre: `Check-list J-1 — ${d.numero_dossier}`,
        corps: `Le groupe "${d.nom_groupe}" arrive demain. Validez la check-list.`,
        dossierId: d.id,
        push: true,
        pushPriority: 'normal',
      });
    }
    logger.info(`[Cron] ${dossiers.length} notifications J-1 envoyées`);
  });

  logger.info('[Cron] Jobs démarrés');
}

module.exports = { startCronJobs };
