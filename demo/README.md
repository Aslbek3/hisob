# Demo ma'lumot

Saytni birinchi marta ochib ko'rganda bo'sh ekran ko'rsatmaslik uchun — soxta,
lekin haqiqiy ko'rinishdagi ma'lumot: 1 ta demo firma, 2 ta ob'ekt, 2 ta hisob,
standart kategoriya/nom ro'yxati, 1 yetkazib beruvchi, 1 pul beruvchi va
so'nggi ~40 kunlik taxminiy yozuvlar (kirim, chiqim, o'tkazma, yetkazib
beruvchiga to'lov/qarzga tovar).

Skriptlarning o'zi `scripts/seed-demo.ts` va `scripts/cleanup-demo.ts`da —
bu yerda faqat qanday va nega ishlatilishi yozilgan.

## Solish

```bash
CONFIRM=DEMO npm run seed-demo
```

Talablar:
- Bazada kamida bitta foydalanuvchi bo'lishi kerak (`npm run create-user`
  bilan avval yaratilgan bo'lishi shart — `docs/deploy.md`ga qarang).
- Bazada demo bo'lmagan (haqiqiy) firma bo'lsa — skript rad etadi. Bu
  himoya: haqiqiy ishlab turgan saytga tasodifan demo solib qo'yilmasin.
- Qayta ishga tushirilsa — demo allaqachon bo'lsa, hech narsa qilmaydi
  (idempotent).

Yaratilgan hamma narsa `ДЕМО` prefiksi bilan boshlanadi: firma, ob'ektlar,
hisoblar, kontragentlar. **Bundan mustasno** — kategoriyalar va nomlar
(material ro'yxati): bular umumiy, haqiqiy ishda ham kerak bo'ladi, shuning
uchun oddiy nomlar bilan yaratiladi va tozalashda tegilmaydi.

## Tozalash (haqiqiy ishga o'tishdan oldin)

```bash
CONFIRM=CLEANUP npm run cleanup-demo
```

**Muhim: tizimda hech narsa butunlay o'chirilmaydi** (bazada bu texnik jihatdan
taqiqlangan — pul tarixi buzilmasligi uchun). Shu sabab tozalash:

- demo yozuvlarni **bekor qiladi** (bazada `CANCELLED`, sababi bilan qoladi) —
  o'chirmaydi;
- demo ob'ektlarni **arxivga** o'tkazadi;
- demo firma/hisob/kontragentlarni **"o'chirilgan"** (`isActive=false`) qiladi.

Bularning barchasi ro'yxatlarda kulrang qilib ko'rsatiladi (yashirilmaydi —
sayt hech narsani "yo'qolgan" qilib ko'rsatmaydi) va audit jurnaliga yoziladi.

Ikkala skript ham `d:\fr5\hisob-sayt`dagi toza (bo'sh) test bazasida
tekshirilgan: xavfsizlik tekshiruvlari, muvaffaqiyatli solish, saytning o'zida
(Кассалар, Объектлар, Етказиб берувчилар, Ҳисобот) to'g'ri ko'rinishi,
tozalash va qayta tozalashning xavfsizligi.
