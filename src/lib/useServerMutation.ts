"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Sahifani yangilaydi va yangilanish TUGAGUNCHA kutadi.
 * `router.refresh()` o'zi bloklamaydi — `useTransition` ichida chaqirilganda
 * `isPending` yangilanish tugaguncha true bo'lib turadi (testify'dagi
 * "bosdim, hech narsa bo'lmadi" muammosining yechimi).
 */
function useRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const resolveRef = useRef<(() => void) | null>(null);

  // Bog'liqliklar ro'yxati ATAYLAB yo'q — juda tez tugagan yangilanishda ham kutish ochilsin
  useEffect(() => {
    if (!refreshing && resolveRef.current) {
      const resolve = resolveRef.current;
      resolveRef.current = null;
      resolve();
    }
  });

  function refresh(): Promise<void> {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      startTransition(() => router.refresh());
    });
  }

  return { refresh, refreshing };
}

/** O'zgartirish so'rovi + sahifani yangilash. `run` true qaytarsa — saqlandi va ekranda ko'rindi. */
export function useServerMutation() {
  const { refresh, refreshing } = useRefresh();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(request: () => Promise<Response>): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Хатолик юз берди");
        return false;
      }
    } catch {
      setError("Тармоқ хатоси — қайта уриниб кўринг");
      return false;
    } finally {
      setSending(false);
    }
    await refresh();
    return true;
  }

  return { run, pending: sending || refreshing, error, setError };
}

/** JSON so'rov yuborish uchun qisqa yozuv. */
export function sendJson(url: string, method: "POST" | "PATCH", body: unknown): Promise<Response> {
  return fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
