"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nameKey } from "@/lib/normalize";

export type ComboOption = { id: number; name: string; hint?: string };

type Props = {
  options: ComboOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Ro'yxat YOPIQ paytdagi klavishlar (Enter, strelkalar) — jadval navigatsiyasiga uzatiladi. */
  onGridKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Ro'yxatdan Enter bilan tanlangach keyingi katakka o'tish. */
  onPickedWithEnter: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
  invalid?: boolean;
};

/**
 * Jadval katagidagi tanlov: yozish → ro'yxat filtrlanadi → Enter/Tab bilan
 * tanlanadi. Ro'yxatda yo'q qiymat QABUL QILINMAYDI (qo'lda yozilgan "sement"
 * variantlari paydo bo'lmasligi uchun) — katakdan chiqilganda eski qiymat qaytadi.
 */
export function ComboCell(p: Props) {
  const selected = p.options.find((o) => o.id === p.value) ?? null;
  const [text, setText] = useState<string | null>(null); // null — tahrir qilinmayapti
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const localRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const matches = useMemo(() => {
    const q = nameKey(text ?? "");
    if (!q) return p.options.slice(0, 60);
    const starts: ComboOption[] = [];
    const contains: ComboOption[] = [];
    for (const o of p.options) {
      const k = nameKey(o.name);
      if (k.startsWith(q)) starts.push(o);
      else if (k.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, 60);
  }, [text, p.options]);

  // Ro'yxat fixed joylashgan — sahifa aylantirilsa joyi yangilanadi
  useEffect(() => {
    if (!open) return;
    const update = () => localRef.current && setRect(localRef.current.getBoundingClientRect());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  function openList() {
    if (localRef.current) setRect(localRef.current.getBoundingClientRect());
    setOpen(true);
    setHi(0);
  }

  function choose(o: ComboOption | null) {
    p.onChange(o ? o.id : null);
    setText(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => Math.min(h + 1, matches.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const o = matches[hi];
        if (o) {
          choose(o);
          p.onPickedWithEnter();
        }
        return;
      }
      if (e.key === "Tab") {
        // Tanlab, brauzerning o'z Tab'i keyingi katakka o'tkazadi
        const o = matches[hi];
        if (o && text) choose(o);
        else setOpen(false);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setText(null);
        setOpen(false);
        return;
      }
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      openList();
      return;
    } else if (e.key === "Delete" && !e.ctrlKey && selected) {
      e.preventDefault();
      choose(null);
      return;
    }
    p.onGridKey(e);
  }

  function onBlur() {
    if (text === null) {
      setOpen(false);
      return;
    }
    const q = nameKey(text);
    if (!q) choose(null);
    else {
      const exact = p.options.find((o) => nameKey(o.name) === q);
      if (exact) choose(exact);
      else {
        // Ro'yxatda yo'q — eski qiymat qaytadi
        setText(null);
        setOpen(false);
      }
    }
  }

  return (
    <>
      <input
        ref={(el) => {
          localRef.current = el;
          p.inputRef(el);
        }}
        className={`cell ${p.invalid ? "cell-invalid" : ""}`}
        value={text ?? selected?.name ?? ""}
        placeholder={p.placeholder}
        disabled={p.disabled}
        onChange={(e) => {
          setText(e.target.value);
          if (!open) openList();
          else setHi(0);
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoComplete="off"
        spellCheck={false}
      />
      {open && rect && (
        <ul
          ref={listRef}
          className="fixed z-50 max-h-[260px] overflow-auto bg-paper border border-line shadow-md text-[13px]"
          style={{ top: rect.bottom + 1, left: rect.left, minWidth: Math.max(rect.width, 220) }}
        >
          {matches.length === 0 && <li className="px-2 py-1.5 text-ink-3">Ro&apos;yxatda yo&apos;q — spravochnikka qo&apos;shing</li>}
          {matches.map((o, i) => (
            <li
              key={o.id}
              data-i={i}
              className={`px-2 py-1 cursor-pointer flex justify-between gap-3 ${i === hi ? "bg-accent-soft" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // blur bo'lmasin
                choose(o);
              }}
              onMouseEnter={() => setHi(i)}
            >
              <span>{o.name}</span>
              {o.hint && <span className="text-ink-3">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
