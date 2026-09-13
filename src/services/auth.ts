import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getDummyHash, verifyPassword } from "@/lib/password";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 kun

/** Bazada tokenning o'zi emas, hashi saqlanadi — baza sizib chiqsa ham sessiyani o'g'irlab bo'lmaydi. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Login + parolni tekshiradi. Muvaffaqiyatli bo'lsa yangi sessiya ochadi va
 * cookie uchun tokenni qaytaradi. Bloklangan hisob — xuddi noto'g'ri parol
 * kabi rad etiladi (hisob borligini oshkor qilmaslik uchun).
 */
export async function login(loginName: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const user = await prisma.user.findUnique({
    where: { login: loginName.trim().toLowerCase() },
    include: { siteAssignments: { select: { siteId: true } } },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok || !user.isActive) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    await writeAudit(tx, { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });
  });

  return {
    token,
    user: { id: user.id, name: user.name, role: user.role, siteIds: user.siteAssignments.map((a) => a.siteId) },
  };
}

/**
 * Token bo'yicha sessiya egasini qaytaradi. Rol, faollik va ob'ektlar HAR
 * SAFAR bazadan olinadi — bloklangan yoki roli o'zgargan foydalanuvchi eski
 * sessiya bilan eski huquqlarini saqlab qolmaydi.
 */
export async function getUserByToken(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: { include: { siteAssignments: { select: { siteId: true } } } },
    },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
  const u = session.user;
  return { id: u.id, name: u.name, role: u.role, siteIds: u.siteAssignments.map((a) => a.siteId) };
}

export async function logout(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Muddati o'tgan sessiyalarni tozalash — login paytida vaqti-vaqti bilan chaqiriladi. */
export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
