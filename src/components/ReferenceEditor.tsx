"use client";

import { useState } from "react";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

export type FieldType = "text" | "select" | "select-id" | "checkbox" | "money" | "number";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  width?: string;
  placeholder?: string;
  /** Tahrirlashda o'zgartirib bo'lmaydigan maydon (masalan yozuvi bor hisobning qoldig'i). */
  lockedWhenUsed?: boolean;
};

export type Values = Record<string, string | boolean | null>;

export type RefRow = {
  id: number;
  values: Values;
  isActive: boolean;
  /** Nechta yozuvda ishlatilgan — ma'lumot uchun. */
  usage?: number;
};

/**
 * Spravochnik jadvali: ro'yxat + joyida tahrirlash + qo'shish + faolsizlantirish.
 * O'chirish yo'q — faqat "o'chirish" belgisi (isActive).
 */
export function ReferenceEditor({
  endpoint,
  fields,
  rows,
  canEdit,
  emptyValues,
  showActive = true,
  usageLabel = "Ёзувлар",
  extra = {},
}: {
  endpoint: string;
  fields: Field[];
  rows: RefRow[];
  canEdit: boolean;
  emptyValues: Values;
  showActive?: boolean;
  usageLabel?: string;
  /** Har bir so'rovga qo'shiladigan qat'iy maydonlar (masalan kind: "SUPPLIER"). */
  extra?: Record<string, unknown>;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Values>(emptyValues);
  const [showInactive, setShowInactive] = useState(false);
  const { run, pending, error, setError } = useServerMutation();

  const inactiveCount = rows.filter((r) => !r.isActive).length;
  const visible = rows.filter((r) => r.isActive || showInactive);

  function toPayload(values: Values, isActive: boolean) {
    const out: Record<string, unknown> = { ...extra, isActive };
    for (const f of fields) {
      const v = values[f.key];
      if (f.type === "select-id") out[f.key] = v ? Number(v) : null;
      else if (f.type === "number") out[f.key] = Number(v) || 0;
      else out[f.key] = v;
    }
    return out;
  }

  async function save(id: number | "new", values: Values, isActive: boolean) {
    const ok = await run(() =>
      id === "new" ? sendJson(endpoint, "POST", toPayload(values, true)) : sendJson(`${endpoint}/${id}`, "PATCH", toPayload(values, isActive))
    );
    if (ok) setEditing(null);
  }

  function startEdit(id: number | "new", values: Values) {
    setError(null);
    setDraft(values);
    setEditing(id);
  }

  function renderInput(f: Field, locked: boolean) {
    const v = draft[f.key];
    const set = (value: string | boolean | null) => setDraft((d) => ({ ...d, [f.key]: value }));
    if (f.type === "checkbox") return <input type="checkbox" checked={!!v} disabled={locked} onChange={(e) => set(e.target.checked)} />;
    if (f.type === "select" || f.type === "select-id") {
      return (
        <select className="field w-full" value={(v as string) ?? ""} disabled={locked} onChange={(e) => set(e.target.value || null)}>
          {f.type === "select-id" && <option value="">—</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className={`field w-full ${f.type === "money" || f.type === "number" ? "num" : ""}`}
        value={(v as string) ?? ""}
        placeholder={f.placeholder}
        disabled={locked}
        inputMode={f.type === "money" || f.type === "number" ? "numeric" : undefined}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save(editing!, draft, editing === "new" ? true : (rows.find((r) => r.id === editing)?.isActive ?? true));
          }
          if (e.key === "Escape") setEditing(null);
        }}
        autoFocus={fields[0] === f}
      />
    );
  }

  function display(f: Field, v: string | boolean | null) {
    if (f.type === "checkbox") return v ? "ҳа" : "";
    if (f.type === "select" || f.type === "select-id") return f.options?.find((o) => o.value === v)?.label ?? "—";
    return v || "—";
  }

  const editRow = (id: number | "new", usage: number, isActive: boolean) => (
    <tr key={`edit-${id}`} className="bg-accent-soft/40">
      {fields.map((f) => (
        <td key={f.key} style={{ width: f.width }}>
          {renderInput(f, id !== "new" && !!f.lockedWhenUsed && usage > 0)}
        </td>
      ))}
      {showActive && <td />}
      <td className="whitespace-nowrap text-right">
        <button className="btn btn-primary" disabled={pending} onClick={() => void save(id, draft, isActive)}>
          Сақлаш
        </button>{" "}
        <button className="btn" onClick={() => setEditing(null)}>
          Бекор
        </button>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {canEdit && editing !== "new" && (
          <button className="btn" onClick={() => startEdit("new", emptyValues)}>
            + Қўшиш
          </button>
        )}
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ўчирилганларни кўрсатиш ({inactiveCount})
          </label>
        )}
        {error && <span className="text-minus text-[13px]">{error}</span>}
      </div>
      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.key} className={f.type === "money" || f.type === "number" ? "num" : ""}>
                  {f.label}
                </th>
              ))}
              {showActive && <th className="num">{usageLabel}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {editing === "new" && editRow("new", 0, true)}
            {visible.length === 0 && editing !== "new" && (
              <tr>
                <td colSpan={fields.length + 2} className="text-center text-ink-3 py-6">
                  Бўш
                </td>
              </tr>
            )}
            {visible.map((r) =>
              editing === r.id ? (
                editRow(r.id, r.usage ?? 0, r.isActive)
              ) : (
                <tr key={r.id} className={r.isActive ? "" : "text-ink-3"}>
                  {fields.map((f) => (
                    <td key={f.key} className={f.type === "money" || f.type === "number" ? "num" : ""}>
                      {display(f, r.values[f.key])}
                    </td>
                  ))}
                  {showActive && <td className="num text-ink-3">{r.usage ?? ""}</td>}
                  <td className="whitespace-nowrap text-right text-[13px]">
                    {canEdit && (
                      <>
                        <button className="link" onClick={() => startEdit(r.id, r.values)}>
                          Таҳрирлаш
                        </button>
                        {showActive && (
                          <button className="link ml-3" disabled={pending} onClick={() => void save(r.id, r.values, !r.isActive)}>
                            {r.isActive ? "Ўчириш" : "Қайта ёқиш"}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
