-- Add GRN fields to GoodsReceiptNote
ALTER TABLE `GoodsReceiptNote`
  ADD COLUMN `receivedBy`         VARCHAR(191)             NULL,
  ADD COLUMN `vehicleRef`         VARCHAR(191)             NULL,
  ADD COLUMN `warehouseLocation`  VARCHAR(191)             NULL,
  ADD COLUMN `status`             ENUM('DRAFT','CONFIRMED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `remarks`            TEXT                     NULL;

-- Index on status
ALTER TABLE `GoodsReceiptNote` ADD INDEX `GoodsReceiptNote_status_idx` (`status`);

-- GrnItem table
CREATE TABLE `GrnItem` (
  `id`               INTEGER       NOT NULL AUTO_INCREMENT,
  `grnId`            INTEGER       NOT NULL,
  `poItemId`         INTEGER       NOT NULL,
  `itemId`           VARCHAR(191)  NOT NULL,
  `quantityOrdered`  INTEGER       NOT NULL,
  `quantityReceived` INTEGER       NOT NULL DEFAULT 0,
  `remarks`          VARCHAR(191)  NULL,
  INDEX `GrnItem_grnId_idx` (`grnId`),
  INDEX `GrnItem_poItemId_idx` (`poItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- InventoryTransaction table
CREATE TABLE `InventoryTransaction` (
  `id`                INTEGER       NOT NULL AUTO_INCREMENT,
  `type`              VARCHAR(191)  NOT NULL,
  `itemId`            VARCHAR(191)  NOT NULL,
  `quantity`          INTEGER       NOT NULL,
  `warehouseLocation` VARCHAR(191)  NULL,
  `reference`         VARCHAR(191)  NULL,
  `grnId`             INTEGER       NULL,
  `grnItemId`         INTEGER       NULL,
  `remarks`           VARCHAR(191)  NULL,
  `createdAt`         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `InventoryTransaction_itemId_idx` (`itemId`),
  INDEX `InventoryTransaction_grnId_idx` (`grnId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys for GrnItem
ALTER TABLE `GrnItem`
  ADD CONSTRAINT `GrnItem_grnId_fkey`
    FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GrnItem`
  ADD CONSTRAINT `GrnItem_poItemId_fkey`
    FOREIGN KEY (`poItemId`) REFERENCES `PurchaseOrderItem` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK for InventoryTransaction → GoodsReceiptNote (SetNull on delete)
ALTER TABLE `InventoryTransaction`
  ADD CONSTRAINT `InventoryTransaction_grnId_fkey`
    FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
