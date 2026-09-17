/**
 * VPS'da (yoki istalgan production bazada) SINASH uchun demo ma'lumot soladi:
 * demo firma, 2 ta hisob, 2 ta ob'ekt, standart kategoriya/nom ro'yxati,
 * bir yetkazib beruvchi, bir pul beruvchi va so'nggi ~40 kunlik taxminiy
 * yozuvlar (kirim, chiqim, o'tkazma, yetkazib beruvchiga to'lov/qarzga tovar).
 *
 * Ishlatish: CONFIRM=DEMO npm run seed-demo
 *
 * Xavfsizlik:
 *  - Faqat CONFIRM=DEMO bilan ishlaydi.
 *  - Bazada demo bo'lmagan (haqiqiy) firma bo'lsa — rad etadi (haqiqiy
 *    ma'lumot ustiga demo solib qo'yish xavfidan).
 *  - Qayta ishga tushirilsa — demo firma allaqachon bo'lsa, hech narsa
 *    qilmaydi (idempotent).
 *  - Kategoriya va nomlar (material) DEMO deb belgilanmaydi — bular
 *    haqiqiy ishda ham kerak bo'ladigan umumiy ro'yxat, qoladi.
 *  - Firma, ob'ekt, hisob, kontragent nomlari "ДЕМО" bilan boshlanadi —
 *    tizim hech narsani o'chirmagani uchun keyin scripts/cleanup-demo.ts
 *    shu prefiks bo'yicha topib, bekor qiladi (o'chirmaydi — bekor qiladi).
 */
import { PrismaClient, Prisma, type Role } from "@prisma/client";
import { computeAmount } from "../src/lib/money";
import { nameKey } from "../src/lib/normalize";
import { todayIso } from "../src/lib/dates";

const prisma = new PrismaClient();
const DEMO = "ДЕМО";

const qty = (n: number) => new Prisma.Decimal(n);
const daysAgo = (n: number) => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

async function main() {
  if (process.env.CONFIRM !== "DEMO") {
    throw new Error("Xavfsizlik: CONFIRM=DEMO npm run seed-demo deb ishga tushiring");
  }

  const realCompany = await prisma.company.findFirst({ where: { name: { not: { startsWith: DEMO } } } });
  if (realCompany) {
    throw new Error(`Bazada haqiqiy firma bor allaqachon ("${realCompany.name}") — demo ma'lumot solinmadi, xavfsizlik uchun.`);
  }

  const existing = await prisma.company.findFirst({ where: { name: { startsWith: DEMO } } });
  if (existing) {
    console.log("Demo ma'lumot allaqachon solingan — qayta solinmaydi. Avval scripts/cleanup-demo.ts bilan tozalang.");
    return;
  }

  const accountant = await prisma.user.findFirst({ where: { role: "ACCOUNTANT" as Role, isActive: true } });
  const director = await prisma.user.findFirst({ where: { role: "DIRECTOR" as Role, isActive: true } });
  const actor = accountant ?? director;
  if (!actor) throw new Error("Avval kamida bitta foydalanuvchi yarating: npm run create-user (docs/deploy.md)");

  console.log(`Ишлатувчи: ${actor.name} (${actor.role})`);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: `${DEMO} Қурилиш МЧЖ` } });
    const cash = await tx.account.create({
      data: { name: `${DEMO} — нахт касса`, type: "CASH", companyId: company.id, openingBalance: 40_000_000n, sortOrder: 1 },
    });
    const bank = await tx.account.create({
      data: { name: `${DEMO} — банк ҳисоби`, type: "BANK", companyId: company.id, openingBalance: 150_000_000n, sortOrder: 2 },
    });

    const site1 = await tx.site.create({ data: { name: `${DEMO} объект 1`, address: "Тошкент ш., намуна кўча 12" } });
    const site2 = await tx.site.create({ data: { name: `${DEMO} объект 2`, address: "Тошкент вилояти, синов МФЙ" } });

    const catNames = ["Материал", "Транспорт", "Техника арендаси", "Иш ҳақи", "Овқат", "Коммунал", "Расмий тўлов", "Бошқа"];
    const categories: Record<string, number> = {};
    for (let i = 0; i < catNames.length; i++) {
      const c = await tx.category.upsert({
        where: { name: catNames[i] },
        update: {},
        create: { name: catNames[i], sortOrder: i + 1 },
      });
      categories[catNames[i]] = c.id;
    }

    const materialDefs: [string, string, string][] = [
      ["Бетон 250 марка", "m3", "Материал"],
      ["Арматура 12 лик", "kg", "Материал"],
      ["Цемент М400", "qop", "Материал"],
      ["Ғишт", "dona", "Материал"],
      ["Қум", "m3", "Материал"],
      ["Мих", "kg", "Материал"],
      ["Юк ташиш", "reys", "Транспорт"],
      ["Кран арендаси", "soat", "Техника арендаси"],
      ["Усталарга тўлов", "xizmat", "Иш ҳақи"],
      ["Ишчиларга овқат", "kishi", "Овқат"],
      ["Электр энергия", "xizmat", "Коммунал"],
      ["Турли харажат", "xizmat", "Бошқа"],
    ];
    const materials: Record<string, { id: number; unit: string; categoryId: number }> = {};
    for (const [name, unit, cat] of materialDefs) {
      const m = await tx.material.upsert({
        where: { nameKey: nameKey(name) },
        update: {},
        create: { name, nameKey: nameKey(name), unit, categoryId: categories[cat] },
      });
      materials[name] = { id: m.id, unit, categoryId: categories[cat] };
    }

    const payer = await tx.counterparty.create({ data: { name: `${DEMO} инвестор`, kind: "PAYER" } });
    const supplier = await tx.counterparty.create({ data: { name: `${DEMO} — бетон заводи`, kind: "SUPPLIER", phone: "+998 90 000 00 00" } });

    // Ob'ekt xarajatlari: [kun oldin, ob'ekt, hisob, material, miqdor, narx, izoh?]
    type Row = [number, typeof site1, typeof cash, string, number, bigint, string?];
    const rows: Row[] = [
      [32, site1, cash, "Бетон 250 марка", 12, 620_000n],
      [30, site1, bank, "Арматура 12 лик", 850, 9_200n],
      [28, site1, cash, "Цемент М400", 60, 62_000n],
      [25, site1, cash, "Юк ташиш", 3, 400_000n],
      [22, site2, cash, "Ғишт", 4000, 900n],
      [20, site1, bank, "Кран арендаси", 6, 350_000n],
      [18, site2, cash, "Қум", 8, 180_000n],
      [15, site1, cash, "Усталарга тўлов", 1, 25_000_000n],
      [14, site2, cash, "Ишчиларга овқат", 12, 35_000n],
      [12, site1, bank, "Электр энергия", 1, 1_800_000n],
      [10, site2, cash, "Мих", 40, 14_000n],
      [8, site1, cash, "Юк ташиш", 2, 400_000n],
      [6, site2, bank, "Арматура 12 лик", 620, 9_200n],
      [4, site1, cash, "Турли харажат", 1, 250_000n, "Рухсатнома"],
      [2, site2, cash, "Цемент М400", 45, 62_000n],
    ];

    for (const [days, site, account, matName, q, price, note] of rows) {
      const mat = materials[matName];
      const quantity = qty(q);
      const amount = computeAmount(BigInt(Math.round(q * 1000)), price);
      await tx.entry.create({
        data: {
          kind: "EXPENSE",
          date: daysAgo(days),
          siteId: site.id,
          accountId: account.id,
          categoryId: mat.categoryId,
          materialId: mat.id,
          quantity,
          unitPrice: price,
          amount,
          note: note ?? null,
          createdById: actor.id,
        },
      });
    }

    // Kirim: investordan
    await tx.entry.create({
      data: {
        kind: "INCOME",
        date: daysAgo(31),
        siteId: site1.id,
        accountId: bank.id,
        counterpartyId: payer.id,
        quantity: qty(1),
        unitPrice: 200_000_000n,
        amount: 200_000_000n,
        note: "Демо: лойиҳа учун асосий маблағ",
        createdById: actor.id,
      },
    });

    // O'tkazma: bankdan nahtga
    await tx.entry.create({
      data: {
        kind: "TRANSFER",
        date: daysAgo(24),
        accountId: bank.id,
        toAccountId: cash.id,
        quantity: qty(1),
        unitPrice: 30_000_000n,
        amount: 30_000_000n,
        createdById: actor.id,
      },
    });

    // Yetkazib beruvchi: qarzga tovar keldi, keyin qisman to'landi
    const betonMat = materials["Бетон 250 марка"];
    const receiptQty = 20;
    const receiptPrice = 600_000n;
    await tx.entry.create({
      data: {
        kind: "GOODS_RECEIPT",
        date: daysAgo(16),
        siteId: site2.id,
        categoryId: betonMat.categoryId,
        materialId: betonMat.id,
        counterpartyId: supplier.id,
        quantity: qty(receiptQty),
        unitPrice: receiptPrice,
        amount: computeAmount(BigInt(receiptQty * 1000), receiptPrice),
        note: "Демо: қарзга олинди",
        createdById: actor.id,
      },
    });
    await tx.entry.create({
      data: {
        kind: "SUPPLIER_PAYMENT",
        date: daysAgo(9),
        accountId: bank.id,
        counterpartyId: supplier.id,
        quantity: qty(1),
        unitPrice: 8_000_000n,
        amount: 8_000_000n,
        note: "Демо: қисман тўлов",
        createdById: actor.id,
      },
    });

    return { company, site1, site2, cash, bank, payer, supplier, entryCount: rows.length + 4 };
  });

  console.log(`\nТайёр:`);
  console.log(`  Фирма: ${result.company.name}`);
  console.log(`  Объектлар: ${result.site1.name}, ${result.site2.name}`);
  console.log(`  Ҳисоблар: ${result.cash.name}, ${result.bank.name}`);
  console.log(`  Пул берувчи: ${result.payer.name}`);
  console.log(`  Етказиб берувчи: ${result.supplier.name}`);
  console.log(`  Ёзувлар: ${result.entryCount} та`);
  console.log(`\nТозалаш учун: CONFIRM=CLEANUP npm run cleanup-demo`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
