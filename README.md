# Special Day / Day Gallery

Premium digitalna platforma za evente i ugostiteljstvo: **digitalni meni sa naručivanjem**,
event galerije, digitalne pozivnice i raspored sjedenja.

## Stack

- **Frontend:** Next.js 15 (App Router), Tailwind, framer-motion, next-intl (bs/en)
- **Backend:** Node.js + Express + Socket.io, Prisma
- **Baza:** MySQL 8
- **Slike:** lokalni disk, obrada preko sharp (WebP + thumbnail)
- **Deploy:** Hetzner VPS + HestiaCP + PM2 (bez Dockera) — vidi [DEPLOY.md](./DEPLOY.md)

## Struktura (npm workspaces)

```
shared/     zod sheme + tipovi (dijele backend i frontend)
backend/    Express API, Prisma, Socket.io, servisi, skripte
frontend/   Next.js app (javne stranice + admin panel)
deploy/     PM2 ecosystem, Hestia nginx template, deploy skripta
```

## Lokalni razvoj

```bash
# preduslov: MySQL lokalno + baza 'specialday'
npm install
cp backend/.env.example backend/.env        # popuni DATABASE_URL, JWT_SECRET
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
# u dva terminala:
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:3005
```

## Role u admin panelu

- **Superadmin** — sve; moderacija galerija; korisnici.
- **Klijent / Šef** — meni, inventar, zadaci/smjene, osoblje svog objekta.
- **Osoblje** (konobar / kuhinja) — narudžbe, svoje zadatke i smjene.

## Migracija sa starog day-gallery sistema

`backend/scripts/import-daygallery.ts` povlači menije/slike sa starog sistema i čuva
stari ID (`legacyId`) da odštampani QR kodovi (`/menu?id=<id>`) nastave raditi.
