import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { ServiceError, notFound } from "@/lib/errors";
import { cleanName, nameKey } from "@/lib/normalize";
import { parseSom } from "@/lib/money";
import { UNIT_CODES } from "@/lib/units";
import { isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

/**
 * Spravochniklar: firma, hisob, kategoriya, nom (material/xizmat), kontragent
 * (pul beruvchi yoki yetkazib beruvchi). Hech biri o'chirilmaydi —
 * `isActive: false` (ro'yxatlarda ko'rinmaydi, eski yozuvlarda nomi saqlanadi).
 */

export const REFERENCE_TYPES = ["companies", "accounts", "categories", "materials", "counterparties"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export function isReferenceType(value: string): value is ReferenceType {
  return (REFERENCE_TYPES as readonly string[]).includes(value);
}

const name = z.string().transform(cleanName).pipe(z.string().min(1, "Номини ёзинг").max(120));
const isActive = z.boolean().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);

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
  categories: z.object({ name, sortOrder: z.number().int().default(0), isActive }),
  materials: z.object({
    name,
    unit: z.enum(UNIT_CODES, { message: "Ўлчов бирлигини танланг" }),
    categoryId: z.number({ message: "Категорияни танланг" }).int().positive({ message: "Категорияни танланг" }),
    isActive,
  }),
  counterparties: z.object({
    name,
    kind: z.enum(["PAYER", "SUPPLIER"]).default("PAYER"),
    phone: optionalText(30),
    note: optionalText(300),
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
  if (value === null) throw new ServiceError("Бошланғич қолдиқ нотўғри — фақат бутун сўм", 400);
  return negative ? -value : value;
}

/** Bir xil nomdagi kontragent (shu turdagi) allaqachon bormi — kalit bo'yicha. */
async function assertCounterpartyUnique(tx: Tx, kind: "PAYER" | "SUPPLIER", title: string, id: number | null) {
  const key = nameKey(title);
  const same = await tx.counterparty.findMany({ where: { kind, ...(id ? { id: { not: id } } : {}) }, select: { name: true, isActive: true } });
  const clash = same.find((c) => nameKey(c.name) === key);
  if (clash) throw new ServiceError(`«${clash.name}» аллақачон бор${clash.isActive ? "" : " (ўчирилган — уни қайта ёқинг)"}`, 409);
}

/** Yangi yozuv yaratish (id = null) yoki mavjudini tahrirlash. */
export async function saveReference(user: SessionUser, type: ReferenceType, id: number | null, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    let before: unknown = null;
    let after: unknown;
    let reason: string | null = null;

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
        if (rest.type !== "PERSONAL" && !rest.companyId) throw new ServiceError("Банк ва касса ҳисоби учун фирмани танланг", 400);
        if (id) {
          const prev = await tx.account.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.openingBalance !== opening) {
            const used = await tx.entry.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });
            if (used > 0) throw new ServiceError("Ҳисобда ёзувлар бор — бошланғич қолдиқни энди ўзгартириб бўлмайди", 409);
          }
          after = await tx.account.update({ where: { id }, data: { ...rest, openingBalance: opening } });
        } else {
          after = await tx.account.create({ data: { ...rest, openingBalance: opening } });
        }
        break;
      }

      case "categories": {
        const data = schemas.categories.parse(raw);
        const all = await tx.category.findMany({ where: id ? { id: { not: id } } : {}, select: { name: true } });
        const clash = all.find((c) => nameKey(c.name) === nameKey(data.name));
        if (clash) throw new ServiceError(`«${clash.name}» категорияси аллақачон бор`, 409);
        if (id) {
          before = await tx.category.findUnique({ where: { id } });
          if (!before) throw notFound();
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
            `«${clash.name}» аллақачон бор${clash.isActive ? "" : " (ўчирилган — уни қайта ёқинг)"}. Иккинчи марта қўшилмайди.`,
            409
          );
        }
        if (!(await tx.category.findUnique({ where: { id: data.categoryId } }))) throw new ServiceError("Категория топилмади", 400);
        if (id) {
          const prev = await tx.material.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.unit !== data.unit && (await tx.entry.count({ where: { materialId: id } })) > 0) {
            throw new ServiceError("Бу ном ёзувларда ишлатилган — ўлчов бирлигини ўзгартириб бўлмайди (эски миқдорлар нотўғри бўлиб қолади)", 409);
          }
          if (prev.categoryId !== data.categoryId) {
            // Yozuvlardagi kategoriya ham yangilanadi (hisobot bir xil bo'lsin). Yopilgan oyning
            // hisoboti esa o'zgarmasligi shart — bunday yozuv bo'lsa, rad etiladi.
            const [closed] = await tx.$queryRaw<{ n: bigint }[]>`
              SELECT count(*) AS n FROM entries e
              JOIN closed_periods cp ON cp.month = date_trunc('month', e.date)::date
              WHERE e.material_id = ${id}`;
            if (closed.n > 0n) {
              throw new ServiceError("Бу ном ёпилган ойларда ишлатилган — категориясини ўзгартириб бўлмайди (ёпилган ой ҳисоботи ўзгариб кетади). Керак бўлса янги ном очинг.", 409);
            }
            const moved = await tx.entry.updateMany({ where: { materialId: id }, data: { categoryId: data.categoryId } });
            reason = `${moved.count} та ёзувнинг категорияси ҳам ўзгартирилди`;
          }
          after = await tx.material.update({ where: { id }, data: { ...data, nameKey: key } });
        } else {
          after = await tx.material.create({ data: { ...data, nameKey: key } });
        }
        break;
      }

      case "counterparties": {
        const data = schemas.counterparties.parse(raw);
        await assertCounterpartyUnique(tx, data.kind, data.name, id);
        if (id) {
          const prev = await tx.counterparty.findUnique({ where: { id } });
          if (!prev) throw notFound();
          before = prev;
          if (prev.kind !== data.kind && (await tx.entry.count({ where: { counterpartyId: id } })) > 0) {
            throw new ServiceError("Ёзувлари бор контрагентнинг турини ўзгартириб бўлмайди", 409);
          }
          after = await tx.counterparty.update({ where: { id }, data });
        } else {
          after = await tx.counterparty.create({ data });
        }
        break;
      }
    }

    const saved = after as { id: number; name: string };
    await writeAudit(tx, {
      userId: user.id,
      action: id ? "UPDATE" : "CREATE",
      entityType: ENTITY[type],
      entityId: saved.id,
      before,
      after,
      reason,
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
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { entries: true, items: true } } },
  });
}

export async function listMaterials() {
  return prisma.material.findMany({
    orderBy: { name: "asc" },
    include: { category: { select: { name: true } }, _count: { select: { entries: true } } },
  });
}

export async function listCounterparties(kind: "PAYER" | "SUPPLIER") {
  return prisma.counterparty.findMany({ where: { kind }, orderBy: { name: "asc" }, include: { _count: { select: { entries: true } } } });
}

// ───────────────────────────── Kunlik daftar uchun tanlovlar ─────────────────────────────

export type Option = { id: number; name: string };
export type ItemOption = Option & { unit: string; categoryId: number | null };
export type EntryOptions = {
  sites: Option[];
  accounts: Option[];
  categories: Option[];
  items: ItemOption[];
  suppliers: Option[];
  payers: Option[];
};

/** Faqat faol qiymatlar. Prorab faqat o'z ob'ektlarini ko'radi, pul beruvchilarni ko'rmaydi. */
export async function getEntryOptions(user: SessionUser): Promise<EntryOptions> {
  const office = isOffice(user);
  const [sites, accounts, categories, items, counterparties] = await Promise.all([
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(office ? {} : { id: { in: user.siteIds } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, categoryId: true },
    }),
    prisma.counterparty.findMany({
      where: { isActive: true, ...(office ? {} : { kind: "SUPPLIER" }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
  ]);
  return {
    sites,
    accounts,
    categories,
    items,
    suppliers: counterparties.filter((c) => c.kind === "SUPPLIER").map(({ id, name }) => ({ id, name })),
    payers: counterparties.filter((c) => c.kind === "PAYER").map(({ id, name }) => ({ id, name })),
  };
}

/** Jurnal filtrlari uchun — o'chirilganlar ham (eski yozuvlarni topish uchun). */
export async function getFilterOptions(user: SessionUser) {
  const office = isOffice(user);
  const [sites, accounts, categories, users, counterparties] = await Promise.all([
    prisma.site.findMany({ where: office ? {} : { id: { in: user.siteIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    office ? prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    office ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.counterparty.findMany({ where: office ? {} : { kind: "SUPPLIER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { sites, accounts, categories, users, counterparties };
}
