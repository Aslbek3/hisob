import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatMonth, isValidIsoDate, monthEndIso, monthStartIso, prevMonthIso, todayIso } from "@/lib/dates";
import { unitLabel } from "@/lib/units";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { BalanceLabel } from "@/components/BalanceLabel";
import { getPeriodReport } from "@/services/reports";
import { getEntryOptions } from "@/services/reference";

type SP = Promise<Record<string, string | string[] | undefined>>;

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Boshliqlarga yuboriladigan hisobot: davr va ob'ektni tanlaydi, ekranda
 * tekshiradi, keyin Excel'ni yuklab oladi va Telegram'ga tashlaydi.
 */
export default async function ReportPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const today = todayIso();
  const date = (k: string) => (typeof sp[k] === "string" && isValidIsoDate(sp[k] as string) ? (sp[k] as string) : undefined);
  const from = date("from") ?? today;
  const to = date("to") ?? today;
  const siteNum = Number(sp.siteId);
  const siteId = Number.isInteger(siteNum) && siteNum > 0 ? siteNum : undefined;

  const [report, options] = await Promise.all([getPeriodReport(user, { siteId, from, to }), getEntryOptions(user)]);

  const link = (f: string, t: string) => `/hisobot?${new URLSearchParams({ from: f, to: t, ...(siteId ? { siteId: String(siteId) } : {}) })}`;
  const thisMonth = monthStartIso(today);
  const lastMonth = prevMonthIso(thisMonth);
  const quick: [string, string, string][] = [
    ["Бугун", today, today],
    ["Кеча", addDays(today, -1), addDays(today, -1)],
    ["Охирги 3 кун", addDays(today, -2), today],
    ["Шу ой", thisMonth, today],
    [formatMonth(lastMonth), lastMonth, monthEndIso(lastMonth)],
  ];
  const exportQs = new URLSearchParams({ from, to, ...(siteId ? { siteId: String(siteId) } : {}) });
  const grand = report.sites.reduce((a, s) => a + s.total, 0n);

  return (
    <>
      <PageHeader title="Ҳисобот" subtitle="Бошлиқларга юбориш учун: даврни танланг, текширинг, Excel'ни юклаб олинг" />

      <div className="bg-paper border border-line px-4 py-3 mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {quick.map(([label, f, t]) => (
            <Link key={label} href={link(f, t)} className={`btn ${f === from && t === to ? "btn-primary" : ""}`}>
              {label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-3">Объект</span>
            <select name="siteId" defaultValue={siteId ?? ""} className="field min-w-[200px]">
              <option value="">Барча объектлар</option>
              {options.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-3">Дан</span>
            <input type="date" name="from" defaultValue={from} max={today} className="field" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-3">Гача</span>
            <input type="date" name="to" defaultValue={to} max={today} className="field" />
          </label>
          <button className="btn">Кўрсатиш</button>
          <span className="ml-auto" />
          <ExportLink href={`/api/export/hisobot?${exportQs}`} label="Excel юклаб олиш" primary />
        </form>
      </div>

      <p className="mb-3 text-[16px]">
        {from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`}: жами харажат <b><Money value={grand} /></b> сўм
      </p>

      {report.sites.map((s) => (
        <section key={s.site.id} className="mb-8">
          <h2 className="text-[17px] font-semibold mb-2">{s.site.name}</h2>
          {s.days.length === 0 ? (
            <p className="text-ink-3">Бу даврда ёзув йўқ.</p>
          ) : (
            <div className="overflow-x-auto border border-line">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="num">№</th>
                    <th>Номи</th>
                    <th className="num">Миқдори</th>
                    <th className="num">Нархи</th>
                    {report.payers.map((p) => (
                      <th key={p.key} className="num">
                        {p.label}
                      </th>
                    ))}
                    <th>Етказиб берувчи</th>
                    <th>Изоҳ</th>
                  </tr>
                </thead>
                <tbody>
                  {s.days.map((d) => (
                    <DayRows key={d.date} day={d} payers={report.payers.map((p) => p.key)} />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>ЖАМИ ХАРАЖАТ: <Money value={s.total} /></td>
                    {report.payers.map((p) => (
                      <td key={p.key} className="num">
                        <Money value={s.byPayer[p.key] ?? 0n} />
                      </td>
                    ))}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      ))}

      {/* Excel'ga shular ham tushadi — yuborishdan oldin ko'rib chiqsin */}
      {report.incomes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[17px] font-semibold mb-2">Келган пул (кирим)</h2>
          <div className="overflow-x-auto border border-line max-w-[900px]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Сана</th>
                  <th>Кимдан</th>
                  <th>Объект</th>
                  <th>Қайси ҳисобга</th>
                  <th className="num">Сумма</th>
                  <th>Изоҳ</th>
                </tr>
              </thead>
              <tbody>
                {report.incomes.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.date)}</td>
                    <td>{e.counterpartyName}</td>
                    <td>{e.siteName ?? "—"}</td>
                    <td>{e.accountName}</td>
                    <td className="num font-medium"><Money value={e.amount} /></td>
                    <td>{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.suppliers.some((s) => s.paid || s.received) && (
        <section className="mb-8">
          <h2 className="text-[17px] font-semibold mb-2">Етказиб берувчилар билан ҳисоб (бугунги ҳолат)</h2>
          <div className="overflow-x-auto border border-line max-w-[900px]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Номи</th>
                  <th className="num">Тўланган</th>
                  <th className="num">Олинган товар</th>
                  <th>Ҳолат</th>
                </tr>
              </thead>
              <tbody>
                {report.suppliers
                  .filter((s) => s.paid || s.received)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="num"><Money value={s.paid} /></td>
                      <td className="num"><Money value={s.received} /></td>
                      <td><BalanceLabel value={s.balance} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );

  function DayRows({ day, payers }: { day: (typeof report.sites)[number]["days"][number]; payers: string[] }) {
    return (
      <>
        <tr>
          <td colSpan={6 + payers.length} className="bg-canvas font-semibold">
            {formatDate(day.date)}
          </td>
        </tr>
        {day.lines.map((l) => (
          <tr key={l.entryId}>
            <td className="num text-ink-3">{l.no}</td>
            <td>{l.name}</td>
            <td className="num">
              {l.quantity} {l.unit ? unitLabel(l.unit) : ""}
            </td>
            <td className="num"><Money value={l.unitPrice} /></td>
            {payers.map((p) => (
              <td key={p} className="num">{l.payer === p ? <Money value={l.amount} /> : ""}</td>
            ))}
            <td>{l.supplier ?? ""}</td>
            <td className="text-[13px]">{l.note}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} className="text-right text-ink-2">
            Кун жами: <b><Money value={day.total} /></b>
          </td>
          {payers.map((p) => (
            <td key={p} className="num font-medium">{day.byPayer[p] ? <Money value={day.byPayer[p]} /> : ""}</td>
          ))}
          <td colSpan={2} />
        </tr>
      </>
    );
  }
}
