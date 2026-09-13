# Serverga o'rnatish (VPS)

Testify bilan bir xil tartib: PM2, nvm orqali Node 22, lokal PostgreSQL, Nginx + certbot.
Parollar faqat serverdagi `.env` da — bu faylga yoki repo'ga yozilmaydi.

## 1. Baza

```bash
sudo -u postgres psql <<'SQL'
CREATE USER hisob WITH PASSWORD '<kuchli-parol>';
CREATE DATABASE hisob OWNER hisob;
SQL
```

## 2. Kod

```bash
cd /root/vps/projects/web
git clone https://github.com/Aslbek3/hisob.git hisob && cd hisob
nvm use 22
cp .env.example .env         # DATABASE_URL="postgresql://hisob:<parol>@127.0.0.1:5432/hisob"
                             # SHADOW_DATABASE_URL qatorini O'CHIRING (production'da kerak emas)
npm ci
npx prisma migrate deploy
npm run build
USER_LOGIN=hisobchi USER_NAME="Исм Фамилия" USER_PASSWORD="<kamida 12 belgi>" USER_ROLE=ACCOUNTANT npm run create-user
USER_LOGIN=direktor USER_NAME="Директор" USER_PASSWORD="<kamida 12 belgi>" npm run create-user
pm2 start ecosystem.config.js --interpreter $(which node)
pm2 save
```

Port: `127.0.0.1:3215` (3000, 3210–3214 boshqa loyihalarda band). `-H 127.0.0.1` majburiy —
aks holda port Nginx'ni chetlab tashqariga ochiladi.

Keyin tizimga kirib: Рўйхатлар → Фирмалар, Кассалар (boshlang'ich qoldiq bilan), Номлар,
Етказиб берувчилар, Пул берувчилар; Объектлар → objektlarni ochish.

## 3. Nginx

```nginx
server {
    server_name <domen>;
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3215;
        proxy_set_header Host $host;          # Origin tekshiruvi uchun SHART (src/lib/api.ts)
        proxy_set_header X-Real-IP $remote_addr;  # login cheklovi shu IP bo'yicha (src/lib/rateLimit.ts)
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`sudo certbot --nginx -d <domen>` — HTTPS (cookie `secure` production'da faqat HTTPS'da ishlaydi).

## 4. Zaxira

```bash
crontab -e
0 3 * * * /root/vps/projects/web/hisob/scripts/backup.sh >> /root/vps/projects/web/hisob/logs/backup.log 2>&1
```

Birinchi marta qo'lda ishga tushirib tekshiring: `./scripts/backup.sh`.
Zaxira shu serverda turadi — haftada bir marta boshqa joyga (Telegram, boshqa server) nusxa oling.

Tiklash: `pg_restore --clean --no-owner -d "postgresql://hisob:<parol>@127.0.0.1:5432/hisob" backups/hisob_....dump`

## 5. Yangilash

```bash
cd /root/vps/projects/web/hisob
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload hisob
```

Tekshirish: `curl -s http://127.0.0.1:3215/api/health` → `{"ok":true,"db":true}`.
