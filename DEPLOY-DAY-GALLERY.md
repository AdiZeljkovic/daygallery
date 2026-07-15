# Prelazak na day-gallery.com (produkcija)

Vodič za prebacivanje platforme na glavnu domenu **day-gallery.com**.

## Ključne odluke (zašto je ovako)

| Stavka | Vrijednost | Zašto |
|---|---|---|
| **Baza** | **ISTA** (`adizeljkovic_daygallery`) | Svi podaci i `legacyId` (stari QR kodovi!) su već tu. **Ne pravi novu bazu.** |
| **Portovi** | API `4712`, WEB `3712` | Stari vhost drži 4711/3711 → oba mogu raditi paralelno, siguran cutover. |
| **PM2** | `dg-api`, `dg-web` | Različita imena od starih (`daygallery-api/web`). |
| **Putanja** | `/home/day-gallery/web/day-gallery.com/app` | Novi Hestia vhost. |

> ⚠️ Stari odštampani QR kodovi (`day-gallery.com/menu?id=<uuid>`) rade **samo** ako koristiš istu bazu — u njoj su `legacyId` vrijednosti koje mapiraju stari ID → novi slug.

---

## 1. Nginx templates (jednom, kao root)

```bash
cd /home/day-gallery/web/day-gallery.com/app   # nakon koraka 2 ako repo još nije tu
cp deploy/hestia/day-gallery.tpl  /usr/local/hestia/data/templates/web/nginx/
cp deploy/hestia/day-gallery.stpl /usr/local/hestia/data/templates/web/nginx/
```

Zatim u **Hestia panelu** → Web → `day-gallery.com` → Edit:
- **Proxy Template:** `day-gallery`
- Sačuvaj.

---

## 2. Kod na server

```bash
cd /home/day-gallery/web/day-gallery.com
git clone https://github.com/AdiZeljkovic/daygallery.git app
cd app
npm ci
```

---

## 3. Slike (uploads) — prekopiraj iz starog vhosta

```bash
mkdir -p /home/day-gallery/web/day-gallery.com/uploads
rsync -a --info=progress2 \
  /home/adizeljkovic/web/daygallery.adizeljkovic.com/app/uploads/ \
  /home/day-gallery/web/day-gallery.com/uploads/
```

> Uradi ovo **neposredno prije cutovera** da ne izgubiš slike uploadane u međuvremenu.

---

## 4. Konfiguracija (.env)

**Backend:**
```bash
cd /home/day-gallery/web/day-gallery.com/app
cp backend/.env.day-gallery.example backend/.env
nano backend/.env
```
Popuni:
- `DATABASE_URL` → **ista** baza + prava lozinka
- `JWT_SECRET` → generiši: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Ostalo je već tačno (`API_PORT=4712`, `FRONTEND_ORIGIN` sa apex+www, `UPLOADS_DIR`).

**Frontend:**
```bash
cp frontend/.env.day-gallery.example frontend/.env.production
```
> ⚠️ `NEXT_PUBLIC_API_URL` se **peče u build**. Mora postojati PRIJE builda; kasnija izmjena bez rebuilda nema efekta.

---

## 5. Build i pokretanje

```bash
cd /home/day-gallery/web/day-gallery.com/app

cd backend && npx prisma generate && npx prisma db push && cd ..

npm run build --workspace shared
npm run build --workspace backend
npm run build --workspace frontend

pm2 start ecosystem.day-gallery.config.js
pm2 save
```

**Provjeri da app radi (prije nego diraš DNS):**
```bash
curl -s http://127.0.0.1:4712/api/health          # → {"ok":true,"db":"up",...}
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3712/   # → 200
pm2 status                                        # dg-api i dg-web = online
```

---

## 6. DNS cutover (Cloudflare)

Ovo je trenutak prelaska — stari sajt (Cloudflare Pages) prestaje raditi.

1. Cloudflare → DNS → `day-gallery.com` (A zapis) → **IP tvog VPS-a**
2. Isto za `www` (A ili CNAME na apex)
3. **Privremeno isključi proxy** (sivi oblak / "DNS only") — inače Let's Encrypt validacija zna pući

---

## 7. SSL (Let's Encrypt)

Hestia panel → `day-gallery.com` → Edit → ✅ **SSL Support** + ✅ **Let's Encrypt** → Save.

Nakon što certifikat prođe:
- Cloudflare → uključi proxy nazad (narandžasti oblak)
- Cloudflare → SSL/TLS mode → **Full (strict)**

---

## 8. Verifikacija (obavezno prije nego pustiš klijente)

```bash
# API živ
curl -s https://day-gallery.com/api/health

# STARI QR KOD → mora preusmjeriti na novi meni
curl -s -o /dev/null -w "%{http_code} → %{redirect_url}\n" \
  "https://day-gallery.com/menu?id=7711a6c7-ac25-4ee9-885b-ed1a16c9b1fc"
# očekivano: 307 → https://day-gallery.com/m/RubD3Neki6YT
```

Ručno u pregledniku:
- [ ] **Skeniraj fizički QR sa stola** (Bistro Boss) → otvara meni
- [ ] Meni: dodaj u korpu → pošalji narudžbu
- [ ] Admin login (`/admin`) → narudžba stigne **live** (socket) + zvuk
- [ ] Slika artikla se prikazuje (`/uploads/...` radi)
- [ ] Pozivnica `/i/<slug>` se otvara
- [ ] `www.day-gallery.com` radi (CORS je podešen za apex+www)

---

## 9. Gašenje starog vhosta (tek nakon što sve gore prođe)

```bash
pm2 stop daygallery-api daygallery-web
pm2 delete daygallery-api daygallery-web
pm2 save
```
Stari vhost `daygallery.adizeljkovic.com` možeš ostaviti kao rezervu ili obrisati u Hestii.

---

## Naredni update-i (nakon prve instalacije)

```bash
cd /home/day-gallery/web/day-gallery.com/app
bash deploy/deploy-day-gallery.sh
```

---

## Ako nešto pukne

| Simptom | Uzrok | Rješenje |
|---|---|---|
| Sajt se učita, ali sve puca / prazan panel | CORS — `FRONTEND_ORIGIN` ne odgovara domeni | Ispravi u `backend/.env` → `pm2 restart dg-api` |
| API pozivi idu na **stari** domen | `NEXT_PUBLIC_API_URL` nije bio prisutan pri buildu | Ispravi `frontend/.env.production` → **rebuild frontend** → `pm2 restart dg-web` |
| Stari QR vodi na početnu | Koristi se **druga baza** (nema `legacyId`) | Prebaci `DATABASE_URL` na `adizeljkovic_daygallery` |
| Slike se ne vide (404) | `UPLOADS_DIR` pogrešan ili slike nisu kopirane | Ponovi korak 3, provjeri putanju u `.env` |
| Narudžbe ne stižu live | Socket.io ne prolazi kroz nginx | Provjeri `location /socket.io/` u templateu, `pm2 logs dg-api` |
| Let's Encrypt ne prolazi | Cloudflare proxy uključen | Privremeno "DNS only", pa ponovi |
