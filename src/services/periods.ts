import { prisma, type Tx } from "@/lib/prisma";
// Eslatma: 1–2 kishi bir vaqtda ishlaydi — oy yopish va yozuv saqlash
// orasidagi poyga (race) uchun alohida qulf ataylab qo'yilmagan.
import { ServiceError } from "@/lib/errors";
import { dbDateToIso, formatMonth, isoToDbDate, monthStartIso, nextMonthIso, todayIso } from "@/lib/dates";
import type { SessionUser } from "@/types/auth";
import { writeAudit } from "@/services/audit";

/**
 * Sana yozuv uchun ochiqmi: kelajakda emas va oyi yopilmagan.
 * Yozuv yaratish/tuzatish/bekor qilishdan oldin, shu tranzaksiya ichida.
 */
export async function assertDateWritable(tx: Tx, dateIso: string) {
  if (dateIso > todayIso()) {
    throw new ServiceError("Келажак санасига ёзув киритиб бўлмайди", 400, "FUTURE_DATE");
  }
  const month = monthStartIso(dateIso);
  const closed = await tx.closedPeriod.findUnique({ where: { month: isoToDbDate(month) } });
  if (closed) {
    throw new ServiceError(`${formatMonth(month)} ёпилган — бу ойга ёзув қўшиб ёки ўзгартириб бўлмайди`, 409, "PERIOD_CLOSED");
  }
}

export async function getClosedMonths(): Promise<Set<string>> {
  const rows = await prisma.closedPeriod.findMany({ select: { month: true } });
  return new Set(rows.map((r) => dbDateToIso(r.month)));
}

export type PeriodRow = {
  month: string;
  closed: boolean;
  closedAt: Date | null;
  closedBy: string | null;
  entryCount: number;
  canClose: boolean;
};

/** Birinchi yozuv oyidan joriy oygacha barcha oylar, holati bilan (yangisi yuqorida). */
export async function listPeriods(): Promise<PeriodRow[]> {
  const [first, closed, counts] = await Promise.all([
    prisma.entry.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.closedPeriod.findMany({ include: { closedBy: { select: { name: true } } } }),
    prisma.$queryRaw<{ month: Date; n: bigint }[]>`
      SELECT date_trunc('month', date)::date AS month, count(*) AS n
      FROM entries WHERE status = 'ACTIVE' GROUP BY 1`,
  ]);

  const current = monthStartIso(todayIso());
  const start = first ? monthStartIso(dbDateToIso(first.date)) : current;
  const closedMap = new Map(closed.map((c) => [dbDateToIso(c.month), c]));
  const countMap = new Map(counts.map((c) => [dbDateToIso(c.month), Number(c.n)]));

  const rows: PeriodRow[] = [];
  for (let m = start; m <= current; m = nextMonthIso(m)) {
    const c = closedMap.get(m);
    rows.push({
      month: m,
      closed: !!c,
      closedAt: c?.closedAt ?? null,
      closedBy: c?.closedBy.name ?? null,
      entryCount: countMap.get(m) ?? 0,
      canClose: !c && m < current,
    });
  }
  return rows.reverse();
}

/** Oyni yopish. Faqat tugagan oy (joriy oy tugamaguncha yopilmaydi). */
export async function closeMonth(user: SessionUser, monthIso: string) {
  const month = monthStartIso(monthIso);
  if (month >= monthStartIso(todayIso())) {
    throw new ServiceError("Фақат тугаган ойни ёпиш мумкин", 400);
  }
  await prisma.$transaction(async (tx) => {
    const exists = await tx.closedPeriod.findUnique({ where: { month: isoToDbDate(month) } });
    if (exists) throw new ServiceError(`${formatMonth(month)} аллақачон ёпилган`, 409);
    await tx.closedPeriod.create({ data: { month: isoToDbDate(month), closedById: user.id } });
    await writeAudit(tx, { userId: user.id, action: "CLOSE_MONTH", entityType: "Period", entityId: month });
  });
}

/** Yopilgan oyni qayta ochish — sabab majburiy, audit jurnalida qoladi. */
export async function reopenMonth(user: SessionUser, monthIso: string, reason: string) {
  const month = monthStartIso(monthIso);
  await prisma.$transaction(async (tx) => {
    const row = await tx.closedPeriod.findUnique({ where: { month: isoToDbDate(month) } });
    if (!row) throw new ServiceError(`${formatMonth(month)} ёпилмаган`, 409);
    await tx.closedPeriod.delete({ where: { month: isoToDbDate(month) } });
    await writeAudit(tx, {
      userId: user.id,
      action: "REOPEN_MONTH",
      entityType: "Period",
      entityId: month,
      before: { closedAt: row.closedAt, closedById: row.closedById },
      reason,
    });
  });
}
