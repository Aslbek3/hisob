/**
 * Nomlarni taqqoslash kaliti. Excel'dagi asosiy muammo — bitta narsa bir
 * necha xil yozilgani. Kalit bir xil bo'lsa — bu bitta nom:
 *   "Бетон 250 марка", "бетон  250   марка", "БЕТОН 250 МАРКА " → bitta
 *   "G'isht", "G‘isht", "Gʻisht", "G`isht"                    → bitta
 *   "Сетка" (kirill) va "Cetka" aralash yozilgan (lotin "C")   → bitta
 *
 * Kirill va lotinning ko'rinishi bir xil harflari bitta belgiga keltiriladi —
 * klaviatura almashib qolganda ham ikkinchi nom paydo bo'lmaydi. Kalit faqat
 * solishtirish uchun, ekranda ko'rinmaydi.
 */
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
};

export function nameKey(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[авеёкмнорстух]/g, (ch) => HOMOGLYPHS[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

/** Ko'rinadigan nomni tozalash: ortiqcha bo'shliqlar olib tashlanadi, harflar o'zgarmaydi. */
export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Ikki kalit orasidagi tahrir masofasi (Levenshtein). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Yangi nom qo'shishdan oldin "shuni nazarda tutdingizmi?" ro'yxati:
 * 1–2 harf farqi ("Электирод" ~ "Электрод") yoki biri ikkinchisining boshi
 * ("Бетон 250" ~ "Бетон 250 марка").
 */
export function similarNames<T extends { name: string }>(input: string, options: T[], limit = 5): T[] {
  const key = nameKey(input);
  if (key.length < 3) return [];
  const scored: { item: T; score: number }[] = [];
  for (const o of options) {
    const k = nameKey(o.name);
    if (k === key) return [o];
    const d = distance(key, k);
    const allowed = Math.max(2, Math.floor(Math.min(key.length, k.length) * 0.25));
    if (d <= allowed) scored.push({ item: o, score: d });
    else if (k.startsWith(key) || key.startsWith(k)) scored.push({ item: o, score: allowed + 1 });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.item);
}
