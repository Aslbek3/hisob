/**
 * Pul va miqdor bilan ishlash. Float ISHLATILMAYDI — faqat BigInt.
 *
 * Bu fayl ham serverda, ham brauzerda ishlaydi (Kiritish jadvali summani
 * jonli ko'rsatadi) — ikkala joyda natija bit-bit bir xil bo'lishi uchun
 * hisoblash bitta funksiyada.
 */

/** Miqdorda verguldan keyin nechta raqam bo'lishi mumkin (DB: Decimal(14,3)). */
const QTY_SCALE = 1000n;
const QTY_DECIMALS = 3;

/** Bitta yozuv summasining yuqori chegarasi — xato kiritilgan ortiqcha nollardan himoya. */
export const MAX_AMOUNT = 1_000_000_000_000n; // 1 trillion so'm

/**
 * "1 250 000" → 1250000n. Faqat raqam va bo'shliq qabul qilinadi.
 * Vergul/nuqta ATAYLAB rad etiladi: "1,5" ni 15 deb o'qib qo'yish xavfi bor,
 * so'mda esa kasr bo'lmaydi.
 */
export function parseSom(input: string): bigint | null {
  const cleaned = input.replace(/[\s ]/g, "");
  if (!/^\d{1,16}$/.test(cleaned)) return null;
  return BigInt(cleaned);
}

/**
 * Miqdor matnini mingdan bir ulushlardagi butun songa aylantiradi:
 * "2,5" → 2500n, "0.75" → 750n. 3 tadan ortiq kasr raqami — xato.
 */
export function parseQuantityMilli(input: string): bigint | null {
  const cleaned = input.replace(/[\s ]/g, "").replace(",", ".");
  const match = /^(\d{1,11})(?:\.(\d{0,3}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const frac = BigInt((match[2] ?? "").padEnd(QTY_DECIMALS, "0"));
  return whole * QTY_SCALE + frac;
}

/** 2500n → "2.5" (DB Decimal uchun kanonik ko'rinish). */
export function quantityMilliToString(milli: bigint): string {
  const whole = milli / QTY_SCALE;
  const frac = (milli % QTY_SCALE).toString().padStart(QTY_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * Summa = round(miqdor × narx), 0.5 yuqoriga.
 * DB'dagi CHECK (amount = round(quantity * unit_price)) bilan aynan bir xil.
 */
export function computeAmount(quantityMilli: bigint, unitPrice: bigint): bigint {
  return (quantityMilli * unitPrice + QTY_SCALE / 2n) / QTY_SCALE;
}

/** 1250000 → "1 250 000". Qabul qiladi: bigint, raqam-matn, number. */
export function formatSom(value: bigint | string | number): string {
  const s = typeof value === "number" ? Math.trunc(value).toString() : value.toString();
  const negative = s.startsWith("-");
  const digits = negative ? s.slice(1) : s;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return negative ? `−${grouped}` : grouped;
}

/** "2.500" / "2.5" → "2,5" (ekranda vergul bilan). */
export function formatQuantity(value: string): string {
  const [whole, frac = ""] = value.split(".");
  const trimmed = frac.replace(/0+$/, "");
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return trimmed ? `${wholeGrouped},${trimmed}` : wholeGrouped;
}
