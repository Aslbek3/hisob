"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string };

export function Sidebar({ main, more, userName, roleLabel }: { main: NavItem[]; more: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sahifa almashsa mobil menyu o'zi yopiladi
  useEffect(() => setOpen(false), [pathname]);

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

  const userBlock = (
    <div className="px-4 py-3 border-t border-line">
      <div className="font-medium truncate">{userName}</div>
      <div className="text-ink-3 text-[13px]">{roleLabel}</div>
      <button onClick={logout} className="link mt-2">
        Чиқиш
      </button>
    </div>
  );

  return (
    <>
      {/* Mobil: tepadagi tor panel + ochiladigan menyu. Desktopda butunlay yashiringan. */}
      <header className="md:hidden sticky top-0 z-40 bg-paper border-b border-line">
        <div className="flex items-center justify-between px-4 h-[52px]">
          <span className="text-[18px] font-semibold">Ҳисоб</span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Менюни ёпиш" : "Менюни очиш"}
            aria-expanded={open}
            className="w-[40px] h-[40px] grid place-items-center rounded-[4px] hover:bg-canvas"
          >
            {open ? (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l14 14M18 4L4 18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h16M3 11h16M3 16h16" />
              </svg>
            )}
          </button>
        </div>
        {open && (
          <div className="border-t border-line max-h-[calc(100vh-52px)] overflow-y-auto">
            <nav className="flex flex-col px-2 py-2 gap-0.5">{main.map((i) => link(i, true))}</nav>
            {more.length > 0 && (
              <>
                <div className="px-5 mt-2 mb-1 text-[12px] text-ink-3">Бошқа</div>
                <nav className="flex flex-col px-2 pb-2 gap-0.5">{more.map((i) => link(i, true))}</nav>
              </>
            )}
            {userBlock}
          </div>
        )}
      </header>

      {/* Desktop: doim ochiq yon menyu */}
      <aside className="hidden md:flex w-[220px] shrink-0 border-r border-line bg-paper flex-col sticky top-0 h-screen">
        <div className="px-4 py-4 text-[18px] font-semibold">Ҳисоб</div>
        <nav className="flex flex-col px-2 gap-0.5">{main.map((i) => link(i, true))}</nav>
        <div className="px-5 mt-6 mb-1 text-[12px] text-ink-3">Бошқа</div>
        <nav className="flex flex-col px-2 gap-px">{more.map((i) => link(i, false))}</nav>
        <div className="mt-auto">{userBlock}</div>
      </aside>
    </>
  );
}
