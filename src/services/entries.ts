import { Prisma, type EntryKind, type EntryStatus } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { MAX_AMOUNT, computeAmount, formatSom, parseQuantityMilli, parseSom, quantityMilliToString } from "@/lib/money";
import { dbDateToIso, isValidIsoDate, isoToDbDate } from "@/lib/dates";
import { SITE_EXPENSE_KINDS, canCreateEntry, canModifyEntry, isOffice, isSiteExpense } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { writeAudit, getAuditTrail, type AuditRow } from "@/services/audit";
import { assertDateWritable } from "@/services/periods";

// ───────────────────────────── Kirish ma'lumoti ─────────────────────────────

const optionalId = z.number().int().positive().nullable().optional().transform((v) => v ?? null);
const optionalText = (max: number) =>
  z.string().max(max).nullable().optional().transform((v) => (v?.trim() ? v.trim() : null));

/**
 * API'ga keladigan yozuv. Pul va miqdor MATN ko'rinishida keladi — JSON'dagi
 * number float bo'lgani uchun katta summalarda aniqlik yo'qolishi mumkin.
 *
 * `amount` — haqiqatda to'langan summa. Berilmasa = round(miqdor × narx).
 * Farq qilsa (chegirma, yaxlitlash) `adjustReason` majburiy.
 */
export const entryInputSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE", "TRANSFER", "SUPPLIER_PAYMENT", "GOODS_RECEIPT"]),
  date: z.string(),
  siteId: optionalId,
  accountId: optionalId,
  toAccountId: optionalId,
  materialId: optionalId,
  counterpartyId: optionalId,
  quantity: z.string().default("1"),
  unitPrice: z.string(),
  amount: optionalText(20),
  adjustReason: optionalText(200),
  note: optionalText(500),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

type NormalizedEntry = {
  kind: EntryKind;
  date: string;
  siteId: number | null;
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  materialId: number | null;
  counterpartyId: number | null;
  quantityMilli: bigint;
  unitPrice: bigint;
  amount: bigint;
  adjustReason: string | null;
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
  adjustReason: string | null;
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
    adjustReason: e.adjustReason,
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
    adjustReason: e.adjustReason,
    note: e.note,
  };
}

// ───────────────────────────── Tekshiruv ─────────────────────────────

type RefField = "siteId" | "accountId" | "toAccountId" | "materialId" | "counterpartyId";

/**
 * Kiritilgan ma'lumotni tekshiradi va summani aniqlaydi. Tuzatishda `prev`
 * beriladi: o'zgarmagan bog'lanish (masalan keyin o'chirilgan nom) qayta
 * tekshirilmaydi — eski yozuvning izohini tuzatib bo'lsin.
 */
async function normalizeEntry(
  tx: Tx,
  user: SessionUser,
  input: EntryInput,
  prev: EntryWithRelations | null
): Promise<NormalizedEntry> {
  if (!isValidIsoDate(input.date)) throw new ServiceError("Сана нотўғри", 400);
  await assertDateWritable(tx, input.date);

  const quantityMilli = parseQuantityMilli(input.quantity);
  if (quantityMilli === null || quantityMilli <= 0n) {
    throw new ServiceError("Миқдор нотўғри (мусбат сон, вергулдан кейин кўпи билан 3 рақам)", 400);
  }
  const unitPrice = parseSom(input.unitPrice);
  if (unitPrice === null) throw new ServiceError("Нарх нотўғри — фақат бутун сўм", 400);

  // To'langan summa — asosiy fakt. Farq bo'lsa sababi majburiy.
  const computed = computeAmount(quantityMilli, unitPrice);
  let amount = computed;
  let adjustReason: string | null = null;
  if (input.amount !== null) {
    const paid = parseSom(input.amount);
    if (paid === null) throw new ServiceError("Сумма нотўғри — фақат бутун сўм", 400);
    amount = paid;
    if (paid !== computed) {
      if (!input.adjustReason) {
        throw new ServiceError(
          `Сумма миқдор × нархдан фарқ қилади (${formatSom(computed)} ўрнига ${formatSom(paid)}) — сабабини ёзинг`,
          400,
          "ADJUST_REASON"
        );
      }
      adjustReason = input.adjustReason;
    }
  }
  if (amount <= 0n) throw new ServiceError("Сумма 0 бўлиши мумкин эмас", 400);
  if (amount > MAX_AMOUNT) throw new ServiceError(`Сумма жуда катта: ${formatSom(amount)} сўм`, 400);

  const e: NormalizedEntry = {
    kind: input.kind,
    date: input.date,
    siteId: input.siteId,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    categoryId: null,
    materialId: input.materialId,
    counterpartyId: input.counterpartyId,
    quantityMilli,
    unitPrice,
    amount,
    adjustReason,
    note: input.note,
  };

  const changed = (field: RefField) => !prev || prev[field] !== e[field];
  const single = () => {
    if (quantityMilli !== 1000n) throw new ServiceError("Бу турдаги ёзувда миқдор 1 бўлади", 400);
  };

  // Tur bo'yicha majburiy/taqiqlangan maydonlar (DB'da ham CHECK bor)
  switch (e.kind) {
    case "EXPENSE":
    case "GOODS_RECEIPT":
      if (!e.siteId) throw new ServiceError("Объект танланмаган", 400);
      if (!e.materialId) throw new ServiceError("Номи рўйхатдан танланиши шарт", 400);
      e.toAccountId = null;
      if (e.kind === "EXPENSE" && !e.accountId) throw new ServiceError("Ким тўлагани танланмаган", 400);
      if (e.kind === "GOODS_RECEIPT") {
        e.accountId = null;
        if (!e.counterpartyId) throw new ServiceError("Қарзга олинганда етказиб берувчи танланиши шарт", 400);
      }
      break;
    case "INCOME":
      if (!e.accountId) throw new ServiceError("Пул қайси ҳисобга тушгани танланмаган", 400);
      if (!e.counterpartyId) throw new ServiceError("Пул кимдан келгани танланмаган", 400);
      single();
      e.materialId = null;
      e.toAccountId = null;
      break;
    case "SUPPLIER_PAYMENT":
      if (!e.accountId) throw new ServiceError("Қайси ҳисобдан тўлангани танланмаган", 400);
      if (!e.counterpartyId) throw new ServiceError("Етказиб берувчи танланмаган", 400);
      single();
      e.siteId = null;
      e.materialId = null;
      e.toAccountId = null;
      break;
    case "TRANSFER":
      if (!e.accountId) throw new ServiceError("Қайси ҳисобдан ўтказилгани танланмаган", 400);
      if (!e.toAccountId) throw new ServiceError("Қайси ҳисобга ўтказилгани танланмаган", 400);
      if (e.toAccountId === e.accountId) throw new ServiceError("Бир ҳисобнинг ўзига ўтказиб бўлмайди", 400);
      single();
      e.siteId = null;
      e.materialId = null;
      e.counterpartyId = null;
      break;
  }

  if (!canCreateEntry(user, e.kind, e.siteId)) {
    throw forbidden(isSiteExpense(e.kind) ? "Бу объектга ёзув киритиш ҳуқуқингиз йўқ" : "Бу турдаги ёзувни киритиш ҳуқуқингиз йўқ");
  }

  if (e.siteId && changed("siteId")) {
    const site = await tx.site.findUnique({ where: { id: e.siteId } });
    if (!site) throw new ServiceError("Объект топилмади", 400);
    if (site.status !== "ACTIVE") throw new ServiceError(`«${site.name}» ёпилган — янги ёзув қабул қилмайди`, 400);
  }

  for (const [field, label] of [["accountId", "Ҳисоб"], ["toAccountId", "Қабул қилувчи ҳисоб"]] as const) {
    const id = e[field];
    if (id && changed(field)) {
      const acc = await tx.account.findUnique({ where: { id } });
      if (!acc) throw new ServiceError(`${label} топилмади`, 400);
      if (!acc.isActive) throw new ServiceError(`${label} «${acc.name}» ёпилган`, 400);
    }
  }

  // Kategoriya nomdan olinadi — foydalanuvchi alohida tanlamaydi
  if (e.materialId) {
    const item = await tx.material.findUnique({ where: { id: e.materialId } });
    if (!item) throw new ServiceError("Номи топилмади", 400);
    if (!item.isActive && changed("materialId")) throw new ServiceError(`«${item.name}» ўчирилган`, 400);
    if (!item.categoryId) throw new ServiceError(`«${item.name}» номига категория берилмаган — рўйхатлардан беринг`, 400);
    e.categoryId = item.categoryId;
  }

  if (e.counterpartyId) {
    const cp = await tx.counterparty.findUnique({ where: { id: e.counterpartyId } });
    if (!cp) throw new ServiceError("Контрагент топилмади", 400);
    if (!cp.isActive && changed("counterpartyId")) throw new ServiceError(`«${cp.name}» ўчирилган`, 400);
    const needed = e.kind === "INCOME" ? "PAYER" : "SUPPLIER";
    if (cp.kind !== needed) {
      throw new ServiceError(needed === "PAYER" ? `«${cp.name}» — пул берувчи эмас` : `«${cp.name}» — етказиб берувчи эмас`, 400);
    }
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
    adjustReason: e.adjustReason,
    note: e.note,
  };
}

// ───────────────────────────── Takrorlanish ─────────────────────────────

export type DuplicateInfo = { id: number; description: string; createdByName: string; createdAt: string };

/**
 * Bir xil sana + summa + ob'ekt (to'lovda — yetkazib beruvchi, kirim/o'tkazmada — hisob).
 * Topilsa ogohlantirish — to'xtatmaydi: foydalanuvchi tasdiqlasa saqlanadi.
 */
async function findDuplicates(tx: Tx, e: NormalizedEntry, excludeId?: number): Promise<DuplicateInfo[]> {
  const scope: Prisma.EntryWhereInput = isSiteExpense(e.kind)
    ? { siteId: e.siteId, kind: { in: SITE_EXPENSE_KINDS } }
    : e.kind === "SUPPLIER_PAYMENT"
      ? { kind: "SUPPLIER_PAYMENT", counterpartyId: e.counterpartyId }
      : e.kind === "TRANSFER"
        ? { kind: "TRANSFER", accountId: e.accountId, toAccountId: e.toAccountId }
        : { kind: "INCOME", accountId: e.accountId };

  const rows = await tx.entry.findMany({
    where: {
      status: "ACTIVE",
      date: isoToDbDate(e.date),
      amount: e.amount,
      ...scope,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: entryInclude,
    orderBy: { id: "desc" },
    take: 5,
  });
  return rows.map((r) => ({
    id: r.id,
    description: [r.material?.name, r.account?.name, r.counterparty?.name, r.note].filter(Boolean).join(" · "),
    createdByName: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

function duplicateError(dups: DuplicateInfo[]) {
  const list = dups.map((d) => `№${d.id}${d.description ? ` (${d.description})` : ""}`).join(", ");
  return new ServiceError(`Шу куни худди шу суммали ёзув бор: ${list}. Барибир сақлансинми?`, 409, "DUPLICATE", {
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
    if (!prev) throw notFound("Ёзув топилмади");
    if (prev.status !== "ACTIVE") throw new ServiceError("Бекор қилинган ёзувни тузатиб бўлмайди", 409);
    if (!canModifyEntry(user, prev)) {
      throw forbidden(isOffice(user) ? undefined : "Ўз ёзувингизни фақат 24 соат ичида тузата оласиз");
    }
    // Naqd xarid ↔ qarzga olish o'rtasida almashtirish mumkin (ikkalasi ham ob'ekt xarajati)
    const sameGroup = input.kind === prev.kind || (isSiteExpense(input.kind) && isSiteExpense(prev.kind));
    if (!sameGroup) throw new ServiceError("Ёзув турини ўзгартириб бўлмайди — бекор қилиб, янгисини киритинг", 400);

    // Eski sana ham, yangi sana ham ochiq oyda bo'lishi shart
    await assertDateWritable(tx, dbDateToIso(prev.date));
    const e = await normalizeEntry(tx, user, input, prev);

    const keyChanged =
      dbDateToIso(prev.date) !== e.date || prev.amount !== e.amount || prev.siteId !== e.siteId ||
      prev.accountId !== e.accountId || prev.toAccountId !== e.toAccountId || prev.counterpartyId !== e.counterpartyId;
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
  if (cleanReason.length < 3) throw new ServiceError("Бекор қилиш сабабини ёзинг", 400);

  return prisma.$transaction(async (tx) => {
    const prev = await tx.entry.findUnique({ where: { id }, include: entryInclude });
    if (!prev) throw notFound("Ёзув топилмади");
    if (prev.status !== "ACTIVE") throw new ServiceError("Ёзув аллақачон бекор қилинган", 409);
    if (!canModifyEntry(user, prev)) {
      throw forbidden(isOffice(user) ? undefined : "Ўз ёзувингизни фақат 24 соат ичида бекор қила оласиз");
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

const ALL_KINDS: EntryKind[] = ["INCOME", "EXPENSE", "TRANSFER", "SUPPLIER_PAYMENT", "GOODS_RECEIPT"];

export type EntryFilters = {
  siteId?: number;
  accountId?: number;
  categoryId?: number;
  materialId?: number;
  counterpartyId?: number;
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
  const kind = get("kind") as EntryKind | undefined;
  const status = get("status");
  return {
    siteId: id("siteId"),
    accountId: id("accountId"),
    categoryId: id("categoryId"),
    materialId: id("materialId"),
    counterpartyId: id("counterpartyId"),
    createdById: id("createdById"),
    kind: kind && ALL_KINDS.includes(kind) ? kind : undefined,
    status: status === "CANCELLED" || status === "ALL" ? status : "ACTIVE",
    from: date("from"),
    to: date("to"),
    q: get("q")?.trim().slice(0, 100) || undefined,
  };
}

function buildWhere(user: SessionUser, f: EntryFilters): Prisma.EntryWhereInput {
  const and: Prisma.EntryWhereInput[] = [];

  // Prorab: faqat o'z ob'ektlari xarajati. Kirim, to'lov va o'tkazmalar ko'rinmaydi.
  if (!isOffice(user)) and.push({ kind: { in: SITE_EXPENSE_KINDS }, siteId: { in: user.siteIds } });

  if (f.status !== "ALL") and.push({ status: f.status });
  if (f.siteId) and.push({ siteId: f.siteId });
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.materialId) and.push({ materialId: f.materialId });
  if (f.counterpartyId) and.push({ counterpartyId: f.counterpartyId });
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
  sums: { income: string; expense: string; transfer: string; supplierPayment: string };
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
  const sumOf = (...kinds: EntryKind[]) =>
    sums.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + (s._sum.amount ?? 0n), 0n).toString();
  return {
    rows: rows.map((r) => toRow(r, user)),
    total,
    sums: {
      income: sumOf("INCOME"),
      expense: sumOf("EXPENSE", "GOODS_RECEIPT"),
      transfer: sumOf("TRANSFER"),
      supplierPayment: sumOf("SUPPLIER_PAYMENT"),
    },
  };
}

/** Hisobot/eksport uchun — sahifalashsiz (xavfsizlik uchun 100 000 qator chegarasi). */
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
 * Kunlik daftar: tanlangan ob'ekt va kunning xarajatlari (naqd + qarzga) va
 * kirimlari. Jadval ularni ko'rsatadi va shu yerning o'zida tuzatiladi.
 */
export async function getDay(user: SessionUser, siteId: number, date: string): Promise<{ expenses: EntryRow[]; incomes: EntryRow[] }> {
  if (!isValidIsoDate(date)) throw new ServiceError("Сана нотўғри", 400);
  if (!isOffice(user) && !user.siteIds.includes(siteId)) throw forbidden();

  const rows = await prisma.entry.findMany({
    where: {
      status: "ACTIVE",
      date: isoToDbDate(date),
      siteId,
      kind: { in: isOffice(user) ? [...SITE_EXPENSE_KINDS, "INCOME"] : SITE_EXPENSE_KINDS },
    },
    include: entryInclude,
    orderBy: { id: "asc" },
  });
  const all = rows.map((r) => toRow(r, user));
  return { expenses: all.filter((r) => isSiteExpense(r.kind)), incomes: all.filter((r) => r.kind === "INCOME") };
}

export async function getEntryDetail(user: SessionUser, id: number): Promise<{ entry: EntryRow; audit: AuditRow[] }> {
  const e = await prisma.entry.findUnique({ where: { id }, include: entryInclude });
  if (!e) throw notFound("Ёзув топилмади");
  if (!isOffice(user) && !(isSiteExpense(e.kind) && e.siteId && user.siteIds.includes(e.siteId))) throw notFound("Ёзув топилмади");
  const audit = isOffice(user) ? await getAuditTrail(prisma, "Entry", id) : [];
  return { entry: toRow(e, user), audit };
}
