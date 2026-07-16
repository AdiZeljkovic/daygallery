import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env, allowedOrigins } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { venuesRouter } from './routes/venues.js';
import { menusRouter } from './routes/menus.js';
import { ordersRouter } from './routes/orders.js';
import { publicRouter } from './routes/public.js';
import { eventsRouter } from './routes/events.js';
import { invitesRouter } from './routes/invites.js';
import { tablesRouter } from './routes/tables.js';
import { staffRouter } from './routes/staff.js';
import { inventoryRouter } from './routes/inventory.js';
import { tasksRouter } from './routes/tasks.js';
import { reviewsRouter } from './routes/reviews.js';
import { groupsRouter } from './routes/groups.js';

export function createApp() {
  const app = express();

  // iza Hestia/nginx proxyja u produkciji — potreban za tačan req.ip (rate limiting)
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // gzip — veliki JSON odgovori (meni sa prevodima) padnu ~10x
  app.use(compression());

  // FRONTEND_ORIGIN može biti lista (zarezom) — apex + www; allowedOrigins iz env.ts
  app.use(
    cors({
      origin: (origin, cb) => {
        // bez Origin headera (server-to-server, curl, health) → propusti
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS: nedozvoljen origin'));
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(globalLimiter);

  /**
   * Health check — pinguje bazu. Vraća 503 ako je DB nedostupna, da monitoring
   * (i Hestia/Cloudflare) vidi pravi problem umjesto lažnog "OK".
   */
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up', uptime: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // public PRIJE menusRouter/ordersRouter — oni imaju router-level requireAuth na /api
  app.use('/api/public', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api', tablesRouter);
  app.use('/api', staffRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', tasksRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api', menusRouter);
  app.use('/api', ordersRouter);

  // statičke slike — dotfiles deny, immutable cache (imena su nanoid, nikad se ne mijenjaju)
  app.use(
    '/uploads',
    express.static(env.uploadsDir, { dotfiles: 'deny', immutable: true, maxAge: '365d' })
  );

  app.use((_req, res) => res.status(404).json({ error: 'Ruta ne postoji' }));
  app.use(errorHandler);

  return app;
}
