import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { getAccountBalances } from "@/services/balances";

export default async function HisoblarPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const accounts = await getAccountBalances();
  const shown = accounts.filter((a) => a.isActive || a.balance !== 0n);
  const sum = (f: (a: (typeof accounts)[number]) => bigint) => shown.reduce((acc, a) => acc + f(a), 0n);

  return (
    <>
      <PageHeader title="Hisoblar" subtitle="Kassa qoldiqlari — yozuvlardan avtomatik hisoblanadi" actions={<ExportLink href="/api/export/hisoblar" />} />
      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Hisob</th>
              <th>Turi</th>
              <th>Firma</th>
              <th className="num">Boshlang&apos;ich</th>
              <th className="num">Kirim</th>
              <th className="num">Chiqim</th>
              <th className="num">O&apos;tkazma +</th>
              <th className="num">O&apos;tkazma −</th>
              <th className="num">Qoldiq</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} className={a.isActive ? "" : "text-ink-3"}>
                <td>
                  <Link href={`/hisoblar/${a.id}`} className="link font-medium">
                    {a.name}
                  </Link>
                  {!a.isActive && <span className="ml-2 text-[12px]">yopilgan</span>}
                </td>
                <td>{ACCOUNT_TYPE_LABEL[a.type]}</td>
                <td>{a.companyName ?? "—"}</td>
                <td className="num"><Money value={a.openingBalance} /></td>
                <td className="num"><Money value={a.income} /></td>
                <td className="num"><Money value={a.expense} /></td>
                <td className="num"><Money value={a.transferIn} /></td>
                <td className="num"><Money value={a.transferOut} /></td>
                <td className="num font-semibold"><Money value={a.balance} signed /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Jami</td>
              <td className="num"><Money value={sum((a) => a.openingBalance)} /></td>
              <td className="num"><Money value={sum((a) => a.income)} /></td>
              <td className="num"><Money value={sum((a) => a.expense)} /></td>
              <td className="num"><Money value={sum((a) => a.transferIn)} /></td>
              <td className="num"><Money value={sum((a) => a.transferOut)} /></td>
              <td className="num"><Money value={sum((a) => a.balance)} signed /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
