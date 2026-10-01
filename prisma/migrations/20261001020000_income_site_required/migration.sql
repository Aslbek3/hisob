-- Kirim (INCOME) endi majburiy ravishda obyektga bog'lanadi — avval ixtiyoriy
-- edi ("investor puli bir nechta ob'ekt uchun" degan eski mulohaza), endi
-- manba (investor) hisobotini obyektlar bo'yicha taqsimlash kerak bo'lgani
-- uchun har bir kirim aniq bitta obyektga yozilishi shart.
--
-- Hozircha bazada site_id bo'sh INCOME yozuvi yo'q (tekshirildi), lekin
-- ehtiyot uchun — eski CHECK'ni olib tashlab, qolgan bo'lsa birinchi
-- obyektga biriktiramiz, keyin yangi CHECK qo'yamiz.
ALTER TABLE "entries" DROP CONSTRAINT "entries_kind_fields";

UPDATE "entries"
SET "site_id" = (SELECT id FROM "sites" ORDER BY id ASC LIMIT 1)
WHERE "kind" = 'INCOME' AND "site_id" IS NULL;

ALTER TABLE "entries" ADD CONSTRAINT "entries_kind_fields" CHECK (
  ("kind"::text = 'INCOME'
     AND "site_id" IS NOT NULL AND "account_id" IS NOT NULL AND "to_account_id" IS NULL)
  OR ("kind"::text = 'EXPENSE'
     AND "site_id" IS NOT NULL AND "account_id" IS NOT NULL AND "category_id" IS NOT NULL
     AND "to_account_id" IS NULL)
  OR ("kind"::text = 'GOODS_RECEIPT'
     AND "site_id" IS NOT NULL AND "category_id" IS NOT NULL AND "counterparty_id" IS NOT NULL
     AND "account_id" IS NULL AND "to_account_id" IS NULL)
  OR ("kind"::text = 'SUPPLIER_PAYMENT'
     AND "site_id" IS NOT NULL AND "account_id" IS NOT NULL AND "counterparty_id" IS NOT NULL
     AND "to_account_id" IS NULL AND "category_id" IS NULL AND "material_id" IS NULL)
  OR ("kind"::text = 'TRANSFER'
     AND "account_id" IS NOT NULL AND "to_account_id" IS NOT NULL
     AND "account_id" <> "to_account_id"
     AND "site_id" IS NULL AND "category_id" IS NULL AND "material_id" IS NULL)
);
