"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function Sidebar({ nav, userName, roleLabel }: { nav: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <aside className="w-[200px] shrink-0 border-r border-line bg-paper flex flex-col sticky top-0 h-screen">
      <div className="px-4 py-4 font-semibold">Hisob</div>
      <nav className="flex flex-col px-2 gap-px">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-[3px] ${active ? "bg-accent-soft text-accent font-medium" : "text-ink-2 hover:bg-canvas"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-4 py-3 border-t border-line text-[13px]">
        <div className="font-medium truncate">{userName}</div>
        <div className="text-ink-3">{roleLabel}</div>
        <button onClick={logout} className="link mt-2">
          Chiqish
        </button>
      </div>
    </aside>
  );
}
