"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function Sidebar({ main, more, userName, roleLabel }: { main: NavItem[]; more: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  const link = (item: NavItem, big: boolean) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`px-3 rounded-[4px] ${big ? "py-2.5 text-[16px]" : "py-1.5 text-[14px]"} ${
          active ? "bg-accent-soft text-accent font-semibold" : "text-ink-2 hover:bg-canvas"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="w-[220px] shrink-0 border-r border-line bg-paper flex flex-col sticky top-0 h-screen">
      <div className="px-4 py-4 text-[18px] font-semibold">Ҳисоб</div>
      <nav className="flex flex-col px-2 gap-0.5">{main.map((i) => link(i, true))}</nav>
      <div className="px-5 mt-6 mb-1 text-[12px] text-ink-3">Бошқа</div>
      <nav className="flex flex-col px-2 gap-px">{more.map((i) => link(i, false))}</nav>
      <div className="mt-auto px-4 py-3 border-t border-line">
        <div className="font-medium truncate">{userName}</div>
        <div className="text-ink-3 text-[13px]">{roleLabel}</div>
        <button onClick={logout} className="link mt-2">
          Чиқиш
        </button>
      </div>
    </aside>
  );
}
