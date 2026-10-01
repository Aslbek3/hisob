import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { formatDate, isValidIsoDate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { ServiceError } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { BalanceLabel } from "@/components/BalanceLabel";
import { ExportLink } from "@/components/ExportLink";
import { getSupplierSiteBalances } from "@/services/suppliers";
import { listEntriesForExport, describeEntry } from "@/services/entries";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SupplierSiteReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const date = (k: string) => (typeof sp[k] === "string" && isValidIsoDate(sp[k] as string) ? (sp[k] as string) : undefined);
  const from = date("from");
  const to = date("to");
  const siteIdRaw = Number(sp.siteId);
  const siteId = Number.isInteger(siteIdRaw) && siteIdRaw > 0 ? siteIdRaw : undefined;

  const [card, history] = await Promise.all([
    getSupplierSiteBalances(id).catch((e) => {
      if (e instanceof ServiceError && e.status === 404) notFound();
      throw e;
    }),
    listEntriesForExport(user, { counterpartyId: id, siteId, from, to, status: "ACTIVE" }),
  ]);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ from, to, siteId: siteId ? String(siteId) : undefined, ...extra })) {
      if (v) p.set(k, v);
    }
    return p.toString();
  };
  const exportQs = new URLSearchParams({ id: String(id), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(siteId ? { siteId: String(siteId) } : {}) });
  const selectedSite = siteId ? card.sites.find((s) => s.siteId === siteId) : undefined;

  return (
    <>
      <PageHeader
        back={{ href: "/yetkazib-beruvchilar", label: "Етказиб берувчилар" }}
        title={card.supplier.name}
        subtitle={card.supplier.phone ?? undefined}
        actions={<ExportLink href={`/api/export/yetkazib-obyektlar?${exportQs}`} label="Excel" />}
      />

      <div className="bg-paper border border-line px-4 py-3 mb-4 flex flex-wrap gap-x-10 gap-y-2 items-center text-[16px]">
        <div>
          <div className="text-ink-3 text-[13px]">Жами олинган товар</div>
          <b><Money value={card.received} /></b>
        </div>
        <div>
          <div className="text-ink-3 text-[13px]">Жами тўланган пул</div>
          <b><Money value={card.paid} /></b>
        </div>
        <div>
          <div className="text-ink-3 text-[13px]">Қолдиқ</div>
          <BalanceLabel value={card.balance} />
        </div>
      </div>

      <div className="overflow-x-auto border border-line mb-3">
        <table className="tbl">
          <thead>
            <tr>
              <th>Объект</th>
              <th className="num">Олинган</th>
              <th className="num">Тўланган</th>
              <th>Қолдиқ</th>
            </tr>
          </thead>
          <tbody>
            {card.sites.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-ink-3 py-6">
                  Ҳали ёзув йўқ
                </td>
              </tr>
            )}
            {card.sites.map((s) => (
              <tr key={s.siteId} className={s.siteId === siteId ? "bg-accent-soft" : ""}>
                <td>
                  <Link href={`?${qs({ siteId: String(s.siteId) })}`} className="link font-medium">
                    {s.siteName}
                  </Link>
                </td>
                <td className="num"><Money value={s.received} /></td>
                <td className="num"><Money value={s.paid} /></td>
                <td><BalanceLabel value={s.balance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="flex flex-wrap items-end gap-2 mb-3">
        {siteId && <input type="hidden" name="siteId" value={siteId} />}
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-3">Дан</span>
          <input type="date" name="from" defaultValue={from} className="field" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-3">Гача</span>
          <input type="date" name="to" defaultValue={to} className="field" />
        </label>
        <button className="btn">Кўрсатиш</button>
        {(from || to || siteId) && (
          <Link href={`/yetkazib-beruvchilar/${id}`} className="btn">
            Бутунлай тозалаш
          </Link>
        )}
      </form>

      {selectedSite && (
        <p className="text-[13px] text-ink-3 mb-2">
          Фильтр: <b>{selectedSite.siteName}</b> ·{" "}
          <Link href={`?${qs({ siteId: undefined })}`} className="link">
            барча объектлар
          </Link>
        </p>
      )}

      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Сана</th>
              <th>Объект</th>
              <th>Тури</th>
              <th>Изоҳ</th>
              <th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-3 py-6">
                  Бу даврда ёзув йўқ
                </td>
              </tr>
            )}
            {history.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{r.siteName ?? "—"}</td>
                <td>{KIND_LABEL[r.kind]}</td>
                <td className="text-[13px]">{describeEntry(r)}</td>
                <td className="num"><Money value={r.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
