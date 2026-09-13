"use client";

import { useState } from "react";
import type { SiteStatus } from "@prisma/client";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

export function NewSiteForm() {
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useServerMutation();

  if (!open) {
    return (
      <div className="mb-3">
        <button className="btn" onClick={() => setOpen(true)}>
          + Yangi ob&apos;ekt
        </button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() => sendJson("/api/sites", "POST", { name: f.get("name"), address: f.get("address") }));
    if (ok) setOpen(false);
  }

  return (
    <form onSubmit={onSubmit} className="mb-3 flex flex-wrap items-center gap-2 bg-paper border border-line px-3 py-2">
      <input name="name" className="field w-[240px]" placeholder="Ob'ekt nomi" autoFocus required />
      <input name="address" className="field w-[280px]" placeholder="Manzil (ixtiyoriy)" />
      <button className="btn btn-primary" disabled={pending}>
        Qo&apos;shish
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Bekor
      </button>
      {error && <span className="text-minus text-[13px]">{error}</span>}
    </form>
  );
}

/** Ob'ektni yopish (arxivga) yoki qayta ochish — faqat direktor. */
export function SiteStatusButton({ id, name, status }: { id: number; name: string; status: SiteStatus }) {
  const { run, pending, error } = useServerMutation();
  const archive = status === "ACTIVE";

  async function onClick() {
    const question = archive
      ? `"${name}" yopilsinmi? Arxivdagi ob'ektga yangi yozuv kiritib bo'lmaydi (tarix saqlanadi).`
      : `"${name}" qayta ochilsinmi?`;
    if (!window.confirm(question)) return;
    await run(() => sendJson(`/api/sites/${id}`, "PATCH", { status: archive ? "ARCHIVED" : "ACTIVE" }));
  }

  return (
    <>
      <button className="link text-[13px]" onClick={onClick} disabled={pending}>
        {archive ? "Yopish" : "Qayta ochish"}
      </button>
      {error && <div className="text-minus text-[12px]">{error}</div>}
    </>
  );
}
