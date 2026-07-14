import 'dotenv/config';
import { createServer } from 'node:http';
import fs from 'node:fs';
import { env } from './config/env.js';
import { initSentry, captureError } from './lib/sentry.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';

// Sentry prvo — da uhvati i greške pri pokretanju
initSentry();

fs.mkdirSync(env.uploadsDir, { recursive: true });

const app = createApp();
const server = createServer(app);
attachSockets(server);

server.listen(env.API_PORT, () => {
  console.log(`✅ API sluša na http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

// Zadnja linija odbrane — bez ovoga PM2 restartuje bez traga zašto.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  captureError(reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  captureError(err);
  // PM2 će restartovati; izlazimo čisto da ne ostanemo u nedefinisanom stanju
  setTimeout(() => process.exit(1), 500);
});

/** Graceful shutdown — PM2 restart ne prekida narudžbe u letu. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} — gasim server...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
