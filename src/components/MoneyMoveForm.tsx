"use client";

import { useState } from "react";
import { formatSom, parseSom } from "@/lib/money";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

type Opt = { id: number; name: string };

type Props =
  | { kind: "INCOME"; payers: Opt[]; accounts: Opt[]; siteId?: number | null; date?: string; today: string; onSaved?: () => void }
  | { kind: "TRANSFER"; accounts: Opt[]; date?: string; today: string; onSaved?: () => void }
  | { kind: "SUPPLIER_PAYMENT"; supplierId: number; accounts: Opt[]; date?: string; today: string; onSaved?: () => void };

const TITLES = {
  INCOME: { from: "Кимдан", to: "Қайси ҳисобга", button: "Кирим қўшиш" },
  TRANSFER: { from: "Қайси ҳисобдан", to: "Қайси ҳисобга", button: "Ўтказмани сақлаш" },
  SUPPLIER_PAYMENT: { from: "", to: "Қайси ҳисобдан тўланди", button: "Тўловни сақлаш" },
} as const;

/**
 * Pul harakati formasi: kirim (kimdan → qaysi hisobga), hisoblar orasida
 * o'tkazma yoki yetkazib beruvchiga to'lov. Uchala joyda bir xil ko'rinish.
 */
export function MoneyMoveForm(props: Props) {
  const t = TITLES[props.kind];
  const [date, setDate] = useState(props.date ?? props.today);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dupMessage, setDupMessage] = useState<string | null>(null);
  const { run, pending, error, setError } = useServerMutation();

  async function submit(allowDuplicate: boolean) {
    setDupMessage(null);
    const base = { kind: props.kind, date: props.date ?? date, unitPrice: amount, quantity: "1", note, allowDuplicate };
    const body =
      props.kind === "INCOME"
        ? { ...base, counterpartyId: Number(from) || null, accountId: Number(to) || null, siteId: props.siteId ?? null }
        : props.kind === "TRANSFER"
          ? { ...base, accountId: Number(from) || null, toAccountId: Number(to) || null }
          : { ...base, counterpartyId: props.supplierId, accountId: Number(to) || null };

    let duplicate: string | null = null;
    const ok = await run(async () => {
      const res = await sendJson("/api/entries", "POST", body);
      if (res.status === 409) {
        const data = await res.clone().json().catch(() => null);
        if (data?.code === "DUPLICATE") duplicate = data.error;
      }
      return res;
    });
    if (duplicate) {
      setError(null);
      setDupMessage(duplicate);
      return;
    }
    if (ok) {
      setAmount("");
      setNote("");
      props.onSaved?.();
    }
  }

  const fromOptions = props.kind === "INCOME" ? props.payers : props.kind === "TRANSFER" ? props.accounts : [];

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {!props.date && (
        <Field label="Сана">
          <input type="date" className="field" value={date} max={props.today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      )}
      {props.kind !== "SUPPLIER_PAYMENT" && (
        <Field label={t.from}>
          <select className="field min-w-[200px]" value={from} onChange={(e) => setFrom(e.target.value)} required>
            <option value="">— танланг —</option>
            {fromOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t.to}>
        <select className="field min-w-[200px]" value={to} onChange={(e) => setTo(e.target.value)} required>
          <option value="">— танланг —</option>
          {props.accounts
            .filter((a) => props.kind !== "TRANSFER" || String(a.id) !== from)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Сумма, сўм">
        <input
          className="field num w-[170px]"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ""))}
          onBlur={() => {
            const v = parseSom(amount);
            if (v !== null) setAmount(formatSom(v));
          }}
          required
        />
      </Field>
      <Field label="Изоҳ">
        <input className="field w-[220px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <button className="btn btn-primary" disabled={pending}>
        {t.button}
      </button>
      {error && <p className="w-full text-minus">{error}</p>}
      {dupMessage && (
        <div className="w-full bg-warn-soft px-3 py-2 flex flex-wrap items-center gap-3">
          <span className="text-warn">{dupMessage}</span>
          <button type="button" className="btn" onClick={() => void submit(true)}>
            Ҳа, сақлаш
          </button>
          <button type="button" className="btn" onClick={() => setDupMessage(null)}>
            Йўқ
          </button>
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}
