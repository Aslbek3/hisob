import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { formatDate, dbDateToIso } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { listPayerBalances } from "@/services/payers";

export default async function PayersPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const payers = (await listPayerBalances()).filter((p) => p.isActive || p.total);

  return (
    <>
      <PageHeader title="Манбалар" subtitle="Пул берувчилар (инвестор, буюртмачи) — қанча пул киритгани, қарз тушунчаси йўқ" />
      <div className="overflow-x-auto border border-line mt-3">
        <table className="tbl">
          <thead>
            <tr>
              <th>Номи</th>
              <th className="num">Жами киритган</th>
              <th className="num">Нечта объектга</th>
              <th>Охирги ёзув</th>
            </tr>
          </thead>
          <tbody>
            {payers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-ink-3 py-6">
                  Ҳали пул берувчи йўқ
                </td>
              </tr>
            )}
            {payers.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/manbalar/${p.id}`} className="link font-medium text-[16px]">
                    {p.name}
                  </Link>
                  {p.phone && <div className="text-[13px] text-ink-3">{p.phone}</div>}
                </td>
                <td className="num"><Money value={p.total} /></td>
                <td className="num">{p.siteCount || "—"}</td>
                <td className="text-ink-3">{p.lastDate ? formatDate(dbDateToIso(p.lastDate)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
