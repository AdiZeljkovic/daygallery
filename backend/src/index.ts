import 'dotenv/config';
import { createServer } from 'node:http';
import fs from 'node:fs';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';

fs.mkdirSync(env.uploadsDir, { recursive: true });

const app = createApp();
const server = createServer(app);
attachSockets(server);

server.listen(env.API_PORT, () => {
  console.log(`✅ API sluša na http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});
