import { Prisma, type EntryKind, type EntryStatus } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { MAX_AMOUNT, computeAmount, formatSom, parseQuantityMilli, parseSom, quantityMilliToString } from "@/lib/money";
import { dbDateToIso, isValidIsoDate, isoToDbDate } from "@/lib/dates";
import { canCreateEntry, canModifyEntry, isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { writeAudit, getAuditTrail, type AuditRow } from "@/services/audit";
import { assertDateWritable } from "@/services/periods";

// ───────────────────────────── Kirish ma'lumoti ─────────────────────────────

const optionalId = z.number().int().positive().nullable().optional().transform((v) => v ?? null);

/**
 * API'ga keladigan yozuv. Pul va miqdor MATN ko'rinishida keladi — JSON'dagi
 * number float bo'lgani uchun katta summalarda aniqlik yo'qolishi mumkin.
 */
export const entryInputSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.string(),
  siteId: optionalId,
  accountId: z.number().int().positive({ message: "Hisob tanlanmagan" }),
  toAccountId: optionalId,
  categoryId: optionalId,
  materialId: optionalId,
  counterpartyId: optionalId,
  quantity: z.string().default("1"),
  unitPrice: z.string(),
  note: z.string().max(500).nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

type NormalizedEntry = {
  kind: EntryKind;
  date: string;
  siteId: number | null;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  materialId: number | null;
  counterpartyId: number | null;
  quantityMilli: bigint;
  unitPrice: bigint;
  amount: bigint;
  note: string | null;
};

// ───────────────────────────── Chiqish (DTO) ─────────────────────────────

const entryInclude = {
  site: { select: { name: true } },
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  category: { select: { name: true } },
  material: { select: { name: true, unit: true } },
  counterparty: { select: { name: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  cancelledBy: { select: { name: true } },
} satisfies Prisma.EntryInclude;

type EntryWithRelations = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

/** Brauzerga yuboriladigan yozuv. BigInt'lar matn — aniqlik yo'qolmasin. */
export type EntryRow = {
  id: number;
  kind: EntryKind;
  status: EntryStatus;
  date: string;
  siteId: number | null;
  siteName: string | null;
  accountId: number | null;
  accountName: string | null;
  toAccountId: number | null;
  toAccountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  materialId: number | null;
  materialName: string | null;
  unit: string | null;
  counterpartyId: number | null;
  counterpartyName: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  note: string | null;
  createdById: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  /** Joriy foydalanuvchi shu yozuvni tuzata/bekor qila oladimi (oy yopiqligi alohida tekshiriladi). */
  canModify: boolean;
};

function toRow(e: EntryWithRelations, user: SessionUser): EntryRow {
  return {
    id: e.id,
    kind: e.kind,
    status: e.status,
    date: dbDateToIso(e.date),
    siteId: e.siteId,
    siteName: e.site?.name ?? null,
    accountId: e.accountId,
    accountName: e.account?.name ?? null,
    toAccountId: e.toAccountId,
    toAccountName: e.toAccount?.name ?? null,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    materialId: e.materialId,
    materialName: e.material?.name ?? null,
    unit: e.material?.unit ?? null,
    counterpartyId: e.counterpartyId,
    counterpartyName: e.counterparty?.name ?? null,
    quantity: e.quantity.toString(),
    unitPrice: e.unitPrice.toString(),
    amount: e.amount.toString(),
    note: e.note,
    createdById: e.createdById,
    createdByName: e.createdBy.name,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt?.toISOString() ?? null,
    updatedByName: e.updatedBy?.name ?? null,
    cancelledAt: e.cancelledAt?.toISOString() ?? null,
    cancelledByName: e.cancelledBy?.name ?? null,
    cancelReason: e.cancelReason,
    canModify: e.status === "ACTIVE" && canModifyEntry(user, e),
  };
}

/** Audit uchun surat: id'lar bilan birga o'sha paytdagi nomlar ham (keyin nom o'zgarsa ham tarix o'qiladi). */
function snapshot(e: EntryWithRelations) {
  return {
    kind: e.kind,
    status: e.status,
    date: dbDateToIso(e.date),
    site: e.site ? { id: e.siteId, name: e.site.name } : null,
    account: e.account ? { id: e.accountId, name: e.account.name } : null,
    toAccount: e.toAccount ? { id: e.toAccountId, name: e.toAccount.name } : null,
    category: e.category ? { id: e.categoryId, name: e.category.name } : null,
    material: e.material ? { id: e.materialId, name: e.material.name, unit: e.material.unit } : null,
    counterparty: e.counterparty ? { id: e.counterpartyId, name: e.counterparty.name } : null,
    quantity: e.quantity.toString(),
    unitPrice: e.unitPrice.toString(),
    amount: e.amount.toString(),
    note: e.note,
  };
}

// ───────────────────────────── Tekshiruv ─────────────────────────────

/**
 * Kiritilgan ma'lumotni tekshiradi va summani hisoblaydi. Tuzatishda
 * `prev` beriladi: o'zgarmagan bog'lanish (masalan keyin arxivlangan
 * material) qayta tekshirilmaydi — eski yozuvning izohini tuzatib bo'lsin.
 */
async function normalizeEntry(
  tx: Tx,
  user: SessionUser,
  input: EntryInput,
  prev: EntryWithRelations | null
): Promise<NormalizedEntry> {
  if (!isValidIsoDate(input.date)) throw new ServiceError("Sana noto'g'ri", 400);
  await assertDateWritable(tx, input.date);

  const quantityMilli = parseQuantityMilli(input.quantity);
  if (quantityMilli === null || quantityMilli <= 0n) {
    throw new ServiceError("Miqdor noto'g'ri (musbat son, verguldan keyin ko'pi bilan 3 raqam)", 400);
  }
  const unitPrice = parseSom(input.unitPrice);
  if (unitPrice === null) throw new ServiceError("Narx noto'g'ri — faqat butun so'm", 400);
  const amount = computeAmount(quantityMilli, unitPrice);
  if (amount <= 0n) throw new ServiceError("Summa 0 bo'lishi mumkin emas", 400);
  if (amount > MAX_AMOUNT) throw new ServiceError(`Summa juda katta: ${formatSom(amount)} so'm`, 400);

  const e: NormalizedEntry = {
    kind: input.kind,
    date: input.date,
    siteId: input.siteId,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    categoryId: input.categoryId,
    materialId: input.materialId,
    counterpartyId: input.counterpartyId,
    quantityMilli,
    unitPrice,
    amount,
    note: input.note,
  };

  const changed = (field: "siteId" | "accountId" | "toAccountId" | "categoryId" | "materialId" | "counterpartyId") =>
    !prev || prev[field] !== e[field];

  // Tur bo'yicha majburiy/taqiqlangan maydonlar (DB'da ham CHECK bor)
  if (e.kind === "EXPENSE") {
    if (!e.siteId) throw new ServiceError("Ob'ekt tanlanmagan", 400);
    if (!e.categoryId) throw new ServiceError("Kategoriya tanlanmagan", 400);
    e.toAccountId = null;
    e.counterpartyId = null;
  } else if (e.kind === "INCOME") {
    if (!e.siteId) throw new ServiceError("Ob'ekt tanlanmagan", 400);
    if (!e.counterpartyId) throw new ServiceError("Kimdan kelgani tanlanmagan", 400);
    e.categoryId = null;
    e.materialId = null;
    e.toAccountId = null;
  } else {
    if (!e.toAccountId) throw new ServiceError("Qaysi hisobga o'tkazilgani tanlanmagan", 400);
    if (e.toAccountId === e.accountId) throw new ServiceError("Bir hisobning o'ziga o'tkazib bo'lmaydi", 400);
    e.siteId = null;
    e.categoryId = null;
    e.materialId = null;
    e.counterpartyId = null;
  }
  if (e.kind !== "EXPENSE" && quantityMilli !== 1000n) {
    throw new ServiceError("Kirim va o'tkazmada miqdor 1 bo'ladi", 400);
  }

  if (!canCreateEntry(user, e.kind, e.siteId)) {
    throw forbidden(e.kind === "EXPENSE" ? "Bu ob'ektga yozuv kiritish huquqingiz yo'q" : "Bu turdagi yozuvni kiritish huquqingiz yo'q");
  }

  if (e.siteId && changed("siteId")) {
    const site = await tx.site.findUnique({ where: { id: e.siteId } });
    if (!site) throw new ServiceError("Ob'ekt topilmadi", 400);
    if (site.status !== "ACTIVE") throw new ServiceError(`"${site.name}" arxivda — yangi yozuv qabul qilmaydi`, 400);
  }

  for (const [field, label] of [["accountId", "Hisob"], ["toAccountId", "Qabul qiluvchi hisob"]] as const) {
    const id = e[field];
    if (id && changed(field)) {
      const acc = await tx.account.findUnique({ where: { id } });
      if (!acc) throw new ServiceError(`${label} topilmadi`, 400);
      if (!acc.isActive) throw new ServiceError(`${label} "${acc.name}" yopilgan`, 400);
    }
  }

  if (e.categoryId) {
    const cat = await tx.category.findUnique({ where: { id: e.categoryId } });
    if (!cat) throw new ServiceError("Kategoriya topilmadi", 400);
    if (!cat.isActive && changed("categoryId")) throw new ServiceError(`"${cat.name}" kategoriyasi o'chirilgan`, 400);
    if (cat.isMaterial) {
      if (!e.materialId) throw new ServiceError("Material ro'yxatdan tanlanishi shart", 400);
    } else {
      e.materialId = null;
    }
  }

  if (e.materialId && changed("materialId")) {
    const mat = await tx.material.findUnique({ where: { id: e.materialId } });
    if (!mat) throw new ServiceError("Material topilmadi", 400);
    if (!mat.isActive) throw new ServiceError(`"${mat.name}" materiali o'chirilgan`, 400);
  }

  if (e.counterpartyId && changed("counterpartyId")) {
    const cp = await tx.counterparty.findUnique({ where: { id: e.counterpartyId } });
    if (!cp) throw new ServiceError("Kontragent topilmadi", 400);
    if (!cp.isActive) throw new ServiceError(`"${cp.name}" o'chirilgan`, 400);
  }

  return e;
}

function toData(e: NormalizedEntry) {
  return {
    kind: e.kind,
    date: isoToDbDate(e.date),
    siteId: e.siteId,
    accountId: e.accountId,
    toAccountId: e.toAccountId,
    categoryId: e.categoryId,
    materialId: e.materialId,
    counterpartyId: e.counterpartyId,
    quantity: new Prisma.Decimal(quantityMilliToString(e.quantityMilli)),
    unitPrice: e.unitPrice,
    amount: e.amount,
    note: e.note,
  };
}

// ───────────────────────────── Takrorlanish ─────────────────────────────

export type DuplicateInfo = { id: number; description: string; createdByName: string; createdAt: string };

/**
 * Bir xil sana + summa + ob'ekt (o'tkazmada: sana + summa + ikkala hisob).
 * Topilsa ogohlantirish — to'xtatmaydi: foydalanuvchi tasdiqlasa saqlanadi.
 */
async function findDuplicates(tx: Tx, e: NormalizedEntry, excludeId?: number): Promise<DuplicateInfo[]> {
  const rows = await tx.entry.findMany({
    where: {
      status: "ACTIVE",
      date: isoToDbDate(e.date),
      amount: e.amount,
      ...(e.kind === "TRANSFER"
        ? { kind: "TRANSFER", accountId: e.accountId, toAccountId: e.toAccountId }
        : { siteId: e.siteId, kind: { not: "TRANSFER" } }),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: entryInclude,
    orderBy: { id: "desc" },
    take: 5,
  });
  return rows.map((r) => ({
    id: r.id,
    description: [r.category?.name, r.material?.name, r.counterparty?.name, r.note]
      .filter(Boolean)
      .join(" · "),
    createdByName: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

function duplicateError(dups: DuplicateInfo[]) {
  const list = dups.map((d) => `#${d.id}`).join(", ");
  return new ServiceError(`O'xshash yozuv bor (${list}): shu sana, summa va ob'ekt. Baribir saqlansinmi?`, 409, "DUPLICATE", {
    duplicates: dups,
  });
}

// ───────────────────────────── Yaratish / tuzatish / bekor qilish ─────────────────────────────

export async function createEntry(user: SessionUser, input: EntryInput, opts: { allowDuplicate: boolean }): Promise<EntryRow> {
  return prisma.$transaction(async (tx) => {
    const e = await normalizeEntry(tx, user, input, null);

    if (!opts.allowDuplicate) {
      const dups = await findDuplicates(tx, e);
      if (dups.length) throw duplicateError(dups);
    }

    const created = await tx.entry.create({
      data: { ...toData(e), createdById: user.id },
      include: entryInclude,
    });
    await writeAudit(tx, { userId: user.id, action: "CREATE", entityType: "Entry", entityId: created.id, after: snapshot(created) });
    return toRow(created, user);
  });
}

export async function updateEntry(
  user: SessionUser,
  id: number,
  input: EntryInput,
  opts: { allowDuplicate: boolean }
): Promise<EntryRow> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.entry.findUnique({ where: { id }, include: entryInclude });
    if (!prev) throw notFound("Yozuv topilmadi");
    if (prev.status !== "ACTIVE") throw new ServiceError("Bekor qilingan yozuvni tuzatib bo'lmaydi", 409);
    if (!canModifyEntry(user, prev)) {
      throw forbidden(isOffice(user) ? undefined : "O'z yozuvingizni faqat 24 soat ichida tuzata olasiz");
    }
    if (input.kind !== prev.kind) throw new ServiceError("Yozuv turini o'zgartirib bo'lmaydi — bekor qilib, yangisini kiriting", 400);

    // Eski sana ham, yangi sana ham ochiq oyda bo'lishi shart
    await assertDateWritable(tx, dbDateToIso(prev.date));
    const e = await normalizeEntry(tx, user, input, prev);

    const keyChanged =
      dbDateToIso(prev.date) !== e.date || prev.amount !== e.amount || prev.siteId !== e.siteId ||
      prev.accountId !== e.accountId || prev.toAccountId !== e.toAccountId;
    if (keyChanged && !opts.allowDuplicate) {
      const dups = await findDuplicates(tx, e, id);
      if (dups.length) throw duplicateError(dups);
    }

    const updated = await tx.entry.update({
      where: { id },
      data: { ...toData(e), updatedById: user.id, updatedAt: new Date() },
      include: entryInclude,
    });

    const before = snapshot(prev);
    const after = snapshot(updated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await writeAudit(tx, { userId: user.id, action: "UPDATE", entityType: "Entry", entityId: id, before, after });
    }
    return toRow(updated, user);
  });
}

export async function cancelEntry(user: SessionUser, id: number, reason: string): Promise<EntryRow> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new ServiceError("Bekor qilish sababini yozing", 400);

  return prisma.$transaction(async (tx) => {
    const prev = await tx.entry.findUnique({ where: { id }, include: entryInclude });
    if (!prev) throw notFound("Yozuv topilmadi");
    if (prev.status !== "ACTIVE") throw new ServiceError("Yozuv allaqachon bekor qilingan", 409);
    if (!canModifyEntry(user, prev)) {
      throw forbidden(isOffice(user) ? undefined : "O'z yozuvingizni faqat 24 soat ichida bekor qila olasiz");
    }
    await assertDateWritable(tx, dbDateToIso(prev.date));

    const updated = await tx.entry.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id, cancelReason: cleanReason },
      include: entryInclude,
    });
    await writeAudit(tx, {
      userId: user.id,
      action: "CANCEL",
      entityType: "Entry",
      entityId: id,
      before: snapshot(prev),
      reason: cleanReason,
    });
    return toRow(updated, user);
  });
}

// ───────────────────────────── O'qish ─────────────────────────────

export type EntryFilters = {
  siteId?: number;
  accountId?: number;
  categoryId?: number;
  materialId?: number;
  createdById?: number;
  kind?: EntryKind;
  status: "ACTIVE" | "CANCELLED" | "ALL";
  from?: string;
  to?: string;
  q?: string;
};

/** URL parametrlari → filtrlar. Noto'g'ri qiymat shunchaki e'tiborsiz qoldiriladi. */
export function parseEntryFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): EntryFilters {
  const get = (key: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(key) : params[key];
    const s = Array.isArray(v) ? v[0] : v;
    return s ? s : undefined;
  };
  const id = (key: string) => {
    const n = Number(get(key));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const date = (key: string) => {
    const s = get(key);
    return s && isValidIsoDate(s) ? s : undefined;
  };
  const kind = get("kind");
  const status = get("status");
  return {
    siteId: id("siteId"),
    accountId: id("accountId"),
    categoryId: id("categoryId"),
    materialId: id("materialId"),
    createdById: id("createdById"),
    kind: kind === "INCOME" || kind === "EXPENSE" || kind === "TRANSFER" ? kind : undefined,
    status: status === "CANCELLED" || status === "ALL" ? status : "ACTIVE",
    from: date("from"),
    to: date("to"),
    q: get("q")?.trim().slice(0, 100) || undefined,
  };
}

function buildWhere(user: SessionUser, f: EntryFilters): Prisma.EntryWhereInput {
  const and: Prisma.EntryWhereInput[] = [];

  // Prorab: faqat o'z ob'ektlari chiqimi. Kirim va o'tkazmalar ko'rinmaydi.
  if (!isOffice(user)) and.push({ kind: "EXPENSE", siteId: { in: user.siteIds } });

  if (f.status !== "ALL") and.push({ status: f.status });
  if (f.siteId) and.push({ siteId: f.siteId });
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.materialId) and.push({ materialId: f.materialId });
  if (f.createdById) and.push({ createdById: f.createdById });
  if (f.kind) and.push({ kind: f.kind });
  if (f.from) and.push({ date: { gte: isoToDbDate(f.from) } });
  if (f.to) and.push({ date: { lte: isoToDbDate(f.to) } });
  if (f.q) {
    and.push({
      OR: [
        { note: { contains: f.q, mode: "insensitive" } },
        { material: { name: { contains: f.q, mode: "insensitive" } } },
        { counterparty: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export type JournalResult = {
  rows: EntryRow[];
  total: number;
  /** Faqat faol yozuvlar bo'yicha jami (bekor qilinganlar hisobga kirmaydi). */
  sums: { income: string; expense: string; transfer: string };
};

export async function listEntries(user: SessionUser, f: EntryFilters, page: number, pageSize: number): Promise<JournalResult> {
  const where = buildWhere(user, f);
  const [rows, total, sums] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.entry.count({ where }),
    prisma.entry.groupBy({ by: ["kind"], where: { AND: [where, { status: "ACTIVE" }] }, _sum: { amount: true } }),
  ]);
  const sumOf = (k: EntryKind) => (sums.find((s) => s.kind === k)?._sum.amount ?? 0n).toString();
  return {
    rows: rows.map((r) => toRow(r, user)),
    total,
    sums: { income: sumOf("INCOME"), expense: sumOf("EXPENSE"), transfer: sumOf("TRANSFER") },
  };
}

/** Excel eksport uchun — sahifalashsiz (xavfsizlik uchun 100 000 qator chegarasi). */
export async function listEntriesForExport(user: SessionUser, f: EntryFilters): Promise<EntryRow[]> {
  const rows = await prisma.entry.findMany({
    where: buildWhere(user, f),
    include: entryInclude,
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: 100_000,
  });
  return rows.map((r) => toRow(r, user));
}

/**
 * Kiritish jadvali uchun: tanlangan sarlavha (ob'ekt + hisob + sana) bo'yicha
 * mavjud faol yozuvlar. Jadval ularni ko'rsatadi va shu yerning o'zida tuzatiladi.
 */
export async function listEntriesForGrid(
  user: SessionUser,
  header: { kind: EntryKind; date: string; siteId: number | null; accountId: number }
): Promise<EntryRow[]> {
  if (!isValidIsoDate(header.date)) throw new ServiceError("Sana noto'g'ri", 400);
  if (header.kind !== "EXPENSE" && !isOffice(user)) throw forbidden();
  if (header.kind !== "TRANSFER" && header.siteId && !isOffice(user) && !user.siteIds.includes(header.siteId)) throw forbidden();

  const rows = await prisma.entry.findMany({
    where: {
      status: "ACTIVE",
      kind: header.kind,
      date: isoToDbDate(header.date),
      accountId: header.accountId,
      ...(header.kind === "TRANSFER" ? {} : { siteId: header.siteId }),
    },
    include: entryInclude,
    orderBy: { id: "asc" },
  });
  return rows.map((r) => toRow(r, user));
}

export async function getEntryDetail(user: SessionUser, id: number): Promise<{ entry: EntryRow; audit: AuditRow[] }> {
  const e = await prisma.entry.findUnique({ where: { id }, include: entryInclude });
  if (!e) throw notFound("Yozuv topilmadi");
  if (!isOffice(user) && !(e.kind === "EXPENSE" && e.siteId && user.siteIds.includes(e.siteId))) throw notFound("Yozuv topilmadi");
  const audit = isOffice(user) ? await getAuditTrail(prisma, "Entry", id) : [];
  return { entry: toRow(e, user), audit };
}
