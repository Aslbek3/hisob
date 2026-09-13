/**
 * Nomlarni taqqoslash kaliti. Excel'dagi asosiy muammo — bitta material bir
 * necha xil yozilgani. Kalit bir xil bo'lsa — bu bitta material:
 *   "Sement M400", "sement  m400", "SEMENT M400 " → "sement m400"
 *   "G'isht", "G‘isht", "Gʻisht", "G`isht"      → "g'isht"
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ko'rinadigan nomni tozalash: ortiqcha bo'shliqlar olib tashlanadi, harflar o'zgarmaydi. */
export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}
