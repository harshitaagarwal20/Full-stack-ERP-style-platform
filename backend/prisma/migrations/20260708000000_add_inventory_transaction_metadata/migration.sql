-- AlterTable
ALTER TABLE `InventoryTransaction`
    ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `uom` VARCHAR(191) NULL,
    ADD COLUMN `grade` VARCHAR(191) NULL;
