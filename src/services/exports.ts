import { buildWorkbook, excelDate, fileSafe, sheet, type ExcelColumn, type ExcelSheet } from "@/lib/excel";
import { formatDate, formatMonth, todayIso } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { ACCOUNT_TYPE_LABEL, KIND_LABEL, SITE_STATUS_LABEL } from "@/lib/labels";
import { unitLabel } from "@/lib/units";
import { isOffice } from "@/lib/permissions";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryFilters, type EntryRow } from "@/services/entries";
import { getAccountBalances, getAccountStatement, type StatementRow } from "@/services/balances";
import { getSiteCard, lastMonths, listSites } from "@/services/sites";
import { getPeriodReport, type ReportLine } from "@/services/reports";
import { getSupplierStatement, type SupplierStatementRow } from "@/services/suppliers";

/** Excel faylini qaytaradi: { buffer, filename }. Har bir hisobot faqat qiymatlar, formulasiz. */
type ExportFile = { buffer: Buffer; filename: string };

const period = (from?: string | null, to?: string | null) =>
  from && to ? (from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`) : from ? `${formatDate(from)} дан` : to ? `${formatDate(to)} гача` : "бутун давр";

// ───────────────────────────── Davriy hisobot (Telegram uchun) ─────────────────────────────

type SubtotalRow = { subtotal: true; date: string; byPayer: Record<string, bigint>; total: bigint };
type ReportRow = ReportLine | SubtotalRow;
const isSub = (r: ReportRow): r is SubtotalRow => "subtotal" in r;

export async function exportPeriodReport(user: SessionUser, q: { siteId?: number; from: string; to: string }): Promise<ExportFile> {
  const report = await getPeriodReport(user, q);
  const sheets: ExcelSheet<any>[] = [];

  // Bo'sh ob'ektlar uchun bo'sh varaq chiqmasin (hammasi bo'sh bo'lsa — bittasi qoladi)
  const withData = report.sites.filter((s) => s.days.length > 0);
  for (const s of withData.length ? withData : report.sites.slice(0, 1)) {
    const rows: ReportRow[] = [];
    for (const d of s.days) {
      rows.push(...d.lines);
      rows.push({ subtotal: true, date: d.date, byPayer: d.byPayer, total: d.total });
    }
    const columns: ExcelColumn<ReportRow>[] = [
      { header: "№", width: 5, value: (r) => (isSub(r) ? null : r.no) },
      { header: "Сана", width: 11, kind: "date", value: (r) => (isSub(r) ? null : excelDate(r.date)) },
      { header: "Маҳсулот номи", width: 32, value: (r) => (isSub(r) ? `${formatDate(r.date)} — кун жами` : r.name) },
      { header: "Миқдори", width: 10, kind: "qty", value: (r) => (isSub(r) ? null : Number(r.quantity.replace(/\s/g, "").replace(",", "."))) },
      { header: "Бирлиги", width: 8, value: (r) => (isSub(r) || !r.unit ? null : unitLabel(r.unit)) },
      { header: "Нархи", width: 13, kind: "money", value: (r) => (isSub(r) ? null : BigInt(r.unitPrice)) },
      ...report.payers.map((p) => ({
        header: p.label,
        width: 15,
        kind: "money" as const,
        value: (r: ReportRow) => (isSub(r) ? (r.byPayer[p.key] ?? null) : r.payer === p.key ? r.amount : null),
      })),
      { header: "Жами", width: 15, kind: "money", value: (r) => (isSub(r) ? r.total : r.amount) },
      { header: "Етказиб берувчи", width: 18, value: (r) => (isSub(r) ? null : r.supplier) },
      { header: "Изоҳ", width: 28, value: (r) => (isSub(r) ? null : r.note || null) },
    ];
    const firstMoney = 6;
    const totals: Record<number, bigint> = {};
    report.payers.forEach((p, i) => (totals[firstMoney + i] = s.byPayer[p.key] ?? 0n));
    totals[firstMoney + report.payers.length] = s.total;

    sheets.push(
      sheet({
        name: s.site.name,
        title: s.site.name + (s.site.address ? `, ${s.site.address}` : ""),
        subtitle: `Харажатлар: ${period(report.from, report.to)}. Тайёрланди: ${formatDate(todayIso())}`,
        columns,
        rows,
        rowKind: (r) => (isSub(r) ? "subtotal" : "normal"),
        totals,
        totalsLabel: "ЖАМИ ХАРАЖАТ",
      })
    );
  }

  if (report.incomes.length) {
    sheets.push(
      sheet({
        name: "Кирим",
        title: `Келган пул: ${period(report.from, report.to)}`,
        columns: [
          { header: "Сана", width: 11, kind: "date", value: (r: EntryRow) => excelDate(r.date) },
          { header: "Кимдан", width: 24, value: (r) => r.counterpartyName },
          { header: "Объект", width: 22, value: (r) => r.siteName },
          { header: "Қайси ҳисобга", width: 22, value: (r) => r.accountName },
          { header: "Сумма", width: 16, kind: "money", value: (r) => BigInt(r.amount) },
          { header: "Изоҳ", width: 28, value: (r) => r.note },
        ],
        rows: report.incomes,
        totals: { 4: report.incomes.reduce((a, r) => a + BigInt(r.amount), 0n) },
        totalsLabel: "ЖАМИ КИРИМ",
      })
    );
  }

  const suppliers = report.suppliers.filter((s) => s.paid || s.received);
  if (suppliers.length) {
    sheets.push(
      sheet({
        name: "Етказиб берувчилар",
        title: `Етказиб берувчилар билан ҳисоб (${formatDate(todayIso())} ҳолатига)`,
        columns: [
          { header: "Етказиб берувчи", width: 26, value: (r) => r.name },
          { header: "Тўланган", width: 16, kind: "money", value: (r) => r.paid },
          { header: "Олинган товар", width: 16, kind: "money", value: (r) => r.received },
          { header: "Қолдиқ", width: 16, kind: "money", value: (r) => r.balance },
          { header: "Изоҳ", width: 30, value: (r) => (r.balance > 0n ? "бизга товар қарз" : r.balance < 0n ? "биз пул қарзмиз" : "тенг") },
        ],
        rows: suppliers,
      })
    );
  }

  const name = q.siteId && report.sites[0] ? fileSafe(report.sites[0].site.name) : "Хисобот";
  const range = report.from === report.to ? report.from : `${report.from}_${report.to}`;
  return { buffer: await buildWorkbook(sheets), filename: `${name}_${range}.xlsx` };
}

// ───────────────────────────── Yetkazib beruvchi: solishtirish dalolatnomasi ─────────────────────────────

type OpeningRow = { opening: true; balance: bigint };
type StatementLine = SupplierStatementRow | OpeningRow;
const isOpening = (r: StatementLine): r is OpeningRow => "opening" in r;

export async function exportSupplierStatement(user: SessionUser, supplierId: number, q: { from?: string; to?: string }): Promise<ExportFile> {
  const st = await getSupplierStatement(user, supplierId, q);
  // Davr boshidagi qoldiq — birinchi raqamli qator: "boshlang'ich + tushum − chiqim = yakuniy" Excel'da ham tekshiriladi
  const rows: StatementLine[] = [...(st.from ? [{ opening: true as const, balance: st.opening }] : []), ...st.rows];
  const buffer = await buildWorkbook([
    sheet({
      name: "Солиштириш",
      title: `Солиштириш далолатномаси: ${st.supplier.name}`,
      subtitle: `Давр: ${period(st.from, st.to)}. Қолдиқ: мусбат — бизга товар қарз, манфий — биз пул қарзмиз.`,
      columns: [
        { header: "Сана", width: 11, kind: "date", value: (r: StatementLine) => (isOpening(r) ? (st.from ? excelDate(st.from) : null) : excelDate(r.date)) },
        { header: "Объект", width: 20, value: (r) => (isOpening(r) ? null : r.siteName) },
        { header: "Номи", width: 28, value: (r) => (isOpening(r) ? "Давр бошига қолдиқ" : r.kind === "SUPPLIER_PAYMENT" ? "Пул ўтказилди" : r.materialName) },
        { header: "Миқдори", width: 10, kind: "qty", value: (r) => (isOpening(r) || r.kind === "SUPPLIER_PAYMENT" ? null : Number(r.quantity)) },
        { header: "Бирлиги", width: 8, value: (r) => (isOpening(r) || !r.unit ? null : unitLabel(r.unit)) },
        { header: "Нархи", width: 13, kind: "money", value: (r) => (isOpening(r) || r.kind === "SUPPLIER_PAYMENT" ? null : BigInt(r.unitPrice)) },
        { header: "Олинди (товар)", width: 16, kind: "money", value: (r) => (isOpening(r) ? null : r.received || null) },
        { header: "Тўланди (пул)", width: 16, kind: "money", value: (r) => (isOpening(r) ? null : r.paid || null) },
        { header: "Қолдиқ", width: 16, kind: "money", value: (r) => (isOpening(r) ? r.balance : r.running) },
        { header: "Изоҳ", width: 26, value: (r) => (isOpening(r) ? null : [r.accountName, r.note].filter(Boolean).join(" · ") || null) },
      ],
      rows,
      rowKind: (r) => (isOpening(r) ? "subtotal" : "normal"),
      totals: { 6: st.received, 7: st.paid, 8: st.closing },
      totalsLabel: "ЖАМИ",
    }),
  ]);
  return { buffer, filename: `Солиштириш_${fileSafe(st.supplier.name)}_${todayIso()}.xlsx` };
}

// ───────────────────────────── Jurnal, ob'ektlar, kassalar ─────────────────────────────

/** Jurnal ustunlari — jurnal va ob'ekt eksportida umumiy. */
function entryColumns(user: SessionUser): ExcelColumn<EntryRow>[] {
  const cols: ExcelColumn<EntryRow>[] = [
    { header: "№", width: 8, value: (r) => r.id },
    { header: "Сана", width: 11, kind: "date", value: (r) => excelDate(r.date) },
    { header: "Тури", width: 14, value: (r) => KIND_LABEL[r.kind] },
    { header: "Объект", width: 22, value: (r) => r.siteName },
    { header: "Ҳисоб", width: 20, value: (r) => r.accountName },
    { header: "Қайси ҳисобга", width: 20, value: (r) => r.toAccountName },
    { header: "Категория", width: 16, value: (r) => r.categoryName },
    { header: "Номи", width: 26, value: (r) => r.materialName },
    { header: "Контрагент", width: 20, value: (r) => r.counterpartyName },
    { header: "Миқдор", width: 10, kind: "qty", value: (r) => Number(r.quantity) },
    { header: "Бирлик", width: 8, value: (r) => (r.unit ? unitLabel(r.unit) : null) },
    { header: "Нарх", width: 14, kind: "money", value: (r) => BigInt(r.unitPrice) },
    { header: "Сумма", width: 15, kind: "money", value: (r) => BigInt(r.amount) },
    { header: "Фарқ сабаби", width: 16, value: (r) => r.adjustReason },
    { header: "Изоҳ", width: 30, value: (r) => r.note },
    { header: "Киритган", width: 16, value: (r) => r.createdByName },
    { header: "Ҳолати", width: 14, value: (r) => (r.status === "CANCELLED" ? `Бекор: ${r.cancelReason ?? ""}` : "Фаол") },
  ];
  return isOffice(user) ? cols : cols.filter((c) => !["Қайси ҳисобга", "Тури"].includes(c.header));
}

export async function exportJournal(user: SessionUser, filters: EntryFilters): Promise<ExportFile> {
  const rows = await listEntriesForExport(user, filters);
  const buffer = await buildWorkbook([
    sheet({ name: "Журнал", title: `Журнал: ${period(filters.from, filters.to)} (${rows.length} та ёзув)`, columns: entryColumns(user), rows }),
  ]);
  return { buffer, filename: `Журнал_${todayIso()}.xlsx` };
}

export async function exportSites(user: SessionUser): Promise<ExportFile> {
  const months = lastMonths(12);
  const sites = await listSites(user, { monthsBack: 12 });
  const office = isOffice(user);
  type S = (typeof sites)[number];

  const columns: ExcelColumn<S>[] = [
    { header: "Объект", width: 26, value: (s) => s.name },
    { header: "Ҳолати", width: 10, value: (s) => SITE_STATUS_LABEL[s.status] },
    ...(office ? [{ header: "Жами кирим", width: 16, kind: "money" as const, value: (s: S) => s.income }] : []),
    { header: "Жами харажат", width: 16, kind: "money", value: (s) => s.expense },
    ...months.map((m, i) => ({ header: formatMonth(m), width: 14, kind: "money" as const, value: (s: S) => s.monthly[i].expense })),
  ];

  const buffer = await buildWorkbook([sheet({ name: "Объектлар", title: `Объектлар бўйича харажат (${formatDate(todayIso())})`, columns, rows: sites })]);
  return { buffer, filename: `Объектлар_${todayIso()}.xlsx` };
}

export async function exportSite(user: SessionUser, siteId: number): Promise<ExportFile> {
  const card = await getSiteCard(user, siteId);
  const entries = await listEntriesForExport(user, { siteId, status: "ACTIVE" });
  const office = isOffice(user);
  type M = (typeof card.months)[number];

  const monthColumns: ExcelColumn<M>[] = [
    { header: "Ой", width: 16, value: (m) => formatMonth(m.month) },
    ...(office ? [{ header: "Кирим", width: 16, kind: "money" as const, value: (m: M) => m.income }] : []),
    { header: "Харажат", width: 16, kind: "money", value: (m) => m.expense },
    ...card.categories.map((c) => ({ header: c.name, width: 15, kind: "money" as const, value: (m: M) => m.byCategory[c.id] ?? 0n })),
  ];

  const buffer = await buildWorkbook([
    sheet({ name: "Ойлар", title: `${card.site.name} — ойлар бўйича`, columns: monthColumns, rows: card.months }),
    sheet({
      name: "Категориялар",
      title: `${card.site.name} — категориялар`,
      columns: [
        { header: "Категория", width: 22, value: (c) => c.name },
        { header: "Сумма", width: 16, kind: "money", value: (c) => c.total },
      ],
      rows: card.categories,
      totals: { 1: card.expense },
    }),
    sheet({
      name: "Номлар",
      title: `${card.site.name} — нималар олинган`,
      columns: [
        { header: "Номи", width: 30, value: (m) => m.name },
        { header: "Миқдори", width: 12, kind: "qty", value: (m) => Number(m.quantity) },
        { header: "Бирлиги", width: 8, value: (m) => unitLabel(m.unit) },
        { header: "Сумма", width: 16, kind: "money", value: (m) => m.total },
      ],
      rows: card.materials,
    }),
    sheet({ name: "Ёзувлар", title: `${card.site.name} — барча ёзувлар`, columns: entryColumns(user), rows: entries }),
  ]);
  return { buffer, filename: `Объект_${fileSafe(card.site.name)}_${todayIso()}.xlsx` };
}

export async function exportBalances(): Promise<ExportFile> {
  const rows = await getAccountBalances();
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((a, r) => a + f(r), 0n);
  const buffer = await buildWorkbook([
    sheet({
      name: "Кассалар",
      title: `Касса қолдиқлари (${formatDate(todayIso())})`,
      columns: [
        { header: "Ҳисоб", width: 24, value: (r) => r.name },
        { header: "Тури", width: 16, value: (r) => ACCOUNT_TYPE_LABEL[r.type] },
        { header: "Фирма", width: 18, value: (r) => r.companyName },
        { header: "Бошланғич", width: 15, kind: "money", value: (r) => r.openingBalance },
        { header: "Кирим", width: 15, kind: "money", value: (r) => r.income },
        { header: "Чиқим", width: 15, kind: "money", value: (r) => r.expense },
        { header: "Ўтказма +", width: 15, kind: "money", value: (r) => r.transferIn },
        { header: "Ўтказма −", width: 15, kind: "money", value: (r) => r.transferOut },
        { header: "Қолдиқ", width: 16, kind: "money", value: (r) => r.balance },
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
  return { buffer, filename: `Кассалар_${todayIso()}.xlsx` };
}

export async function exportStatement(user: SessionUser, accountId: number, month: string): Promise<ExportFile> {
  const st = await getAccountStatement(user, accountId, month);
  const buffer = await buildWorkbook([
    sheet({
      name: formatMonth(st.month),
      title: `${st.account.name} — ${formatMonth(st.month)}`,
      subtitle: `Ой бошига қолдиқ: ${st.opening.toString()} сўм`,
      columns: [
        { header: "№", width: 8, value: (r: StatementRow) => r.id },
        { header: "Сана", width: 11, kind: "date", value: (r) => excelDate(r.date) },
        { header: "Тури", width: 16, value: (r) => KIND_LABEL[r.kind] },
        { header: "Объект / ҳисоб", width: 24, value: (r) => r.siteName ?? (r.toAccountId === accountId ? r.accountName : r.toAccountName) },
        {
          header: "Тавсиф",
          width: 32,
          value: (r) =>
            [r.materialName && `${r.materialName} ${formatQuantity(r.quantity)} ${r.unit ? unitLabel(r.unit) : ""}`.trim(), r.counterpartyName, r.note]
              .filter(Boolean)
              .join(" · "),
        },
        { header: "Кирим", width: 15, kind: "money", value: (r) => (r.effect > 0n ? r.effect : null) },
        { header: "Чиқим", width: 15, kind: "money", value: (r) => (r.effect < 0n ? -r.effect : null) },
        { header: "Қолдиқ", width: 16, kind: "money", value: (r) => r.running },
      ],
      rows: st.rows,
      totals: { 5: st.inflow, 6: st.outflow, 7: st.closing },
    }),
  ]);
  return { buffer, filename: `Касса_${fileSafe(st.account.name)}_${st.month.slice(0, 7)}.xlsx` };
}
