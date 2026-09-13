import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ServiceError, notFound } from "@/lib/errors";
import { cleanName, nameKey } from "@/lib/normalize";
import { parseSom } from "@/lib/money";
import { UNIT_CODES } from "@/lib/units";
import { isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

/**
 * Spravochniklar: firma, hisob, kategoriya, material, kirim manbai.
 * Hech biri o'chirilmaydi — `isActive: false` (ro'yxatlarda ko'rinmaydi,
 * eski yozuvlarda nomi saqlanadi).
 */

export const REFERENCE_TYPES = ["companies", "accounts", "categories", "materials", "counterparties"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export function isReferenceType(value: string): value is ReferenceType {
  return (REFERENCE_TYPES as readonly string[]).includes(value);
}

const name = z.string().transform(cleanName).pipe(z.string().min(1, "Nomini kiriting").max(120));
const isActive = z.boolean().optional();

const schemas = {
  companies: z.object({ name, isActive }),
  accounts: z.object({
    name,
    type: z.enum(["BANK", "CASH", "PERSONAL"]),
    companyId: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
    openingBalance: z.string().default("0"),
    sortOrder: z.number().int().default(0),
    isActive,
  }),
  categories: z.object({ name, isMaterial: z.boolean().default(false), sortOrder: z.number().int().default(0), isActive }),
  materials: z.object({ name, unit: z.enum(UNIT_CODES, { message: "O'lchov birligini tanlang" }), isActive }),
  counterparties: z.object({
    name,
    kind: z.enum(["PAYER"]).default("PAYER"),
    phone: z.string().trim().max(30).nullable().optional().transform((v) => v || null),
    note: z.string().trim().max(300).nullable().optional().transform((v) => v || null),
    isActive,
  }),
};

const ENTITY: Record<ReferenceType, string> = {
  companies: "Company",
  accounts: "Account",
  categories: "Category",
  materials: "Material",
  counterparties: "Counterparty",
};

/** "-1 500 000" → -1500000n (boshlang'ich qoldiq manfiy bo'lishi mumkin). */
function parseSignedSom(input: string): bigint {
  const trimmed = input.trim();
  const negative = /^[-−]/.test(trimmed);
  const value = parseSom(negative ? trimmed.slice(1) : trimmed);
  if (value === null) throw new ServiceError("Boshlang'ich qoldiq noto'g'ri — faqat butun so'm", 400);
  return negative ? -value : value;
}

/** Yangi yozuv yaratish (id = null) yoki mavjudini tahrirlash. */
export async function saveReference(user: SessionUser, type: ReferenceType, id: number | null, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    let before: unknown = null;
    let after: unknown;

    switch (type) {
      case "companies": {
        const data = schemas.companies.parse(raw);
        if (id) {
          before = await tx.company.findUnique({ where: { id } });
          if (!before) throw notFound();
          after = await tx.company.update({ where: { id }, data });
        } else {
          after = await tx.company.create({ data });
        }
        break;
      }

      case "accounts": {
        const { openingBalance, ...rest } = schemas.accounts.parse(raw);
        const opening = parseSignedSom(openingBalance);
        if (rest.type !== "PERSONAL" && !rest.companyId) throw new ServiceError("Bank va kassa hisobi uchun firmani tanlang", 400);
        if (id) {
          const prev = await tx.account.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.openingBalance !== opening) {
            const used = await tx.entry.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });
            if (used > 0) throw new ServiceError("Hisobda yozuvlar bor — boshlang'ich qoldiqni endi o'zgartirib bo'lmaydi", 409);
          }
          after = await tx.account.update({ where: { id }, data: { ...rest, openingBalance: opening } });
        } else {
          after = await tx.account.create({ data: { ...rest, openingBalance: opening } });
        }
        break;
      }

      case "categories": {
        const data = schemas.categories.parse(raw);
        const clash = await tx.category.findFirst({
          where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
        });
        if (clash) throw new ServiceError(`"${clash.name}" kategoriyasi allaqachon bor`, 409);
        if (id) {
          const prev = await tx.category.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.isMaterial !== data.isMaterial && (await tx.entry.count({ where: { categoryId: id } })) > 0) {
            throw new ServiceError("Kategoriyada yozuvlar bor — \"material\" belgisini o'zgartirib bo'lmaydi", 409);
          }
          after = await tx.category.update({ where: { id }, data });
        } else {
          after = await tx.category.create({ data });
        }
        break;
      }

      case "materials": {
        const data = schemas.materials.parse(raw);
        const key = nameKey(data.name);
        const clash = await tx.material.findUnique({ where: { nameKey: key } });
        if (clash && clash.id !== id) {
          throw new ServiceError(
            `"${clash.name}" allaqachon bor${clash.isActive ? "" : " (o'chirilgan — uni qayta yoqing)"}. Ikkinchi marta qo'shilmaydi.`,
            409
          );
        }
        if (id) {
          const prev = await tx.material.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.unit !== data.unit && (await tx.entry.count({ where: { materialId: id } })) > 0) {
            throw new ServiceError("Materialda yozuvlar bor — o'lchov birligini o'zgartirib bo'lmaydi (eski miqdorlar noto'g'ri bo'lib qoladi)", 409);
          }
          after = await tx.material.update({ where: { id }, data: { ...data, nameKey: key } });
        } else {
          after = await tx.material.create({ data: { ...data, nameKey: key } });
        }
        break;
      }

      case "counterparties": {
        const data = schemas.counterparties.parse(raw);
        if (id) {
          before = await tx.counterparty.findUnique({ where: { id } });
          if (!before) throw notFound();
          after = await tx.counterparty.update({ where: { id }, data });
        } else {
          after = await tx.counterparty.create({ data });
        }
        break;
      }
    }

    const saved = after as { id: number };
    await writeAudit(tx, {
      userId: user.id,
      action: id ? "UPDATE" : "CREATE",
      entityType: ENTITY[type],
      entityId: saved.id,
      before,
      after,
    });
    return saved;
  });
}

// ───────────────────────────── Ro'yxatlar ─────────────────────────────

export async function listCompanies() {
  return prisma.company.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { accounts: true } } } });
}

export async function listAccounts() {
  return prisma.account.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { company: { select: { name: true } }, _count: { select: { entries: true, incomingTransfers: true } } },
  });
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { entries: true } } } });
}

export async function listMaterials() {
  return prisma.material.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { entries: true } } } });
}

export async function listCounterparties() {
  return prisma.counterparty.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { entries: true } } } });
}

// ───────────────────────────── Kiritish ekrani uchun tanlovlar ─────────────────────────────

export type Option = { id: number; name: string };
export type EntryOptions = {
  sites: Option[];
  accounts: Option[];
  categories: (Option & { isMaterial: boolean })[];
  materials: (Option & { unit: string })[];
  counterparties: Option[];
};

/** Faqat faol qiymatlar. Prorab faqat o'z ob'ektlarini ko'radi. */
export async function getEntryOptions(user: SessionUser): Promise<EntryOptions> {
  const [sites, accounts, categories, materials, counterparties] = await Promise.all([
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isOffice(user) ? {} : { id: { in: user.siteIds } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isMaterial: true },
    }),
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    isOffice(user)
      ? prisma.counterparty.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  return { sites, accounts, categories, materials, counterparties };
}

/** Jurnal filtrlari uchun — o'chirilganlar ham (eski yozuvlarni topish uchun). */
export async function getFilterOptions(user: SessionUser) {
  const office = isOffice(user);
  const [sites, accounts, categories, users] = await Promise.all([
    prisma.site.findMany({ where: office ? {} : { id: { in: user.siteIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    office ? prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    office ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return { sites, accounts, categories, users };
}
