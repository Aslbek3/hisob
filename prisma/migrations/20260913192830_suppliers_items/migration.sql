-- AlterEnum
ALTER TYPE "CounterpartyKind" ADD VALUE 'SUPPLIER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntryKind" ADD VALUE 'SUPPLIER_PAYMENT';
ALTER TYPE "EntryKind" ADD VALUE 'GOODS_RECEIPT';

-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "adjust_reason" TEXT;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "category_id" INTEGER;

-- CreateIndex
CREATE INDEX "entries_counterparty_id_date_idx" ON "entries"("counterparty_id", "date");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
