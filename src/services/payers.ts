import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryRow } from "@/services/entries";

/**
 * Pul beruvchi (investor, buyurtmachi) — faqat kirim kiritadi, qoldiq/qarz
 * tushunchasi yo'q. Shuning uchun yetkazib beruvchidan farqli: bu yerda faqat
 * "qancha kiritgan" hisoblanadi, ayirish yo'q.
 */

export type PayerBalance = {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  total: bigint;
  siteCount: number;
  lastDate: Date | null;
};

export async function listPayerBalances(): Promise<PayerBalance[]> {
  const [payers, sums] = await Promise.all([
    prisma.counterparty.findMany({ where: { kind: "PAYER" }, orderBy: { name: "asc" } }),
    prisma.$queryRaw<{ id: number; total: bigint; site_count: bigint; last_date: Date | null }[]>`
      SELECT e.counterparty_id AS id,
        COALESCE(SUM(e.amount), 0)::bigint AS total,
        COUNT(DISTINCT e.site_id) AS site_count,
        MAX(e.date) AS last_date
      FROM entries e
      WHERE e.status = 'ACTIVE' AND e.kind = 'INCOME' AND e.counterparty_id IS NOT NULL
      GROUP BY e.counterparty_id`,
  ]);
  const byId = new Map(sums.map((s) => [s.id, s]));
  return payers.map((p) => {
    const x = byId.get(p.id);
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      note: p.note,
      isActive: p.isActive,
      total: x?.total ?? 0n,
      siteCount: x ? Number(x.site_count) : 0,
      lastDate: x?.last_date ?? null,
    };
  });
}

export type PayerSiteRow = { siteId: number; siteName: string; total: bigint; /** foiz, 1 kasr aniqligida */ share: number; lastDate: Date };

export type PayerStatement = {
  payer: { id: number; name: string; phone: string | null; isActive: boolean };
  from: string | null;
  to: string | null;
  siteId: number | null;
  total: bigint;
  sites: PayerSiteRow[];
  rows: EntryRow[];
};

/** Bigint ulushni foizga aylantiradi (1 kasr aniqligida), floatsiz. */
function shareOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}

/**
 * Pul beruvchining kiritgan puli: obyektlar bo'yicha jami (hamma vaqt uchun,
 * filtrdan qat'i nazar — yetkazib beruvchi kartochkasidagi kabi) va tarix
 * (sana oralig'i va obyekt bo'yicha filtrlanadi).
 */
export async function getPayerStatement(
  user: SessionUser,
  payerId: number,
  period: { from?: string; to?: string; siteId?: number }
): Promise<PayerStatement> {
  const payer = await prisma.counterparty.findUnique({ where: { id: payerId } });
  if (!payer || payer.kind !== "PAYER") throw notFound("Пул берувчи топилмади");

  const siteRows = await prisma.$queryRaw<{ site_id: number; site_name: string; total: bigint; last_date: Date }[]>`
    SELECT s.id AS site_id, s.name AS site_name, SUM(e.amount)::bigint AS total, MAX(e.date) AS last_date
    FROM entries e
    JOIN sites s ON s.id = e.site_id
    WHERE e.status = 'ACTIVE' AND e.kind = 'INCOME' AND e.counterparty_id = ${payerId}
    GROUP BY s.id, s.name
    ORDER BY total DESC`;

  const total = siteRows.reduce((a, r) => a + r.total, 0n);
  const sites: PayerSiteRow[] = siteRows.map((r) => ({
    siteId: r.site_id,
    siteName: r.site_name,
    total: r.total,
    share: shareOf(r.total, total),
    lastDate: r.last_date,
  }));

  const rows = await listEntriesForExport(user, {
    counterpartyId: payerId,
    kind: "INCOME",
    siteId: period.siteId,
    from: period.from,
    to: period.to,
    status: "ACTIVE",
  });

  return {
    payer: { id: payer.id, name: payer.name, phone: payer.phone, isActive: payer.isActive },
    from: period.from ?? null,
    to: period.to ?? null,
    siteId: period.siteId ?? null,
    total,
    sites,
    rows,
  };
}
