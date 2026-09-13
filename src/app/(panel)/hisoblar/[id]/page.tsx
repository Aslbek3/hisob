import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatMonth, isValidIsoDate, monthStartIso, nextMonthIso, prevMonthIso, todayIso } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { ServiceError } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { getAccountStatement } from "@/services/balances";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const m = (await searchParams).month;
  const current = monthStartIso(todayIso());
  const month = typeof m === "string" && isValidIsoDate(m) ? monthStartIso(m) : current;

  const st = await getAccountStatement(user, id, month).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });

  return (
    <>
      <PageHeader
        back={{ href: "/hisoblar", label: "Hisoblar" }}
        title={st.account.name}
        subtitle={st.account.companyName ?? undefined}
        actions={<ExportLink href={`/api/export/hisob?id=${id}&month=${month}`} />}
      />

      <div className="flex items-center gap-3 mb-3">
        <Link className="btn" href={`/hisoblar/${id}?month=${prevMonthIso(month)}`}>
          ←
        </Link>
        <span className="font-semibold min-w-[130px] text-center">{formatMonth(month)}</span>
        {month < current && (
          <Link className="btn" href={`/hisoblar/${id}?month=${nextMonthIso(month)}`}>
            →
          </Link>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-10 gap-y-2 mb-4 bg-paper border border-line px-4 py-3">
        <Stat label="Oy boshiga" value={st.opening} />
        <Stat label="Kirdi" value={st.inflow} />
        <Stat label="Chiqdi" value={st.outflow} />
        <Stat label="Oy oxiriga" value={st.closing} strong />
      </dl>

      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th className="num">№</th>
              <th>Sana</th>
              <th>Turi</th>
              <th>Ob&apos;ekt / hisob</th>
              <th>Tavsif</th>
              <th className="num">Kirim</th>
              <th className="num">Chiqim</th>
              <th className="num">Qoldiq</th>
            </tr>
          </thead>
          <tbody>
            {st.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-ink-3 py-6">
                  Bu oyda harakat yo&apos;q
                </td>
              </tr>
            )}
            {st.rows.map((r) => (
              <tr key={r.id}>
                <td className="num">
                  <Link href={`/jurnal/${r.id}`} className="link">
                    #{r.id}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{KIND_LABEL[r.kind]}</td>
                <td>{r.siteName ?? (r.toAccountId === id ? `← ${r.accountName}` : `→ ${r.toAccountName}`)}</td>
                <td>{[r.categoryName, r.materialName, r.counterpartyName, r.note].filter(Boolean).join(" · ")}</td>
                <td className="num">{r.effect > 0n && <Money value={r.effect} />}</td>
                <td className="num">{r.effect < 0n && <Money value={-r.effect} />}</td>
                <td className="num font-medium">
                  <Money value={r.running} signed />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: bigint; strong?: boolean }) {
  return (
    <div>
      <dt className="text-ink-3 text-[12px]">{label}</dt>
      <dd className={strong ? "text-[18px] font-semibold" : "text-[16px]"}>
        <Money value={value} signed={strong} />
      </dd>
    </div>
  );
}
