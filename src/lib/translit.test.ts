import { test } from "node:test";
import assert from "node:assert/strict";
import { toCyrillic, toLatin } from "./translit";

test("toCyrillic: ko'p harfli birikmalar (sh, ch, o', g', ts, ya, yu, yo)", () => {
  assert.equal(toCyrillic("Shpaklyovka"), "Шпаклёвка");
  assert.equal(toCyrillic("G'isht"), "Ғишт");
  assert.equal(toCyrillic("Tsement"), "Цемент");
  assert.equal(toCyrillic("Yordam"), "Ёрдам");
  assert.equal(toCyrillic("Yulduz"), "Юлдуз");
  assert.equal(toCyrillic("Yakshanba"), "Якшанба");
  assert.equal(toCyrillic("Mix"), "Мих");
  assert.equal(toCyrillic("Qum"), "Қум");
  assert.equal(toCyrillic("Hovli"), "Ҳовли");
});

test("toCyrillic: apostrof variantlari (ʻ, ʼ, ’, `) bir xil belgiga keltiriladi", () => {
  assert.equal(toCyrillic("Oʻzbek"), "Ўзбек");
  assert.equal(toCyrillic("Oʼzbek"), "Ўзбек");
  assert.equal(toCyrillic("O’zbek"), "Ўзбек");
  assert.equal(toCyrillic("G`isht"), "Ғишт");
});

test("toCyrillic: raqam, tinish belgisi va lotin qisqartma o'zgarmay qoladi", () => {
  assert.equal(toCyrillic("M400"), "М400");
  assert.equal(toCyrillic("12 dona (uchun)"), "12 дона (учун)");
});

test("toLatin: ko'p harfli kirill harflari to'g'ri birikmaga tushadi", () => {
  assert.equal(toLatin("Шпаклёвка"), "Shpaklyovka");
  assert.equal(toLatin("Ғишт"), "G'isht");
  assert.equal(toLatin("Цемент"), "Tsement");
  assert.equal(toLatin("Ёрдам"), "Yordam");
  assert.equal(toLatin("Юлдуз"), "Yulduz");
  assert.equal(toLatin("Якшанба"), "Yakshanba");
  assert.equal(toLatin("Мих"), "Mix");
  assert.equal(toLatin("Қум"), "Qum");
  assert.equal(toLatin("Ҳовли"), "Hovli");
});

test("toLatin: raqam va tinish belgisi o'zgarmay qoladi", () => {
  assert.equal(toLatin("М400"), "M400");
  assert.equal(toLatin("12 дона (учун)"), "12 dona (uchun)");
});

test("aylantirib tekshirish: toLatin(toCyrillic(x)) === x", () => {
  const samples = [
    "Shpaklyovka",
    "G'isht",
    "Tsement M400",
    "Yordam",
    "Avanson (ishchiga)",
    "Mix",
    "Qum",
    "Hovli",
    "Beton 250 marka",
    "O'rindiq",
    "12 dona",
    "Elektr kabel",
  ];
  for (const x of samples) assert.equal(toLatin(toCyrillic(x)), x, `round-trip buzildi: ${x}`);
});

test("aylantirib tekshirish: toCyrillic(toLatin(y)) === y (щ/ы/э siz oddiy kirill matn uchun)", () => {
  const samples = ["Шпаклёвка", "Ғишт", "Цемент", "Ёрдам", "Мих", "Қум", "Ҳовли", "Бетон 250 марка"];
  for (const y of samples) assert.equal(toCyrillic(toLatin(y)), y, `round-trip buzildi: ${y}`);
});
