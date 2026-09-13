"use client";

import { useState } from "react";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

/** Yozuvni bekor qilish — sabab majburiy. O'chirish emas: yozuv tarixda qoladi. */
export function CancelEntryButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error } = useServerMutation();

  if (!open) {
    return (
      <button className="btn btn-danger" onClick={() => setOpen(true)}>
        Bekor qilish
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => sendJson(`/api/entries/${id}/cancel`, "POST", { reason }))) setOpen(false);
      }}
    >
      <input className="field w-[260px]" placeholder="Bekor qilish sababi" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      <button className="btn btn-danger" disabled={pending || reason.trim().length < 3}>
        Tasdiqlash
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Yo&apos;q
      </button>
      {error && <span className="text-minus text-[13px]">{error}</span>}
    </form>
  );
}
