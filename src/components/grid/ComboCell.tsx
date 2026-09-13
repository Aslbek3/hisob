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
  /** Berilsa — ro'yxatda yo'q matn uchun "+ Янги: «...»" varianti chiqadi. */
  onCreate?: (text: string) => void;
  createLabel?: string;
  invalid?: boolean;
};

/**
 * Jadval katagidagi tanlov: yozish → ro'yxat filtrlanadi → Enter/Tab yoki
 * sichqoncha bilan tanlanadi. Ro'yxatda yo'q matn QABUL QILINMAYDI (bitta
 * narsaning har xil yozilishi paydo bo'lmasligi uchun) — katakdan chiqilganda
 * eski qiymat qaytadi. Yangi nom faqat `onCreate` orqali (tasdiqlash oynasi bilan).
 */
export function ComboCell(p: Props) {
  const selected = p.options.find((o) => o.id === p.value) ?? null;
  const [text, setText] = useState<string | null>(null); // null — tahrir qilinmayapti
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const localRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  /**
   * Ro'yxatdan hozirgina tanlandi — keyingi blur yozilgan matnga qarab qayta tanlamasin.
   * (Enter'dan keyin fokus darhol keyingi katakka o'tadi; blur paytida "text" hali eski:
   * "Мих" yozib "Мих 100 лик" tanlansa, blur aynan mos "Мих"ni qaytarib qo'yardi.)
   */
  const justChosen = useRef(false);

  const query = nameKey(text ?? "");
  const matches = useMemo(() => {
    if (!query) return p.options.slice(0, 80);
    const starts: ComboOption[] = [];
    const contains: ComboOption[] = [];
    for (const o of p.options) {
      const k = nameKey(o.name);
      if (k.startsWith(query)) starts.push(o);
      else if (k.includes(query)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, 80);
  }, [query, p.options]);

  const exact = matches.some((o) => nameKey(o.name) === query);
  const canCreate = !!p.onCreate && !!query && !exact;
  const total = matches.length + (canCreate ? 1 : 0);

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
    justChosen.current = true;
    p.onChange(o ? o.id : null);
    setText(null);
    setOpen(false);
  }

  function create() {
    const t = (text ?? "").trim();
    setText(null);
    setOpen(false);
    if (t) p.onCreate?.(t);
  }

  function pick(index: number, withEnter: boolean) {
    if (index < matches.length) {
      choose(matches[index]);
      if (withEnter) p.onPickedWithEnter();
    } else if (canCreate) {
      create();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => Math.min(h + 1, total - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (total > 0) pick(hi, true);
        return;
      }
      if (e.key === "Tab") {
        // Tanlab, brauzerning o'z Tab'i keyingi katakka o'tkazadi
        if (text && hi < matches.length) choose(matches[hi]);
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
    if (justChosen.current) {
      justChosen.current = false;
      setText(null);
      setOpen(false);
      return;
    }
    if (text === null) {
      setOpen(false);
      return;
    }
    if (!query) choose(null);
    else {
      const found = p.options.find((o) => nameKey(o.name) === query);
      if (found) choose(found);
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
          justChosen.current = false;
          setText(e.target.value);
          if (!open) openList();
          else setHi(0);
        }}
        onFocus={(e) => e.target.select()}
        onDoubleClick={() => !open && openList()}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoComplete="off"
        spellCheck={false}
      />
      {open && rect && (
        <ul
          ref={listRef}
          className="fixed z-50 max-h-[320px] overflow-auto bg-paper border border-line shadow-lg"
          style={{ top: rect.bottom + 1, left: rect.left, minWidth: Math.max(rect.width, 260) }}
        >
          {matches.length === 0 && !canCreate && <li className="px-3 py-2 text-ink-3">Рўйхатда йўқ</li>}
          {matches.map((o, i) => (
            <li
              key={o.id}
              data-i={i}
              className={`px-3 py-1.5 cursor-pointer flex justify-between gap-4 ${i === hi ? "bg-accent-soft" : ""}`}
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
          {canCreate && (
            <li
              data-i={matches.length}
              className={`px-3 py-1.5 cursor-pointer text-accent border-t border-line ${hi === matches.length ? "bg-accent-soft" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                create();
              }}
              onMouseEnter={() => setHi(matches.length)}
            >
              + {p.createLabel ?? "Янги"}: «{(text ?? "").trim()}»
            </li>
          )}
        </ul>
      )}
    </>
  );
}
