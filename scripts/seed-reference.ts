/**
 * Qurilish firmasi uchun odatiy spravochnik: kategoriya va nomlar ro'yxati.
 * Haqiqiy ma'lumot (DEMO emas) — ishga tushirilgandan keyin ham qoladi.
 *
 * Idempotent: kategoriya nomi bo'yicha, nom esa nameKey bo'yicha tekshiriladi —
 * qayta ishga tushirilsa, borlari o'tkazib yuboriladi, yangilari qo'shiladi.
 * Faqat Category va Material jadvallariga yozadi.
 *
 * Ishlatish: npm run seed-reference
 */
import { PrismaClient } from "@prisma/client";
import { nameKey } from "../src/lib/normalize";

const prisma = new PrismaClient();

const CATEGORIES = [
  "Материал",
  "Иш ҳақи",
  "Транспорт",
  "Техника арендаси",
  "Ёқилғи",
  "Овқат",
  "Коммунал",
  "Ижара",
  "Солиқ ва расмий",
  "Бошқа",
] as const;

// [nom, birlik kodi, kategoriya]
const MATERIALS: [string, string, (typeof CATEGORIES)[number]][] = [
  // Материал
  ["Цемент М400", "qop", "Материал"],
  ["Цемент М500", "qop", "Материал"],
  ["Бетон 200 марка", "m3", "Материал"],
  ["Бетон 250 марка", "m3", "Материал"],
  ["Бетон 300 марка", "m3", "Материал"],
  ["Қум", "m3", "Материал"],
  ["Шағал", "m3", "Материал"],
  ["Шебень", "m3", "Материал"],
  ["Ғишт", "dona", "Материал"],
  ["Блок (пеноблок)", "dona", "Материал"],
  ["Арматура 8 лик", "kg", "Материал"],
  ["Арматура 10 лик", "kg", "Материал"],
  ["Арматура 12 лик", "kg", "Материал"],
  ["Арматура 14 лик", "kg", "Материал"],
  ["Сим (боғлаш учун)", "kg", "Материал"],
  ["Мих", "kg", "Материал"],
  ["Тахта", "m3", "Материал"],
  ["Фанера", "list", "Материал"],
  ["Профнастил", "list", "Материал"],
  ["Шифер", "list", "Материал"],
  ["Металл профиль", "m", "Материал"],
  ["Гипсокартон", "list", "Материал"],
  ["Шпаклёвка", "qop", "Материал"],
  ["Гипс (алебастр)", "qop", "Материал"],
  ["Оҳак", "qop", "Материал"],
  ["Бўёқ", "kg", "Материал"],
  ["Грунтовка", "l", "Материал"],
  ["Плитка", "m2", "Материал"],
  ["Плитка елими", "qop", "Материал"],
  ["Пенопласт", "list", "Материал"],
  ["Утеплитель", "rulon", "Материал"],
  ["Гидроизоляция", "rulon", "Материал"],
  ["Канализация қувури", "m", "Материал"],
  ["Сув қувури", "m", "Материал"],
  ["Электр кабель", "m", "Материал"],
  ["Розетка ва выключатель", "dona", "Материал"],
  ["Эшик", "dona", "Материал"],
  ["Дераза", "dona", "Материал"],
  ["Турли материал", "xizmat", "Материал"],
  // Иш ҳақи
  ["Усталарга тўлов", "xizmat", "Иш ҳақи"],
  ["Ишчиларга кунлик тўлов", "kun", "Иш ҳақи"],
  ["Бетончиларга тўлов", "xizmat", "Иш ҳақи"],
  ["Сувоқчиларга тўлов", "xizmat", "Иш ҳақи"],
  ["Электрикка тўлов", "xizmat", "Иш ҳақи"],
  ["Сантехникка тўлов", "xizmat", "Иш ҳақи"],
  ["Авансом (ишчига)", "xizmat", "Иш ҳақи"],
  // Транспорт
  ["Юк ташиш", "reys", "Транспорт"],
  ["Бетон ташиш (миксер)", "reys", "Транспорт"],
  ["Самосвал", "reys", "Транспорт"],
  // Техника арендаси
  ["Кран арендаси", "soat", "Техника арендаси"],
  ["Экскаватор арендаси", "soat", "Техника арендаси"],
  ["Погрузчик арендаси", "soat", "Техника арендаси"],
  ["Бетон насос", "soat", "Техника арендаси"],
  ["Леса (опалубка) ижараси", "kun", "Техника арендаси"],
  // Ёқилғи
  ["Бензин", "l", "Ёқилғи"],
  ["Дизель", "l", "Ёқилғи"],
  ["Газ (метан)", "m3", "Ёқилғи"],
  // Овқат
  ["Ишчиларга овқат", "kishi", "Овқат"],
  ["Чой-нон", "xizmat", "Овқат"],
  // Коммунал
  ["Электр энергия", "xizmat", "Коммунал"],
  ["Сув", "xizmat", "Коммунал"],
  ["Газ (коммунал)", "xizmat", "Коммунал"],
  ["Интернет ва алоқа", "xizmat", "Коммунал"],
  // Ижара
  ["Вагон (ишчилар учун) ижараси", "kun", "Ижара"],
  ["Склад ижараси", "kun", "Ижара"],
  // Солиқ ва расмий
  ["Солиқ", "xizmat", "Солиқ ва расмий"],
  ["Банк хизмати", "xizmat", "Солиқ ва расмий"],
  ["Рухсатнома ва ҳужжат", "xizmat", "Солиқ ва расмий"],
  // Бошқа
  ["Турли харажат", "xizmat", "Бошқа"],
  ["Асбоб-ускуна", "dona", "Бошқа"],
  ["Таъмир (техника)", "xizmat", "Бошқа"],
];

async function main() {
  const categoryIds: Record<string, number> = {};
  let categoriesCreated = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i];
    const existing = await prisma.category.findUnique({ where: { name } });
    const c = existing ?? (await prisma.category.create({ data: { name, sortOrder: i + 1 } }));
    if (!existing) categoriesCreated++;
    categoryIds[name] = c.id;
  }

  let materialsCreated = 0;
  for (const [name, unit, category] of MATERIALS) {
    const key = nameKey(name);
    const existing = await prisma.material.findUnique({ where: { nameKey: key } });
    if (existing) continue;
    await prisma.material.create({
      data: { name, nameKey: key, unit, categoryId: categoryIds[category] },
    });
    materialsCreated++;
  }

  console.log(`Категория: ${categoriesCreated} та янги қўшилди (жами ${CATEGORIES.length} та текширилди).`);
  console.log(`Ном: ${materialsCreated} та янги қўшилди (жами ${MATERIALS.length} та текширилди).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
