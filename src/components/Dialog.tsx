"use client";

import { useEffect, useRef } from "react";

/** Oddiy modal oyna (brauzerning <dialog> elementi). Esc yoki fonga bosish — yopiladi. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="rounded-[4px] border border-line p-0 backdrop:bg-black/30 w-[min(520px,94vw)]"
    >
      {open && (
        <div className="p-5">
          <h2 className="text-[18px] font-semibold mb-4">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
