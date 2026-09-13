/**
 * Material o'lchov birliklari. Ro'yxat kodda — qo'lda yozilgan "kg" / "kg." /
 * "kilogramm" chalkashligi bo'lmasligi uchun. Yangi birlik kerak bo'lsa shu
 * yerga qo'shiladi.
 */
export const UNITS = [
  { code: "kg", label: "kg" },
  { code: "t", label: "tonna" },
  { code: "m3", label: "m³" },
  { code: "m2", label: "m²" },
  { code: "m", label: "metr" },
  { code: "dona", label: "dona" },
  { code: "qop", label: "qop" },
  { code: "l", label: "litr" },
  { code: "pachka", label: "pachka" },
  { code: "rulon", label: "rulon" },
  { code: "list", label: "list" },
  { code: "komplekt", label: "komplekt" },
  { code: "reys", label: "reys" },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];

export const UNIT_CODES = UNITS.map((u) => u.code) as [UnitCode, ...UnitCode[]];

export function unitLabel(code: string): string {
  return UNITS.find((u) => u.code === code)?.label ?? code;
}
