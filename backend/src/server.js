require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

const db = require('./config/db');
const redis = require('./config/redis');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { setupSocketHandlers } = require('./socket');
const { startCronJobs } = require('./cron');

// Routes
const authRoutes = require('./routes/auth');
const dossiersRoutes = require('./routes/dossiers');
const programmesRoutes = require('./routes/programmes');
const checklistRoutes = require('./routes/checklist');
const rapportsRoutes = require('./routes/rapports');
const paiementsRoutes = require('./routes/paiements');
const evaluationsRoutes = require('./routes/evaluations');
const prestatairesRoutes = require('./routes/prestataires');
const notificationsRoutes = require('./routes/notifications');
const pdfRoutes = require('./routes/pdf');
const messagesRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

// Socket.io avec Redis adapter pour multi-instance
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ['websocket', 'polling'],
});
const pubRedis = redis.duplicate();
const subRedis = redis.duplicate();
io.adapter(createAdapter(pubRedis, subRedis));
setupSocketHandlers(io, redis);

// Middleware globaux
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
const globalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use('/api', globalLimit);
app.use('/api/auth/login', authLimit);

// Rendre io accessible dans les routes
app.use((req, res, next) => { req.io = io; req.redis = redis; next(); });

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/dossiers', dossiersRoutes);
app.use('/api/dossiers', programmesRoutes);
app.use('/api/dossiers', checklistRoutes);
app.use('/api/dossiers', rapportsRoutes);
app.use('/api/dossiers', pdfRoutes);
app.use('/api/dossiers', messagesRoutes);
app.use('/api/paiements', paiementsRoutes);
app.use('/api/guides', evaluationsRoutes);
app.use('/api/prestataires', prestatairesRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    await db.raw('SELECT 1');
    logger.info(`[DB] PostgreSQL connecté`);
  } catch (e) {
    logger.error('[DB] Connexion échouée:', e.message);
  }
  startCronJobs();
  logger.info(`[Server] RIHLA API démarrée sur le port ${PORT}`);
});

module.exports = { app, server, io };
