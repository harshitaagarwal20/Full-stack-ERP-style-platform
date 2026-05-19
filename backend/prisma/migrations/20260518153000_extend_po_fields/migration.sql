-- Extend purchase orders with the spreadsheet fields used by the PO sheet
ALTER TABLE `PurchaseOrder`
  ADD COLUMN `poNumberWithCategory` VARCHAR(191) NULL AFTER `poNumber`,
  ADD COLUMN `category` VARCHAR(191) NULL AFTER `poNumberWithCategory`,
  ADD COLUMN `billTo` VARCHAR(191) NULL AFTER `category`,
  ADD COLUMN `totalDiscount` DOUBLE NOT NULL DEFAULT 0 AFTER `expectedDeliveryDate`,
  ADD COLUMN `freight` VARCHAR(191) NULL AFTER `totalDiscount`;

ALTER TABLE `PurchaseOrderItem`
  ADD COLUMN `expDaysDelivery` VARCHAR(191) NULL AFTER `taxPercent`;
