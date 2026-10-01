import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { isoToDbDate } from "@/lib/dates";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryRow } from "@/services/entries";

/**
 * Yetkazib beruvchi (beton zavodi, baza) bilan hisob-kitob.
 *
 *   To'landi  = zavodga o'tkazilgan pul (SUPPLIER_PAYMENT) + naqd xarid (EXPENSE, shu zavoddan)
 *   Olindi    = qarzga/oldindan to'langan pulga kelgan tovar (GOODS_RECEIPT) + naqd xarid
 *   Qoldiq    = To'landi − Olindi
 *     > 0 — zavod bizga shuncha tovar qarzdor
 *     < 0 — biz zavodga shuncha pul qarzdormiz
 *
 * Naqd xarid ikkala tomonga ham yoziladi — qoldiqqa ta'sir qilmaydi, lekin
 * solishtirish dalolatnomasida ko'rinadi (zavod o'z daftari bilan solishtiradi).
 */

export type SupplierBalance = {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  paid: bigint;
  received: bigint;
  balance: bigint;
  lastDate: Date | null;
};

export async function listSupplierBalances(): Promise<SupplierBalance[]> {
  const [suppliers, sums] = await Promise.all([
    prisma.counterparty.findMany({ where: { kind: "SUPPLIER" }, orderBy: { name: "asc" } }),
    prisma.$queryRaw<{ id: number; paid: bigint; received: bigint; last_date: Date | null }[]>`
      SELECT e.counterparty_id AS id,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind IN ('SUPPLIER_PAYMENT', 'EXPENSE')), 0)::bigint AS paid,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind IN ('GOODS_RECEIPT', 'EXPENSE')), 0)::bigint AS received,
        MAX(e.date) AS last_date
      FROM entries e
      WHERE e.status = 'ACTIVE' AND e.counterparty_id IS NOT NULL
      GROUP BY e.counterparty_id`,
  ]);
  const byId = new Map(sums.map((s) => [s.id, s]));
  return suppliers.map((s) => {
    const x = byId.get(s.id);
    const paid = x?.paid ?? 0n;
    const received = x?.received ?? 0n;
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      note: s.note,
      isActive: s.isActive,
      paid,
      received,
      balance: paid - received,
      lastDate: x?.last_date ?? null,
    };
  });
}

export type SupplierSiteRow = { siteId: number; siteName: string; paid: bigint; received: bigint; balance: bigint };

export type SupplierSiteBalances = {
  supplier: { id: number; name: string; phone: string | null; isActive: boolean };
  sites: SupplierSiteRow[];
  paid: bigint;
  received: bigint;
  balance: bigint;
};

/**
 * Yetkazib beruvchi qoldig'ini obyektlar bo'yicha taqsimlab beradi. Har bir
 * yozuv (to'lov, tovar, naqd xarid) aniq bitta obyektga tegishli bo'lgani
 * uchun (migratsiya: SUPPLIER_PAYMENT'da endi site_id majburiy), obyektlar
 * qoldig'i yig'indisi = umumiy qoldiq — ayricha "taqsimlanmagan" qator kerak emas.
 */
export async function getSupplierSiteBalances(supplierId: number): Promise<SupplierSiteBalances> {
  const supplier = await prisma.counterparty.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.kind !== "SUPPLIER") throw notFound("Етказиб берувчи топилмади");

  const rows = await prisma.$queryRaw<{ site_id: number; site_name: string; paid: bigint; received: bigint }[]>`
    SELECT s.id AS site_id, s.name AS site_name,
      COALESCE(SUM(e.amount) FILTER (WHERE e.kind IN ('SUPPLIER_PAYMENT', 'EXPENSE')), 0)::bigint AS paid,
      COALESCE(SUM(e.amount) FILTER (WHERE e.kind IN ('GOODS_RECEIPT', 'EXPENSE')), 0)::bigint AS received
    FROM entries e
    JOIN sites s ON s.id = e.site_id
    WHERE e.status = 'ACTIVE' AND e.counterparty_id = ${supplierId}
    GROUP BY s.id, s.name
    ORDER BY s.name ASC`;

  const sites: SupplierSiteRow[] = rows.map((r) => ({
    siteId: r.site_id,
    siteName: r.site_name,
    paid: r.paid,
    received: r.received,
    balance: r.paid - r.received,
  }));
  const paid = sites.reduce((a, s) => a + s.paid, 0n);
  const received = sites.reduce((a, s) => a + s.received, 0n);

  return {
    supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone, isActive: supplier.isActive },
    sites,
    paid,
    received,
    balance: paid - received,
  };
}

export type SupplierStatementRow = EntryRow & { paid: bigint; received: bigint; running: bigint };

export type SupplierStatement = {
  supplier: { id: number; name: string; phone: string | null };
  from: string | null;
  to: string | null;
  /** Davr boshidagi qoldiq (from bo'lmasa — 0). */
  opening: bigint;
  paid: bigint;
  received: bigint;
  closing: bigint;
  rows: SupplierStatementRow[];
};

/** Solishtirish dalolatnomasi (akt sverka): davr boshidagi qoldiq, har bir tovar/to'lov va yakuniy qoldiq. */
export async function getSupplierStatement(
  user: SessionUser,
  supplierId: number,
  period: { from?: string; to?: string }
): Promise<SupplierStatement> {
  const supplier = await prisma.counterparty.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.kind !== "SUPPLIER") throw notFound("Етказиб берувчи топилмади");

  let opening = 0n;
  if (period.from) {
    const [row] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(CASE
        WHEN kind = 'SUPPLIER_PAYMENT' THEN amount
        WHEN kind = 'GOODS_RECEIPT' THEN -amount
        ELSE 0 END), 0)::bigint AS total
      FROM entries
      WHERE status = 'ACTIVE' AND counterparty_id = ${supplierId} AND date < ${isoToDbDate(period.from)}`;
    opening = row.total;
  }

  const entries = await listEntriesForExport(user, {
    counterpartyId: supplierId,
    from: period.from,
    to: period.to,
    status: "ACTIVE",
  });

  let running = opening;
  let paid = 0n;
  let received = 0n;
  const rows = entries.map((e) => {
    const amount = BigInt(e.amount);
    const p = e.kind === "SUPPLIER_PAYMENT" || e.kind === "EXPENSE" ? amount : 0n;
    const r = e.kind === "GOODS_RECEIPT" || e.kind === "EXPENSE" ? amount : 0n;
    paid += p;
    received += r;
    running += p - r;
    return { ...e, paid: p, received: r, running };
  });

  return {
    supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone },
    from: period.from ?? null,
    to: period.to ?? null,
    opening,
    paid,
    received,
    closing: running,
    rows,
  };
}
