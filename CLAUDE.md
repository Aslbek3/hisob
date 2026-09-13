@AGENTS.md

# Hisob — loyiha konteksti

## Nima bu
Qurilish firmasi uchun kirim-chiqim hisob tizimi (Excel o'rnini bosadi).
"Bu ob'ektga qancha ketdi", "kassada qancha qoldi" savollariga aniq javob beradi.
**Asosiy foydalanuvchi — bitta odam (~50 yosh)**: 2–3 ob'ektning xarajatini har kuni yozadi.
Boshliqlar/investorlar oyda 1–2 marta ko'radi; hisobot Excel'ini o'zlari Telegram'ga yuklaydi.
Maqsad: Excel'dan qulayroq, imlo xatosiz, yetkazib beruvchi (beton zavodi) bilan kelishmovchiliksiz.
**Kichik loyiha — oddiylik ustun.** Yangi "arxitektura" qo'shilmaydi: Redis, Docker, navbat,
WebSocket, keshlash, mikroservis kerak emas. Yangi imkoniyat faqat foydalanuvchi so'rasa.

## Interfeys
- **Kirill yozuvida** (firmaning Excel'i kirillda). Kod izohlari lotinda.
- Katta shrift (16px), katta tugmalar; menyuda 4 ta asosiy bo'lim, qolgani "Бошқа" ostida.
- Asosiy ekran — **Кунлик дафтар** (`/kiritish`): ob'ekt tugmasi + sana, pastma-past qatorlar,
  har qatorda "Ким тўлади" (hisob yoki "Қарзга"). Enter yoki qatordan chiqish — o'zi saqlanadi.
- Nom faqat ro'yxatdan; yangi nom qo'shishda o'xshashlari taklif qilinadi (`similarNames`).

## Stack
Next.js 16 (App Router, panel + API bitta joyda), TypeScript, PostgreSQL + Prisma 6,
Tailwind 4, exceljs (eksport), zod (tekshiruv). Keyin: aiogram 3 bot (`bot/`, alohida PM2 jarayon).

## Rollar
- **Direktor** — hammasi + ob'ekt ochish/yopish + oy yopish/qayta ochish + foydalanuvchilar.
- **Buxgalter** — kiritish, tuzatish, hisobot, spravochniklar. Ob'ekt va oy yopa olmaydi.
- **Prorab** — faqat biriktirilgan ob'ekt, faqat chiqim. Kirim va kassa qoldig'ini ko'rmaydi.
  O'z yozuvini 24 soat ichida tuzatadi/bekor qiladi.

Barcha qoidalar — `src/lib/permissions.ts`.

## Arxitektura qoidalari
Qatlamlar bir yo'nalishda: **API route → service → Prisma**.
- Har bir API route `withUser(request, <permissions.ts funksiyasi>, handler)` orqali o'tadi
  (`src/lib/api.ts`). Tekshiruvsiz route yozilmaydi. Ochiq route'lar: faqat login, logout, health.
- Prisma importi faqat `src/services/`, `src/lib/prisma.ts`, `prisma/seed.ts` va `scripts/`da.
- Sahifalar (server komponentlar) servislarni to'g'ridan-to'g'ri chaqiradi; har sahifa boshida
  `requirePageUser()` (layout'da emas — layout va sahifa parallel chiziladi).
- Bir xil kod ikki joyda yozilmaydi: `lib/` (money, dates, excel, normalize) yoki `components/`.

## Pul qoidalari (buzilmasin)
- Pul — **BigInt, so'mda, kasrsiz**. Float yo'q. JSON'da pul MATN ko'rinishida yuradi.
- Miqdor — `Decimal(14,3)`; kodda mingdan bir ulushlarda BigInt (`parseQuantityMilli`).
- **To'langan summa — asosiy fakt.** Odatda = `round(miqdor × narx)` (`computeAmount()`, brauzer va
  serverda bitta funksiya). Farq bo'lsa (chegirma, yaxlitlash) `adjustReason` majburiy — DB CHECK ham.
- Kategoriya qatorda tanlanmaydi — nomdan (`Material.categoryId`) olinadi.
- Kassa qoldig'i hech qayerda saqlanmaydi — har safar yozuvlardan hisoblanadi (`services/balances.ts`).
- Yozuv o'chirilmaydi — `CANCELLED` + sabab. Spravochnik — `isActive=false`. Ob'ekt — `ARCHIVED`.
- Har o'zgarish audit jurnaliga **o'sha tranzaksiyaning ichida** yoziladi (`writeAudit(tx, ...)`).
- Yopilgan oy va kelajak sanasi (Toshkent vaqti) — `assertDateWritable()` (`services/periods.ts`).

## Bazadagi himoya (migratsiya oxirida, qo'lda yozilgan SQL)
CHECK: `amount > 0`, `amount = round(quantity * unit_price)` yoki `adjust_reason` bor, har `kind` uchun majburiy maydonlar,
bekor qilinganda sabab majburiy. TRIGGER: `entries`dan DELETE taqiqlangan; `audit_logs` faqat
qo'shiladi. Barcha FK — `ON DELETE RESTRICT`. **Yangi migratsiya yozganda bularni saqlang.**

## Bosqichlar
1. ✅ Firma, hisob, ob'ekt, kategoriya, nom, kirim/chiqim/o'tkazma, kassa qoldig'i, oy yopish, audit.
2. ✅ Kunlik daftar (kirill), yetkazib beruvchi hisobi (SUPPLIER_PAYMENT / GOODS_RECEIPT, solishtirish
   dalolatnomasi), boshliqlar uchun davriy hisobot (`services/reports.ts`, eski Excel ko'rinishida).
   Ombor (InventoryCount) — hali yo'q, so'ralmagan.
3. Ustalar (Contract; avans = EXPENSE yozuvining o'zi, `contractId` bilan).
4. Telegram bot — bazaga tegmaydi, faqat shu loyiha API'si orqali.
Kengaytirish yo'li `prisma/schema.prisma` oxirida yozilgan — mavjud jadvallar qayta yozilmaydi.

## Lokal ishga tushirish
```
npm install
npx prisma dev -n hisob-v2 --detach       # lokal Postgres (PGlite); kompyuter uxlab qolsa: npx prisma dev start hisob-v2
npx prisma migrate deploy
SEED_PASSWORD="<parol>" npm run db:seed    # direktor, hisobchi, prorab
npm run dev                                # http://localhost:3100
```
`.env` — `.env.example`dan. Lokal PGlite uchun DATABASE_URL'da `pgbouncer=true` shart
("prepared statement already exists" xatosi), production'da kerak emas.
Kam RAM'li kompyuterda `next dev` beqaror bo'lsa — `npm run build && npx next start -p 3100`.

## ⚠️ Repo OCHIQ (public)
Parol, token, `.env`, haqiqiy firma/mijoz ma'lumotlari repo'ga YOZILMAYDI — shu fayl ham.
Seed paroli faqat `SEED_PASSWORD` muhit o'zgaruvchisidan. Production'da birinchi foydalanuvchi:
`USER_LOGIN=... USER_NAME=... USER_PASSWORD=... npm run create-user`.

## Dizayn
`panel-mockup-v2.html` hali berilmagan. Firmaning asl Excel'i (`*.xlsx`) — .gitignore'da, repo'ga tushmaydi.
Rang/shrift tokenlari faqat `src/app/globals.css` dagi `@theme`da; maket kelganda shu yer almashtiriladi.
Qochish kerak: krem fon + terracotta, bir xil radiusli kartochkalar, ALL CAPS yorliqlar.
