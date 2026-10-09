"use client";

import { useEffect, useState } from "react";
import { type Alphabet, readAlphabet, writeAlphabet } from "@/lib/alphabet";

/** Yuqori panel/menyudagi kichik alifbo almashtirgich. Standart holat — кирилл. */
export function AlphabetToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Alphabet>("cyr");

  useEffect(() => setMode(readAlphabet()), []);

  function toggle() {
    const next: Alphabet = mode === "cyr" ? "lat" : "cyr";
    writeAlphabet(next);
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`text-[12px] px-2 py-1 rounded-[4px] border border-line text-ink-2 hover:bg-canvas ${className}`}
      title="Экран алифбосини алмаштириш"
      data-no-translit
    >
      {mode === "cyr" ? "Кирилл / Lotin" : "Lotin / Кирилл"}
    </button>
  );
}
