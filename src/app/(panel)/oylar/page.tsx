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
        title="Oylar"
        subtitle="Yopilgan oyga yozuv qo'shib, o'zgartirib yoki bekor qilib bo'lmaydi. Oyni faqat direktor yopadi."
      />
      <table className="tbl max-w-[760px] border border-line">
        <thead>
          <tr>
            <th>Oy</th>
            <th className="num">Yozuvlar</th>
            <th>Holati</th>
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
                    Yopilgan · {p.closedBy}, {p.closedAt && formatDateTime(p.closedAt)}
                  </span>
                ) : (
                  <span className="text-plus">Ochiq</span>
                )}
              </td>
              <td className="text-right">
                {canClose && (p.closed || p.canClose) && <PeriodButton month={p.month} closed={p.closed} label={formatMonth(p.month)} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
