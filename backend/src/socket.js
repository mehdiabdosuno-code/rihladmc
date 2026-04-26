const jwt = require('jsonwebtoken');
const logger = require('./config/logger');

function setupSocketHandlers(io, redis) {
  // Auth WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('UNAUTHORIZED'));
    try {
      socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role, nom, prenom } = socket.data.user;
    logger.info(`[WS] ${prenom} ${nom} (${role}) connecté — socket ${socket.id}`);

    // Rejoindre room personnelle
    socket.join(`user:${userId}`);
    socket.emit('connecte', { user_id: userId, role });

    // Rejoindre room d'un dossier
    socket.on('rejoindre_dossier', ({ dossier_id }) => {
      socket.join(`dossier:${dossier_id}`);
      logger.debug(`[WS] ${userId} rejoint dossier:${dossier_id}`);
    });

    socket.on('quitter_dossier', ({ dossier_id }) => {
      socket.leave(`dossier:${dossier_id}`);
    });

    // Chat : envoyer message
    socket.on('envoyer_message', async (data) => {
      const db = require('./config/db');
      const { dossier_id, destinataire_id, contenu } = data;
      if (!contenu?.trim()) return;

      const [msg] = await db('messages').insert({
        dossier_id,
        expediteur_id: userId,
        destinataire_id,
        contenu: contenu.trim(),
      }).returning('*');

      const payload = {
        id: msg.id,
        dossier_id,
        expediteur: { id: userId, nom: `${prenom} ${nom}`, role },
        contenu: msg.contenu,
        created_at: msg.created_at,
      };

      io.to(`dossier:${dossier_id}`).emit('nouveau_message', payload);
      io.to(`user:${destinataire_id}`).emit('nouveau_message', payload);
    });

    // Indicateur de frappe
    socket.on('typing', ({ dossier_id, typing }) => {
      socket.to(`dossier:${dossier_id}`).emit('typing', {
        dossier_id, user_id: userId, nom: `${prenom} ${nom}`, typing,
      });
    });

    // Marquer message lu
    socket.on('message_lu', async ({ message_id }) => {
      const db = require('./config/db');
      await db('messages').where('id', message_id).update({ lu: true, lu_at: new Date() });
      socket.broadcast.to(`user:${userId}`).emit('message_lu', { message_id, lu_par: userId });
    });

    socket.on('disconnect', () => {
      logger.debug(`[WS] ${userId} déconnecté`);
    });
  });

  // Écouter Pub/Sub Redis pour diffuser aux clients
  const subRedis = redis.duplicate();
  subRedis.subscribe('rapport', 'alerte', 'paiement', 'pdf', (err) => {
    if (err) logger.error('[Redis PubSub] subscribe error:', err.message);
  });

  subRedis.on('message', (channel, message) => {
    const data = JSON.parse(message);
    switch (channel) {
      case 'rapport':
        io.to(`dossier:${data.dossier_id}`).emit('nouveau_rapport', data);
        break;
      case 'alerte':
        io.to(`user:${data.td_id}`).emit('alerte_critique', data);
        break;
      case 'paiement':
        io.to(`user:${data.guide_id}`).emit('paiement_effectue', data);
        io.to(`user:${data.td_id}`).emit('paiement_effectue', data);
        break;
      case 'pdf':
        io.to(`user:${data.td_id}`).emit('pdf_pret', data);
        break;
    }
  });
}

module.exports = { setupSocketHandlers };
