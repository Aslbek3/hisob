import type { AuditAction, Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";

/**
 * Audit yozuvi. DOIM o'zgarishning o'zi bilan bitta tranzaksiyada (tx)
 * chaqiriladi — biri yozilib, ikkinchisi yozilmay qolishi mumkin emas.
 */
export async function writeAudit(
  tx: Tx,
  params: {
    userId: number;
    action: AuditAction;
    entityType: string;
    entityId: string | number;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  }
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      before: toJson(params.before),
      after: toJson(params.after),
      reason: params.reason ?? null,
    },
  });
}

/** BigInt, Decimal va Date'ni JSON'ga xavfsiz aylantiradi. */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

export type AuditRow = {
  id: string;
  at: Date;
  userName: string;
  action: AuditAction;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
  reason: string | null;
};

export async function getAuditTrail(tx: Tx, entityType: string, entityId: string | number): Promise<AuditRow[]> {
  const rows = await tx.auditLog.findMany({
    where: { entityType, entityId: String(entityId) },
    orderBy: { id: "asc" },
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id.toString(),
    at: r.at,
    userName: r.user.name,
    action: r.action,
    before: r.before,
    after: r.after,
    reason: r.reason,
  }));
}
