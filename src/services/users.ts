import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ServiceError, notFound } from "@/lib/errors";
import { cleanName } from "@/lib/normalize";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/password";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

const base = {
  name: z.string().transform(cleanName).pipe(z.string().min(1, "Исмни ёзинг").max(80)),
  role: z.enum(["DIRECTOR", "ACCOUNTANT", "FOREMAN"]),
  siteIds: z.array(z.number().int().positive()).default([]),
};

export const createUserSchema = z.object({
  ...base,
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Логин: 3–32 та лотин ҳарф, рақам, . _ -"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Парол камида ${MIN_PASSWORD_LENGTH} белги`),
});

export const updateUserSchema = z.object({
  ...base,
  isActive: z.boolean(),
  /** Bo'sh bo'lmasa — parol yangilanadi va barcha sessiyalar yopiladi. */
  newPassword: z.string().optional().transform((v) => v || undefined),
});

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
      isActive: true,
      createdAt: true,
      siteAssignments: { select: { site: { select: { id: true, name: true } } } },
    },
  });
}

/** Safe (parolsiz) ko'rinish — audit va javob uchun. */
function publicUser(u: { id: number; name: string; login: string; role: string; isActive: boolean }, siteIds: number[]) {
  return { id: u.id, name: u.name, login: u.login, role: u.role, isActive: u.isActive, siteIds };
}

export async function createUser(actor: SessionUser, input: z.infer<typeof createUserSchema>) {
  const exists = await prisma.user.findUnique({ where: { login: input.login } });
  if (exists) throw new ServiceError(`«${input.login}» логини банд`, 409);
  const passwordHash = await hashPassword(input.password);
  const siteIds = input.role === "FOREMAN" ? input.siteIds : [];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        login: input.login,
        passwordHash,
        role: input.role,
        siteAssignments: { create: siteIds.map((siteId) => ({ siteId })) },
      },
    });
    await writeAudit(tx, { userId: actor.id, action: "CREATE", entityType: "User", entityId: user.id, after: publicUser(user, siteIds) });
    return { id: user.id };
  });
}

export async function updateUser(actor: SessionUser, id: number, input: z.infer<typeof updateUserSchema>) {
  if (input.newPassword !== undefined && input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ServiceError(`Парол камида ${MIN_PASSWORD_LENGTH} белги`, 400);
  }
  if (id === actor.id && (!input.isActive || input.role !== actor.role)) {
    throw new ServiceError("Ўзингизни блоклаб ёки ролингизни ўзгартириб бўлмайди", 400);
  }
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined;
  const siteIds = input.role === "FOREMAN" ? input.siteIds : [];

  return prisma.$transaction(async (tx) => {
    const prev = await tx.user.findUnique({ where: { id }, include: { siteAssignments: true } });
    if (!prev) throw notFound("Фойдаланувчи топилмади");

    const user = await tx.user.update({
      where: { id },
      data: { name: input.name, role: input.role, isActive: input.isActive, ...(passwordHash ? { passwordHash } : {}) },
    });
    await tx.siteAssignment.deleteMany({ where: { userId: id } });
    if (siteIds.length) await tx.siteAssignment.createMany({ data: siteIds.map((siteId) => ({ userId: id, siteId })) });

    // Bloklansa yoki paroli yangilansa — ochiq sessiyalar darhol yopiladi
    if (!input.isActive || passwordHash) await tx.session.deleteMany({ where: { userId: id } });

    await writeAudit(tx, {
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      before: publicUser(prev, prev.siteAssignments.map((a) => a.siteId)),
      after: publicUser(user, siteIds),
    });
    if (passwordHash) {
      await writeAudit(tx, { userId: actor.id, action: "PASSWORD_RESET", entityType: "User", entityId: id });
    }
    return { id };
  });
}
