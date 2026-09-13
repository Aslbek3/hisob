import type { AuditAction, Prisma } from "@prisma/client";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatQuantity, formatSom } from "@/lib/money";
import { KIND_LABEL } from "@/lib/labels";

const ACTION_LABEL: Partial<Record<AuditAction, string>> = {
  CREATE: "Киритилди",
  UPDATE: "Ўзгартирилди",
  CANCEL: "Бекор қилинди",
};

const FIELD_LABEL: Record<string, string> = {
  kind: "Тури",
  date: "Сана",
  site: "Объект",
  account: "Ҳисоб",
  toAccount: "Қайси ҳисобга",
  category: "Категория",
  material: "Номи",
  counterparty: "Контрагент",
  quantity: "Миқдор",
  unitPrice: "Нарх",
  amount: "Сумма",
  adjustReason: "Фарқ сабаби",
  note: "Изоҳ",
};

type Snapshot = Record<string, unknown>;

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object" && v && "name" in v) return String((v as { name: unknown }).name);
  if (field === "unitPrice" || field === "amount") return formatSom(String(v));
  if (field === "quantity") return formatQuantity(String(v));
  if (field === "date") return formatDate(String(v));
  if (field === "kind") return KIND_LABEL[v as keyof typeof KIND_LABEL] ?? String(v);
  return String(v);
}

/** Qaysi maydon qanday o'zgargani: "Narx: 45 000 → 47 000". */
function diff(before: Snapshot, after: Snapshot): { field: string; from: string; to: string }[] {
  return Object.keys(FIELD_LABEL)
    .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
    .map((k) => ({ field: FIELD_LABEL[k], from: show(k, before[k]), to: show(k, after[k]) }));
}

export function AuditTrail({
  rows,
}: {
  rows: { id: string; at: string; userName: string; action: AuditAction; before: Prisma.JsonValue; after: Prisma.JsonValue; reason: string | null }[];
}) {
  return (
    <table className="tbl max-w-[820px] border border-line">
      <thead>
        <tr>
          <th>Вақт</th>
          <th>Ким</th>
          <th>Амал</th>
          <th>Тафсилот</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const changes = a.action === "UPDATE" && a.before && a.after ? diff(a.before as Snapshot, a.after as Snapshot) : [];
          return (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{formatDateTime(a.at)}</td>
              <td>{a.userName}</td>
              <td>{ACTION_LABEL[a.action] ?? a.action}</td>
              <td>
                {changes.map((c) => (
                  <div key={c.field}>
                    <span className="text-ink-3">{c.field}:</span> {c.from} → <b>{c.to}</b>
                  </div>
                ))}
                {a.reason && <div>Сабаб: {a.reason}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
