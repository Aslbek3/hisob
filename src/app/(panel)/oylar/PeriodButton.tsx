"use client";

import { sendJson, useServerMutation } from "@/lib/useServerMutation";

export function PeriodButton({ month, closed, label }: { month: string; closed: boolean; label: string }) {
  const { run, pending, error } = useServerMutation();

  async function onClick() {
    if (closed) {
      const reason = window.prompt(`${label} qayta ochilsinmi? Sababini yozing:`);
      if (!reason?.trim()) return;
      await run(() => sendJson("/api/periods", "POST", { action: "reopen", month, reason }));
    } else {
      if (!window.confirm(`${label} yopilsinmi? Shundan keyin bu oyga yozuv qo'shib yoki o'zgartirib bo'lmaydi.`)) return;
      await run(() => sendJson("/api/periods", "POST", { action: "close", month }));
    }
  }

  return (
    <>
      <button className={closed ? "link text-[13px]" : "btn"} onClick={onClick} disabled={pending}>
        {closed ? "Qayta ochish" : "Oyni yopish"}
      </button>
      {error && <div className="text-minus text-[12px]">{error}</div>}
    </>
  );
}
