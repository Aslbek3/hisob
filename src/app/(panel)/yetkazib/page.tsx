import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { formatDate, dbDateToIso } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { BalanceLabel } from "@/components/BalanceLabel";
import { listSupplierBalances } from "@/services/suppliers";
import { NewSupplierForm } from "./NewSupplierForm";

export default async function SuppliersPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const suppliers = (await listSupplierBalances())
    .filter((s) => s.isActive || s.paid || s.received)
    .sort((a, b) => {
      const debt = (x: typeof a) => (x.balance !== 0n ? 0 : 1);
      return debt(a) - debt(b) || a.name.localeCompare(b.name);
    });

  return (
    <>
      <PageHeader
        title="Етказиб берувчилар"
        subtitle="Заводга қанча пул ўтказилди ва ундан қанча товар келди — фарқи ўзи ҳисобланади, қарзи борлар юқорида"
      />
      <NewSupplierForm />
      <div className="overflow-x-auto border border-line mt-3">
        <table className="tbl">
          <thead>
            <tr>
              <th>Номи</th>
              <th className="num">Жами олинган товар</th>
              <th className="num">Жами тўланган пул</th>
              <th>Қолдиқ</th>
              <th>Охирги ёзув</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-3 py-6">
                  Ҳали етказиб берувчи йўқ
                </td>
              </tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/yetkazib/${s.id}`} className="link font-medium text-[16px]">
                    {s.name}
                  </Link>
                  {s.phone && <div className="text-[13px] text-ink-3">{s.phone}</div>}
                </td>
                <td className="num"><Money value={s.received} /></td>
                <td className="num"><Money value={s.paid} /></td>
                <td><BalanceLabel value={s.balance} /></td>
                <td className="text-ink-3">{s.lastDate ? formatDate(dbDateToIso(s.lastDate)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
