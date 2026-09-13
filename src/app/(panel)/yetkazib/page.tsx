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
  const suppliers = (await listSupplierBalances()).filter((s) => s.isActive || s.paid || s.received);

  return (
    <>
      <PageHeader
        title="Етказиб берувчилар"
        subtitle="Заводга қанча пул ўтказилди ва ундан қанча товар келди — фарқи ўзи ҳисобланади"
      />
      <NewSupplierForm />
      <div className="overflow-x-auto border border-line mt-3">
        <table className="tbl">
          <thead>
            <tr>
              <th>Номи</th>
              <th className="num">Тўланган пул</th>
              <th className="num">Келган товар</th>
              <th>Ҳолат</th>
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
                <td className="num"><Money value={s.paid} /></td>
                <td className="num"><Money value={s.received} /></td>
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
