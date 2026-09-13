import { buildWorkbook, excelDate, sheet, type ExcelColumn } from "@/lib/excel";
import { formatDate, formatMonth, todayIso } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL, KIND_LABEL, SITE_STATUS_LABEL } from "@/lib/labels";
import { unitLabel } from "@/lib/units";
import { isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryFilters, type EntryRow } from "@/services/entries";
import { getAccountBalances, getAccountStatement, type StatementRow } from "@/services/balances";
import { getSiteCard, lastMonths, listSites } from "@/services/sites";

/** Excel faylini qaytaradi: { buffer, filename }. Har bir hisobot faqat qiymatlar, formulasiz. */
type ExportFile = { buffer: Buffer; filename: string };

const stamp = () => formatDate(todayIso()).replaceAll(".", "-");

/** Jurnal ustunlari — jurnal va ob'ekt eksportida umumiy. */
function entryColumns(user: SessionUser): ExcelColumn<EntryRow>[] {
  const cols: ExcelColumn<EntryRow>[] = [
    { header: "№", width: 8, value: (r) => r.id },
    { header: "Sana", width: 11, kind: "date", value: (r) => excelDate(r.date) },
    { header: "Turi", width: 10, value: (r) => KIND_LABEL[r.kind] },
    { header: "Ob'ekt", width: 22, value: (r) => r.siteName },
    { header: "Hisob", width: 20, value: (r) => r.accountName },
    { header: "Qaysi hisobga", width: 20, value: (r) => r.toAccountName },
    { header: "Kategoriya", width: 16, value: (r) => r.categoryName },
    { header: "Material", width: 24, value: (r) => r.materialName },
    { header: "Kimdan", width: 20, value: (r) => r.counterpartyName },
    { header: "Miqdor", width: 10, kind: "qty", value: (r) => Number(r.quantity) },
    { header: "Birlik", width: 8, value: (r) => (r.unit ? unitLabel(r.unit) : null) },
    { header: "Narx", width: 14, kind: "money", value: (r) => BigInt(r.unitPrice) },
    { header: "Summa", width: 15, kind: "money", value: (r) => BigInt(r.amount) },
    { header: "Izoh", width: 30, value: (r) => r.note },
    { header: "Kiritgan", width: 16, value: (r) => r.createdByName },
    { header: "Holati", width: 12, value: (r) => (r.status === "CANCELLED" ? `Bekor: ${r.cancelReason ?? ""}` : "Faol") },
  ];
  // Prorab kirim/o'tkazma ko'rmaydi — bu ustunlar unga keraksiz
  return isOffice(user) ? cols : cols.filter((c) => !["Qaysi hisobga", "Kimdan", "Turi"].includes(c.header));
}

export async function exportJournal(user: SessionUser, filters: EntryFilters): Promise<ExportFile> {
  const rows = await listEntriesForExport(user, filters);
  const columns = entryColumns(user);
  const amountCol = columns.findIndex((c) => c.header === "Summa");
  const expense = rows.filter((r) => r.status === "ACTIVE" && r.kind === "EXPENSE").reduce((a, r) => a + BigInt(r.amount), 0n);

  const period = [filters.from && formatDate(filters.from), filters.to && formatDate(filters.to)].filter(Boolean).join(" — ");
  const buffer = await buildWorkbook([
    sheet({
      name: "Jurnal",
      title: `Jurnal${period ? `: ${period}` : ""} (${rows.length} ta yozuv)`,
      columns,
      rows,
      totals: isOffice(user) ? undefined : { [amountCol]: expense },
    }),
  ]);
  return { buffer, filename: `jurnal_${stamp()}.xlsx` };
}

export async function exportSites(user: SessionUser): Promise<ExportFile> {
  const months = lastMonths(12);
  const sites = await listSites(user, { monthsBack: 12 });
  const office = isOffice(user);

  const columns: ExcelColumn<(typeof sites)[number]>[] = [
    { header: "Ob'ekt", width: 26, value: (s) => s.name },
    { header: "Holati", width: 10, value: (s) => SITE_STATUS_LABEL[s.status] },
    ...(office ? [{ header: "Jami kirim", width: 16, kind: "money" as const, value: (s: (typeof sites)[number]) => s.income }] : []),
    { header: "Jami chiqim", width: 16, kind: "money", value: (s) => s.expense },
    ...months.map((m, i) => ({
      header: formatMonth(m),
      width: 14,
      kind: "money" as const,
      value: (s: (typeof sites)[number]) => s.monthly[i].expense,
    })),
  ];

  const buffer = await buildWorkbook([sheet({ name: "Ob'ektlar", title: `Ob'ektlar bo'yicha chiqim (${formatDate(todayIso())})`, columns, rows: sites })]);
  return { buffer, filename: `obyektlar_${stamp()}.xlsx` };
}

export async function exportSite(user: SessionUser, siteId: number): Promise<ExportFile> {
  const card = await getSiteCard(user, siteId);
  const entries = await listEntriesForExport(user, { siteId, status: "ACTIVE" });
  const office = isOffice(user);
  type MonthRow = (typeof card.months)[number];

  const monthColumns: ExcelColumn<MonthRow>[] = [
    { header: "Oy", width: 16, value: (m) => formatMonth(m.month) },
    ...(office ? [{ header: "Kirim", width: 16, kind: "money" as const, value: (m: MonthRow) => m.income }] : []),
    { header: "Chiqim", width: 16, kind: "money", value: (m) => m.expense },
    ...card.categories.map((c) => ({ header: c.name, width: 15, kind: "money" as const, value: (m: MonthRow) => m.byCategory[c.id] ?? 0n })),
  ];

  const buffer = await buildWorkbook([
    sheet({ name: "Oylar", title: `${card.site.name} — oylar bo'yicha`, columns: monthColumns, rows: card.months }),
    sheet({
      name: "Kategoriyalar",
      title: `${card.site.name} — kategoriya kesimi`,
      columns: [
        { header: "Kategoriya", width: 22, value: (c) => c.name },
        { header: "Summa", width: 16, kind: "money", value: (c) => c.total },
      ],
      rows: card.categories,
      totals: { 1: card.expense },
    }),
    sheet({
      name: "Materiallar",
      title: `${card.site.name} — materiallar`,
      columns: [
        { header: "Material", width: 28, value: (m) => m.name },
        { header: "Miqdor", width: 12, kind: "qty", value: (m) => Number(m.quantity) },
        { header: "Birlik", width: 8, value: (m) => unitLabel(m.unit) },
        { header: "Summa", width: 16, kind: "money", value: (m) => m.total },
      ],
      rows: card.materials,
    }),
    sheet({ name: "Yozuvlar", title: `${card.site.name} — barcha yozuvlar`, columns: entryColumns(user), rows: entries }),
  ]);
  return { buffer, filename: `obyekt_${card.site.name.replace(/[^\p{L}\p{N}]+/gu, "_")}_${stamp()}.xlsx` };
}

export async function exportBalances(): Promise<ExportFile> {
  const rows = await getAccountBalances();
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((a, r) => a + f(r), 0n);
  const buffer = await buildWorkbook([
    sheet({
      name: "Hisoblar",
      title: `Kassa qoldiqlari (${formatDate(todayIso())})`,
      columns: [
        { header: "Hisob", width: 24, value: (r) => r.name },
        { header: "Turi", width: 12, value: (r) => ACCOUNT_TYPE_LABEL[r.type] },
        { header: "Firma", width: 18, value: (r) => r.companyName },
        { header: "Boshlang'ich", width: 15, kind: "money", value: (r) => r.openingBalance },
        { header: "Kirim", width: 15, kind: "money", value: (r) => r.income },
        { header: "Chiqim", width: 15, kind: "money", value: (r) => r.expense },
        { header: "O'tkazma +", width: 15, kind: "money", value: (r) => r.transferIn },
        { header: "O'tkazma −", width: 15, kind: "money", value: (r) => r.transferOut },
        { header: "Qoldiq", width: 16, kind: "money", value: (r) => r.balance },
      ],
      rows,
      totals: {
        3: sum((r) => r.openingBalance),
        4: sum((r) => r.income),
        5: sum((r) => r.expense),
        6: sum((r) => r.transferIn),
        7: sum((r) => r.transferOut),
        8: sum((r) => r.balance),
      },
    }),
  ]);
  return { buffer, filename: `hisoblar_${stamp()}.xlsx` };
}

export async function exportStatement(user: SessionUser, accountId: number, month: string): Promise<ExportFile> {
  const st = await getAccountStatement(user, accountId, month);
  const buffer = await buildWorkbook([
    sheet({
      name: formatMonth(st.month),
      title: `${st.account.name} — ${formatMonth(st.month)}. Oy boshiga qoldiq: ${st.opening.toString()}`,
      columns: [
        { header: "№", width: 8, value: (r: StatementRow) => r.id },
        { header: "Sana", width: 11, kind: "date", value: (r) => excelDate(r.date) },
        { header: "Turi", width: 10, value: (r) => KIND_LABEL[r.kind] },
        { header: "Ob'ekt / hisob", width: 24, value: (r) => r.siteName ?? (r.toAccountId === accountId ? r.accountName : r.toAccountName) },
        { header: "Tavsif", width: 30, value: (r) => [r.categoryName, r.materialName, r.counterpartyName, r.note].filter(Boolean).join(" · ") },
        { header: "Kirim", width: 15, kind: "money", value: (r) => (r.effect > 0n ? r.effect : null) },
        { header: "Chiqim", width: 15, kind: "money", value: (r) => (r.effect < 0n ? -r.effect : null) },
        { header: "Qoldiq", width: 16, kind: "money", value: (r) => r.running },
      ],
      rows: st.rows,
      totals: { 5: st.inflow, 6: st.outflow, 7: st.closing },
    }),
  ]);
  return { buffer, filename: `hisob_${st.account.name.replace(/[^\p{L}\p{N}]+/gu, "_")}_${st.month.slice(0, 7)}.xlsx` };
}
