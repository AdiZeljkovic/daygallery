/**
 * PM2 konfiguracija za PRODUKCIJU na day-gallery.com (HestiaCP, bez Dockera).
 *
 * Namjerno koristi DRUGE portove i DRUGA imena procesa od starog vhosta
 * (daygallery.adizeljkovic.com → 4711/3711, daygallery-api/web), da oba mogu
 * raditi paralelno dok ne potvrdiš da je novi sajt ispravan.
 *
 * Pokretanje (iz korijena repoa u /home/adizeljkovic/web/day-gallery.com/app):
 *   pm2 start ecosystem.day-gallery.config.js
 *   pm2 save
 *
 * Nginx proxira:  /api /uploads /socket.io → :4712,  sve ostalo → :3712
 */
module.exports = {
  apps: [
    {
      name: 'dg-api',
      cwd: './backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        // API_PORT=4712 se čita iz backend/.env (dotenv)
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      autorestart: true,
    },
    {
      name: 'dg-web',
      cwd: './frontend',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3712', // interni port Next servera (nginx proxira ovamo)
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      autorestart: true,
    },
  ],
};
