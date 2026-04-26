const db = require('../config/db');
const logger = require('../config/logger');

let firebaseAdmin = null;

function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdmin = admin;
    return admin;
  } catch (e) {
    logger.warn('[Firebase] Initialisation échouée:', e.message);
    return null;
  }
}

async function envoyerNotification({ userId, type, titre, corps, dossierId, rapportId, push = false, pushPriority = 'normal', pushSound = 'default' }) {
  // 1. Insérer en BDD
  const [notif] = await db('notifications').insert({
    user_id: userId,
    type,
    titre,
    corps,
    dossier_id: dossierId || null,
    rapport_id: rapportId || null,
  }).returning('*');

  // 2. Push Firebase si demandé
  if (push) {
    const user = await db('utilisateurs').where('id', userId).select('fcm_token').first();
    if (user?.fcm_token) {
      await envoyerPush(user.fcm_token, titre, corps, { type, dossier_id: dossierId, notif_id: notif.id }, pushPriority, pushSound);
      await db('notifications').where('id', notif.id).update({ push_envoye: true, push_envoye_at: new Date() });
    }
  }

  return notif;
}

async function envoyerPush(fcmToken, titre, corps, data, priority, sound) {
  const admin = getFirebase();
  if (!admin) return logger.warn('[Push] Firebase non configuré, push ignoré');

  const message = {
    token: fcmToken,
    notification: { title: titre, body: corps },
    data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v || '')])),
    android: {
      priority: priority === 'high' ? 'high' : 'normal',
      notification: { sound, channelId: priority === 'high' ? 'alertes' : 'general' },
    },
    apns: {
      payload: { aps: { sound: sound === 'alerte' ? 'alerte.caf' : 'default', badge: 1 } },
    },
  };

  try {
    await admin.messaging().send(message);
    logger.debug(`[Push] Envoyé à ${fcmToken.slice(0, 12)}...`);
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      // Token périmé — nettoyer
      await db('utilisateurs').where('fcm_token', fcmToken).update({ fcm_token: null });
    }
    logger.error('[Push] Erreur Firebase:', err.message);
  }
}

module.exports = { envoyerNotification };
