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

  const editQs = new URLSearchParams({ kind: e.kind, date: e.date, accountId: String(e.accountId), focus: String(e.id) });
  if (e.siteId) editQs.set("siteId", String(e.siteId));

  const rows: [string, React.ReactNode][] = [
    ["Turi", KIND_LABEL[e.kind]],
    ["Sana", formatDate(e.date)],
    ...(e.siteName ? [["Ob'ekt", e.siteName] as [string, React.ReactNode]] : []),
    [e.kind === "TRANSFER" ? "Qaysi hisobdan" : "Hisob", e.accountName],
    ...(e.toAccountName ? [["Qaysi hisobga", e.toAccountName] as [string, React.ReactNode]] : []),
    ...(e.categoryName ? [["Kategoriya", e.categoryName] as [string, React.ReactNode]] : []),
    ...(e.materialName ? [["Material", e.materialName] as [string, React.ReactNode]] : []),
    ...(e.counterpartyName ? [["Kimdan", e.counterpartyName] as [string, React.ReactNode]] : []),
    ...(e.kind === "EXPENSE"
      ? ([
          ["Miqdor", `${formatQuantity(e.quantity)} ${e.unit ? unitLabel(e.unit) : ""}`],
          ["Narx", <Money key="p" value={e.unitPrice} />],
        ] as [string, React.ReactNode][])
      : []),
    ["Summa", <b key="a"><Money value={e.amount} /></b>],
    ["Izoh", e.note ?? "—"],
    ["Kiritgan", `${e.createdByName}, ${formatDateTime(e.createdAt)}`],
    ...(e.updatedAt ? [["Oxirgi o'zgartirish", `${e.updatedByName}, ${formatDateTime(e.updatedAt)}`] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/jurnal", label: "Jurnal" }}
        title={`Yozuv #${e.id}`}
        subtitle={e.status === "CANCELLED" ? <span className="text-minus">Bekor qilingan</span> : closed ? "Oy yopilgan — o'zgartirib bo'lmaydi" : undefined}
        actions={
          editable && (
            <>
              <Link href={`/kiritish?${editQs}`} className="btn">
                Tuzatish
              </Link>
              <CancelEntryButton id={e.id} />
            </>
          )
        }
      />

      {e.status === "CANCELLED" && (
        <div className="mb-4 px-3 py-2 bg-err-soft border border-line">
          {e.cancelledByName} tomonidan {e.cancelledAt && formatDateTime(e.cancelledAt)} da bekor qilingan. Sabab: {e.cancelReason}
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
          <h2 className="font-semibold mb-2">O&apos;zgarishlar tarixi</h2>
          <AuditTrail rows={audit.map((a) => ({ ...a, at: a.at.toISOString() }))} />
        </section>
      )}
    </>
  );
}
