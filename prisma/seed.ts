/**
 * Lokal dev bazaga boshlang'ich ma'lumot. PRODUCTION'DA ISHLATILMAYDI —
 * u yerda birinchi direktor `npm run create-user` bilan yaratiladi.
 *
 * Parol repo'da YOZILMAYDI (repo ochiq): SEED_PASSWORD muhit o'zgaruvchisidan olinadi.
 *   SEED_PASSWORD="..." npm run db:seed
 *
 * Bo'sh bo'lmagan bazada ishlamaydi — mavjud ma'lumotni ustidan yozib yubormaslik uchun.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nameKey } from "../src/lib/normalize";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed production'da ishlatilmaydi");
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8) throw new Error("SEED_PASSWORD (kamida 8 belgi) berilmagan");
  if ((await prisma.user.count()) > 0) {
    console.log("Bazada foydalanuvchilar bor — seed o'tkazib yuborildi.");
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  // Ketma-ket (Promise.all emas) — id tartibi har safar bir xil bo'lsin
  const firmaA = await prisma.company.create({ data: { name: "Firma A" } });
  const firmaB = await prisma.company.create({ data: { name: "Firma B" } });

  await prisma.account.createMany({
    data: [
      { name: "Firma A — bank", type: "BANK", companyId: firmaA.id, sortOrder: 1 },
      { name: "Firma A — naqd", type: "CASH", companyId: firmaA.id, sortOrder: 2 },
      { name: "Firma B — bank", type: "BANK", companyId: firmaB.id, sortOrder: 3 },
      { name: "Firma B — naqd", type: "CASH", companyId: firmaB.id, sortOrder: 4 },
      { name: "Shaxsiy naqd", type: "PERSONAL", sortOrder: 5 },
    ],
  });

  const categories = [
    ["Material", true],
    ["Transport", false],
    ["Texnika arendasi", false],
    ["Ish haqi", false],
    ["Ovqat", false],
    ["Kommunal", false],
    ["Rasmiy to'lov", false],
    ["Boshqa", false],
  ] as const;
  await prisma.category.createMany({
    data: categories.map(([name, isMaterial], i) => ({ name, isMaterial, sortOrder: i + 1 })),
  });

  const materials: [string, string][] = [
    ["Sement M400", "qop"],
    ["Sement M500", "qop"],
    ["Armatura 12 mm", "kg"],
    ["Armatura 14 mm", "kg"],
    ["G'isht pishgan", "dona"],
    ["Qum", "m3"],
    ["Shag'al", "m3"],
    ["Beton M300", "m3"],
    ["Penoblok", "m3"],
    ["Taxta 50×150", "m3"],
  ];
  await prisma.material.createMany({ data: materials.map(([name, unit]) => ({ name, nameKey: nameKey(name), unit })) });

  await prisma.counterparty.createMany({
    data: [
      { name: "Buyurtmachi", kind: "PAYER" },
      { name: "Ta'sischi", kind: "PAYER" },
    ],
  });

  const site1 = await prisma.site.create({ data: { name: "Yunusobod 9-uy", address: "Yunusobod tumani" } });
  const site2 = await prisma.site.create({ data: { name: "Chilonzor 3-blok", address: "Chilonzor tumani" } });

  await prisma.user.createMany({
    data: [
      { name: "Direktor", login: "direktor", passwordHash: hash, role: "DIRECTOR" },
      { name: "Buxgalter", login: "buxgalter", passwordHash: hash, role: "ACCOUNTANT" },
      { name: "Prorab 1", login: "prorab1", passwordHash: hash, role: "FOREMAN" },
      { name: "Prorab 2", login: "prorab2", passwordHash: hash, role: "FOREMAN" },
    ],
  });
  const [p1, p2] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { login: "prorab1" } }),
    prisma.user.findUniqueOrThrow({ where: { login: "prorab2" } }),
  ]);
  await prisma.siteAssignment.createMany({
    data: [
      { userId: p1.id, siteId: site1.id },
      { userId: p2.id, siteId: site2.id },
    ],
  });

  console.log("Seed tayyor: direktor, buxgalter, prorab1, prorab2 (parol — SEED_PASSWORD).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
