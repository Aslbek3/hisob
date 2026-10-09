/**
 * Kirill ⇄ lotin alifbo almashtirish. FAQAT ekranda ko'rsatish va foydalanuvchi
 * kiritgan matnni saqlashdan oldin o'girish uchun — bazada hamma narsa doim
 * kirillda turadi (buni chaqiruvchi tomon ta'minlaydi, bu fayl sof funksiya).
 *
 * Raqam, tinish belgisi va xarita topa olmagan harf (lotin "c", "w" kabi)
 * o'zgarmay qoladi.
 *
 * Katta-kichik harf: faqat manba birikmaning BIRINCHI harfi katta bo'lsa
 * natijaning birinchi harfi katta qilinadi (butun so'z katta bo'lsa ham) —
 * bu ilovada ALL CAPS matn ishlatilmaydi, shuning uchun bu etarli va bitta
 * kirill harfidan "ALL CAPS" ni "Katta harf bilan boshlanish"dan ajratib
 * bo'lmasligi muammosini ham chetlab o'tadi.
 */

const APOSTROPHE_VARIANTS = /[‘’ʻʼ`´]/g;

// Ko'p harfli birikmalar BIRINCHI tekshiriladi (uzundan — bu yerda hammasi 2
// harf — lekin tartib https://... emas, shunchaki bitta ro'yxat), aks holda
// "sh" "s" va "h" bo'lib alohida-alohida o'giriladi.
const LAT_TO_CYR_MULTI: [string, string][] = [
  ["sh", "ш"],
  ["ch", "ч"],
  ["ng", "нг"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ts", "ц"],
  ["o'", "ў"],
  ["g'", "ғ"],
];

const LAT_TO_CYR_SINGLE: Record<string, string> = {
  a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", j: "ж", z: "з", i: "и",
  y: "й", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р",
  s: "с", t: "т", u: "у", f: "ф", x: "х", h: "ҳ", "'": "ъ",
};

// Faqat toLatin uchun: bir nechta kirill harfi bitta lotin birikmasiga tushadi.
// "щ" ham "sh" ga tushadi (nodir rus so'zlari uchun taxminiy) — bu yo'nalish
// qaytarilganda "ш" chiqadi, "щ" emas; bu funksiyalar simmetrik emas, faqat
// toLatin(toCyrillic(x)) === x kafolatlanadi (vazifada so'ralgani ham shu).
const CYR_TO_LAT_MULTI: Record<string, string> = {
  ш: "sh", ч: "ch", ё: "yo", ю: "yu", я: "ya", ц: "ts", ў: "o'", ғ: "g'", щ: "sh",
};

const CYR_TO_LAT_SINGLE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "x", ъ: "'", ы: "i", э: "e", қ: "q", ҳ: "h",
};

function matchCase(source: string, target: string): string {
  const first = source[0];
  if (!first) return target;
  const firstIsUpper = first !== first.toLowerCase() && first === first.toUpperCase();
  return firstIsUpper ? target[0].toUpperCase() + target.slice(1) : target;
}

/** Lotin matnni kirillga o'giradi (foydalanuvchi kiritgan nomni saqlashdan oldin). */
export function toCyrillic(text: string): string {
  const src = text.normalize("NFC").replace(APOSTROPHE_VARIANTS, "'");
  const lower = src.toLowerCase();
  let out = "";
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (const [lat, cyr] of LAT_TO_CYR_MULTI) {
      if (lower.startsWith(lat, i)) {
        out += matchCase(src.slice(i, i + lat.length), cyr);
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = src[i];
    const mapped = LAT_TO_CYR_SINGLE[lower[i]];
    out += mapped ? matchCase(ch, mapped) : ch;
    i++;
  }
  return out;
}

/** Kirill matnni lotinga o'giradi (ekranda ko'rsatish uchun). */
export function toLatin(text: string): string {
  const src = text.normalize("NFC");
  let out = "";
  for (const ch of src) {
    const lower = ch.toLowerCase();
    const multi = CYR_TO_LAT_MULTI[lower];
    if (multi) {
      out += matchCase(ch, multi);
      continue;
    }
    const single = CYR_TO_LAT_SINGLE[lower];
    out += single ? matchCase(ch, single) : ch;
  }
  return out;
}
