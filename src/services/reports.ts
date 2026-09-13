import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/money";
import { isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryRow } from "@/services/entries";
import { listSupplierBalances, type SupplierBalance } from "@/services/suppliers";

/**
 * Boshliqlar/investorlar uchun davriy hisobot (Telegram'ga yuboriladigan Excel).
 * Ko'rinishi firmaning eski Excel'iga o'xshash: ob'ekt → kunlar → qatorlar,
 * to'lovchilar alohida ustunlarda, kunlik va umumiy jami.
 * Sahifadagi ko'rinish va Excel — shu bitta ma'lumotdan.
 */

export const DEBT_COLUMN = "debt";

export type PayerColumn = { key: string; label: string };

export type ReportLine = {
  no: number;
  entryId: number;
  date: string;
  name: string;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  amount: bigint;
  payer: string; // hisob id'si yoki DEBT_COLUMN
  supplier: string | null;
  note: string;
};

export type ReportDay = { date: string; lines: ReportLine[]; byPayer: Record<string, bigint>; total: bigint };

export type SiteReport = {
  site: { id: number; name: string; address: string | null };
  days: ReportDay[];
  byPayer: Record<string, bigint>;
  total: bigint;
};

export type PeriodReport = {
  from: string;
  to: string;
  payers: PayerColumn[];
  sites: SiteReport[];
  incomes: EntryRow[];
  suppliers: SupplierBalance[];
};

const add = (map: Record<string, bigint>, key: string, v: bigint) => {
  map[key] = (map[key] ?? 0n) + v;
};

export async function getPeriodReport(
  user: SessionUser,
  q: { siteId?: number; from: string; to: string }
): Promise<PeriodReport> {
  const office = isOffice(user);
  const [expenses, incomes, accounts, sites, suppliers] = await Promise.all([
    Promise.all([
      listEntriesForExport(user, { siteId: q.siteId, from: q.from, to: q.to, status: "ACTIVE", kind: "EXPENSE" }),
      listEntriesForExport(user, { siteId: q.siteId, from: q.from, to: q.to, status: "ACTIVE", kind: "GOODS_RECEIPT" }),
    ]).then(([a, b]) => [...a, ...b].sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id)),
    office ? listEntriesForExport(user, { siteId: q.siteId, from: q.from, to: q.to, status: "ACTIVE", kind: "INCOME" }) : Promise.resolve([]),
    prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    prisma.site.findMany({
      where: {
        AND: [q.siteId ? { id: q.siteId } : {}, office ? {} : { id: { in: user.siteIds } }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, status: true },
    }),
    office ? listSupplierBalances() : Promise.resolve([]),
  ]);

  // Ustunlar: davrda ishlatilgan hisoblar (tartib bo'yicha) + qarzga
  const usedPayers = new Set(expenses.map((e) => (e.kind === "GOODS_RECEIPT" ? DEBT_COLUMN : String(e.accountId))));
  const payers: PayerColumn[] = accounts.filter((a) => usedPayers.has(String(a.id))).map((a) => ({ key: String(a.id), label: a.name }));
  if (usedPayers.has(DEBT_COLUMN)) payers.push({ key: DEBT_COLUMN, label: "Етказиб берувчи ҳисобидан (қарз/аванс)" });

  const siteReports: SiteReport[] = [];
  for (const s of sites) {
    const own = expenses.filter((e) => e.siteId === s.id);
    // Yopilgan ob'ekt — faqat davrda yozuvi bo'lsa
    if (!own.length && s.status !== "ACTIVE") continue;
    const report: SiteReport = { site: { id: s.id, name: s.name, address: s.address }, days: [], byPayer: {}, total: 0n };
    let day: ReportDay | null = null;
    for (const e of own) {
      if (!day || day.date !== e.date) {
        day = { date: e.date, lines: [], byPayer: {}, total: 0n };
        report.days.push(day);
      }
      const amount = BigInt(e.amount);
      const payer = e.kind === "GOODS_RECEIPT" ? DEBT_COLUMN : String(e.accountId);
      day.lines.push({
        no: day.lines.length + 1,
        entryId: e.id,
        date: e.date,
        name: e.materialName ?? e.categoryName ?? "",
        quantity: formatQuantity(e.quantity),
        unit: e.unit,
        unitPrice: e.unitPrice,
        amount,
        payer,
        supplier: e.counterpartyName,
        note: [e.note, e.adjustReason ? `(${e.adjustReason.toLowerCase()})` : null].filter(Boolean).join(" "),
      });
      add(day.byPayer, payer, amount);
      day.total += amount;
      add(report.byPayer, payer, amount);
      report.total += amount;
    }
    siteReports.push(report);
  }

  return { from: q.from, to: q.to, payers, sites: siteReports, incomes, suppliers };
}
