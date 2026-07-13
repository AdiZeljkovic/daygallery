/**
 * PM2 konfiguracija za Hetzner VPS (HestiaCP, bez Dockera).
 * Pokreće dva procesa: API (Express + Socket.io) i WEB (Next.js).
 *
 * Pokretanje na serveru (iz korijena repoa):
 *   pm2 start ecosystem.config.js
 *   pm2 save            # zapamti procese za restart nakon reboota
 *   pm2 startup         # (jednom) generiše systemd servis
 *
 * Nginx proxira:  /api /uploads /socket.io → :4000,  sve ostalo → :3005
 */
module.exports = {
  apps: [
    {
      name: 'daygallery-api',
      cwd: './backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        // interni port — mora biti slobodan na serveru; postavljen i u backend/.env (API_PORT)
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      autorestart: true,
      // .env se učitava iz backend/.env (dotenv u src/index.ts)
    },
    {
      name: 'daygallery-web',
      cwd: './frontend',
      // pokreće `npm run start` (→ next start); npm sam nađe hoistovani next
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3711', // interni port Next servera (nginx proxira ovamo)
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      autorestart: true,
    },
  ],
};
