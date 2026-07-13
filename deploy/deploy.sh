#!/usr/bin/env bash
# Deploy/update na VPS-u — pokreni iz korijena repoa: bash deploy/deploy.sh
# Za PRVU instalaciju prati DEPLOY.md; ova skripta je za naredne update-e.
set -euo pipefail

echo "▶ git pull"
git pull --ff-only

echo "▶ npm ci (workspaces)"
npm ci

echo "▶ build (shared → backend → frontend)"
npm run build

echo "▶ prisma migrate deploy"
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..

echo "▶ pm2 reload"
pm2 reload ecosystem.config.js --update-env
pm2 save

echo "✅ Deploy gotov."
