/**
 * Production'da birinchi (yoki qo'shimcha) foydalanuvchini yaratish:
 *   USER_LOGIN=direktor USER_NAME="Ism Familiya" USER_PASSWORD="..." [USER_ROLE=DIRECTOR] npm run create-user
 *
 * Parol faqat muhit o'zgaruvchisidan — hech qayerga yozilmaydi.
 * Ilova tashqarisidagi skript, shuning uchun Prisma'ni to'g'ridan-to'g'ri ishlatadi.
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.USER_LOGIN?.trim().toLowerCase();
  const name = process.env.USER_NAME?.trim();
  const password = process.env.USER_PASSWORD;
  const role = (process.env.USER_ROLE ?? "DIRECTOR") as Role;

  if (!login || !/^[a-z0-9._-]{3,32}$/.test(login)) throw new Error("USER_LOGIN: 3–32 ta lotin harf, raqam, . _ -");
  if (!name) throw new Error("USER_NAME berilmagan");
  if (!password || password.length < 12) throw new Error("USER_PASSWORD kamida 12 belgi bo'lsin");
  if (!["DIRECTOR", "ACCOUNTANT", "FOREMAN"].includes(role)) throw new Error("USER_ROLE: DIRECTOR | ACCOUNTANT | FOREMAN");
  if (await prisma.user.findUnique({ where: { login } })) throw new Error(`"${login}" allaqachon bor`);

  const user = await prisma.user.create({
    data: { login, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Yaratildi: #${user.id} ${user.login} (${user.role})`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
