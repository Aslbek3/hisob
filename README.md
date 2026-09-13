# Hisob

Qurilish firmasi uchun kirim-chiqim hisob tizimi: ob'ektlar bo'yicha xarajat, kassa qoldiqlari,
Excel kabi tez kiritish jadvali, oy yopish, audit jurnali, Excel eksport.

**Stack:** Next.js 16 · TypeScript · PostgreSQL · Prisma · Tailwind

## Ishga tushirish (lokal)

```bash
npm install
cp .env.example .env                      # DATABASE_URL ni to'ldiring
npx prisma migrate deploy
SEED_PASSWORD="<kamida 8 belgi>" npm run db:seed
npm run dev                               # http://localhost:3100
```

PostgreSQL o'rnatilmagan bo'lsa: `npx prisma dev -n hisob-sayt --detach` — lokal Postgres
(ulanish satriga `pgbouncer=true` qo'shing).

## Production

```bash
npm ci && npx prisma migrate deploy && npm run build
USER_LOGIN=direktor USER_NAME="Direktor" USER_PASSWORD="<kuchli parol>" npm run create-user
pm2 start ecosystem.config.js
```

Kunlik zaxira: `scripts/backup.sh` (cron, 03:00).

Loyiha qoidalari va arxitektura: [CLAUDE.md](CLAUDE.md).
