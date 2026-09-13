import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { canManageSites, isOffice } from "@/lib/permissions";
import { formatMonthShort } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { listSites, lastMonths } from "@/services/sites";
import { getClosedMonths } from "@/services/periods";
import { NewSiteForm, SiteStatusButton } from "./SiteActions";

const MONTHS_BACK = 6;

export default async function ObyektlarPage() {
  const user = await requirePageUser();
  const [sites, closed] = await Promise.all([listSites(user, { monthsBack: MONTHS_BACK }), getClosedMonths()]);
  const months = lastMonths(MONTHS_BACK);
  const office = isOffice(user);
  const manage = canManageSites(user);

  const active = sites.filter((s) => s.status === "ACTIVE");
  const archived = sites.filter((s) => s.status === "ARCHIVED");
  const total = (f: (s: (typeof sites)[number]) => bigint | null) => sites.reduce((a, s) => a + (f(s) ?? 0n), 0n);

  return (
    <>
      <PageHeader
        title="Ob'ektlar"
        subtitle={`${active.length} ta faol${archived.length ? `, ${archived.length} ta arxivda` : ""}`}
        actions={<ExportLink href="/api/export/obyektlar" />}
      />

      {manage && <NewSiteForm />}

      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ob&apos;ekt</th>
              {office && <th className="num">Jami kirim</th>}
              <th className="num">Jami chiqim</th>
              {months.map((m) => (
                <th key={m} className="num">
                  {formatMonthShort(m)}
                  <span className={`block text-[11px] font-normal ${closed.has(m) ? "text-ink-3" : "text-plus"}`}>
                    {closed.has(m) ? "yopilgan" : "ochiq"}
                  </span>
                </th>
              ))}
              {manage && <th />}
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 && (
              <tr>
                <td colSpan={months.length + 4} className="text-ink-3 py-6 text-center">
                  Hali ob&apos;ekt yo&apos;q
                </td>
              </tr>
            )}
            {[...active, ...archived].map((s) => (
              <tr key={s.id} className={s.status === "ARCHIVED" ? "text-ink-3" : ""}>
                <td>
                  <Link href={`/obyektlar/${s.id}`} className="link font-medium">
                    {s.name}
                  </Link>
                  {s.status === "ARCHIVED" && <span className="ml-2 text-[12px]">arxivda</span>}
                  {s.address && <div className="text-[12px] text-ink-3">{s.address}</div>}
                </td>
                {office && (
                  <td className="num">
                    <Money value={s.income} />
                  </td>
                )}
                <td className="num font-medium">
                  <Money value={s.expense} />
                </td>
                {s.monthly.map((m) => (
                  <td key={m.month} className="num">
                    <Money value={m.expense} />
                  </td>
                ))}
                {manage && (
                  <td className="text-right">
                    <SiteStatusButton id={s.id} name={s.name} status={s.status} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {sites.length > 1 && (
            <tfoot>
              <tr>
                <td>Jami</td>
                {office && (
                  <td className="num">
                    <Money value={total((s) => s.income)} />
                  </td>
                )}
                <td className="num">
                  <Money value={total((s) => s.expense)} />
                </td>
                {months.map((m, i) => (
                  <td key={m} className="num">
                    <Money value={total((s) => s.monthly[i].expense)} />
                  </td>
                ))}
                {manage && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
