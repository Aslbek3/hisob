import type { AuditAction, Prisma } from "@prisma/client";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatQuantity, formatSom } from "@/lib/money";

const ACTION_LABEL: Partial<Record<AuditAction, string>> = {
  CREATE: "Kiritildi",
  UPDATE: "O'zgartirildi",
  CANCEL: "Bekor qilindi",
};

const FIELD_LABEL: Record<string, string> = {
  date: "Sana",
  site: "Ob'ekt",
  account: "Hisob",
  toAccount: "Qaysi hisobga",
  category: "Kategoriya",
  material: "Material",
  counterparty: "Kimdan",
  quantity: "Miqdor",
  unitPrice: "Narx",
  amount: "Summa",
  note: "Izoh",
};

type Snapshot = Record<string, unknown>;

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object" && v && "name" in v) return String((v as { name: unknown }).name);
  if (field === "unitPrice" || field === "amount") return formatSom(String(v));
  if (field === "quantity") return formatQuantity(String(v));
  if (field === "date") return formatDate(String(v));
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
          <th>Vaqt</th>
          <th>Kim</th>
          <th>Amal</th>
          <th>Tafsilot</th>
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
                {a.reason && <div>Sabab: {a.reason}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
