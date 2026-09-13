"use client";

import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { similarNames } from "@/lib/normalize";
import { UNITS } from "@/lib/units";
import { sendJson } from "@/lib/useServerMutation";

type Opt = { id: number; name: string };

/**
 * Ro'yxatda yo'q nomni qo'shish. Avval o'xshashlari ko'rsatiladi —
 * "Электирод" yozilsa "Электрод"ni taklif qiladi. Shu tufayli bitta narsa
 * ikki xil yozilib qolmaydi.
 */
export function NewNameDialog({
  mode,
  initialName,
  existing,
  categories,
  onPick,
  onCreated,
  onClose,
}: {
  mode: "item" | "supplier";
  initialName: string;
  existing: Opt[];
  categories: Opt[];
  onPick: (id: number) => void;
  onCreated: (created: Opt & { unit?: string; categoryId?: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<string>("dona");
  const [categoryId, setCategoryId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const similar = similarNames(name, existing);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body =
      mode === "item"
        ? { name, unit, categoryId: Number(categoryId) || 0 }
        : { name, kind: "SUPPLIER", phone };
    try {
      const res = await sendJson(mode === "item" ? "/api/reference/materials" : "/api/reference/counterparties", "POST", body);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Сақланмади");
        return;
      }
      onCreated({ id: data.id, name: name.replace(/\s+/g, " ").trim(), unit, categoryId: Number(categoryId) });
    } catch {
      setError("Тармоқ хатоси");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open title={mode === "item" ? "Янги ном қўшиш" : "Янги етказиб берувчи"} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-3">Номи</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>

        {similar.length > 0 && (
          <div className="bg-warn-soft px-3 py-2">
            <div className="text-warn mb-1.5">Балки шуни назарда тутгандирсиз? Бир нарса икки хил ёзилмаслиги керак.</div>
            <div className="flex flex-wrap gap-2">
              {similar.map((s) => (
                <button key={s.id} type="button" className="btn" onClick={() => onPick(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "item" ? (
          <div className="flex gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] text-ink-3">Ўлчов бирлиги</span>
              <select className="field w-[160px]" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[13px] text-ink-3">Категория (ҳисоботда шу бўйича гуруҳланади)</span>
              <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">— танланг —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-3">Телефон (ихтиёрий)</span>
            <input className="field w-[220px]" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        )}

        {mode === "item" && (
          <p className="text-[13px] text-ink-3">
            Нарх доим битта бирлик учун ёзилади: кг да ўлчанса — 1 кг нархи, тоннада ўлчанса — 1 тонна нархи.
          </p>
        )}

        {error && <p className="text-minus">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={pending}>
            Қўшиш
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Бекор
          </button>
        </div>
      </form>
    </Dialog>
  );
}
