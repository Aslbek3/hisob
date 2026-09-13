import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAmount, formatQuantity, formatSom, parseQuantityMilli, parseSom, quantityMilliToString } from "./money";

// Pul hisobi — eng muhim joy. DB'dagi CHECK (amount = round(quantity * unit_price))
// bilan aynan bir xil natija berishi shart.

test("parseSom: faqat butun so'm, bo'shliq va NBSP bilan", () => {
  assert.equal(parseSom("1 250 000"), 1250000n);
  assert.equal(parseSom("1 250 000"), 1250000n);
  assert.equal(parseSom("0"), 0n);
  assert.equal(parseSom("1,5"), null); // "15" deb o'qilmasin
  assert.equal(parseSom("1.5"), null);
  assert.equal(parseSom("-5"), null);
  assert.equal(parseSom(""), null);
  assert.equal(parseSom("12345678901234567"), null); // 17 raqam — juda katta
});

test("parseQuantityMilli: vergul yoki nuqta, ko'pi bilan 3 kasr", () => {
  assert.equal(parseQuantityMilli("2,5"), 2500n);
  assert.equal(parseQuantityMilli("0.75"), 750n);
  assert.equal(parseQuantityMilli("1 000"), 1000000n);
  assert.equal(parseQuantityMilli("0,0004"), null);
  assert.equal(parseQuantityMilli("abc"), null);
  assert.equal(quantityMilliToString(2500n), "2.5");
  assert.equal(quantityMilliToString(1000n), "1");
});

test("computeAmount: 0.5 yuqoriga yaxlitlanadi (Postgres round bilan bir xil)", () => {
  assert.equal(computeAmount(2500n, 3n), 8n); // 7.5 → 8
  assert.equal(computeAmount(2400n, 3n), 7n); // 7.2 → 7
  assert.equal(computeAmount(6000n, 28333n), 169998n); // penopleks: 6 × 28 333
  assert.equal(computeAmount(167000n, 600000n), 100200000n); // 167 kub beton
  assert.equal(computeAmount(1000n, 999_999_999_999n), 999_999_999_999n);
});

test("formatSom / formatQuantity", () => {
  assert.equal(formatSom(1250000n).replace(/ /g, " "), "1 250 000");
  assert.equal(formatSom(-500n), "−500");
  assert.equal(formatQuantity("2.500"), "2,5");
  assert.equal(formatQuantity("1000").replace(/\s/g, " "), "1 000");
});
