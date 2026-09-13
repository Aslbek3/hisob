import type { SiteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, notFound } from "@/lib/errors";
import { cleanName } from "@/lib/normalize";
import { dbDateToIso, monthStartIso, prevMonthIso, todayIso } from "@/lib/dates";
import { canViewSite, isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

export type SiteListItem = {
  id: number;
  name: string;
  address: string | null;
  status: SiteStatus;
  expense: bigint;
  /** Prorabga ko'rsatilmaydi (null). */
  income: bigint | null;
  /** Oxirgi N oy chiqimi, eskidan yangiga. */
  monthly: { month: string; expense: bigint }[];
};

/** Oxirgi n oy boshlanishi (eskidan yangiga), joriy oy bilan birga. */
export function lastMonths(n: number): string[] {
  const months: string[] = [];
  let m = monthStartIso(todayIso());
  for (let i = 0; i < n; i++) {
    months.unshift(m);
    m = prevMonthIso(m);
  }
  return months;
}

type SiteMonthKind = { site_id: number; month: Date; kind: "INCOME" | "EXPENSE"; total: bigint };

export async function listSites(user: SessionUser, opts: { monthsBack: number }): Promise<SiteListItem[]> {
  const sites = await prisma.site.findMany({
    where: isOffice(user) ? {} : { id: { in: user.siteIds } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const sums = await prisma.$queryRaw<SiteMonthKind[]>`
    SELECT site_id, date_trunc('month', date)::date AS month, kind, SUM(amount)::bigint AS total
    FROM entries
    WHERE status = 'ACTIVE' AND site_id IS NOT NULL AND kind IN ('INCOME', 'EXPENSE')
    GROUP BY 1, 2, 3`;

  const months = lastMonths(opts.monthsBack);
  return sites.map((s) => {
    const own = sums.filter((r) => r.site_id === s.id);
    const total = (kind: "INCOME" | "EXPENSE") => own.filter((r) => r.kind === kind).reduce((acc, r) => acc + r.total, 0n);
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      status: s.status,
      expense: total("EXPENSE"),
      income: isOffice(user) ? total("INCOME") : null,
      monthly: months.map((m) => ({
        month: m,
        expense: own.find((r) => r.kind === "EXPENSE" && dbDateToIso(r.month) === m)?.total ?? 0n,
      })),
    };
  });
}

export type SiteCard = {
  site: { id: number; name: string; address: string | null; status: SiteStatus; createdAt: Date; archivedAt: Date | null };
  income: bigint | null;
  expense: bigint;
  categories: { id: number; name: string; total: bigint }[];
  /** Oylar × kategoriyalar jadvali (yangisi yuqorida). */
  months: { month: string; income: bigint | null; expense: bigint; byCategory: Record<number, bigint> }[];
  materials: { id: number; name: string; unit: string; quantity: string; total: bigint }[];
};

export async function getSiteCard(user: SessionUser, siteId: number): Promise<SiteCard> {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || !canViewSite(user, siteId)) throw notFound("Ob'ekt topilmadi");

  const [monthCat, monthIncome, materials] = await Promise.all([
    prisma.$queryRaw<{ month: Date; category_id: number; name: string; total: bigint }[]>`
      SELECT date_trunc('month', e.date)::date AS month, c.id AS category_id, c.name, SUM(e.amount)::bigint AS total
      FROM entries e JOIN categories c ON c.id = e.category_id
      WHERE e.status = 'ACTIVE' AND e.kind = 'EXPENSE' AND e.site_id = ${siteId}
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT date_trunc('month', date)::date AS month, SUM(amount)::bigint AS total
      FROM entries WHERE status = 'ACTIVE' AND kind = 'INCOME' AND site_id = ${siteId}
      GROUP BY 1`,
    prisma.$queryRaw<{ id: number; name: string; unit: string; quantity: string; total: bigint }[]>`
      SELECT m.id, m.name, m.unit, SUM(e.quantity)::text AS quantity, SUM(e.amount)::bigint AS total
      FROM entries e JOIN materials m ON m.id = e.material_id
      WHERE e.status = 'ACTIVE' AND e.kind = 'EXPENSE' AND e.site_id = ${siteId}
      GROUP BY m.id, m.name, m.unit ORDER BY total DESC`,
  ]);

  const office = isOffice(user);
  const catTotals = new Map<number, { id: number; name: string; total: bigint }>();
  const monthMap = new Map<string, SiteCard["months"][number]>();
  const monthRow = (m: string) => {
    let row = monthMap.get(m);
    if (!row) {
      row = { month: m, income: office ? 0n : null, expense: 0n, byCategory: {} };
      monthMap.set(m, row);
    }
    return row;
  };

  for (const r of monthCat) {
    const cat = catTotals.get(r.category_id) ?? { id: r.category_id, name: r.name, total: 0n };
    cat.total += r.total;
    catTotals.set(r.category_id, cat);
    const row = monthRow(dbDateToIso(r.month));
    row.expense += r.total;
    row.byCategory[r.category_id] = (row.byCategory[r.category_id] ?? 0n) + r.total;
  }
  if (office) {
    for (const r of monthIncome) {
      const row = monthRow(dbDateToIso(r.month));
      row.income = (row.income ?? 0n) + r.total;
    }
  }

  const categories = [...catTotals.values()].sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
  const months = [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month));

  return {
    site: { id: site.id, name: site.name, address: site.address, status: site.status, createdAt: site.createdAt, archivedAt: site.archivedAt },
    income: office ? monthIncome.reduce((acc, r) => acc + r.total, 0n) : null,
    expense: categories.reduce((acc, c) => acc + c.total, 0n),
    categories,
    months,
    materials,
  };
}

/** Prorabga biriktirish uchun barcha ob'ektlar (arxivdagilar oxirida). */
export async function listSiteOptions() {
  return prisma.site.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });
}

// ───────────────────────────── Boshqarish (faqat direktor) ─────────────────────────────

export async function createSite(user: SessionUser, input: { name: string; address?: string | null }) {
  const name = cleanName(input.name);
  if (!name) throw new ServiceError("Ob'ekt nomini kiriting", 400);
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.create({ data: { name, address: input.address?.trim() || null } });
    await writeAudit(tx, { userId: user.id, action: "CREATE", entityType: "Site", entityId: site.id, after: site });
    return site;
  });
}

export async function updateSite(user: SessionUser, id: number, input: { name: string; address?: string | null }) {
  const name = cleanName(input.name);
  if (!name) throw new ServiceError("Ob'ekt nomini kiriting", 400);
  return prisma.$transaction(async (tx) => {
    const before = await tx.site.findUnique({ where: { id } });
    if (!before) throw notFound("Ob'ekt topilmadi");
    const after = await tx.site.update({ where: { id }, data: { name, address: input.address?.trim() || null } });
    await writeAudit(tx, { userId: user.id, action: "UPDATE", entityType: "Site", entityId: id, before, after });
    return after;
  });
}

/** Ob'ektni yopish (arxiv) yoki qayta ochish. O'chirish yo'q. */
export async function setSiteStatus(user: SessionUser, id: number, status: SiteStatus) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.site.findUnique({ where: { id } });
    if (!before) throw notFound("Ob'ekt topilmadi");
    if (before.status === status) return before;
    const after = await tx.site.update({
      where: { id },
      data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null },
    });
    await writeAudit(tx, {
      userId: user.id,
      action: status === "ARCHIVED" ? "ARCHIVE" : "RESTORE",
      entityType: "Site",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}
