## 2026-10-01 — Manbalar (investor): obyektlar bo'yicha hisobot

- **Nima qilindi**: Yetkazib beruvchi kartochkasi uslubida, lekin qoldiq/qarz
  tushunchasisiz — manba (investor, buyurtmachi) qancha pul kiritganini
  obyektlar bo'yicha ko'rsatadigan hisobot. Yangi sahifalar: `/manbalar`
  (ro'yxat) va `/manbalar/[id]` (jami summa, obyektlar jadvali — summa va
  ulush %, sana/obyekt filtrlanadigan tarix, Excel eksport). Sidebar'ga
  "Манбалар" bandi qo'shildi ("Етказиб берувчилар" yonida).
- **Teskari tomon**: obyekt kartochkasiga (`/obyektlar/[id]`) "Кимдан келган
  пул" jadvali qo'shildi — shu obyektga qaysi manbadan qancha pul kelgani.
- **Migratsiya**: kirim (INCOME) endi MAJBURIY obyektga bog'lanadi — avval
  ixtiyoriy edi ("investor puli bir nechta obyekt uchun" degan eski mulohaza).
  `prisma/migrations/20261001020000_income_site_required` — CHECK qoidasiga
  `site_id IS NOT NULL` qo'shildi (bazada tekshirilgan: orfan yozuv yo'q edi,
  backfill ishlatilmadi). `entries.ts`ga tekshiruv qo'shildi ("Объект
  танланмаган"). `/hisoblar` sahifasidagi "умумий кирим" formasiga ham
  obyekt tanlash maydoni qo'shildi (`MoneyMoveForm`), chunki u yerda
  avval obyektsiz kirim kiritilardi.
- **O'zgargan/yangi fayllar**: yangi migratsiya, `prisma/schema.prisma`
  (izoh), `src/services/entries.ts` (validatsiya), `src/components/MoneyMoveForm.tsx`
  (INCOME uchun ham "Объект" tanlash — kontekstda obyekt bo'lmasa),
  `src/app/(panel)/hisoblar/page.tsx`, `src/app/(panel)/kiritish/DailyLedger.tsx`
  (tip tozalash), yangi `src/services/payers.ts`, `src/services/sites.ts`
  (`getSiteCard`ga `payers` maydoni), `src/app/(panel)/obyektlar/[id]/page.tsx`,
  `src/services/exports.ts` (`exportPayerSites`), `src/app/api/export/[report]/route.ts`
  (`manba`), `src/app/(panel)/layout.tsx`, ikkita yangi sahifa fayl.
- **Natija**: `npm run typecheck`, `npm test`, `npm run build` — hammasi
  xatosiz. Vaqtinchalik test sessiyasi bilan curl orqali sinaldi: ro'yxat,
  kartochka, obyekt bo'yicha ulush %, Excel eksport (raqamlar mos), obyekt
  kartochkasidagi teskari jadval, yangi kirim yaratish (obyektsiz — rad
  etildi, obyekt bilan — saqlandi, keyin bekor qilindi). `pm2 restart hisob`
  bilan joylashtirildi.
- **Keyingi qadam**: yo'q — vazifa to'liq bajarildi.

## 2026-10-01 — Yetkazib beruvchilar: obyektlar bo'yicha hisobot

- **Nima qilindi**: Yangi, faqat o'qish uchun hisobot qo'shildi — har bir yetkazib
  beruvchining qarzi endi obyekt (qurilish maydoni) bo'yicha ajratib ko'rsatiladi.
  Yangi sahifalar: `/yetkazib-beruvchilar` (ro'yxat, qarzi borlar yuqorida) va
  `/yetkazib-beruvchilar/[id]` (3 karta: jami olingan/to'langan/qoldiq, obyektlar
  jadvali, bosilganda shu obyekt tarixi filtrlanadi, Excel eksport).
- **Muhim o'zgarish (foydalanuvchi so'roviga ko'ra)**: avval zavodga to'lov
  (SUPPLIER_PAYMENT) hech qachon obyektga yozilmasdi — faqat umumiy yetkazib
  beruvchi bo'yicha. Shu sababli "obyekt qoldig'i" to'g'ri chiqmasdi. Migratsiya
  bilan (`prisma/migrations/20261001010000_supplier_payment_site_required`)
  endi to'lov yozilganda ham obyekt tanlash MAJBURIY qilindi (baza CHECK qoidasi
  + `services/entries.ts` tekshiruvi + `MoneyMoveForm`ga "Объект" maydoni
  qo'shildi). 3 ta eski demo to'lov yozuvi avtomatik tegishli obyektga
  biriktirildi (backfill, migration faylining o'zida).
- **O'zgargan fayllar**: `prisma/schema.prisma` (izoh), yangi migratsiya,
  `src/services/entries.ts` (validatsiya + `describeEntry` yordamchisi),
  `src/components/MoneyMoveForm.tsx`, `src/app/(panel)/yetkazib/[id]/page.tsx`
  (`sites` prop uzatildi), `src/services/suppliers.ts` (`getSupplierSiteBalances`),
  `src/services/exports.ts` (`exportSupplierSites`), `src/app/api/export/[report]/route.ts`
  (`yetkazib-obyektlar`), `src/app/(panel)/layout.tsx` (menyuga havola),
  ikkita yangi sahifa fayl.
- **Natija**: `npm run typecheck`, `npm test`, `npm run build` — hammasi xatosiz.
  Vaqtinchalik test sessiyasi bilan curl orqali sinaldi: ro'yxat, kartochka,
  obyekt filtri, Excel eksport, yangi to'lov yaratish (obyektsiz — rad etildi,
  obyekt bilan — saqlandi, keyin test yozuv bekor qilindi). `pm2 restart hisob`
  bilan joylashtirildi, sayt ishlayapti.
- **Keyingi qadam**: yo'q — vazifa to'liq bajarildi. Foydalanuvchi real ishda
  sinab ko'rsin, savol chiqsa shu yerga qaraladi.
