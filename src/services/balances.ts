import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { isoToDbDate, monthEndIso, monthStartIso } from "@/lib/dates";
import type { SessionUser } from "@/types/auth";
import { listEntriesForExport, type EntryRow } from "@/services/entries";

/**
 * Kassa qoldig'i = boshlang'ich qoldiq + kirim − chiqim + kelgan o'tkazma − ketgan o'tkazma.
 * Faqat faol (bekor qilinmagan) yozuvlar. Hech qayerda saqlanmaydi — har safar
 * yozuvlardan hisoblanadi, shuning uchun "qoldiq noto'g'ri yangilangan" holati bo'lmaydi.
 */

export type AccountBalance = {
  id: number;
  name: string;
  type: AccountType;
  companyName: string | null;
  isActive: boolean;
  openingBalance: bigint;
  income: bigint;
  expense: bigint;
  transferIn: bigint;
  transferOut: bigint;
  balance: bigint;
};

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      include: { company: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.$queryRaw<{ id: number; income: bigint; expense: bigint; transfer_in: bigint; transfer_out: bigint }[]>`
      SELECT a.id,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind = 'INCOME'   AND e.account_id = a.id), 0)::bigint    AS income,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind = 'EXPENSE'  AND e.account_id = a.id), 0)::bigint    AS expense,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind = 'TRANSFER' AND e.to_account_id = a.id), 0)::bigint AS transfer_in,
        COALESCE(SUM(e.amount) FILTER (WHERE e.kind = 'TRANSFER' AND e.account_id = a.id), 0)::bigint    AS transfer_out
      FROM accounts a
      LEFT JOIN entries e ON e.status = 'ACTIVE' AND (e.account_id = a.id OR e.to_account_id = a.id)
      GROUP BY a.id`,
  ]);
  const byId = new Map(sums.map((s) => [s.id, s]));

  return accounts.map((a) => {
    const s = byId.get(a.id);
    const income = s?.income ?? 0n;
    const expense = s?.expense ?? 0n;
    const transferIn = s?.transfer_in ?? 0n;
    const transferOut = s?.transfer_out ?? 0n;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      companyName: a.company?.name ?? null,
      isActive: a.isActive,
      openingBalance: a.openingBalance,
      income,
      expense,
      transferIn,
      transferOut,
      balance: a.openingBalance + income - expense + transferIn - transferOut,
    };
  });
}

/** Yozuvning shu hisob qoldig'iga ta'siri: + kirdi, − chiqdi. */
export function accountEffect(e: Pick<EntryRow, "kind" | "accountId" | "toAccountId" | "amount">, accountId: number): bigint {
  const amount = BigInt(e.amount);
  if (e.kind === "INCOME") return amount;
  if (e.kind === "TRANSFER" && e.toAccountId === accountId) return amount;
  return -amount; // EXPENSE yoki ketgan o'tkazma
}

export type StatementRow = EntryRow & { effect: bigint; running: bigint };

export type AccountStatement = {
  account: { id: number; name: string; type: AccountType; companyName: string | null };
  month: string;
  opening: bigint;
  inflow: bigint;
  outflow: bigint;
  closing: bigint;
  rows: StatementRow[];
};

/** Bitta hisobning bir oylik harakati: oy boshidagi qoldiq, har qator va yakuniy qoldiq. */
export async function getAccountStatement(user: SessionUser, accountId: number, monthIso: string): Promise<AccountStatement> {
  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { company: { select: { name: true } } } });
  if (!account) throw notFound("Hisob topilmadi");

  const month = monthStartIso(monthIso);
  const [before] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(CASE
      WHEN kind = 'INCOME' THEN amount
      WHEN kind = 'TRANSFER' AND to_account_id = ${accountId} THEN amount
      ELSE -amount END), 0)::bigint AS total
    FROM entries
    WHERE status = 'ACTIVE' AND (account_id = ${accountId} OR to_account_id = ${accountId})
      AND date < ${isoToDbDate(month)}`;

  const entries = await listEntriesForExport(user, {
    accountId,
    from: month,
    to: monthEndIso(month),
    status: "ACTIVE",
  });

  const opening = account.openingBalance + before.total;
  let running = opening;
  let inflow = 0n;
  let outflow = 0n;
  const rows = entries.map((e) => {
    const effect = accountEffect(e, accountId);
    running += effect;
    if (effect > 0n) inflow += effect;
    else outflow -= effect;
    return { ...e, effect, running };
  });

  return {
    account: { id: account.id, name: account.name, type: account.type, companyName: account.company?.name ?? null },
    month,
    opening,
    inflow,
    outflow,
    closing: running,
    rows,
  };
}
