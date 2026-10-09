/**
 * Foydalanuvchining ekran alifbosi tanlovi (кирилл/lotin). Faqat EKRAN uchun —
 * bazaga doim kirill boradi (@/lib/translit orqali toCyrillic bilan o'girilib).
 * localStorage — tezkor o'qish uchun; cookie — root layout (server komponent)
 * boshlang'ich <html data-alphabet> ni o'rnatishi uchun. Ataylab "use client"
 * emas — bu oddiy funksiyalar moduli, window/document faqat brauzerda
 * ishlaydigan funksiyalar ichida ishlatiladi (chaqiruvchi tomon javobgar).
 */
import { toCyrillic } from "./translit";

export type Alphabet = "cyr" | "lat";

export const ALPHABET_STORAGE_KEY = "hisob_alphabet";
export const ALPHABET_COOKIE = "hisob_alphabet";
export const ALPHABET_EVENT = "hisob:alphabet-change";

export function readAlphabet(): Alphabet {
  if (typeof window === "undefined") return "cyr";
  return window.localStorage.getItem(ALPHABET_STORAGE_KEY) === "lat" ? "lat" : "cyr";
}

export function writeAlphabet(value: Alphabet) {
  window.localStorage.setItem(ALPHABET_STORAGE_KEY, value);
  document.cookie = `${ALPHABET_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.dataset.alphabet = value;
  window.dispatchEvent(new CustomEvent<Alphabet>(ALPHABET_EVENT, { detail: value }));
}

/**
 * Foydalanuvchi lotin rejimida matn maydoniga yozgan nomni (material, izoh,
 * obyekt, kontragent) saqlashdan OLDIN shu bilan o'giring — natija bazaga
 * kirillda boradi. Kirill rejimida matn o'zgarmay qaytadi.
 */
export function toStorageText(text: string): string {
  return readAlphabet() === "lat" ? toCyrillic(text) : text;
}
