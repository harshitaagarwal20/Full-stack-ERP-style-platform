-- AlterTable Supplier: add gstNo, panNo, pincode
ALTER TABLE `Supplier` ADD COLUMN `gstNo` VARCHAR(191) NULL;
ALTER TABLE `Supplier` ADD COLUMN `panNo` VARCHAR(191) NULL;
ALTER TABLE `Supplier` ADD COLUMN `pincode` VARCHAR(191) NULL;

-- AlterTable PurchaseOrder: add department
ALTER TABLE `PurchaseOrder` ADD COLUMN `department` VARCHAR(191) NULL;

-- AlterTable PurchaseOrderItem: add grade, currency, unitPrice, taxPercent
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `grade` VARCHAR(191) NULL;
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR';
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `unitPrice` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `taxPercent` DOUBLE NOT NULL DEFAULT 0;
