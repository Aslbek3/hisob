import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { MoneyMoveForm } from "@/components/MoneyMoveForm";
import { getAccountBalances } from "@/services/balances";
import { getEntryOptions } from "@/services/reference";

export default async function KassalarPage() {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const [accounts, options] = await Promise.all([getAccountBalances(), getEntryOptions(user)]);
  const shown = accounts.filter((a) => a.isActive || a.balance !== 0n);
  const sum = (f: (a: (typeof accounts)[number]) => bigint) => shown.reduce((acc, a) => acc + f(a), 0n);
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Кассалар"
        subtitle="Ҳар бир ҳисобда қанча пул қолгани — ёзувлардан ўзи ҳисобланади"
        actions={<ExportLink href="/api/export/hisoblar" />}
      />
      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ҳисоб</th>
              <th>Тури</th>
              <th className="num">Бошланғич</th>
              <th className="num">Кирим</th>
              <th className="num">Чиқим</th>
              <th className="num">Ўтказма +</th>
              <th className="num">Ўтказма −</th>
              <th className="num">Қолдиқ</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} className={a.isActive ? "" : "text-ink-3"}>
                <td>
                  <Link href={`/hisoblar/${a.id}`} className="link font-medium text-[16px]">
                    {a.name}
                  </Link>
                  {a.companyName && <div className="text-[13px] text-ink-3">{a.companyName}</div>}
                </td>
                <td>{ACCOUNT_TYPE_LABEL[a.type]}</td>
                <td className="num"><Money value={a.openingBalance} /></td>
                <td className="num"><Money value={a.income} /></td>
                <td className="num"><Money value={a.expense} /></td>
                <td className="num"><Money value={a.transferIn} /></td>
                <td className="num"><Money value={a.transferOut} /></td>
                <td className="num font-semibold text-[17px]"><Money value={a.balance} signed /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Жами</td>
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
      <p className="text-[13px] text-ink-3 mt-2">
        Манфий қолдиқ (қизил) — ҳисобдан келган пулдан кўп сарфланган. Масалан, шахсий ҳисобда бу фирма ўша одамга қарз эканини билдиради.
      </p>

      <section className="bg-paper border border-line px-4 py-3 mt-6">
        <h2 className="text-[17px] font-semibold mb-2">Пул келди (кирим)</h2>
        <MoneyMoveForm kind="INCOME" payers={options.payers} accounts={options.accounts} today={today} />
      </section>

      <section className="bg-paper border border-line px-4 py-3 mt-4">
        <h2 className="text-[17px] font-semibold mb-2">Ҳисоблар орасида ўтказма</h2>
        <p className="text-[13px] text-ink-3 mb-2">Масалан: фирма кассасидан бир одамнинг шахсий ҳисобига нахт пул берилди, ёки банкдан нахтга ечилди.</p>
        <MoneyMoveForm kind="TRANSFER" accounts={options.accounts} today={today} />
      </section>
    </>
  );
}
