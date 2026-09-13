/**
 * O'lchov birliklari. Ro'yxat kodda — "кг" / "кг." / "килограмм" chalkashligi
 * bo'lmasligi uchun. Kod (bazada saqlanadi) o'zgarmaydi, yorliq — ekranda.
 * Yangi birlik kerak bo'lsa shu yerga qo'shiladi.
 */
export const UNITS = [
  { code: "dona", label: "дона" },
  { code: "kg", label: "кг" },
  { code: "t", label: "тонна" },
  { code: "m3", label: "куб" },
  { code: "m2", label: "кв.м" },
  { code: "m", label: "метр" },
  { code: "qop", label: "қоп" },
  { code: "pachka", label: "пачка" },
  { code: "l", label: "литр" },
  { code: "reys", label: "рейс" },
  { code: "soat", label: "соат" },
  { code: "kun", label: "кун" },
  { code: "kishi", label: "киши" },
  { code: "rulon", label: "рулон" },
  { code: "list", label: "лист" },
  { code: "bochka", label: "бочка" },
  { code: "komplekt", label: "комплект" },
  { code: "xizmat", label: "хизмат" },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];

export const UNIT_CODES = UNITS.map((u) => u.code) as [UnitCode, ...UnitCode[]];

export function unitLabel(code: string): string {
  return UNITS.find((u) => u.code === code)?.label ?? code;
}
