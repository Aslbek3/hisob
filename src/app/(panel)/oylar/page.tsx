import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatMonth, monthEndIso } from "@/lib/dates";
import { canClosePeriods } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { listPeriods } from "@/services/periods";
import { PeriodButton } from "./PeriodButton";

export default async function OylarPage() {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const periods = await listPeriods();
  const canClose = canClosePeriods(user);

  return (
    <>
      <PageHeader
        title="Ойлар"
        subtitle="Ёпилган ойга ёзув қўшиб, ўзгартириб ёки бекор қилиб бўлмайди. Бошлиқларга ҳисобот юборилгач ойни ёпиш тавсия этилади."
      />
      <div className="overflow-x-auto border border-line max-w-[760px]">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ой</th>
              <th className="num">Ёзувлар</th>
              <th>Ҳолати</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.month}>
                <td>
                  <Link href={`/jurnal?from=${p.month}&to=${monthEndIso(p.month)}`} className="link">
                    {formatMonth(p.month)}
                  </Link>
                </td>
                <td className="num">{p.entryCount}</td>
                <td>
                  {p.closed ? (
                    <span className="text-ink-2">
                      Ёпилган · {p.closedBy}, {p.closedAt && formatDateTime(p.closedAt)}
                    </span>
                  ) : (
                    <span className="text-plus">Очиқ</span>
                  )}
                </td>
                <td className="text-right">
                  {canClose && (p.closed || p.canClose) && <PeriodButton month={p.month} closed={p.closed} label={formatMonth(p.month)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
