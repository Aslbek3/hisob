"use client";

import { sendJson, useServerMutation } from "@/lib/useServerMutation";

export function PeriodButton({ month, closed, label }: { month: string; closed: boolean; label: string }) {
  const { run, pending, error } = useServerMutation();

  async function onClick() {
    if (closed) {
      const reason = window.prompt(`${label} қайта очилсинми? Сабабини ёзинг:`);
      if (!reason?.trim()) return;
      await run(() => sendJson("/api/periods", "POST", { action: "reopen", month, reason }));
    } else {
      if (!window.confirm(`${label} ёпилсинми? Шундан кейин бу ойга ёзув қўшиб ёки ўзгартириб бўлмайди.`)) return;
      await run(() => sendJson("/api/periods", "POST", { action: "close", month }));
    }
  }

  return (
    <>
      <button className={closed ? "link text-[13px]" : "btn"} onClick={onClick} disabled={pending}>
        {closed ? "Қайта очиш" : "Ойни ёпиш"}
      </button>
      {error && <div className="text-minus text-[12px]">{error}</div>}
    </>
  );
}
