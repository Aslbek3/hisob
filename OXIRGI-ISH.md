## 2026-10-06 — Kirill/lotin alifbo almashtirish (ekranda)

- **Nima qilindi**: `src/lib/translit.ts` (toLatin/toCyrillic, sof funksiyalar,
  13 test `translit.test.ts`da — jumladan aylantirib tekshirish), `src/lib/alphabet.ts`
  (tanlov localStorage+cookie'da), `src/components/AlphabetOverlay.tsx` (ekrandagi
  matnni MutationObserver bilan o'giradi) va `AlphabetToggle.tsx` (tugma, Sidebar'ga
  qo'shildi — mobil va desktop). Root layout (`src/app/layout.tsx`) cookie'dan
  boshlang'ich holatni o'qib `<html data-alphabet>` qo'yadi.
- **Bazaga HAMMA NARSA kirillda boradi** — lotin faqat ekranda. Nom/izoh
  kiritiladigan 6 joyda (`NewNameDialog`, `NewSupplierForm`, `SiteActions`,
  `MoneyMoveForm`, `ReferenceEditor` umumiy, `DailyLedger`ning faqat "izoh"
  qatori) saqlashdan oldin `toStorageText()` chaqiriladi. `DailyLedger.tsx`ga
  atayl faqat bitta qator tegildi (qayta yozilmadi — task talabi).
- **Topilgan va tuzatilgan xato**: overlay dastlab kirillga qaytishda matnni
  algoritm bilan teskari o'girar edi — "Ҳисобот (**Excel**)" kabi ichida lotin
  so'z bor matnlarni buzib qo'yardi. Yechim: har bir matn tuguni uchun ASL
  kirill qiymati `WeakMap`da saqlanadi, qaytishda shu asl qiymat tiklanadi
  (qayta hisoblanmaydi). Haqiqiy brauzerda (Playwright, chromium-cli mavjud
  bo'lmagani uchun `/tmp/pwshot` dagi playwright-core + yuklab olingan
  Chromium'dan foydalanildi) login→toggle→qaytish sinaldi, matn so'z-so'z
  asliga teng chiqdi.
- **Sinov muhiti**: productionga tegmaslik uchun vaqtincha `npx prisma dev`
  (PGlite) bazasi va alohida portda (`3177`) dev server ko'tarildi, sinovdan
  keyin ikkalasi ham tozalandi — production baza/jarayonlarga tegilmadi.
- **Natija**: `npm run typecheck`, `npm test` (13/13) va `npm run build`
  toza o'tdi. Excel/Telegram hisobotlar server-tomon bazadan to'g'ridan-to'g'ri
  kirill o'qiydi — bu o'zgarishga umuman tegmadi (Telegram bot hali yo'q ham).
- **Keyingi qadam**: foydalanuvchi haqiqiy telefonda tugmani sinab ko'rsin;
  "vitest" so'ralgan edi, lekin loyihada `node:test` (tsx) ishlatiladi —
  shu konvensiyaga mos test yozildi (yangi test frameworki qo'shilmadi).

## 2026-10-04 — Qurilish spravochnikasi (kategoriya + nom) bazaga kiritildi

- **Nima qilindi**: `scripts/seed-reference.ts` yozildi — 10 ta kategoriya
  (Материал, Иш ҳақи, Транспорт, Техника арендаси, Ёқилғи, Овқат, Коммунал,
  Ижара, Солиқ ва расмий, Бошқа) va 71 ta nom (narx/birlik bilan emas, faqat
  nom+birlik+kategoriya) bazaga qo'shildi. `npm run seed-reference` buyrug'i
  `package.json`ga qo'shildi.
- **Idempotent**: kategoriya nomi, nom esa `nameKey` bo'yicha tekshiriladi —
  qayta ishga tushirilsa borlari o'tkazib yuboriladi.
- **Natija**: production bazaga (VPS, 127.0.0.1:5432) ishga tushirildi —
  "Категория: 10 та янги қўшилди", "Ном: 71 та янги қўшилди". "ДЕМО" prefiksi
  YO'Q — bu haqiqiy, doimiy spravochnik.
- **Muhim**: skriptni `tsx` bilan ishga tushirishda `/usr/bin/node` (v12,
  eski) emas, `/root/.nvm/versions/node/v22.23.1/bin/node` ishlatilishi kerak
  — aks holda tsx sintaksis xatosi beradi. PM2 jarayoni `hisob` aynan shu v22
  bilan ishlaydi.

## 2026-10-01 — Demo ma'lumot butunlay tozalandi, real ishga tayyor

- **Nima qilindi**: Bazadagi demo ma'lumot (firma, obyekt, hisob, kontragent,
  yozuvlar) butunlay o'chirildi — `npx prisma migrate reset --skip-seed`
  (Prisma CLI buni xavfli AI-amal deb bloklagan edi, foydalanuvchidan aniq
  tasdiq olingach `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` bilan ishga
  tushirildi). Oldin `scripts/backup.sh` bilan zaxira olindi
  (`backups/hisob_2026-10-01_1336.dump`).
- **Muammo va yechim**: reset'dan keyin ikkita trigger funksiyasi
  (`forbid_delete`, `forbid_audit_change`) bazada qolib ketgan edi (Prisma'ning
  "soft reset"i raw SQL orqali yaratilgan funksiyalarni o'chirmaydi) — birinchi
  migratsiya shu sababli xato berdi. Funksiyalar qo'lda `DROP FUNCTION`
  qilindi, migratsiya `rolled-back` deb belgilandi, keyin barcha 6 migratsiya
  toza bazaga muvaffaqiyatli qayta qo'llandi.
- **Foydalanuvchi**: `scripts/create-user.ts` dagi parol talabi 12 dan 8
  belgiga tushirildi (foydalanuvchi so'rovi, `seed.ts`dagi talab bilan bir
  xil). Yagona DIRECTOR foydalanuvchi yaratildi: login `direktor`, ism Oktam.
- **Muhim eslatma**: kategoriya va nom (material) ro'yxati ham **bo'sh** —
  ular demo emas, `scripts/seed-demo.ts` orqali yaratilgan edi (bu skript
  ishlatilmadi). Haqiqiy ishga o'tishdan oldin bularni ham qo'lda kiritish
  kerak.
- **Natija**: build + `pm2 restart hisob` — sayt ishlab turibdi. Tekshirildi:
  login ishlaydi, barcha asosiy sahifalar (kunlik daftar, obyektlar, manbalar,
  yetkazib beruvchilar, kassalar, jurnal, barcha spravochnik bo'limlari) 200
  qaytaradi, baza butunlay bo'sh (users=1, qolgani 0).
- **Keyingi qadam**: foydalanuvchi saytga kirib firma/hisob/obyekt/kategoriya/
  material/kontragent ma'lumotlarini qo'lda kiritadi.

## 2026-10-01 — Yetkazib beruvchi: ikki sahifa bittaga birlashtirildi

- **Muammo**: `/yetkazib` (eski, Солиштириш далолатномаси + то'лов formasi)
  va `/yetkazib-beruvchilar` (yangi, obyektlar jadvali) alohida ikki sahifa
  edi, ikkalasi ham Sidebar'da — takrorlanish.
- **Nima qilindi**: Hammasi `/yetkazib` va `/yetkazib/[id]` ichiga birlashtirildi:
  - Ro'yxat (`/yetkazib`): qoldiq ustunlari va "qarzi borlar yuqorida" tartibi
    yangi sahifadan olindi, `NewSupplierForm` saqlanib qoldi.
  - Kartochka (`/yetkazib/[id]`): eski "Солиштириш далолатномаси" (давр
    бошига қолдиқ, кетма-кет ёзувлар, running balance, то'лов formasi) +
    yangi "obyektlar jadvali" (obyekt|olingan|to'langan|qoldiq, bosilganda
    shu obyekt bo'yicha tarix filtrlanadi). Ikki Excel eksport tugmasi
    (Солиштириш va Объектлар бўйича) yonma-yon.
  - `getSupplierStatement` servisi o'zgarmadi (siteId filtri yo'q) — shu
    sababli obyekt bo'yicha filtr sahifaning o'zida (JS'da) qilinadi, running
    balance baribir umumiy (zavod bo'yicha) qoldiqni ko'rsatadi, faqat shu
    obyektga tegishli qatorlar ko'rinadi.
  - `src/app/(panel)/yetkazib-beruvchilar/` papkasi butunlay o'chirildi.
  - `layout.tsx` menyusidan "Етказиб — объектлар бўйича" bandi olib tashlandi
    — faqat "Етказиб берувчилар" qoldi.
  - Eksport route (`/api/export/yetkazib-obyektlar`) va servis funksiyasi
    o'zgarishsiz qoldi, endi faqat yagona sahifadan chaqiriladi.
  - `grep -rn "yetkazib-beruvchilar"` — butun loyihada hech narsa topilmadi.
- **Natija**: `npm run typecheck`, `npm test`, `npm run build` — xatosiz.
  Vaqtinchalik sessiya bilan tekshirildi: ro'yxat, kartochka, obyekt filtri,
  ikkala eksport, eski manzil (404). `pm2 restart hisob` bilan joylashtirildi.
- **Keyingi qadam**: yo'q.

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
