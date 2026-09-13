/**
 * Sanalar. Biznes sanasi har doim "YYYY-MM-DD" matni ko'rinishida yuradi,
 * "bugun" esa Toshkent vaqti bo'yicha (server UTC'da ishlasa ham, 00:00–05:00
 * oralig'ida kiritilgan yozuv "kelajak sanasi" deb rad etilmasligi uchun).
 *
 * Server va brauzerda ham ishlaydi.
 */

const TZ = "Asia/Tashkent";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** Toshkent vaqti bo'yicha bugungi sana: "2026-09-13". */
export function todayIso(): string {
  // en-CA formati aynan YYYY-MM-DD beradi
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "2026-09-13" → Prisma @db.Date uchun Date (UTC yarim tun). */
export function isoToDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Prisma @db.Date qiymati → "2026-09-13". */
export function dbDateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "2026-09-13" → "2026-09-01" */
export function monthStartIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "2026-09-01" → "2026-10-01" */
export function nextMonthIso(monthIso: string): string {
  const y = Number(monthIso.slice(0, 4));
  const m = Number(monthIso.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** "2026-09-01" → "2026-08-01" */
export function prevMonthIso(monthIso: string): string {
  const y = Number(monthIso.slice(0, 4));
  const m = Number(monthIso.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

/** "2026-02-01" → "2026-02-28" */
export function monthEndIso(monthIso: string): string {
  const d = new Date(`${nextMonthIso(monthStartIso(monthIso))}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-13" → "13.09.2026" */
export function formatDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** "2026-09-01" → "Сентябрь 2026" */
export function formatMonth(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** "2026-09-01" → "Сен 26" — tor jadval ustunlari uchun */
export function formatMonthShort(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(2, 4)}`;
}

/** Vaqt belgisi (created_at va h.k.) → "13.09.2026 14:05", Toshkent vaqtida. */
export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}
