"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: form.get("login"), password: form.get("password") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Kirib bo'lmadi");
        setPending(false);
        return;
      }
      // To'liq qayta yuklash — server komponentlar yangi sessiya bilan chizilsin
      window.location.href = "/";
    } catch {
      setError("Tarmoq xatosi — qayta urinib ko'ring");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-ink-2 text-[13px]">Login</span>
        <input name="login" className="field" autoComplete="username" autoFocus required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-2 text-[13px]">Parol</span>
        <input name="password" type="password" className="field" autoComplete="current-password" required />
      </label>
      {error && <p className="text-minus text-[13px]">{error}</p>}
      <button className="btn btn-primary justify-center mt-2" disabled={pending}>
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </button>
    </form>
  );
}
