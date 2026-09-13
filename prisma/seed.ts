/**
 * Lokal dev bazaga boshlang'ich ma'lumot. PRODUCTION'DA ISHLATILMAYDI —
 * u yerda birinchi foydalanuvchi `npm run create-user` bilan yaratiladi.
 *
 * Parol repo'da YOZILMAYDI (repo ochiq): SEED_PASSWORD muhit o'zgaruvchisidan olinadi.
 *   SEED_PASSWORD="..." npm run db:seed
 *
 * Bo'sh bo'lmagan bazada ishlamaydi — mavjud ma'lumotni ustidan yozib yubormaslik uchun.
 * Nomlar umumiy (namuna) — haqiqiy firma ma'lumoti bu yerga yozilmaydi.
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
  const firma = await prisma.company.create({ data: { name: "Фирма А" } });
  await prisma.account.createMany({
    data: [
      { name: "Фирма А — нахт", type: "CASH", companyId: firma.id, sortOrder: 1 },
      { name: "Фирма А — перечисления", type: "BANK", companyId: firma.id, sortOrder: 2 },
      { name: "Шахсий (прораб)", type: "PERSONAL", sortOrder: 3 },
    ],
  });

  const categoryNames = ["Материал", "Транспорт", "Ёқилғи", "Техника ижараси", "Асбоб ва сарф", "Иш ҳақи", "Овқат", "Коммунал", "Расмий тўлов", "Бошқа"];
  for (const [i, name] of categoryNames.entries()) await prisma.category.create({ data: { name, sortOrder: i + 1 } });
  const cat = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));

  const items: [string, string, string][] = [
    ["Бетон 250 марка", "m3", "Материал"],
    ["Арматура 12 лик", "kg", "Материал"],
    ["Арматура 16 лик", "kg", "Материал"],
    ["Цемент", "qop", "Материал"],
    ["Қум", "m3", "Материал"],
    ["Шағал", "m3", "Материал"],
    ["Тахта", "m3", "Материал"],
    ["Мих", "kg", "Материал"],
    ["Электрод", "pachka", "Асбоб ва сарф"],
    ["Болгарка тоши", "dona", "Асбоб ва сарф"],
    ["Перчатка", "dona", "Асбоб ва сарф"],
    ["Мошинага газ", "xizmat", "Ёқилғи"],
    ["Движокка бензин", "l", "Ёқилғи"],
    ["Юк ташиш (такси)", "reys", "Транспорт"],
    ["Кран хизмати", "soat", "Техника ижараси"],
    ["Опалубка ижараси", "xizmat", "Техника ижараси"],
    ["Усталарга аванс", "xizmat", "Иш ҳақи"],
    ["Ишчиларга овқат пули", "xizmat", "Овқат"],
    ["Электр энергия", "xizmat", "Коммунал"],
  ];
  await prisma.material.createMany({ data: items.map(([name, unit, c]) => ({ name, nameKey: nameKey(name), unit, categoryId: cat[c] })) });

  await prisma.counterparty.createMany({
    data: [
      { name: "Инвестор 1", kind: "PAYER" },
      { name: "Бетон завод", kind: "SUPPLIER" },
      { name: "Арматура база", kind: "SUPPLIER" },
    ],
  });

  const site1 = await prisma.site.create({ data: { name: "Объект 1", address: "Шаҳар, кўча" } });
  await prisma.site.create({ data: { name: "Объект 2", address: "Шаҳар, кўча" } });

  await prisma.user.createMany({
    data: [
      { name: "Директор", login: "direktor", passwordHash: hash, role: "DIRECTOR" },
      { name: "Ҳисобчи", login: "hisobchi", passwordHash: hash, role: "ACCOUNTANT" },
      { name: "Прораб", login: "prorab", passwordHash: hash, role: "FOREMAN" },
    ],
  });
  const prorab = await prisma.user.findUniqueOrThrow({ where: { login: "prorab" } });
  await prisma.siteAssignment.create({ data: { userId: prorab.id, siteId: site1.id } });

  console.log("Seed tayyor: direktor, hisobchi, prorab (parol — SEED_PASSWORD).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
