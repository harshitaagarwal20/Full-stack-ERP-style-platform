-- Tags bulk opening-stock Excel imports on the inventory ledger so a given
-- import run can be identified/traced (distinct from ad-hoc manual adjustments).
ALTER TABLE `InventoryTransaction`
ADD COLUMN `importBatch` VARCHAR(191) NULL;
