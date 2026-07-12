-- Per-line-item remark on a purchase order.
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `remark` VARCHAR(191) NULL;
