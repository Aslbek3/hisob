"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ComboCell, type ComboOption } from "@/components/grid/ComboCell";
import { MoneyMoveForm } from "@/components/MoneyMoveForm";
import { computeAmount, formatQuantity, formatSom, parseQuantityMilli, parseSom } from "@/lib/money";
import { formatDate, formatMonth, monthStartIso, todayIso } from "@/lib/dates";
import { unitLabel } from "@/lib/units";
import type { EntryOptions, ItemOption, Option } from "@/services/reference";
import type { EntryRow } from "@/services/entries";
import { NewNameDialog } from "./NewNameDialog";

/**
 * Kunlik daftar — asosiy ekran. Excel'dagi kabi: bitta ob'ekt, bitta kun,
 * pastma-past qatorlar. Har qatorda kim to'lagani tanlanadi (firma naqd kassasi,
 * perechisleniye, shaxsiy hisob...) yoki "Етказиб берувчи ҳисобидан" (qarz/avans).
 *
 * Saqlash: Enter bosilganda YOKI qatordan chiqilganda (sichqoncha bilan
 * ishlaydigan foydalanuvchi uchun) — qator to'liq bo'lsa o'zi saqlanadi.
 * Kun/ob'ekt/sahifa almashishidan oldin barcha qatorlar saqlanadi va natija
 * kutiladi — saqlanmagan qator jimgina yo'qolmaydi.
 */

type RowStatus = "draft" | "dirty" | "saving" | "saved" | "dup" | "error";
const DEBT = "debt";
const ADJUST_CHOICES = ["Чегирма", "Яхлитлаш", "Келишилган нарх"];
const AUTO_ROUND = "Яхлитлаш (нарх суммадан ҳисобланди)";
const DEBT_LABEL = "Етказиб берувчи ҳисобидан";

type Row = {
  key: string;
  id: number | null;
  materialId: number | null;
  quantity: string;
  unitPrice: string;
  /** To'langan summa (qo'lda tuzatilgan bo'lsa). amountTouched=false — avtomatik. */
  amount: string;
  amountTouched: boolean;
  /** Narx foydalanuvchi yozmagan — to'langan summadan hisoblangan (summa ÷ miqdor). */
  priceDerived: boolean;
  adjustReason: string;
  payer: string; // hisob id'si yoki DEBT
  supplierId: number | null;
  note: string;
  status: RowStatus;
  message: string | null;
  canModify: boolean;
  createdByName: string | null;
  /** Har tahrirda oshadi — saqlash paytida kiritilgan o'zgarish yo'qolmasligi uchun. */
  rev: number;
};

type Col = "item" | "qty" | "price" | "amount" | "payer" | "supplier" | "note";
const COLS: Col[] = ["item", "qty", "price", "amount", "payer", "supplier", "note"];

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

function emptyRow(payer: string): Row {
  return {
    key: newKey(),
    id: null,
    materialId: null,
    quantity: "1",
    unitPrice: "",
    amount: "",
    amountTouched: false,
    priceDerived: false,
    adjustReason: "",
    payer,
    supplierId: null,
    note: "",
    status: "draft",
    message: null,
    canModify: true,
    createdByName: null,
    rev: 0,
  };
}

function computed(r: Pick<Row, "quantity" | "unitPrice">): bigint | null {
  const q = parseQuantityMilli(r.quantity);
  const p = parseSom(r.unitPrice);
  return q === null || p === null ? null : computeAmount(q, p);
}

function effective(r: Row): bigint | null {
  return r.amountTouched ? parseSom(r.amount) : computed(r);
}

function mismatch(r: Row): { computed: bigint; paid: bigint } | null {
  if (!r.amountTouched) return null;
  const c = computed(r);
  const p = parseSom(r.amount);
  return c !== null && p !== null && c !== p ? { computed: c, paid: p } : null;
}

function fromEntry(e: EntryRow, key?: string): Row {
  const base = { quantity: formatQuantity(e.quantity), unitPrice: formatSom(e.unitPrice) };
  const auto = computed(base);
  return {
    key: key ?? `e${e.id}`,
    id: e.id,
    materialId: e.materialId,
    ...base,
    amount: formatSom(e.amount),
    amountTouched: auto === null || auto.toString() !== e.amount,
    priceDerived: false,
    adjustReason: e.adjustReason ?? "",
    payer: e.kind === "GOODS_RECEIPT" ? DEBT : String(e.accountId ?? ""),
    supplierId: e.counterpartyId,
    note: e.note ?? "",
    status: "saved",
    message: null,
    canModify: e.canModify,
    createdByName: e.createdByName,
    rev: 0,
  };
}

/**
 * Narx yozilmay faqat to'langan summa yozilgan bo'lsa (yoki narx avval summadan
 * olingan bo'lsa) — narx = summa ÷ miqdor. Summa o'zgarmaydi (u — fakt):
 * "6 дона, 170 000" → narx 28 333, farq (2 so'm) sababi "Яхлитлаш".
 */
function withDerivedPrice(r: Row): Row {
  if (!r.amountTouched || (r.unitPrice.trim() && !r.priceDerived)) return r;
  const paid = parseSom(r.amount);
  const q = parseQuantityMilli(r.quantity);
  if (paid === null || q === null || q <= 0n) return r;
  const price = (paid * 1000n + q / 2n) / q;
  const exact = computeAmount(q, price) === paid;
  const adjustReason = exact ? (r.adjustReason === AUTO_ROUND ? "" : r.adjustReason) : r.adjustReason || AUTO_ROUND;
  return { ...r, unitPrice: formatSom(price), priceDerived: true, adjustReason };
}

function hasContent(r: Row): boolean {
  return (
    r.materialId !== null || !!r.unitPrice.trim() || !!r.amount.trim() || !!r.note.trim() ||
    (r.quantity.trim() !== "1" && r.quantity.trim() !== "")
  );
}

/** Mijoz tomonidagi tez tekshiruv — server baribir o'zi tekshiradi. */
function validate(row: Row): string | null {
  const r = withDerivedPrice(row);
  if (!r.materialId) return "Номини рўйхатдан танланг";
  if (parseQuantityMilli(r.quantity) === null) return "Миқдор нотўғри";
  if (parseSom(r.unitPrice) === null) return "Нархни ёзинг (бутун сўм)";
  const amount = effective(r);
  if (amount === null || amount <= 0n) return "Сумма 0 бўлиши мумкин эмас";
  if (!r.payer) return "Ким тўлаганини танланг";
  if (r.payer === DEBT && !r.supplierId) return `«${DEBT_LABEL}» танланганда етказиб берувчини танланг`;
  if (mismatch(r) && !r.adjustReason.trim()) return "Сумма миқдор × нархдан фарқ қилади — сабабини танланг";
  return null;
}

const STORAGE = "hisob.daftar";

export function DailyLedger(props: {
  options: EntryOptions;
  initialSiteId: number | null;
  initialDate: string;
  today: string;
  closedMonths: string[];
  focusId: number | null;
  showIncome: boolean;
  /** Yangi nom/yetkazib beruvchi qo'shish huquqi (ofis). Prorabga "+ Янги" ko'rsatilmaydi. */
  canAddNames: boolean;
}) {
  const { closedMonths } = props;
  // Sahifa yarim tundan keyin ham ochiq qolsa — "bugun" yangilanib tursin
  const [today, setToday] = useState(props.today);
  useEffect(() => {
    const t = setInterval(() => setToday(todayIso()), 60_000);
    return () => clearInterval(t);
  }, []);
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>(props.options.items);
  const [suppliers, setSuppliers] = useState<Option[]>(props.options.suppliers);
  /** Eski qatorlarda ishlatilgan, lekin hozir yopilgan hisoblar — select'da bo'sh ko'rinmasin. */
  const [extraAccounts, setExtraAccounts] = useState<Option[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const { sites, accounts, categories, payers } = props.options;

  const [siteId, setSiteId] = useState<number | null>(props.initialSiteId);
  const [date, setDate] = useState(props.initialDate);
  const [rows, setRows] = useState<Row[]>([]);
  const [incomes, setIncomes] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "item" | "supplier"; rowKey: string; text: string } | null>(null);
  const [cancelling, setCancelling] = useState<{ key: string; reason: string } | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ key: string; col: Col } | null>(null);
  const lastPayer = useRef<string>(accounts[0] ? String(accounts[0].id) : "");
  /**
   * Hozir serverga ketayotgan qatorlar. Enter bosilganda saqlash boshlanadi va
   * fokus darhol keyingi qatorga o'tadi — bu o'tish "qatordan chiqildi"
   * (avto-saqlash) hodisasini ham chaqiradi, rowsRef esa hali eski holatda.
   * Shu to'plam bo'lmasa bitta qator ikki marta yuborilib, ikkinchisi
   * "takror" deb qaytib, saqlangan qatorni xato ko'rsatardi.
   */
  const inFlight = useRef(new Map<string, Promise<boolean>>());

  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemOptions: ComboOption[] = items.map((i) => ({ id: i.id, name: i.name, hint: unitLabel(i.unit) }));
  const locked = closedMonths.includes(monthStartIso(date));
  const site = sites.find((s) => s.id === siteId) ?? null;

  // URL'da ob'ekt bo'lmasa — oxirgi tanlangani (faqat shu brauzerda)
  useEffect(() => {
    if (props.initialSiteId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as { siteId?: number } | null;
      if (saved?.siteId && sites.some((s) => s.id === saved.siteId)) setSiteId(saved.siteId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kun yuklanadi: ob'ekt yoki sana o'zgarsa ──
  useEffect(() => {
    const qs = new URLSearchParams({ date });
    if (siteId) qs.set("siteId", String(siteId));
    window.history.replaceState(null, "", `/kiritish?${qs}`);
    if (!siteId) {
      setRows([]);
      return;
    }
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ siteId }));
    } catch {}

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/entries?${qs}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data?.error ?? "Юклаб бўлмади");
          setRows([]);
          setIncomes([]);
          return;
        }
        const exps = data.expenses as EntryRow[];
        mergeInactive(exps);
        const loaded = exps.map((e) => fromEntry(e));
        const last = loaded[loaded.length - 1];
        if (last?.payer) lastPayer.current = last.payer;
        const draft = emptyRow(lastPayer.current);
        setRows([...loaded, draft]);
        setIncomes(data.incomes as EntryRow[]);
        const focus = loaded.find((r) => r.id === props.focusId) ?? draft;
        pendingFocus.current = { key: focus.key, col: "item" };
      })
      .catch(() => !cancelled && setLoadError("Тармоқ хатоси"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, date]);

  /** Eski qatorda o'chirilgan nom/yetkazib beruvchi/hisob bo'lsa — ro'yxatga "(ўчирилган)" bilan qo'shiladi. */
  function mergeInactive(exps: EntryRow[]) {
    const mark = (name: string | null) => `${name ?? "?"} (ўчирилган)`;
    setItems((xs) => {
      const have = new Set(xs.map((x) => x.id));
      const add = new Map<number, ItemOption>();
      for (const e of exps) {
        if (e.materialId && !have.has(e.materialId)) {
          add.set(e.materialId, { id: e.materialId, name: mark(e.materialName), unit: e.unit ?? "dona", categoryId: e.categoryId });
        }
      }
      return add.size ? [...xs, ...add.values()] : xs;
    });
    setSuppliers((xs) => {
      const have = new Set(xs.map((x) => x.id));
      const add = new Map<number, Option>();
      for (const e of exps) if (e.counterpartyId && !have.has(e.counterpartyId)) add.set(e.counterpartyId, { id: e.counterpartyId, name: mark(e.counterpartyName) });
      return add.size ? [...xs, ...add.values()] : xs;
    });
    setExtraAccounts((xs) => {
      const have = new Set([...accounts, ...xs].map((x) => x.id));
      const add = new Map<number, Option>();
      for (const e of exps) if (e.accountId && !have.has(e.accountId)) add.set(e.accountId, { id: e.accountId, name: mark(e.accountName) });
      return add.size ? [...xs, ...add.values()] : xs;
    });
  }

  /** Kirim qo'shilgach faqat kirimlar yangilanadi — yozilayotgan qatorlar joyida qoladi. */
  async function reloadIncomes() {
    if (!siteId) return;
    const res = await fetch(`/api/entries?siteId=${siteId}&date=${date}`).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data) setIncomes(data.incomes as EntryRow[]);
  }

  // Kutilayotgan fokus (yangi qator chizilgach)
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    const el = cellRefs.current.get(`${f.key}:${f.col}`) as HTMLInputElement | undefined;
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  // Saqlanmagan qator bilan sahifadan chiqishda ogohlantirish
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (rowsRef.current.some((r) => r.status !== "saved" && hasContent(r))) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const unsaved = rows.filter((r) => r.status !== "saved" && hasContent(r));

  /**
   * Kun/ob'ekt/sahifa almashishidan oldin: to'liq qatorlar saqlanadi va NATIJA
   * KUTILADI. Birortasi saqlanmasa (takror, server rad etdi, tarmoq) — joyida
   * qolamiz. To'liq bo'lmagan qatorlar — faqat foydalanuvchi rozi bo'lsa tashlanadi.
   */
  async function flushUnsaved(): Promise<boolean> {
    const pending = rowsRef.current.filter((r) => r.status !== "saved" && hasContent(r));
    if (!pending.length) return true;
    const incomplete = pending.filter((r) => validate(r) !== null && r.status !== "dup");
    if (incomplete.length && !window.confirm(`${incomplete.length} та қатор тўлиқ эмас — сақланмайди. Барибир ўтилсинми?`)) return false;
    const results = await Promise.all(pending.filter((r) => !incomplete.includes(r)).map((r) => saveRow(r.key)));
    if (results.every(Boolean)) return true;
    setNotice("Баъзи қаторлар сақланмади — қизил ёки сариқ қаторни тузатинг ёки «Ҳа, барибир сақлаш»ни босинг.");
    return false;
  }
  const flushRef = useRef(flushUnsaved);
  flushRef.current = flushUnsaved;

  // Menyudagi havola bosilganda ham — avval saqlash (beforeunload ichki o'tishda ishlamaydi)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!rowsRef.current.some((r) => r.status !== "saved" && hasContent(r))) return;
      e.preventDefault();
      e.stopPropagation();
      void flushRef.current().then((ok) => ok && router.push(url.pathname + url.search));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  async function changeDay(patch: { siteId?: number; date?: string }) {
    if (!(await flushUnsaved())) return;
    setNotice(null);
    if (patch.siteId !== undefined) setSiteId(patch.siteId);
    if (patch.date !== undefined) setDate(patch.date > today ? today : patch.date);
  }

  function shiftDate(days: number) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    void changeDay({ date: d.toISOString().slice(0, 10) });
  }

  const updateRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  function setField(key: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        let next: Row = { ...r, ...patch, message: null, status: (r.id ? "dirty" : "draft") as RowStatus, rev: r.rev + 1 };
        if ("unitPrice" in patch) next.priceDerived = false; // narxni o'zi yozdi
        if (next.amountTouched && next.priceDerived && ("quantity" in patch || "amount" in patch)) {
          // Narx summadan olingan — summa (fakt) joyida qoladi, narx qayta hisoblanadi
          next = withDerivedPrice(next);
        } else if (r.amountTouched && ("quantity" in patch || "unitPrice" in patch) && !("adjustReason" in patch)) {
          // Summa qo'lda yozilgan qatorda miqdor/narx o'zgarsa — farq ham o'zgaradi,
          // eski sabab jimgina qolib ketmasin: foydalanuvchi qaytadan tasdiqlaydi.
          next.adjustReason = "";
        }
        return next;
      })
    );
  }

  /** Summa katagidan chiqildi: formatlanadi, kerak bo'lsa narx summadan olinadi, xato holati tozalanadi. */
  function onAmountBlur(key: string) {
    const r = rowsRef.current.find((x) => x.key === key);
    if (!r || !r.amountTouched) return;
    const paid = parseSom(r.amount);
    if (paid === null) return;
    let next = withDerivedPrice({ ...r, amount: formatSom(paid) });
    // Qo'lda yozilgan summa miqdor × narxga teng — avtomatik rejimga qaytamiz (narxni o'zi yozgan bo'lsa)
    if (!next.priceDerived && computed(next) === paid) next = { ...next, amountTouched: false };
    if (next.status === "error") next = { ...next, status: next.id ? "dirty" : "draft", message: null };
    setRows((rs) => rs.map((x) => (x.key === key ? next : x)));
  }

  /** true — qator saqlangan (yoki bo'sh). Bitta qator uchun bir vaqtda faqat bitta so'rov. */
  function saveRow(key: string, allowDuplicate = false): Promise<boolean> {
    const pending = inFlight.current.get(key);
    if (pending) return pending;
    const p = doSave(key, allowDuplicate).finally(() => inFlight.current.delete(key));
    inFlight.current.set(key, p);
    return p;
  }

  async function doSave(key: string, allowDuplicate: boolean): Promise<boolean> {
    const found = rowsRef.current.find((x) => x.key === key);
    if (!found || !siteId) return false;
    if (found.status === "saved" || !hasContent(found)) return true;
    const r = withDerivedPrice(found);
    const derived = { unitPrice: r.unitPrice, priceDerived: r.priceDerived, adjustReason: r.adjustReason };
    const problem = validate(r);
    if (problem) {
      updateRow(key, { ...derived, status: "error", message: problem });
      return false;
    }
    updateRow(key, { ...derived, status: "saving", message: null });
    lastPayer.current = r.payer;
    const sentRev = r.rev;

    const debt = r.payer === DEBT;
    const body = {
      kind: debt ? "GOODS_RECEIPT" : "EXPENSE",
      date,
      siteId,
      accountId: debt ? null : Number(r.payer),
      materialId: r.materialId,
      counterpartyId: r.supplierId,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      amount: r.amountTouched ? r.amount : null,
      adjustReason: mismatch(r) ? r.adjustReason : null,
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
        const savedRow = fromEntry(data.row as EntryRow, key);
        // Saqlash paytida foydalanuvchi shu qatorni o'zgartirgan bo'lsa — uning o'zgarishi qoladi
        setRows((rs) =>
          rs.map((x) => (x.key !== key ? x : x.rev === sentRev ? savedRow : { ...x, id: savedRow.id, canModify: savedRow.canModify, status: "dirty" }))
        );
        return true;
      }
      if (res.status === 409 && data?.code === "DUPLICATE") updateRow(key, { status: "dup", message: data.error });
      else updateRow(key, { status: "error", message: data?.error ?? "Сақланмади" });
      return false;
    } catch {
      updateRow(key, { status: "error", message: "Тармоқ хатоси — қайта уриниб кўринг" });
      return false;
    }
  }

  function saveAll() {
    for (const r of rowsRef.current) if (r.status !== "saved" && r.status !== "saving" && hasContent(r)) void saveRow(r.key);
  }

  /** Qatordan chiqildi — to'liq bo'lsa jimgina saqlanadi (xato ko'rsatilmaydi). */
  function onRowLeave(key: string) {
    const r = rowsRef.current.find((x) => x.key === key);
    if (r && (r.status === "draft" || r.status === "dirty") && hasContent(r) && validate(r) === null) void saveRow(key);
  }

  function addRow(focusCol: Col = "item") {
    const draft = emptyRow(lastPayer.current);
    pendingFocus.current = { key: draft.key, col: focusCol };
    setRows((rs) => [...rs, draft]);
  }

  function onEnter(index: number) {
    const r = rowsRef.current[index];
    if (!r) return;
    if (r.status === "dup") void saveRow(r.key, true);
    else if (r.status !== "saved") {
      if (!hasContent(r)) return;
      void saveRow(r.key);
    }
    focusRow(index + 1, "item");
  }

  function focusRow(index: number, col: Col) {
    const target = rowsRef.current[index];
    if (!target) return addRow(col);
    const el = cellRefs.current.get(`${target.key}:${col}`) as HTMLInputElement | undefined;
    if (el && !el.disabled) el.focus();
    else pendingFocus.current = { key: target.key, col };
  }

  function focusNext(index: number, col: Col) {
    const r = rowsRef.current[index];
    // Darhol (keyingi kadrda emas): aks holda tez yozilgan raqam hali eski katakka tushadi
    for (const c of COLS.slice(COLS.indexOf(col) + 1)) {
      const el = cellRefs.current.get(`${r.key}:${c}`) as HTMLInputElement | undefined;
      if (el && !el.disabled) return el.focus();
    }
  }

  function onGridKey(e: React.KeyboardEvent<HTMLElement>, index: number, col: Col) {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(index);
    } else if (e.key === "ArrowDown" && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      if (index + 1 < rowsRef.current.length) focusRow(index + 1, col);
    } else if (e.key === "ArrowUp" && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      if (index > 0) focusRow(index - 1, col);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    const r = rowsRef.current.find((x) => x.key === cancelling.key);
    if (!r?.id) return;
    const res = await fetch(`/api/entries/${r.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: cancelling.reason }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRows((rs) => rs.filter((x) => x.key !== r.key));
      setCancelling(null);
    } else updateRow(r.key, { status: "error", message: data?.error ?? "Бекор қилинмади" });
  }

  function removeRow(key: string) {
    const r = rowsRef.current.find((x) => x.key === key);
    if (!r) return;
    if (r.id) setCancelling({ key, reason: "" });
    else if (rowsRef.current.length > 1) setRows((rs) => rs.filter((x) => x.key !== key));
    else setRows([emptyRow(lastPayer.current)]);
  }

  const reg = (key: string, col: Col) => (el: HTMLElement | null) => {
    const k = `${key}:${col}`;
    if (el) cellRefs.current.set(k, el);
    else cellRefs.current.delete(k);
  };

  // ── Kun yakuni: kim qancha to'ladi ──
  const saved = rows.filter((r) => r.status === "saved");
  const dayTotal = saved.reduce((a, r) => a + (effective(r) ?? 0n), 0n);
  const byPayer = new Map<string, bigint>();
  for (const r of saved) byPayer.set(r.payer, (byPayer.get(r.payer) ?? 0n) + (effective(r) ?? 0n));
  const allAccounts = [...accounts, ...extraAccounts];
  const payerName = (p: string) => (p === DEBT ? DEBT_LABEL : (allAccounts.find((a) => String(a.id) === p)?.name ?? "—"));

  return (
    <div>
      {/* ── Ob'ekt va sana ── */}
      <div className="bg-paper border border-line px-4 py-3 mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {sites.length === 0 && <span className="text-ink-3">Фаол объект йўқ — «Объектлар» бўлимида очинг.</span>}
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => s.id !== siteId && void changeDay({ siteId: s.id })}
              className={`h-[44px] px-5 border rounded-[4px] text-[16px] ${
                s.id === siteId ? "bg-accent text-white border-accent font-semibold" : "bg-paper border-line hover:bg-canvas"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => shiftDate(-1)} title="Олдинги кун">
            ◀
          </button>
          <input
            type="date"
            className="field text-[16px]"
            value={date}
            max={today}
            onChange={(e) => e.target.value && void changeDay({ date: e.target.value })}
          />
          <button type="button" className="btn" onClick={() => shiftDate(1)} disabled={date >= today} title="Кейинги кун">
            ▶
          </button>
          {date !== today && (
            <button type="button" className="btn" onClick={() => void changeDay({ date: today })}>
              Бугун
            </button>
          )}
          <span className="text-[16px] ml-2 font-medium">{formatDate(date)}</span>
          {site && (
            <span className="ml-auto text-[15px]">
              Кун жами: <b className="num">{formatSom(dayTotal)}</b> сўм
              {[...byPayer.entries()].map(([p, v]) => (
                <span key={p} className="text-ink-2 ml-3">
                  {payerName(p)}: <span className="num">{formatSom(v)}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {locked && (
        <div className="mb-3 px-4 py-2 bg-warn-soft text-warn border border-line">
          {formatMonth(monthStartIso(date))} ёпилган — бу ойга ёзув қўшиб ёки ўзгартириб бўлмайди.
        </div>
      )}
      {loadError && <div className="mb-3 px-4 py-2 bg-err-soft text-minus border border-line">{loadError}</div>}
      {notice && <div className="mb-3 px-4 py-2 bg-warn-soft text-warn border border-line">{notice}</div>}

      {site && (
        <div className="overflow-x-auto border border-line bg-paper">
          <table className="tbl grid-tbl">
            <thead>
              <tr>
                <th className="w-[46px] num">№</th>
                <th className="min-w-[250px]">Номи</th>
                <th className="w-[96px] num">Миқдор</th>
                <th className="w-[72px]">Бирлик</th>
                <th className="w-[130px] num">Нархи</th>
                <th className="w-[150px] num">Сумма</th>
                <th className="w-[190px]">Ким тўлади</th>
                <th className="min-w-[170px]">Етказиб берувчи</th>
                <th className="min-w-[180px]">Изоҳ</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rowLocked = locked || loading || (r.id !== null && !r.canModify);
                const item = r.materialId ? itemById.get(r.materialId) : undefined;
                const auto = computed(r);
                const diff = mismatch(r);
                const cls = rowLocked && r.id ? "row-locked" : r.status === "dup" ? "row-dup" : r.status === "error" ? "row-error" : r.status === "saved" ? "row-saved" : "row-draft";
                const key = (col: Col) => (e: React.KeyboardEvent<HTMLElement>) => onGridKey(e, i, col);
                return (
                  <Fragment key={r.key}>
                    <tr
                      className={cls}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onRowLeave(r.key);
                      }}
                    >
                      <td
                        className="num text-ink-3 text-[13px] px-2"
                        title={r.id ? `Ёзув №${r.id}${r.createdByName ? `, киритган: ${r.createdByName}` : ""}` : undefined}
                      >
                        {i + 1}
                      </td>
                      <td>
                        <ComboCell
                          options={itemOptions}
                          value={r.materialId}
                          onChange={(v) => setField(r.key, { materialId: v })}
                          disabled={rowLocked}
                          placeholder="ёзинг ва танланг…"
                          onGridKey={key("item")}
                          onPickedWithEnter={() => focusNext(i, "item")}
                          inputRef={reg(r.key, "item")}
                          onCreate={props.canAddNames ? (text) => setDialog({ mode: "item", rowKey: r.key, text }) : undefined}
                          createLabel="Янги ном қўшиш"
                        />
                      </td>
                      <td>
                        <input
                          ref={reg(r.key, "qty")}
                          className="cell num"
                          inputMode="decimal"
                          value={r.quantity}
                          disabled={rowLocked}
                          onChange={(e) => setField(r.key, { quantity: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={key("qty")}
                        />
                      </td>
                      <td className="px-2 text-ink-3">{item ? unitLabel(item.unit) : ""}</td>
                      <td>
                        <input
                          ref={reg(r.key, "price")}
                          className="cell num"
                          inputMode="numeric"
                          value={r.unitPrice}
                          disabled={rowLocked}
                          onChange={(e) => setField(r.key, { unitPrice: e.target.value.replace(/[^\d\s]/g, "") })}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            const v = parseSom(r.unitPrice);
                            if (v !== null && formatSom(v) !== r.unitPrice) updateRow(r.key, { unitPrice: formatSom(v) });
                          }}
                          onKeyDown={key("price")}
                        />
                      </td>
                      <td>
                        <input
                          ref={reg(r.key, "amount")}
                          className={`cell num font-semibold ${diff ? "text-warn" : ""}`}
                          inputMode="numeric"
                          value={r.amountTouched ? r.amount : auto !== null ? formatSom(auto) : ""}
                          placeholder="авто"
                          disabled={rowLocked}
                          title={diff && r.adjustReason ? `Миқдор × нарх = ${formatSom(diff.computed)}. Фарқ сабаби: ${r.adjustReason}` : "Одатда ўзи ҳисобланади. Тўланган сумма бошқача бўлса — тузатинг."}
                          onChange={(e) => setField(r.key, { amount: e.target.value.replace(/[^\d\s]/g, ""), amountTouched: true })}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => onAmountBlur(r.key)}
                          onKeyDown={key("amount")}
                        />
                      </td>
                      <td>
                        <select
                          ref={reg(r.key, "payer")}
                          className="cell"
                          value={r.payer}
                          disabled={rowLocked}
                          onChange={(e) => setField(r.key, { payer: e.target.value })}
                          onKeyDown={key("payer")}
                        >
                          <option value="">— танланг —</option>
                          {allAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                          <option value={DEBT}>{DEBT_LABEL} (қарз ёки аванс)</option>
                        </select>
                      </td>
                      <td>
                        <ComboCell
                          options={suppliers}
                          value={r.supplierId}
                          onChange={(v) => setField(r.key, { supplierId: v })}
                          disabled={rowLocked}
                          placeholder={r.payer === DEBT ? "танланг — шарт" : ""}
                          invalid={r.payer === DEBT && !r.supplierId && r.status === "error"}
                          onGridKey={key("supplier")}
                          onPickedWithEnter={() => focusNext(i, "supplier")}
                          inputRef={reg(r.key, "supplier")}
                          onCreate={props.canAddNames ? (text) => setDialog({ mode: "supplier", rowKey: r.key, text }) : undefined}
                          createLabel="Янги етказиб берувчи"
                        />
                      </td>
                      <td>
                        <input
                          ref={reg(r.key, "note")}
                          className="cell"
                          value={r.note}
                          maxLength={500}
                          disabled={rowLocked}
                          onChange={(e) => setField(r.key, { note: e.target.value })}
                          onKeyDown={key("note")}
                        />
                      </td>
                      <td className="text-center">
                        <StatusMark status={r.status} />
                        {!rowLocked && (r.id ? r.canModify : true) && (
                          <button
                            type="button"
                            tabIndex={-1}
                            className="text-ink-3 hover:text-minus px-1 text-[18px]"
                            title={r.id ? "Бекор қилиш" : "Қаторни ўчириш"}
                            onClick={() => removeRow(r.key)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Summa miqdor × narxdan farq qiladi — sababi bir bosishda */}
                    {diff && !rowLocked && r.status !== "saved" && (
                      <tr className="row-dup">
                        <td />
                        <td colSpan={9} className="px-3 py-1.5">
                          <span className="text-warn">
                            Миқдор × нарх = {formatSom(diff.computed)}, тўланган {formatSom(diff.paid)} (фарқ {formatSom(diff.paid - diff.computed)}). Сабаби:
                          </span>{" "}
                          {ADJUST_CHOICES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`btn ml-1 ${r.adjustReason === c ? "btn-primary" : ""}`}
                              onClick={() => {
                                setField(r.key, { adjustReason: c });
                                setTimeout(() => onRowLeave(r.key), 0);
                              }}
                            >
                              {c}
                            </button>
                          ))}
                          <input
                            className="field ml-2 w-[220px]"
                            placeholder="ёки ёзинг"
                            value={ADJUST_CHOICES.includes(r.adjustReason) ? "" : r.adjustReason}
                            onChange={(e) => setField(r.key, { adjustReason: e.target.value })}
                            onBlur={() => onRowLeave(r.key)}
                          />
                        </td>
                      </tr>
                    )}

                    {r.payer !== DEBT && r.payer !== "" && r.supplierId && !rowLocked && r.status !== "saved" && (
                      <tr className="row-draft">
                        <td />
                        <td colSpan={9} className="px-3 py-1.5 text-[14px] text-ink-2">
                          Эслатма: бу — нахт харид (пул ҳозир тўланди, товар ҳозир келди). Агар бу пул олдин «{DEBT_LABEL}» олинган товар
                          учун бўлса — уни бу ерда эмас, «Етказиб берувчилар» бўлимида «Заводга пул ўтказилди» деб ёзинг, акс ҳолда
                          харажат икки марта ҳисобланади.
                        </td>
                      </tr>
                    )}

                    {r.message && (
                      <tr className={r.status === "dup" ? "row-dup" : "row-error"}>
                        <td />
                        <td colSpan={9} className={`px-3 py-1.5 ${r.status === "dup" ? "text-warn" : "text-minus"}`}>
                          {r.message}
                          {r.status === "dup" && (
                            <>
                              <button type="button" className="btn ml-3" onClick={() => void saveRow(r.key, true)}>
                                Ҳа, барибир сақлаш
                              </button>
                              <button type="button" className="btn ml-2" onClick={() => updateRow(r.key, { status: r.id ? "dirty" : "draft", message: null })}>
                                Йўқ
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )}

                    {cancelling?.key === r.key && (
                      <tr className="row-error">
                        <td />
                        <td colSpan={9} className="px-3 py-1.5">
                          <span>№{r.id} ёзувни бекор қилиш сабаби: </span>
                          <input
                            className="field w-[280px] ml-2"
                            autoFocus
                            value={cancelling.reason}
                            onChange={(e) => setCancelling({ key: r.key, reason: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && void confirmCancel()}
                          />
                          <button type="button" className="btn btn-danger ml-2" disabled={cancelling.reason.trim().length < 3} onClick={() => void confirmCancel()}>
                            Бекор қилиш
                          </button>
                          <button type="button" className="btn ml-2" onClick={() => setCancelling(null)}>
                            Йўқ
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {site && !locked && (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" className="btn" onClick={() => addRow()}>
            + Қатор қўшиш
          </button>
          {unsaved.length > 0 && (
            <>
              <button type="button" className="btn btn-primary" onClick={saveAll}>
                Сақлаш ({unsaved.length})
              </button>
              <span className="text-warn">Сақланмаган: {unsaved.length} та қатор</span>
            </>
          )}
          <span className="ml-auto text-[13px] text-ink-3 hidden lg:inline">
            Tab — кейинги катак · Enter — сақлаш ва янги қатор · қатордан чиқилса ўзи сақланади
          </span>
        </div>
      )}

      {/* ── Shu ob'ekt uchun kelgan pul ── */}
      {site && props.showIncome && (
        <section className="mt-8">
          <h2 className="text-[17px] font-semibold mb-2">Пул келди (кирим) — {formatDate(date)}</h2>
          {incomes.length > 0 && (
            <table className="tbl border border-line mb-3 max-w-[820px]">
              <thead>
                <tr>
                  <th>Кимдан</th>
                  <th>Қайси ҳисобга</th>
                  <th className="num">Сумма</th>
                  <th>Изоҳ</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((e) => (
                  <tr key={e.id}>
                    <td>{e.counterpartyName}</td>
                    <td>{e.accountName}</td>
                    <td className="num font-medium">{formatSom(e.amount)}</td>
                    <td>{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!locked && (
            <MoneyMoveForm
              kind="INCOME"
              payers={payers}
              accounts={accounts}
              siteId={siteId}
              date={date}
              today={today}
              onSaved={() => void reloadIncomes()}
            />
          )}
        </section>
      )}

      {dialog && (
        <NewNameDialog
          mode={dialog.mode}
          initialName={dialog.text}
          existing={dialog.mode === "item" ? items : suppliers}
          categories={categories}
          onClose={() => setDialog(null)}
          onPick={(id) => {
            setField(dialog.rowKey, dialog.mode === "item" ? { materialId: id } : { supplierId: id });
            pendingFocus.current = { key: dialog.rowKey, col: dialog.mode === "item" ? "qty" : "note" };
            setDialog(null);
          }}
          onCreated={(created) => {
            if (dialog.mode === "item") {
              setItems((xs) => [...xs, { id: created.id, name: created.name, unit: created.unit ?? "dona", categoryId: created.categoryId ?? null }].sort((a, b) => a.name.localeCompare(b.name)));
              setField(dialog.rowKey, { materialId: created.id });
              pendingFocus.current = { key: dialog.rowKey, col: "qty" };
            } else {
              setSuppliers((xs) => [...xs, { id: created.id, name: created.name }].sort((a, b) => a.name.localeCompare(b.name)));
              setField(dialog.rowKey, { supplierId: created.id });
              pendingFocus.current = { key: dialog.rowKey, col: "note" };
            }
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function StatusMark({ status }: { status: RowStatus }) {
  if (status === "saving") return <span className="text-ink-3">…</span>;
  if (status === "saved") return <span className="text-plus" title="Сақланди">✓</span>;
  if (status === "dirty") return <span className="text-warn" title="Сақланмаган ўзгариш">●</span>;
  if (status === "dup" || status === "error") return <span className="text-minus">!</span>;
  return null;
}
