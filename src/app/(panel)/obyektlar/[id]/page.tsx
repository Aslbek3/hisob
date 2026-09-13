import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { formatMonth, monthEndIso } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { unitLabel } from "@/lib/units";
import { ServiceError } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { getSiteCard } from "@/services/sites";
import { getClosedMonths } from "@/services/periods";

export default async function SiteCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const card = await getSiteCard(user, id).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const closed = await getClosedMonths();
  const office = card.income !== null;
  const { site } = card;

  return (
    <>
      <PageHeader
        back={{ href: "/obyektlar", label: "Ob'ektlar" }}
        title={site.name}
        subtitle={[site.address, site.status === "ARCHIVED" ? "arxivda" : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Link href={`/jurnal?siteId=${site.id}`} className="btn">
              Jurnal
            </Link>
            {site.status === "ACTIVE" && (
              <Link href={`/kiritish?siteId=${site.id}`} className="btn">
                Kiritish
              </Link>
            )}
            <ExportLink href={`/api/export/obyekt?id=${site.id}`} />
          </>
        }
      />

      {/* Jami raqamlar — kartochka emas, bitta qator */}
      <dl className="flex flex-wrap gap-x-10 gap-y-2 mb-5 bg-paper border border-line px-4 py-3">
        {office && (
          <div>
            <dt className="text-ink-3 text-[12px]">Jami kirim</dt>
            <dd className="text-[18px] font-semibold">
              <Money value={card.income} />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-ink-3 text-[12px]">Jami chiqim</dt>
          <dd className="text-[18px] font-semibold">
            <Money value={card.expense} />
          </dd>
        </div>
        {office && (
          <div>
            <dt className="text-ink-3 text-[12px]">Farq (kirim − chiqim)</dt>
            <dd className="text-[18px] font-semibold">
              <Money value={(card.income ?? 0n) - card.expense} signed />
            </dd>
          </div>
        )}
      </dl>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Oylar bo&apos;yicha</h2>
        {card.months.length === 0 ? (
          <p className="text-ink-3">Hali yozuv yo&apos;q.</p>
        ) : (
          <div className="overflow-x-auto border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Oy</th>
                  {office && <th className="num">Kirim</th>}
                  <th className="num">Chiqim</th>
                  {card.categories.map((c) => (
                    <th key={c.id} className="num">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.months.map((m) => (
                  <tr key={m.month}>
                    <td className="whitespace-nowrap">
                      <Link href={`/jurnal?siteId=${site.id}&from=${m.month}&to=${monthEndIso(m.month)}`} className="link">
                        {formatMonth(m.month)}
                      </Link>
                      {closed.has(m.month) && <span className="ml-2 text-[12px] text-ink-3">yopilgan</span>}
                    </td>
                    {office && (
                      <td className="num">
                        <Money value={m.income} />
                      </td>
                    )}
                    <td className="num font-medium">
                      <Money value={m.expense} />
                    </td>
                    {card.categories.map((c) => (
                      <td key={c.id} className="num">
                        <Money value={m.byCategory[c.id] ?? 0n} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Jami</td>
                  {office && (
                    <td className="num">
                      <Money value={card.income} />
                    </td>
                  )}
                  <td className="num">
                    <Money value={card.expense} />
                  </td>
                  {card.categories.map((c) => (
                    <td key={c.id} className="num">
                      <Money value={c.total} />
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {card.materials.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Materiallar</h2>
          <div className="overflow-x-auto border border-line max-w-[760px]">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="num">Miqdor</th>
                  <th>Birlik</th>
                  <th className="num">Summa</th>
                </tr>
              </thead>
              <tbody>
                {card.materials.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/jurnal?siteId=${site.id}&materialId=${m.id}`} className="link">
                        {m.name}
                      </Link>
                    </td>
                    <td className="num">{formatQuantity(m.quantity)}</td>
                    <td className="text-ink-3">{unitLabel(m.unit)}</td>
                    <td className="num">
                      <Money value={m.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
