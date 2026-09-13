import { test } from "node:test";
import assert from "node:assert/strict";
import { nameKey, similarNames } from "./normalize";

// Bir narsa ikki xil yozilmasligi — loyihaning asosiy maqsadlaridan biri.

test("nameKey: katta-kichik harf, bo'shliq, apostrof, kirill/lotin", () => {
  assert.equal(nameKey("Бетон  250 МАРКА "), nameKey("бетон 250 марка"));
  assert.equal(nameKey("G'isht"), nameKey("Gʻisht"));
  assert.equal(nameKey("G‘isht"), nameKey("G`isht"));
  assert.equal(nameKey("Бeтoн 250"), nameKey("Бетон 250")); // lotin e, o aralashgan
  assert.notEqual(nameKey("Арматура 12"), nameKey("Арматура 14"));
});

test("similarNames: 1–2 harf farqi va boshlanishi", () => {
  const items = [{ name: "Электрод" }, { name: "Бетон 250 марка" }, { name: "Цемент" }];
  assert.deepEqual(similarNames("Электирод", items).map((x) => x.name), ["Электрод"]);
  assert.deepEqual(similarNames("бетон 250", items).map((x) => x.name), ["Бетон 250 марка"]);
  assert.deepEqual(similarNames("Шағал", items), []);
  assert.deepEqual(similarNames("ab", items), []); // juda qisqa — taklif yo'q
});
