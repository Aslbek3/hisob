import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { formatDate, isValidIsoDate, todayIso } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { unitLabel } from "@/lib/units";
import { ServiceError } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { BalanceLabel } from "@/components/BalanceLabel";
import { ExportLink } from "@/components/ExportLink";
import { MoneyMoveForm } from "@/components/MoneyMoveForm";
import { getSupplierStatement } from "@/services/suppliers";
import { getEntryOptions } from "@/services/reference";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const date = (k: string) => (typeof sp[k] === "string" && isValidIsoDate(sp[k] as string) ? (sp[k] as string) : undefined);
  const from = date("from");
  const to = date("to");

  const [st, options] = await Promise.all([
    getSupplierStatement(user, id, { from, to }).catch((e) => {
      if (e instanceof ServiceError && e.status === 404) notFound();
      throw e;
    }),
    getEntryOptions(user),
  ]);
  const qs = new URLSearchParams({ id: String(id), ...(from ? { from } : {}), ...(to ? { to } : {}) });

  return (
    <>
      <PageHeader
        back={{ href: "/yetkazib", label: "Етказиб берувчилар" }}
        title={st.supplier.name}
        subtitle={st.supplier.phone ?? undefined}
        actions={<ExportLink href={`/api/export/yetkazib?${qs}`} label="Солиштириш далолатномаси (Excel)" />}
      />

      <div className="bg-paper border border-line px-4 py-3 mb-4 flex flex-wrap gap-x-10 gap-y-2 items-center text-[16px]">
        {from && (
          <div>
            <div className="text-ink-3 text-[13px]">Давр бошига</div>
            <BalanceLabel value={st.opening} />
          </div>
        )}
        <div>
          <div className="text-ink-3 text-[13px]">Тўланган пул</div>
          <b><Money value={st.paid} /></b>
        </div>
        <div>
          <div className="text-ink-3 text-[13px]">Келган товар</div>
          <b><Money value={st.received} /></b>
        </div>
        <div>
          <div className="text-ink-3 text-[13px]">Ҳозирги ҳолат</div>
          <BalanceLabel value={st.closing} />
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-3">Дан</span>
          <input type="date" name="from" defaultValue={from} className="field" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-3">Гача</span>
          <input type="date" name="to" defaultValue={to} className="field" />
        </label>
        <button className="btn">Кўрсатиш</button>
        {(from || to) && (
          <Link href={`/yetkazib/${id}`} className="btn">
            Бутун давр
          </Link>
        )}
      </form>

      <div className="overflow-x-auto border border-line mb-6">
        <table className="tbl">
          <thead>
            <tr>
              <th>Сана</th>
              <th>Объект</th>
              <th>Номи</th>
              <th className="num">Миқдор</th>
              <th className="num">Нархи</th>
              <th className="num">Келган товар</th>
              <th className="num">Тўланган пул</th>
              <th className="num">Қолдиқ</th>
              <th>Изоҳ</th>
            </tr>
          </thead>
          <tbody>
            {st.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-ink-3 py-6">
                  Бу даврда ёзув йўқ
                </td>
              </tr>
            )}
            {st.rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{r.siteName ?? "—"}</td>
                <td>{r.kind === "SUPPLIER_PAYMENT" ? <b>Пул ўтказилди</b> : r.materialName}</td>
                <td className="num">{r.kind === "SUPPLIER_PAYMENT" ? "" : `${formatQuantity(r.quantity)} ${r.unit ? unitLabel(r.unit) : ""}`}</td>
                <td className="num">{r.kind === "SUPPLIER_PAYMENT" ? "" : <Money value={r.unitPrice} />}</td>
                <td className="num">{r.received ? <Money value={r.received} /> : ""}</td>
                <td className="num">{r.paid ? <Money value={r.paid} /> : ""}</td>
                <td className="num font-medium"><Money value={r.running} signed /></td>
                <td className="text-[13px]">{[r.accountName, r.note].filter(Boolean).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="bg-paper border border-line px-4 py-3">
        <h2 className="text-[17px] font-semibold mb-2">Заводга пул ўтказилди</h2>
        <MoneyMoveForm kind="SUPPLIER_PAYMENT" supplierId={id} accounts={options.accounts} today={todayIso()} />
        <p className="text-[13px] text-ink-3 mt-2">
          Товар келганда эса «Кунлик дафтар»да «Ким тўлади» устунида «Етказиб берувчи ҳисобидан» танланади — шу ерга ўзи тушади.
        </p>
      </section>
    </>
  );
}
