-- Yetkazib beruvchiga to'lov (SUPPLIER_PAYMENT) endi obyektga bog'lanadi — shunda
-- yetkazib beruvchi qoldig'ini obyektlar bo'yicha taqsimlash mumkin bo'ladi
-- (umumiy qoldiq = obyektlar qoldiqlari yig'indisi).
--
-- Eski yozuvlarda site_id bo'sh bo'lishi mumkin edi (CHECK buni ruxsat berardi).
-- Yangi CHECK qo'yishdan oldin ularga obyekt biriktiramiz: shu yetkazib beruvchidan
-- eng ko'p tovar kelgan obyekt (GOODS_RECEIPT summasi bo'yicha). Mos obyekt
-- topilmasa (masalan tovar hali kelmagan bo'lsa) — birinchi obyektga yoziladi.
-- Bu faqat eski demo yozuvlarga tegishli: real ishda bunday yozuv yo'q edi
-- (eski CHECK ham shart qilmagani uchun hech qachon maqsadli tanlanmagan).

-- Eski CHECK hali SUPPLIER_PAYMENT'da site_id bo'sh bo'lishini talab qiladi —
-- backfilldan oldin shuni olib tashlaymiz, aks holda UPDATE'ning o'zi uni buzadi.
ALTER TABLE "entries" DROP CONSTRAINT "entries_kind_fields";

UPDATE "entries" p
SET "site_id" = (
  SELECT g."site_id"
  FROM "entries" g
  WHERE g."kind" = 'GOODS_RECEIPT' AND g."counterparty_id" = p."counterparty_id"
  GROUP BY g."site_id"
  ORDER BY SUM(g."amount") DESC, g."site_id" ASC
  LIMIT 1
)
WHERE p."kind" = 'SUPPLIER_PAYMENT' AND p."site_id" IS NULL;

UPDATE "entries" p
SET "site_id" = (SELECT id FROM "sites" ORDER BY id ASC LIMIT 1)
WHERE p."kind" = 'SUPPLIER_PAYMENT' AND p."site_id" IS NULL;

-- Endi yangi CHECK: SUPPLIER_PAYMENT uchun ham site_id majburiy (boshqa shartlar o'zgarmadi)
ALTER TABLE "entries" ADD CONSTRAINT "entries_kind_fields" CHECK (
  ("kind"::text = 'INCOME'
     AND "account_id" IS NOT NULL AND "to_account_id" IS NULL)
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
