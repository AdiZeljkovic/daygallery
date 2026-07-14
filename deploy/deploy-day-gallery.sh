#!/usr/bin/env bash
# ============================================================
# Update produkcije na day-gallery.com (NAKON prve instalacije).
# Pokreni iz korijena repoa:
#   cd /home/adizeljkovic/web/day-gallery.com/app && bash deploy/deploy-day-gallery.sh
#
# Prva instalacija → prati DEPLOY-DAY-GALLERY.md
# ============================================================
set -euo pipefail

echo "▶ git pull"
git pull --ff-only

echo "▶ npm ci (workspaces)"
npm ci

echo "▶ prisma: generate + db push (shema → baza, aditivno)"
cd backend
npx prisma generate
npx prisma db push
cd ..

echo "▶ build: shared → backend → frontend"
npm run build --workspace shared
npm run build --workspace backend
npm run build --workspace frontend

echo "▶ pm2 reload"
pm2 reload ecosystem.day-gallery.config.js --update-env
pm2 save

echo "▶ health check"
sleep 2
curl -fsS http://127.0.0.1:4712/api/health && echo ""

echo "✅ Deploy gotov."
