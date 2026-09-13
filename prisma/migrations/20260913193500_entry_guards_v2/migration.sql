-- Himoya qoidalari (yangilangan): to'langan summa asosiy, yetkazib beruvchi yozuvlari.
-- Oldingi migratsiyada qo'shilgan enum qiymatlari endi commit qilingan.
-- ═══════════════════════════════════════════════════════════════════════
-- Qo'lda yozilgan himoya (yangilangan)
-- Eslatma: yangi enum qiymatlari shu tranzaksiyada qo'shildi — shuning uchun
-- CHECK'da "kind"::text bilan solishtiriladi (enum literal ishlatilmaydi).
-- ═══════════════════════════════════════════════════════════════════════

-- To'langan summa asosiy fakt: miqdor × narxga teng bo'lmasa — sababi majburiy
-- (chegirma, yaxlitlash). Sababsiz farqni baza qabul qilmaydi.
ALTER TABLE "entries" DROP CONSTRAINT "entries_amount_formula";
ALTER TABLE "entries" ADD CONSTRAINT "entries_amount_formula" CHECK (
  "amount" = round("quantity" * "unit_price")
  OR ("adjust_reason" IS NOT NULL AND length(trim("adjust_reason")) > 0)
);

ALTER TABLE "entries" DROP CONSTRAINT "entries_kind_fields";
ALTER TABLE "entries" ADD CONSTRAINT "entries_kind_fields" CHECK (
  -- Kirim: qaysi hisobga tushdi. Ob'ekt ixtiyoriy (investor puli bir nechta ob'ekt uchun bo'lishi mumkin)
  ("kind"::text = 'INCOME'
     AND "account_id" IS NOT NULL AND "to_account_id" IS NULL)
  -- Chiqim: hisobdan pul ketdi, ob'ekt xarajati. Yetkazib beruvchi ixtiyoriy (naqd xarid)
  OR ("kind"::text = 'EXPENSE'
     AND "site_id" IS NOT NULL AND "account_id" IS NOT NULL AND "category_id" IS NOT NULL
     AND "to_account_id" IS NULL)
  -- Tovar keldi (qarzga / oldindan to'langan pulga): ob'ekt xarajati, kassaga tegmaydi
  OR ("kind"::text = 'GOODS_RECEIPT'
     AND "site_id" IS NOT NULL AND "category_id" IS NOT NULL AND "counterparty_id" IS NOT NULL
     AND "account_id" IS NULL AND "to_account_id" IS NULL)
  -- Yetkazib beruvchiga to'lov: kassadan chiqdi, ob'ekt xarajati emas
  OR ("kind"::text = 'SUPPLIER_PAYMENT'
     AND "account_id" IS NOT NULL AND "counterparty_id" IS NOT NULL
     AND "site_id" IS NULL AND "to_account_id" IS NULL AND "category_id" IS NULL AND "material_id" IS NULL)
  -- Hisoblar orasida o'tkazma
  OR ("kind"::text = 'TRANSFER'
     AND "account_id" IS NOT NULL AND "to_account_id" IS NOT NULL
     AND "account_id" <> "to_account_id"
     AND "site_id" IS NULL AND "category_id" IS NULL AND "material_id" IS NULL)
);
