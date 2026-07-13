# Deploy na Hetzner VPS + HestiaCP

Poddomena: **daygallery.adizeljkovic.com**
Putanja: `/home/adizeljkovic/web/daygallery.adizeljkovic.com/`

Frontend (Next.js) i backend (Express + Socket.io) su na istoj domeni; nginx rutira
`/api`, `/socket.io`, `/uploads` na backend (:4000), sve ostalo na Next (:3005).

---

## 0. Preduslovi na serveru (jednom)

```bash
# Node 20+ (preko nvm — ne dira sistemski node)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm alias default 20

# PM2 (process manager)
npm install -g pm2

# provjera
node -v   # v20+
pm2 -v
```

U **HestiaCP panelu**:
1. **Web → Add Domain** → `daygallery.adizeljkovic.com` (ako već nije).
2. **Databases → Add Database** → zapamti ime baze, korisnika i lozinku (npr. `adizeljkovic_dg`).
3. SSL uključi kasnije (korak 6).

---

## 1. Kod na server

```bash
cd /home/adizeljkovic/web/daygallery.adizeljkovic.com/
# public_html je Hestijin default docroot; kod ide u zaseban folder 'app'
git clone https://github.com/AdiZeljkovic/daygallery.git app
cd app
```

## 2. Konfiguracija (.env)

```bash
# Backend
cp backend/.env.production.example backend/.env
nano backend/.env      # popuni DATABASE_URL, JWT_SECRET, UPLOADS_DIR, FRONTEND_ORIGIN

# JWT tajni ključ:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Frontend (NEXT_PUBLIC_* se peče u build!)
cp frontend/.env.production.example frontend/.env.production
```

Bitno u `backend/.env`:
- `DATABASE_URL` = konekcija na Hestia bazu
- `FRONTEND_ORIGIN="https://daygallery.adizeljkovic.com"`
- `UPLOADS_DIR="/home/adizeljkovic/web/daygallery.adizeljkovic.com/app/uploads"`
- `NODE_ENV="production"`

## 3. Prebaci bazu i slike (sa lokalne mašine)

Backup baze i slike NISU u gitu (prevelike/tajne). Prebaci ih preko `scp`
sa svoje Windows mašine (iz `platform/backups/`):

```powershell
# sa lokalne mašine (PowerShell), zamijeni ime dump fajla stvarnim:
scp backups/daygallery_full_XXXX.sql   adizeljkovic@SERVER_IP:/home/adizeljkovic/
scp backups/uploads_snapshot.tar.gz    adizeljkovic@SERVER_IP:/home/adizeljkovic/
```

Na serveru:

```bash
cd /home/adizeljkovic/web/daygallery.adizeljkovic.com/app

# Uvezi bazu (full dump: schema + podaci + migracijska historija)
mysql -u DB_USER -p DB_NAME < /home/adizeljkovic/daygallery_full_XXXX.sql

# Raspakuj slike u app/uploads
tar -xzf /home/adizeljkovic/uploads_snapshot.tar.gz -C .
ls uploads/venues   # provjera
```

> Puni dump već sadrži i `_prisma_migrations`, pa je baza odmah na najnovijoj
> migraciji — nije potrebno `prisma migrate deploy` pri prvoj instalaciji.

## 4. Instalacija i build

```bash
npm ci
npx --workspace backend prisma generate
npm run build          # shared → backend (tsc) → frontend (next build)
```

> `next build` zna biti memorijski zahtjevan. Ako VPS ima <2GB RAM, dodaj swap
> ili build pokreni sa `NODE_OPTIONS=--max-old-space-size=1024`.

## 5. Pokretanje (PM2)

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # ispiši i pokreni komandu koju predloži (systemd)
pm2 status             # daygallery-api (online) + daygallery-web (online)
pm2 logs               # provjera grešaka
```

Brzi lokalni test da procesi rade prije nginx-a:
```bash
curl -s localhost:4000/api/health     # {"ok":true}
curl -s -o /dev/null -w "%{http_code}" localhost:3005/   # 200
```

## 6. Nginx (Hestia proxy template) + SSL

```bash
# Instaliraj proxy template
sudo cp deploy/hestia/daygallery.tpl  /usr/local/hestia/data/templates/web/nginx/
sudo cp deploy/hestia/daygallery.stpl /usr/local/hestia/data/templates/web/nginx/

# Dodijeli domeni proxy template
sudo /usr/local/hestia/bin/v-change-web-domain-proxy-tpl adizeljkovic daygallery.adizeljkovic.com daygallery

# Uključi SSL (Let's Encrypt)
sudo /usr/local/hestia/bin/v-add-letsencrypt-domain adizeljkovic daygallery.adizeljkovic.com

# Restart nginx
sudo systemctl reload nginx
```

> Ako `v-change-web-domain-proxy-tpl` javi da template ne postoji, provjeri da su
> se oba fajla (`.tpl` i `.stpl`) iskopirala i da je ime bez ekstenzije `daygallery`.

## 7. Provjera uživo

- `https://daygallery.adizeljkovic.com` → marketing stranica
- `https://daygallery.adizeljkovic.com/admin/login` → admin panel
- **Stari QR test:** `https://daygallery.adizeljkovic.com/menu?id=<stari-menu-id>`
  → mora preusmjeriti na `/m/<slug>` i prikazati meni sa slikama.
- Prijava kao superadmin (iz baze: `admin@specialday.ba` — ODMAH promijeni lozinku).

---

## Naredni update-i (kad promijeniš kod)

```bash
cd /home/adizeljkovic/web/daygallery.adizeljkovic.com/app
bash deploy/deploy.sh      # git pull → npm ci → build → migrate → pm2 reload
```

## Backup u produkciji (cron)

```bash
# dnevni backup baze + uploads u 03:00
crontab -e
0 3 * * * mysqldump -u DB_USER -pDB_PASS DB_NAME > /home/adizeljkovic/backups/db_$(date +\%F).sql
30 3 * * * tar -czf /home/adizeljkovic/backups/uploads_$(date +\%F).tar.gz -C /home/adizeljkovic/web/daygallery.adizeljkovic.com/app uploads
```

## Nalozi restorana (Šefovi)

Kredencijali kreirani pri migraciji su u `backups/kreirani-nalozi.json` (lokalno, van gita).
Emaili su placeholderi (`boss@`, `dzenita@` ...) — svaki Šef ih mijenja u panelu.
