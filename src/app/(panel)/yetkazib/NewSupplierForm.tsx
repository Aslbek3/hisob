"use client";

import { useState } from "react";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

export function NewSupplierForm() {
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useServerMutation();

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        + Янги етказиб берувчи
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 bg-paper border border-line px-3 py-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ok = await run(() => sendJson("/api/reference/counterparties", "POST", { name: f.get("name"), phone: f.get("phone"), kind: "SUPPLIER" }));
        if (ok) setOpen(false);
      }}
    >
      <input name="name" className="field w-[260px]" placeholder="Номи (масалан, Бетон завод)" autoFocus required />
      <input name="phone" className="field w-[180px]" placeholder="Телефон" />
      <button className="btn btn-primary" disabled={pending}>
        Қўшиш
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Бекор
      </button>
      {error && <span className="text-minus">{error}</span>}
    </form>
  );
}
