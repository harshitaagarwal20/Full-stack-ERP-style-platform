-- =============================================================
-- Nimbasia ERP - Safe Migration Script
-- This script is safe to run on a live database with existing data.
-- It uses IF NOT EXISTS checks everywhere — existing tables,
-- columns, and constraints are never dropped or modified.
-- =============================================================

-- Helper: add a column only if it does not already exist
DROP PROCEDURE IF EXISTS _nimbasia_add_col;
DROP PROCEDURE IF EXISTS _nimbasia_add_fk;

DELIMITER //

CREATE PROCEDURE _nimbasia_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _st FROM @_sql;
    EXECUTE _st;
    DEALLOCATE PREPARE _st;
  END IF;
END //

-- Helper: add a foreign key constraint only if it does not already exist
CREATE PROCEDURE _nimbasia_add_fk(IN tbl VARCHAR(64), IN fk_name VARCHAR(64), IN fk_def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND CONSTRAINT_NAME = fk_name
  ) THEN
    SET @_sql = CONCAT('ALTER TABLE `', tbl, '` ADD CONSTRAINT `', fk_name, '` ', fk_def);
    PREPARE _st FROM @_sql;
    EXECUTE _st;
    DEALLOCATE PREPARE _st;
  END IF;
END //

DELIMITER ;

-- =============================================================
-- 1. SUPPLIER
-- =============================================================

CREATE TABLE IF NOT EXISTS `Supplier` (
    `id`            INTEGER      NOT NULL AUTO_INCREMENT,
    `name`          VARCHAR(191) NOT NULL,
    `supplierCode`  VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `email`         VARCHAR(191) NULL,
    `phone`         VARCHAR(191) NULL,
    `address`       VARCHAR(191) NULL,
    `pincode`       VARCHAR(191) NULL,
    `gstNo`         VARCHAR(191) NULL,
    `panNo`         VARCHAR(191) NULL,
    `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Supplier_name_key`(`name`),
    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add columns in case table already existed without them
CALL _nimbasia_add_col('Supplier', 'supplierCode',  'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'contactPerson', 'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'email',         'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'phone',         'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'address',       'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'pincode',       'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'gstNo',         'VARCHAR(191) NULL');
CALL _nimbasia_add_col('Supplier', 'panNo',         'VARCHAR(191) NULL');

-- =============================================================
-- 2. PURCHASE ORDER
-- =============================================================

CREATE TABLE IF NOT EXISTS `PurchaseOrder` (
    `id`                   INTEGER      NOT NULL AUTO_INCREMENT,
    `poNumber`             VARCHAR(191) NOT NULL,
    `poNumberWithCategory` VARCHAR(191) NULL,
    `category`             VARCHAR(191) NULL,
    `billTo`               VARCHAR(191) NULL,
    `supplierId`           INTEGER      NOT NULL,
    `orderDate`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDeliveryDate` DATETIME(3)  NULL,
    `totalDiscount`        DOUBLE       NOT NULL DEFAULT 0,
    `freight`              VARCHAR(191) NULL,
    `status`               ENUM('DRAFT','SUBMITTED','APPROVED','SENT_TO_SUPPLIER','PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED') NOT NULL DEFAULT 'DRAFT',
    `totalAmount`          DOUBLE       NOT NULL DEFAULT 0,
    `notes`                TEXT         NULL,
    `department`           VARCHAR(191) NULL,
    `createdById`          INTEGER      NOT NULL,
    `createdAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `PurchaseOrder_poNumber_key`(`poNumber`),
    INDEX `PurchaseOrder_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL _nimbasia_add_col('PurchaseOrder', 'poNumberWithCategory', 'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrder', 'category',             'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrder', 'billTo',               'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrder', 'totalDiscount',        'DOUBLE NOT NULL DEFAULT 0');
CALL _nimbasia_add_col('PurchaseOrder', 'freight',              'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrder', 'department',           'VARCHAR(191) NULL');

-- =============================================================
-- 3. PURCHASE ORDER ITEM
-- =============================================================

CREATE TABLE IF NOT EXISTS `PurchaseOrderItem` (
    `id`              INTEGER      NOT NULL AUTO_INCREMENT,
    `uniqueKey`       VARCHAR(191) NOT NULL,
    `poId`            INTEGER      NOT NULL,
    `poNumber`        VARCHAR(191) NOT NULL,
    `supplier`        VARCHAR(191) NOT NULL,
    `itemId`          VARCHAR(191) NOT NULL,
    `category`        VARCHAR(191) NULL,
    `uom`             VARCHAR(191) NULL,
    `grade`           VARCHAR(191) NULL,
    `currency`        VARCHAR(191) NOT NULL DEFAULT 'INR',
    `unitPrice`       DOUBLE       NOT NULL DEFAULT 0,
    `taxPercent`      DOUBLE       NOT NULL DEFAULT 0,
    `expDaysDelivery` VARCHAR(191) NULL,
    `qty`             DOUBLE       NOT NULL,
    `receivedQty`     DOUBLE       NOT NULL DEFAULT 0,
    `outwardKey`      VARCHAR(191) NULL,
    `batchNo`         VARCHAR(191) NULL,
    `createdAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedAt`      DATETIME(3)  NULL,
    UNIQUE INDEX `PurchaseOrderItem_uniqueKey_key`(`uniqueKey`),
    INDEX `PurchaseOrderItem_poId_idx`(`poId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL _nimbasia_add_col('PurchaseOrderItem', 'category',        'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrderItem', 'uom',             'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrderItem', 'grade',           'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrderItem', 'currency',        'VARCHAR(191) NOT NULL DEFAULT ''INR''');
CALL _nimbasia_add_col('PurchaseOrderItem', 'unitPrice',       'DOUBLE NOT NULL DEFAULT 0');
CALL _nimbasia_add_col('PurchaseOrderItem', 'taxPercent',      'DOUBLE NOT NULL DEFAULT 0');
CALL _nimbasia_add_col('PurchaseOrderItem', 'expDaysDelivery', 'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrderItem', 'outwardKey',      'VARCHAR(191) NULL');
CALL _nimbasia_add_col('PurchaseOrderItem', 'batchNo',         'VARCHAR(191) NULL');

-- =============================================================
-- 4. GOODS RECEIPT NOTE
-- =============================================================

CREATE TABLE IF NOT EXISTS `GoodsReceiptNote` (
    `id`               INTEGER      NOT NULL AUTO_INCREMENT,
    `grnNumber`        VARCHAR(191) NOT NULL,
    `poId`             INTEGER      NOT NULL,
    `receivedDate`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedBy`       VARCHAR(191) NULL,
    `vehicleRef`       VARCHAR(191) NULL,
    `warehouseLocation` VARCHAR(191) NULL,
    `status`           ENUM('DRAFT','CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    `remarks`          TEXT         NULL,
    `notes`            VARCHAR(191) NULL,
    `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `GoodsReceiptNote_grnNumber_key`(`grnNumber`),
    INDEX `GoodsReceiptNote_poId_idx`(`poId`),
    INDEX `GoodsReceiptNote_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL _nimbasia_add_col('GoodsReceiptNote', 'receivedBy',        'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GoodsReceiptNote', 'vehicleRef',        'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GoodsReceiptNote', 'warehouseLocation', 'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GoodsReceiptNote', 'remarks',           'TEXT NULL');
CALL _nimbasia_add_col('GoodsReceiptNote', 'notes',             'VARCHAR(191) NULL');

-- =============================================================
-- 5. GRN ITEM
-- =============================================================

CREATE TABLE IF NOT EXISTS `GrnItem` (
    `id`               INTEGER      NOT NULL AUTO_INCREMENT,
    `grnId`            INTEGER      NOT NULL,
    `poItemId`         INTEGER      NOT NULL,
    `itemId`           VARCHAR(191) NOT NULL,
    `category`         VARCHAR(191) NULL,
    `grade`            VARCHAR(191) NULL,
    `uom`              VARCHAR(191) NULL,
    `currency`         VARCHAR(191) NULL,
    `unitPrice`        DOUBLE       NULL,
    `taxPercent`       DOUBLE       NULL,
    `batchNo`          VARCHAR(191) NULL,
    `quantityOrdered`  DOUBLE       NOT NULL,
    `quantityReceived` DOUBLE       NOT NULL DEFAULT 0,
    `remarks`          VARCHAR(191) NULL,
    INDEX `GrnItem_grnId_idx` (`grnId`),
    INDEX `GrnItem_poItemId_idx` (`poItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CALL _nimbasia_add_col('GrnItem', 'category',   'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GrnItem', 'grade',       'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GrnItem', 'uom',         'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GrnItem', 'currency',    'VARCHAR(191) NULL');
CALL _nimbasia_add_col('GrnItem', 'unitPrice',   'DOUBLE NULL');
CALL _nimbasia_add_col('GrnItem', 'taxPercent',  'DOUBLE NULL');
CALL _nimbasia_add_col('GrnItem', 'batchNo',     'VARCHAR(191) NULL');

-- =============================================================
-- 6. INVENTORY TRANSACTION
-- =============================================================

CREATE TABLE IF NOT EXISTS `InventoryTransaction` (
    `id`                INTEGER      NOT NULL AUTO_INCREMENT,
    `type`              VARCHAR(191) NOT NULL,
    `itemId`            VARCHAR(191) NOT NULL,
    `quantity`          DOUBLE       NOT NULL,
    `warehouseLocation` VARCHAR(191) NULL,
    `reference`         VARCHAR(191) NULL,
    `grnId`             INTEGER      NULL,
    `grnItemId`         INTEGER      NULL,
    `remarks`           VARCHAR(191) NULL,
    `createdAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `InventoryTransaction_itemId_idx` (`itemId`),
    INDEX `InventoryTransaction_grnId_idx` (`grnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- 7. PRODUCTION - add batchNo column
-- =============================================================

CALL _nimbasia_add_col('Production', 'batchNo', 'VARCHAR(191) NULL');

-- =============================================================
-- 8. FOREIGN KEYS (skipped if already exist)
-- =============================================================

CALL _nimbasia_add_fk(
    'PurchaseOrder', 'PurchaseOrder_supplierId_fkey',
    'FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'PurchaseOrder', 'PurchaseOrder_createdById_fkey',
    'FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'PurchaseOrderItem', 'PurchaseOrderItem_poId_fkey',
    'FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'GoodsReceiptNote', 'GoodsReceiptNote_poId_fkey',
    'FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'GrnItem', 'GrnItem_grnId_fkey',
    'FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'GrnItem', 'GrnItem_poItemId_fkey',
    'FOREIGN KEY (`poItemId`) REFERENCES `PurchaseOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);

CALL _nimbasia_add_fk(
    'InventoryTransaction', 'InventoryTransaction_grnId_fkey',
    'FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);

-- =============================================================
-- 9. CLEANUP helper procedures
-- =============================================================

DROP PROCEDURE IF EXISTS _nimbasia_add_col;
DROP PROCEDURE IF EXISTS _nimbasia_add_fk;

-- Done.
