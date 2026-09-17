/**
 * scripts/seed-demo.ts bilan solingan demo ma'lumotni ishdan chiqaradi —
 * HAQIQIY ma'lumotga o'tishdan oldin ishga tushiriladi.
 *
 * MUHIM: tizimda hech narsa butunlay o'chirilmaydi (Entry'ni o'chirish
 * bazada trigger bilan taqiqlangan — buzilmasin, chunki bu pul tarixi).
 * Shu sabab bu skript:
 *   - demo yozuvlarni BEKOR QILADI (CANCELLED, sababi bilan) — o'chirmaydi;
 *   - demo ob'ektlarni ARXIVGA o'tkazadi;
 *   - demo firma/hisob/kontragentlarni "o'chirilgan" (isActive=false) qiladi.
 * Hammasi audit jurnaliga yoziladi — keyinchalik "nega bunday raqamlar
 * bo'lgan edi" desa, tarixda "demo, bekor qilingan" deb ko'rinadi.
 *
 * Ishlatish: CONFIRM=CLEANUP npm run cleanup-demo
 */
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO = "ДЕМО";
const REASON = "Демо маълумот — ҳақиқий ишга ўтишдан олдин бекор қилинди";

async function main() {
  if (process.env.CONFIRM !== "CLEANUP") {
    throw new Error("Xavfsizlik: CONFIRM=CLEANUP npm run cleanup-demo deb ishga tushiring");
  }

  const actor =
    (await prisma.user.findFirst({ where: { role: "DIRECTOR" as Role, isActive: true } })) ??
    (await prisma.user.findFirst({ where: { isActive: true } }));
  if (!actor) throw new Error("Bazada faol foydalanuvchi topilmadi");

  const demoFilter = { startsWith: DEMO };
  const entries = await prisma.entry.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { site: { name: demoFilter } },
        { account: { name: demoFilter } },
        { toAccount: { name: demoFilter } },
        { counterparty: { name: demoFilter } },
      ],
    },
    select: { id: true },
  });

  if (entries.length === 0) {
    console.log("Bekor qilinadigan demo yozuv topilmadi (allaqachon tozalangan bo'lishi mumkin).");
  }

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      const before = await tx.entry.findUniqueOrThrow({ where: { id: e.id } });
      await tx.entry.update({
        where: { id: e.id },
        data: { status: "CANCELLED", cancelledById: actor.id, cancelledAt: new Date(), cancelReason: REASON },
      });
      await tx.auditLog.create({
        data: { userId: actor.id, action: "CANCEL", entityType: "Entry", entityId: String(e.id), before: JSON.parse(JSON.stringify(before, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), reason: REASON },
      });
    }

    const sites = await tx.site.findMany({ where: { name: demoFilter, status: "ACTIVE" } });
    for (const s of sites) {
      await tx.site.update({ where: { id: s.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "ARCHIVE", entityType: "Site", entityId: String(s.id), reason: REASON } });
    }

    const accounts = await tx.account.findMany({ where: { name: demoFilter, isActive: true } });
    for (const a of accounts) {
      await tx.account.update({ where: { id: a.id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE", entityType: "Account", entityId: String(a.id), reason: REASON } });
    }

    const counterparties = await tx.counterparty.findMany({ where: { name: demoFilter, isActive: true } });
    for (const c of counterparties) {
      await tx.counterparty.update({ where: { id: c.id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE", entityType: "Counterparty", entityId: String(c.id), reason: REASON } });
    }

    const companies = await tx.company.findMany({ where: { name: demoFilter, isActive: true } });
    for (const c of companies) {
      await tx.company.update({ where: { id: c.id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE", entityType: "Company", entityId: String(c.id), reason: REASON } });
    }

    console.log(`Бекор қилинди: ${entries.length} та ёзув, ${sites.length} та объект архивга ўтди, ${accounts.length} та ҳисоб ва ${counterparties.length} та контрагент ва ${companies.length} та фирма ўчирилди (белгиланди).`);
  });

  console.log("\nЕслатма: категориялар ва номлар (материаллар рўйхати) ДЕМО деб белгиланмаган — улар ҳақиқий ишда ҳам керак бўлади, тегилмади.");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
