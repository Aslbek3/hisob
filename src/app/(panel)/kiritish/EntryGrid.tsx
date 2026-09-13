"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EntryKind } from "@prisma/client";
import { ComboCell, type ComboOption } from "@/components/grid/ComboCell";
import { computeAmount, formatQuantity, formatSom, parseQuantityMilli, parseSom } from "@/lib/money";
import { formatMonth, monthStartIso } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/labels";
import { unitLabel } from "@/lib/units";
import type { EntryOptions } from "@/services/reference";
import type { EntryRow } from "@/services/entries";

type Header = { kind: EntryKind; siteId: number | null; accountId: number | null; date: string };

type RowStatus = "draft" | "dirty" | "saving" | "saved" | "dup" | "error";

type GridRow = {
  key: string;
  id: number | null;
  categoryId: number | null;
  materialId: number | null;
  counterpartyId: number | null;
  toAccountId: number | null;
  quantity: string;
  unitPrice: string;
  note: string;
  status: RowStatus;
  message: string | null;
  canModify: boolean;
  createdByName: string | null;
};

type Col = "category" | "material" | "counterparty" | "toAccount" | "quantity" | "price" | "note";

const COLUMNS: Record<EntryKind, Col[]> = {
  EXPENSE: ["category", "material", "quantity", "price", "note"],
  INCOME: ["counterparty", "price", "note"],
  TRANSFER: ["toAccount", "price", "note"],
};

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

function emptyRow(categoryId: number | null = null): GridRow {
  return {
    key: newKey(),
    id: null,
    categoryId,
    materialId: null,
    counterpartyId: null,
    toAccountId: null,
    quantity: "1",
    unitPrice: "",
    note: "",
    status: "draft",
    message: null,
    canModify: true,
    createdByName: null,
  };
}

function fromEntry(e: EntryRow, key?: string): GridRow {
  return {
    key: key ?? `e${e.id}`,
    id: e.id,
    categoryId: e.categoryId,
    materialId: e.materialId,
    counterpartyId: e.counterpartyId,
    toAccountId: e.toAccountId,
    quantity: formatQuantity(e.quantity),
    unitPrice: formatSom(e.unitPrice),
    note: e.note ?? "",
    status: "saved",
    message: null,
    canModify: e.canModify,
    createdByName: e.createdByName,
  };
}

function rowAmount(r: GridRow): bigint | null {
  const q = parseQuantityMilli(r.quantity);
  const p = parseSom(r.unitPrice);
  if (q === null || p === null) return null;
  return computeAmount(q, p);
}

/** Yangi qatorda biror narsa yozilganmi (bo'sh qator saqlanmaydi). */
function hasContent(r: GridRow, kind: EntryKind): boolean {
  if (r.unitPrice.trim() || r.note.trim()) return true;
  if (kind === "EXPENSE") return r.materialId !== null || (r.quantity.trim() !== "1" && r.quantity.trim() !== "");
  if (kind === "INCOME") return r.counterpartyId !== null;
  return r.toAccountId !== null;
}

const HEADER_STORAGE = "hisob.kiritish.header";

export function EntryGrid(props: {
  options: EntryOptions;
  allowedKinds: EntryKind[];
  initialHeader: Header;
  closedMonths: string[];
  today: string;
  focusId: number | null;
}) {
  const { options, allowedKinds, closedMonths, today } = props;
  const [header, setHeader] = useState<Header>(props.initialHeader);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const cellRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<{ key: string; col: Col } | null>(null);

  const cols = COLUMNS[header.kind];
  const categoryById = new Map(options.categories.map((c) => [c.id, c]));
  const materialById = new Map(options.materials.map((m) => [m.id, m]));
  const monthClosed = closedMonths.includes(monthStartIso(header.date));
  const headerReady = !!header.accountId && (header.kind === "TRANSFER" || !!header.siteId) && !!header.date;

  const categoryOptions: ComboOption[] = options.categories;
  const materialOptions: ComboOption[] = options.materials.map((m) => ({ id: m.id, name: m.name, hint: unitLabel(m.unit) }));
  const toAccountOptions: ComboOption[] = options.accounts.filter((a) => a.id !== header.accountId);

  // URL'da ob'ekt/hisob bo'lmasa — oxirgi tanlanganini eslaymiz (faqat shu brauzerda).
  // Yuklash effektidan OLDIN turishi shart: u localStorage'ga yozadi.
  useEffect(() => {
    if (props.initialHeader.siteId || props.initialHeader.accountId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(HEADER_STORAGE) ?? "null") as { siteId?: number; accountId?: number } | null;
      const siteOk = options.sites.some((s) => s.id === saved?.siteId);
      const accountOk = options.accounts.some((a) => a.id === saved?.accountId);
      if (siteOk || accountOk) {
        setHeader((h) => ({
          ...h,
          siteId: siteOk ? saved!.siteId! : h.siteId,
          accountId: accountOk ? saved!.accountId! : h.accountId,
        }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Yuklash: sarlavha o'zgarsa shu kun yozuvlari + bitta bo'sh qator ──
  useEffect(() => {
    try {
      localStorage.setItem(HEADER_STORAGE, JSON.stringify({ siteId: header.siteId, accountId: header.accountId }));
    } catch {}
    const qs = new URLSearchParams({ kind: header.kind, date: header.date });
    if (header.siteId) qs.set("siteId", String(header.siteId));
    if (header.accountId) qs.set("accountId", String(header.accountId));
    window.history.replaceState(null, "", `/kiritish?${qs}`);

    if (!headerReady) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/entries?${qs}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data?.error ?? "Yuklab bo'lmadi");
          setRows([]);
          return;
        }
        const loaded: GridRow[] = (data.rows as EntryRow[]).map((e) => fromEntry(e));
        const last = loaded[loaded.length - 1];
        const draft = emptyRow(header.kind === "EXPENSE" ? (last?.categoryId ?? null) : null);
        setRows([...loaded, draft]);
        const focusRow = loaded.find((r) => r.id === props.focusId) ?? draft;
        pendingFocus.current = { key: focusRow.key, col: COLUMNS[header.kind][0] };
      })
      .catch(() => !cancelled && setLoadError("Tarmoq xatosi"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.kind, header.siteId, header.accountId, header.date]);

  // Kutilayotgan fokus (yangi qator chizilgach)
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    const el = cellRefs.current.get(`${f.key}:${f.col}`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  // Saqlanmagan qator bilan sahifadan chiqishda ogohlantirish
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (rowsRef.current.some((r) => r.status !== "saved" && hasContent(r, header.kind))) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [header.kind]);

  const unsavedCount = rows.filter((r) => r.status !== "saved" && hasContent(r, header.kind)).length;

  function changeHeader(patch: Partial<Header>) {
    if (unsavedCount > 0 && !window.confirm(`${unsavedCount} ta qator saqlanmagan. Tashlab yuborilsinmi?`)) return;
    setHeader((h) => ({ ...h, ...patch }));
  }

  const updateRow = useCallback((key: string, patch: Partial<GridRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  function setField<K extends keyof GridRow>(key: string, field: K, value: GridRow[K]) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, [field]: value, message: null, status: (r.id ? "dirty" : "draft") as RowStatus };
        if (field === "categoryId") {
          const cat = categoryById.get(value as number);
          if (!cat?.isMaterial) next.materialId = null;
        }
        return next;
      })
    );
  }

  /** Mijoz tomonidagi tez tekshiruv — server baribir o'zi tekshiradi. */
  function validate(r: GridRow): string | null {
    if (header.kind === "EXPENSE") {
      if (!r.categoryId) return "Kategoriyani tanlang";
      if (categoryById.get(r.categoryId)?.isMaterial && !r.materialId) return "Materialni ro'yxatdan tanlang";
      if (parseQuantityMilli(r.quantity) === null) return "Miqdor noto'g'ri";
    }
    if (header.kind === "INCOME" && !r.counterpartyId) return "Kimdan kelganini tanlang";
    if (header.kind === "TRANSFER" && !r.toAccountId) return "Qaysi hisobga o'tkazilganini tanlang";
    if (parseSom(r.unitPrice) === null) return header.kind === "EXPENSE" ? "Narxni kiriting (butun so'm)" : "Summani kiriting (butun so'm)";
    const amount = rowAmount(r);
    if (amount === null || amount <= 0n) return "Summa 0 bo'lishi mumkin emas";
    return null;
  }

  async function saveRow(key: string, allowDuplicate = false) {
    const r = rowsRef.current.find((x) => x.key === key);
    if (!r || r.status === "saving" || r.status === "saved" || !hasContent(r, header.kind)) return;
    const problem = validate(r);
    if (problem) {
      updateRow(key, { status: "error", message: problem });
      return;
    }
    updateRow(key, { status: "saving", message: null });

    const body = {
      kind: header.kind,
      date: header.date,
      siteId: header.kind === "TRANSFER" ? null : header.siteId,
      accountId: header.accountId,
      toAccountId: r.toAccountId,
      categoryId: r.categoryId,
      materialId: r.materialId,
      counterpartyId: r.counterpartyId,
      quantity: header.kind === "EXPENSE" ? r.quantity : "1",
      unitPrice: r.unitPrice,
      note: r.note,
      allowDuplicate,
    };
    try {
      const res = await fetch(r.id ? `/api/entries/${r.id}` : "/api/entries", {
        method: r.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setRows((rs) => rs.map((x) => (x.key === key ? fromEntry(data.row as EntryRow, key) : x)));
      } else if (res.status === 409 && data?.code === "DUPLICATE") {
        updateRow(key, { status: "dup", message: `${data.error} — tasdiqlash uchun shu qatorda Enter bosing.` });
      } else {
        updateRow(key, { status: "error", message: data?.error ?? "Saqlanmadi" });
      }
    } catch {
      updateRow(key, { status: "error", message: "Tarmoq xatosi — qatorda Enter bosib qayta urinib ko'ring" });
    }
  }

  function saveAll() {
    for (const r of rowsRef.current) {
      if (r.status !== "saved" && r.status !== "saving" && hasContent(r, header.kind)) void saveRow(r.key);
    }
  }

  /** Enter: qatorni saqlash (fonda) va darhol keyingi qatorga o'tish — yozish oqimi to'xtamaydi. */
  function onEnter(index: number) {
    const r = rowsRef.current[index];
    if (!r) return;
    if (r.status === "dup") void saveRow(r.key, true);
    else if (r.status !== "saved") {
      if (!hasContent(r, header.kind)) return; // bo'sh qatorda Enter — hech narsa
      void saveRow(r.key);
    }
    focusRow(index + 1, cols[0], r.categoryId);
  }

  function focusRow(index: number, col: Col, carryCategory: number | null = null) {
    const target = rowsRef.current[index];
    if (target) {
      const el = cellRefs.current.get(`${target.key}:${col}`);
      if (el && !el.disabled) el.focus();
      else pendingFocus.current = { key: target.key, col };
      return;
    }
    const draft = emptyRow(header.kind === "EXPENSE" ? carryCategory : null);
    pendingFocus.current = { key: draft.key, col };
    setRows((rs) => [...rs, draft]);
  }

  function onGridKey(e: React.KeyboardEvent<HTMLInputElement>, index: number, col: Col) {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(index);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (index + 1 < rowsRef.current.length) focusRow(index + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) focusRow(index - 1, col);
    } else if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      void removeRow(index);
    }
  }

  /** Ro'yxatdan Enter bilan tanlangach keyingi katakka o'tish. */
  function focusNextCell(index: number, col: Col) {
    const r = rowsRef.current[index];
    const next = cols.slice(cols.indexOf(col) + 1);
    // Tanlangan kategoriya material bo'lmasa — material katagi o'chiq, keyingisiga
    requestAnimationFrame(() => {
      for (const c of next) {
        const el = cellRefs.current.get(`${r.key}:${c}`);
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
    });
  }

  async function removeRow(index: number) {
    const r = rowsRef.current[index];
    if (!r) return;
    if (!r.id) {
      if (rowsRef.current.length === 1) return; // oxirgi bo'sh qator qoladi
      setRows((rs) => rs.filter((x) => x.key !== r.key));
      return;
    }
    if (!r.canModify) return;
    const reason = window.prompt(`#${r.id} yozuvini bekor qilish sababi:`);
    if (!reason?.trim()) return;
    const res = await fetch(`/api/entries/${r.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) setRows((rs) => rs.filter((x) => x.key !== r.key));
    else updateRow(r.key, { status: "error", message: data?.error ?? "Bekor qilinmadi" });
  }

  const reg = (key: string, col: Col) => (el: HTMLInputElement | null) => {
    const k = `${key}:${col}`;
    if (el) cellRefs.current.set(k, el);
    else cellRefs.current.delete(k);
  };

  const savedTotal = rows.filter((r) => r.status === "saved").reduce((a, r) => a + (rowAmount(r) ?? 0n), 0n);
  const savedCount = rows.filter((r) => r.status === "saved").length;
  const attention = rows.filter((r) => r.status === "dup" || r.status === "error").length;
  const priceLabel = header.kind === "EXPENSE" ? "Narx" : "Summa";

  return (
    <div>
      {/* ── Sarlavha: bir marta tanlanadi ── */}
      <div className="flex flex-wrap items-end gap-3 mb-3 bg-paper border border-line px-3 py-2.5">
        {allowedKinds.length > 1 && (
          <div className="flex border border-line rounded-[3px] overflow-hidden">
            {allowedKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => header.kind !== k && changeHeader({ kind: k })}
                className={`px-3 h-[30px] ${header.kind === k ? "bg-accent text-white" : "bg-paper hover:bg-canvas"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        {header.kind !== "TRANSFER" && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[12px] text-ink-3">Ob&apos;ekt</span>
            <select
              className="field min-w-[200px]"
              value={header.siteId ?? ""}
              onChange={(e) => changeHeader({ siteId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— tanlang —</option>
              {options.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-[12px] text-ink-3">{header.kind === "TRANSFER" ? "Qaysi hisobdan" : "Hisob"}</span>
          <select
            className="field min-w-[180px]"
            value={header.accountId ?? ""}
            onChange={(e) => changeHeader({ accountId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— tanlang —</option>
            {options.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[12px] text-ink-3">Sana</span>
          <input
            type="date"
            className="field"
            value={header.date}
            max={today}
            onChange={(e) => e.target.value && changeHeader({ date: e.target.value > today ? today : e.target.value })}
          />
        </label>
        <div className="ml-auto text-[12px] text-ink-3 leading-snug hidden lg:block">
          Tab — keyingi katak · Enter — saqlash va yangi qator
          <br />↑↓ — qatorlar · Ctrl+Delete — qatorni o&apos;chirish/bekor qilish
        </div>
      </div>

      {monthClosed && (
        <div className="mb-3 px-3 py-2 bg-warn-soft text-warn border border-line">
          {formatMonth(monthStartIso(header.date))} yopilgan — bu oyga yozuv qo&apos;shib yoki o&apos;zgartirib bo&apos;lmaydi.
        </div>
      )}
      {loadError && <div className="mb-3 px-3 py-2 bg-err-soft text-minus border border-line">{loadError}</div>}
      {!headerReady && <p className="text-ink-3 py-6">Yuqorida {header.kind === "TRANSFER" ? "hisobni" : "ob'ekt va hisobni"} tanlang.</p>}

      {headerReady && (
        <div className="overflow-x-auto border border-line bg-paper">
          <table className="tbl grid-tbl">
            <thead>
              <tr>
                <th className="w-[44px] num">№</th>
                {header.kind === "EXPENSE" && (
                  <>
                    <th className="min-w-[150px]">Kategoriya</th>
                    <th className="min-w-[220px]">Material</th>
                    <th className="w-[100px] num">Miqdor</th>
                    <th className="w-[70px]">Birlik</th>
                  </>
                )}
                {header.kind === "INCOME" && <th className="min-w-[240px]">Kimdan</th>}
                {header.kind === "TRANSFER" && <th className="min-w-[240px]">Qaysi hisobga</th>}
                <th className="w-[130px] num">{priceLabel}</th>
                {header.kind === "EXPENSE" && <th className="w-[140px] num">Summa</th>}
                <th className="min-w-[200px]">Izoh</th>
                <th className="w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const locked = monthClosed || (r.id !== null && !r.canModify) || loading;
                const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined;
                const mat = r.materialId ? materialById.get(r.materialId) : undefined;
                const amount = rowAmount(r);
                const rowClass = locked && r.id
                  ? "row-locked"
                  : r.status === "dup"
                    ? "row-dup"
                    : r.status === "error"
                      ? "row-error"
                      : r.status === "saved"
                        ? "row-saved"
                        : "row-draft";
                const key = (col: Col) => (e: React.KeyboardEvent<HTMLInputElement>) => onGridKey(e, i, col);
                return (
                  <FragmentRow key={r.key} message={r.message} colSpan={cols.length + 4} status={r.status}>
                    <tr className={rowClass}>
                      <td className="num text-ink-3 text-[12px] px-2" title={r.createdByName ? `Kiritgan: ${r.createdByName}` : undefined}>
                        {r.id ? `#${r.id}` : ""}
                      </td>
                      {header.kind === "EXPENSE" && (
                        <>
                          <td>
                            <ComboCell
                              options={categoryOptions}
                              value={r.categoryId}
                              onChange={(v) => setField(r.key, "categoryId", v)}
                              disabled={locked}
                              onGridKey={key("category")}
                              onPickedWithEnter={() => focusNextCell(i, "category")}
                              inputRef={reg(r.key, "category")}
                            />
                          </td>
                          <td>
                            <ComboCell
                              options={materialOptions}
                              value={r.materialId}
                              onChange={(v) => setField(r.key, "materialId", v)}
                              disabled={locked || !cat?.isMaterial}
                              placeholder={cat && !cat.isMaterial ? "—" : ""}
                              onGridKey={key("material")}
                              onPickedWithEnter={() => focusNextCell(i, "material")}
                              inputRef={reg(r.key, "material")}
                            />
                          </td>
                          <td>
                            <input
                              ref={reg(r.key, "quantity")}
                              className="cell num"
                              inputMode="decimal"
                              value={r.quantity}
                              disabled={locked}
                              onChange={(e) => setField(r.key, "quantity", e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={key("quantity")}
                            />
                          </td>
                          <td className="px-2 text-ink-3 align-middle">{mat ? unitLabel(mat.unit) : ""}</td>
                        </>
                      )}
                      {header.kind === "INCOME" && (
                        <td>
                          <ComboCell
                            options={options.counterparties}
                            value={r.counterpartyId}
                            onChange={(v) => setField(r.key, "counterpartyId", v)}
                            disabled={locked}
                            onGridKey={key("counterparty")}
                            onPickedWithEnter={() => focusNextCell(i, "counterparty")}
                            inputRef={reg(r.key, "counterparty")}
                          />
                        </td>
                      )}
                      {header.kind === "TRANSFER" && (
                        <td>
                          <ComboCell
                            options={toAccountOptions}
                            value={r.toAccountId}
                            onChange={(v) => setField(r.key, "toAccountId", v)}
                            disabled={locked}
                            onGridKey={key("toAccount")}
                            onPickedWithEnter={() => focusNextCell(i, "toAccount")}
                            inputRef={reg(r.key, "toAccount")}
                          />
                        </td>
                      )}
                      <td>
                        <input
                          ref={reg(r.key, "price")}
                          className="cell num"
                          inputMode="numeric"
                          value={r.unitPrice}
                          disabled={locked}
                          onChange={(e) => setField(r.key, "unitPrice", e.target.value.replace(/[^\d\s]/g, ""))}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            const v = parseSom(r.unitPrice);
                            if (v !== null && formatSom(v) !== r.unitPrice) updateRow(r.key, { unitPrice: formatSom(v) });
                          }}
                          onKeyDown={key("price")}
                        />
                      </td>
                      {header.kind === "EXPENSE" && (
                        <td className="num px-2 align-middle font-medium">{amount !== null ? formatSom(amount) : ""}</td>
                      )}
                      <td>
                        <input
                          ref={reg(r.key, "note")}
                          className="cell"
                          value={r.note}
                          maxLength={500}
                          disabled={locked}
                          onChange={(e) => setField(r.key, "note", e.target.value)}
                          onKeyDown={key("note")}
                        />
                      </td>
                      <td className="text-center align-middle">
                        <RowStatusMark status={r.status} />
                        {!locked && (r.id ? r.canModify : rows.length > 1) && (
                          <button
                            type="button"
                            tabIndex={-1}
                            className="text-ink-3 hover:text-minus px-1"
                            title={r.id ? "Bekor qilish" : "Qatorni o'chirish"}
                            onClick={() => void removeRow(i)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {headerReady && (
        <div className="flex items-center gap-4 mt-2 text-[13px]">
          <span>
            Saqlangan: <b>{savedCount}</b> ta, jami <b className="num">{formatSom(savedTotal)}</b> so&apos;m
          </span>
          {unsavedCount > 0 && <span className="text-warn">Saqlanmagan: {unsavedCount} ta</span>}
          {attention > 0 && <span className="text-minus">E&apos;tibor talab qiladi: {attention} ta</span>}
          {unsavedCount > 0 && (
            <button type="button" className="btn ml-auto" onClick={saveAll}>
              Barchasini saqlash
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RowStatusMark({ status }: { status: RowStatus }) {
  if (status === "saving") return <span className="text-ink-3">…</span>;
  if (status === "dirty") return <span className="text-warn" title="Saqlanmagan o'zgarish">●</span>;
  if (status === "dup") return <span className="text-warn" title="O'xshash yozuv bor">!</span>;
  if (status === "error") return <span className="text-minus" title="Saqlanmadi">!</span>;
  return null;
}

/** Qator + (bo'lsa) uning ostida xabar qatori. */
function FragmentRow({ children, message, colSpan, status }: { children: React.ReactNode; message: string | null; colSpan: number; status: RowStatus }) {
  return (
    <>
      {children}
      {message && (
        <tr className={status === "dup" ? "row-dup" : "row-error"}>
          <td />
          <td colSpan={colSpan - 1} className={`px-2 py-1 text-[12px] ${status === "dup" ? "text-warn" : "text-minus"}`}>
            {message}
          </td>
        </tr>
      )}
    </>
  );
}
