import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatDateTime, monthStartIso } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { unitLabel } from "@/lib/units";
import { KIND_LABEL } from "@/lib/labels";
import { ServiceError } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { getEntryDetail } from "@/services/entries";
import { getClosedMonths } from "@/services/periods";
import { AuditTrail } from "./AuditTrail";
import { CancelEntryButton } from "./CancelEntryButton";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { entry: e, audit } = await getEntryDetail(user, id).catch((err) => {
    if (err instanceof ServiceError && err.status === 404) notFound();
    throw err;
  });
  const closed = (await getClosedMonths()).has(monthStartIso(e.date));
  const editable = e.canModify && !closed;

  // Ob'ekt xarajati kunlik daftarning o'zida tuzatiladi; boshqa turlar — bekor qilib qayta kiritiladi
  const siteExpense = e.kind === "EXPENSE" || e.kind === "GOODS_RECEIPT";
  const editQs = new URLSearchParams({ date: e.date, siteId: String(e.siteId ?? ""), focus: String(e.id) });

  const rows: [string, React.ReactNode][] = [
    ["Тури", KIND_LABEL[e.kind]],
    ["Сана", formatDate(e.date)],
    ...(e.siteName ? [["Объект", e.siteName] as [string, React.ReactNode]] : []),
    [e.kind === "TRANSFER" ? "Қайси ҳисобдан" : e.kind === "INCOME" ? "Қайси ҳисобга" : "Ким тўлади", e.kind === "GOODS_RECEIPT" ? "Қарзга" : e.accountName],
    ...(e.toAccountName ? [["Қайси ҳисобга", e.toAccountName] as [string, React.ReactNode]] : []),
    ...(e.materialName ? [["Номи", e.materialName] as [string, React.ReactNode]] : []),
    ...(e.categoryName ? [["Категория", e.categoryName] as [string, React.ReactNode]] : []),
    ...(e.counterpartyName ? [[e.kind === "INCOME" ? "Кимдан" : "Етказиб берувчи", e.counterpartyName] as [string, React.ReactNode]] : []),
    ...(siteExpense
      ? ([
          ["Миқдор", `${formatQuantity(e.quantity)} ${e.unit ? unitLabel(e.unit) : ""}`],
          ["Нархи", <Money key="p" value={e.unitPrice} />],
        ] as [string, React.ReactNode][])
      : []),
    ["Сумма", <b key="a"><Money value={e.amount} /></b>],
    ...(e.adjustReason ? [["Фарқ сабаби", e.adjustReason] as [string, React.ReactNode]] : []),
    ["Изоҳ", e.note ?? "—"],
    ["Киритган", `${e.createdByName}, ${formatDateTime(e.createdAt)}`],
    ...(e.updatedAt ? [["Охирги ўзгартириш", `${e.updatedByName}, ${formatDateTime(e.updatedAt)}`] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/jurnal", label: "Барча ёзувлар" }}
        title={`Ёзув №${e.id}`}
        subtitle={e.status === "CANCELLED" ? <span className="text-minus">Бекор қилинган</span> : closed ? "Ой ёпилган — ўзгартириб бўлмайди" : undefined}
        actions={
          editable && (
            <>
              {siteExpense && (
                <Link href={`/kiritish?${editQs}`} className="btn">
                  Тузатиш
                </Link>
              )}
              <CancelEntryButton id={e.id} />
            </>
          )
        }
      />

      {e.status === "CANCELLED" && (
        <div className="mb-4 px-3 py-2 bg-err-soft border border-line">
          {e.cancelledByName} томонидан {e.cancelledAt && formatDateTime(e.cancelledAt)} да бекор қилинган. Сабаб: {e.cancelReason}
        </div>
      )}

      <table className="tbl max-w-[620px] border border-line mb-6">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="w-[180px] text-ink-3">{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {audit.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Ўзгаришлар тарихи</h2>
          <AuditTrail rows={audit.map((a) => ({ ...a, at: a.at.toISOString() }))} />
        </section>
      )}
    </>
  );
}
