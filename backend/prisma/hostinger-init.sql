-- ============================================================
-- Nimbasia ERP — Hostinger MySQL schema (fresh install AND live update).
--
-- One canonical file for both cases:
--   * Fresh/empty database — creates every table, index and FK.
--   * Existing database with real data — brings it up to the current
--     schema by ADDING only what is missing (the columns/tables/indexes
--     a `CREATE TABLE IF NOT EXISTS`-only script would silently skip on
--     an already-existing table, e.g. User.passwordChangedAt).
--
-- Fully idempotent and NON-DESTRUCTIVE — safe to re-run:
--   * CREATE TABLE IF NOT EXISTS  — adds new tables only
--   * ADD COLUMN (guarded)        — adds new columns only
--   * CREATE INDEX (guarded)      — adds new indexes only
--   * ADD CONSTRAINT (guarded)    — adds new foreign keys only
--
-- It NEVER drops or alters an existing table, column, index, FK, or
-- row, so no existing data can be lost.
--
-- Creates structure only — no data. On a fresh database run the seed
-- (npm run seed) afterwards for the admin user and role permissions,
-- or you will not be able to log in.
--
-- Uses PREPARE/EXECUTE guards (no DELIMITER) so it imports cleanly via
-- phpMyAdmin too.
--
-- BACK UP FIRST anyway:  mysqldump -u USER -p DBNAME > backup.sql
-- ============================================================
SET @OLD_FOREIGN_KEY_CHECKS := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1) New tables (skipped if they already exist)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `passwordChangedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_createdAt_id_idx`(`createdAt`, `id`),
    INDEX `User_role_createdAt_idx`(`role`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `level` ENUM('NONE', 'VIEW', 'FULL') NOT NULL DEFAULT 'NONE',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RolePermission_role_idx`(`role`),
    UNIQUE INDEX `RolePermission_role_module_key`(`role`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_name_idx`(`name`),
    UNIQUE INDEX `Customer_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CustomerAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerAddress_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NULL,
    `actorId` INTEGER NULL,
    `actorName` VARCHAR(191) NULL,
    `actorRole` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Enquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enquiryNumber` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NULL,
    `customerAddressId` INTEGER NULL,
    `product` VARCHAR(191) NOT NULL,
    `products` JSON NULL,
    `quantity` DOUBLE NOT NULL,
    `price` DOUBLE NULL,
    `currency` VARCHAR(191) NULL,
    `unitOfMeasurement` VARCHAR(191) NULL,
    `enquiryDate` DATETIME(3) NULL,
    `modeOfEnquiry` VARCHAR(191) NULL,
    `customerType` VARCHAR(191) NULL,
    `enquiryType` VARCHAR(191) NULL,
    `incoTerm` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `port` VARCHAR(191) NULL,
    `lastTransaction` VARCHAR(191) NULL,
    `expectedTimeline` DATETIME(3) NULL,
    `assignedPerson` VARCHAR(191) NOT NULL,
    `notesForProduction` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'HOLD', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `stage` ENUM('GENERAL', 'SAMPLED', 'QUOTED') NOT NULL DEFAULT 'GENERAL',
    `sampledAt` DATETIME(3) NULL,
    `isUrgent` BOOLEAN NOT NULL DEFAULT false,
    `rejectionReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,

    INDEX `Enquiry_customerId_idx`(`customerId`),
    INDEX `Enquiry_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Enquiry_stage_idx`(`stage`),
    INDEX `Enquiry_enquiryDate_idx`(`enquiryDate`),
    INDEX `Enquiry_expectedTimeline_idx`(`expectedTimeline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BillOfMaterial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillOfMaterial_product_idx`(`product`),
    UNIQUE INDEX `BillOfMaterial_product_grade_key`(`product`, `grade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BillOfMaterialItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bomId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `qtyPerUnit` DOUBLE NOT NULL,
    `remark` VARCHAR(191) NULL,

    INDEX `BillOfMaterialItem_bomId_idx`(`bomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enquiryId` INTEGER NULL,
    `customerId` INTEGER NULL,
    `customerAddressId` INTEGER NULL,
    `salesGroupNumber` VARCHAR(191) NULL,
    `salesOrderNumber` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `price` DOUBLE NULL,
    `currency` VARCHAR(191) NULL,
    `unit` ENUM('KG', 'MT', 'LTR') NOT NULL,
    `packingType` VARCHAR(191) NOT NULL,
    `packingSize` VARCHAR(191) NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `dispatchDate` DATETIME(3) NULL,
    `status` ENUM('CREATED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED', 'COMPLETED', 'DISPATCHED') NOT NULL DEFAULT 'CREATED',
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'RECEIVED') NOT NULL DEFAULT 'PENDING',
    `amountReceived` DOUBLE NULL,
    `paymentReceivedAt` DATETIME(3) NULL,
    `paymentRemarks` VARCHAR(191) NULL,
    `isUrgent` BOOLEAN NOT NULL DEFAULT false,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    UNIQUE INDEX `Order_enquiryId_key`(`enquiryId`),
    UNIQUE INDEX `Order_salesOrderNumber_key`(`salesOrderNumber`),
    UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
    INDEX `Order_customerId_idx`(`customerId`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Order_orderDate_idx`(`orderDate`),
    INDEX `Order_deliveryDate_idx`(`deliveryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ManualOrderRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestNumber` VARCHAR(191) NOT NULL,
    `customerId` INTEGER NULL,
    `customerAddressId` INTEGER NULL,
    `product` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `packingType` VARCHAR(191) NOT NULL,
    `packingSize` VARCHAR(191) NOT NULL,
    `dispatchDate` DATETIME(3) NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'ORDER_CREATED') NOT NULL DEFAULT 'REQUESTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,
    `orderId` INTEGER NULL,

    UNIQUE INDEX `ManualOrderRequest_orderId_key`(`orderId`),
    INDEX `ManualOrderRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `ManualOrderRequest_requestNumber_idx`(`requestNumber`),
    INDEX `ManualOrderRequest_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Production` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'PARTIALLY_PRODUCED', 'HOLD', 'REWORK', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `statusChangeCount` INTEGER NOT NULL DEFAULT 0,
    `state` VARCHAR(191) NULL,
    `assignedPersonnel` VARCHAR(191) NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `productSpecs` VARCHAR(191) NOT NULL,
    `capacity` DOUBLE NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `particleSize` VARCHAR(191) NOT NULL,
    `acmRpm` INTEGER NOT NULL,
    `classifierRpm` INTEGER NOT NULL,
    `blowerRpm` INTEGER NOT NULL,
    `rawMaterials` LONGTEXT NULL,
    `productRemark` VARCHAR(191) NULL,
    `remarks` LONGTEXT NULL,
    `productionStartedDate` DATETIME(3) NULL,
    `productionCompletionDate` DATETIME(3) NULL,
    `producedQuantity` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Production_orderId_idx`(`orderId`),
    INDEX `Production_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Production_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InProcessTestSheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productionId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `overallResult` ENUM('PENDING', 'PASS', 'FAIL') NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InProcessTestSheet_productionId_key`(`productionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InProcessTestSheetItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inProcessTestSheetId` INTEGER NOT NULL,
    `analysisDate` DATETIME(3) NULL,
    `shift` VARCHAR(191) NULL,
    `lotNo` VARCHAR(191) NULL,
    `reactorNo` VARCHAR(191) NULL,
    `samplingBy` VARCHAR(191) NULL,
    `samplingTime` VARCHAR(191) NULL,
    `freeFattyAcid` VARCHAR(191) NULL,
    `ash` VARCHAR(191) NULL,
    `moisture` VARCHAR(191) NULL,
    `appearance` VARCHAR(191) NULL,
    `meltingPoint` VARCHAR(191) NULL,
    `analysisBy` VARCHAR(191) NULL,
    `ffaInformTime` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,

    INDEX `InProcessTestSheetItem_inProcessTestSheetId_idx`(`inProcessTestSheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FinishedGoodsTestSheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productionId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `overallResult` ENUM('PENDING', 'PASS', 'FAIL') NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinishedGoodsTestSheet_productionId_key`(`productionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FinishedGoodsTestSheetItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sheetId` INTEGER NOT NULL,
    `srNo` INTEGER NULL,
    `sampleDate` DATETIME(3) NULL,
    `shift` VARCHAR(191) NULL,
    `samplingBy` VARCHAR(191) NULL,
    `samplingTime` VARCHAR(191) NULL,
    `blackParticle` VARCHAR(191) NULL,
    `bulkDensity` VARCHAR(191) NULL,
    `sieveResidue` VARCHAR(191) NULL,
    `analysisBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,

    INDEX `FinishedGoodsTestSheetItem_sheetId_idx`(`sheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Dispatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `dispatchedQuantity` DOUBLE NOT NULL,
    `dispatchDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `packingDone` BOOLEAN NOT NULL,
    `shipmentStatus` ENUM('PACKING', 'SHIPPED', 'DELIVERED') NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Dispatch_orderId_idx`(`orderId`),
    INDEX `Dispatch_createdAt_id_idx`(`createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PackingRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `packedQuantity` DOUBLE NOT NULL,
    `packingMaterialItemId` VARCHAR(191) NOT NULL,
    `packingMaterialQty` DOUBLE NOT NULL,
    `packedBy` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PackingRecord_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `supplierCode` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_name_key`(`name`),
    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PurchaseOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `poNumber` VARCHAR(191) NOT NULL,
    `poNumberWithCategory` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `billTo` VARCHAR(191) NULL,
    `shipTo` VARCHAR(191) NULL,
    `supplierId` INTEGER NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDeliveryDate` DATETIME(3) NULL,
    `totalDiscount` DOUBLE NOT NULL DEFAULT 0,
    `freight` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `department` VARCHAR(191) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_poNumber_key`(`poNumber`),
    INDEX `PurchaseOrder_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_orderDate_idx`(`orderDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PurchaseOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uniqueKey` VARCHAR(191) NOT NULL,
    `poId` INTEGER NOT NULL,
    `poNumber` VARCHAR(191) NOT NULL,
    `supplier` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `uom` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `taxPercent` DOUBLE NOT NULL DEFAULT 0,
    `expDaysDelivery` VARCHAR(191) NULL,
    `qty` DOUBLE NOT NULL,
    `receivedQty` DOUBLE NOT NULL DEFAULT 0,
    `outwardKey` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PurchaseOrderItem_uniqueKey_key`(`uniqueKey`),
    INDEX `PurchaseOrderItem_poId_idx`(`poId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `GoodsReceiptNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grnNumber` VARCHAR(191) NOT NULL,
    `poId` INTEGER NOT NULL,
    `receivedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedBy` VARCHAR(191) NULL,
    `vehicleRef` VARCHAR(191) NULL,
    `warehouseLocation` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `rejectionReason` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoodsReceiptNote_grnNumber_key`(`grnNumber`),
    INDEX `GoodsReceiptNote_poId_idx`(`poId`),
    INDEX `GoodsReceiptNote_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `GrnItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grnId` INTEGER NOT NULL,
    `poItemId` INTEGER NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `uom` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL,
    `unitPrice` DOUBLE NULL,
    `taxPercent` DOUBLE NULL,
    `batchNo` VARCHAR(191) NULL,
    `quantityOrdered` DOUBLE NOT NULL,
    `quantityReceived` DOUBLE NOT NULL DEFAULT 0,
    `remarks` VARCHAR(191) NULL,

    INDEX `GrnItem_grnId_idx`(`grnId`),
    INDEX `GrnItem_poItemId_idx`(`poItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QcTestSheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grnId` INTEGER NOT NULL,
    `sheetNumber` VARCHAR(191) NULL,
    `overallResult` ENUM('PENDING', 'PASS', 'FAIL') NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QcTestSheet_grnId_key`(`grnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QcTestSheetItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `qcTestSheetId` INTEGER NOT NULL,
    `srNo` INTEGER NULL,
    `samplingDate` DATETIME(3) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `mfgDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `supplier` VARCHAR(191) NULL,
    `sampleQty` DOUBLE NULL,
    `testParameter` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `analysisBy` VARCHAR(191) NULL,
    `analysisDate` DATETIME(3) NULL,
    `remarks` VARCHAR(191) NULL,

    INDEX `QcTestSheetItem_qcTestSheetId_idx`(`qcTestSheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InventoryTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `warehouseLocation` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `grnId` INTEGER NULL,
    `grnItemId` INTEGER NULL,
    `remarks` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `uom` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `shift` VARCHAR(191) NULL,
    `importBatch` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryTransaction_itemId_idx`(`itemId`),
    INDEX `InventoryTransaction_itemId_batchNo_idx`(`itemId`, `batchNo`),
    INDEX `InventoryTransaction_grnId_idx`(`grnId`),
    INDEX `InventoryTransaction_reference_idx`(`reference`),
    INDEX `InventoryTransaction_createdAt_idx`(`createdAt`),
    INDEX `InventoryTransaction_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BatchSubstitution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productionId` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `originalItemId` VARCHAR(191) NOT NULL,
    `originalBatchNo` VARCHAR(191) NOT NULL,
    `originalVendor` VARCHAR(191) NULL,
    `originalGrade` VARCHAR(191) NULL,
    `quantity` DOUBLE NOT NULL,
    `substituteItemId` VARCHAR(191) NOT NULL,
    `substituteBatchNo` VARCHAR(191) NOT NULL,
    `substituteVendor` VARCHAR(191) NULL,
    `substituteGrade` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `reversalTransactionId` INTEGER NOT NULL,
    `consumptionTransactionId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BatchSubstitution_reversalTransactionId_key`(`reversalTransactionId`),
    UNIQUE INDEX `BatchSubstitution_consumptionTransactionId_key`(`consumptionTransactionId`),
    INDEX `BatchSubstitution_productionId_idx`(`productionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MasterDataItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(100) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MasterDataItem_category_sortOrder_idx`(`category`, `sortOrder`),
    UNIQUE INDEX `MasterDataItem_category_value_key`(`category`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EnquiryMaster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `modeOfEnquiry` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NOT NULL,
    `assignedPerson` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EnquiryMaster_unique_key`(`modeOfEnquiry`, `companyName`, `product`, `assignedPerson`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CustomerMaster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerName` VARCHAR(191) NOT NULL,
    `gstn` VARCHAR(50) NULL,
    `country` VARCHAR(100) NULL,
    `countryCode` VARCHAR(20) NULL,
    `custInitials` VARCHAR(20) NULL,
    `sNoCode` VARCHAR(50) NULL,
    `customerCode` VARCHAR(80) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactPersonNumber` VARCHAR(30) NULL,
    `companyEmail` VARCHAR(191) NULL,
    `address` VARCHAR(500) NULL,
    `pincode` VARCHAR(20) NULL,
    `state` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomerMaster_customerCode_key`(`customerCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupplierMaster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplierName` VARCHAR(191) NOT NULL,
    `gstn` VARCHAR(50) NULL,
    `panNo` VARCHAR(20) NULL,
    `country` VARCHAR(100) NULL,
    `countryCode` VARCHAR(20) NULL,
    `supplierCode` VARCHAR(80) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactPersonNumber` VARCHAR(30) NULL,
    `companyEmail` VARCHAR(191) NULL,
    `address` VARCHAR(500) NULL,
    `pincode` VARCHAR(20) NULL,
    `state` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SupplierMaster_supplierCode_key`(`supplierCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductMaster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(100) NULL,
    `defaultUnit` VARCHAR(20) NULL,
    `hsnCode` VARCHAR(30) NULL,
    `description` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductMaster_productName_key`(`productName`),
    INDEX `ProductMaster_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2) New columns on existing tables (added only if missing)
-- ------------------------------------------------------------

-- User.name
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'name');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `name` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.email
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'email');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `email` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.password
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'password');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `password` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.role
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'role');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `role` ENUM(''admin'', ''sales'', ''production'', ''dispatch'', ''purchase'', ''accounts'') NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.passwordChangedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'passwordChangedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `passwordChangedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.role
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND COLUMN_NAME = 'role');
SET @sql := IF(@c = 0, 'ALTER TABLE `RolePermission` ADD COLUMN `role` ENUM(''admin'', ''sales'', ''production'', ''dispatch'', ''purchase'', ''accounts'') NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.module
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND COLUMN_NAME = 'module');
SET @sql := IF(@c = 0, 'ALTER TABLE `RolePermission` ADD COLUMN `module` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.level
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND COLUMN_NAME = 'level');
SET @sql := IF(@c = 0, 'ALTER TABLE `RolePermission` ADD COLUMN `level` ENUM(''NONE'', ''VIEW'', ''FULL'') NOT NULL DEFAULT ''NONE''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `RolePermission` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Customer.name
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'name');
SET @sql := IF(@c = 0, 'ALTER TABLE `Customer` ADD COLUMN `name` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Customer.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Customer` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Customer.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Customer` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.customerId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `customerId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `address` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `city` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `pincode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `state` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.countryCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'countryCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `countryCode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.isDefault
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'isDefault');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT false', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.action
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'action');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `action` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.entityType
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'entityType');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `entityType` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.entityId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'entityId');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `entityId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.actorId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'actorId');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `actorId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.actorName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'actorName');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `actorName` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.actorRole
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'actorRole');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `actorRole` ENUM(''admin'', ''sales'', ''production'', ''dispatch'', ''purchase'', ''accounts'') NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.oldValue
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'oldValue');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `oldValue` JSON NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.newValue
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'newValue');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `newValue` JSON NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.note
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'note');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `note` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `AuditLog` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.enquiryNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'enquiryNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `enquiryNumber` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.companyName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'companyName');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `companyName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.customerId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.customerAddressId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.product
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'product');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `product` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.products
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'products');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `products` JSON NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.quantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `quantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.price
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'price');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `price` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.currency
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'currency');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `currency` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.unitOfMeasurement
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'unitOfMeasurement');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `unitOfMeasurement` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.enquiryDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'enquiryDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `enquiryDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.modeOfEnquiry
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'modeOfEnquiry');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `modeOfEnquiry` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.customerType
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerType');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerType` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.enquiryType
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'enquiryType');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `enquiryType` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.incoTerm
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'incoTerm');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `incoTerm` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.country
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'country');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `country` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.port
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'port');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `port` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.lastTransaction
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'lastTransaction');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `lastTransaction` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.expectedTimeline
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'expectedTimeline');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `expectedTimeline` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.assignedPerson
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'assignedPerson');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `assignedPerson` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.notesForProduction
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'notesForProduction');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `notesForProduction` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `status` ENUM(''PENDING'', ''ACCEPTED'', ''HOLD'', ''REJECTED'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.stage
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'stage');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `stage` ENUM(''GENERAL'', ''SAMPLED'', ''QUOTED'') NOT NULL DEFAULT ''GENERAL''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.sampledAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'sampledAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `sampledAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.isUrgent
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'isUrgent');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `isUrgent` BOOLEAN NOT NULL DEFAULT false', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.rejectionReason
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'rejectionReason');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `rejectionReason` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.createdById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `createdById` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.approvedById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'approvedById');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `approvedById` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.product
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND COLUMN_NAME = 'product');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterial` ADD COLUMN `product` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterial` ADD COLUMN `grade` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterial` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterial` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.bomId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'bomId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `bomId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `category` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.name
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'name');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `name` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.vendor
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'vendor');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `vendor` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.qtyPerUnit
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'qtyPerUnit');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `qtyPerUnit` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.remark
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND COLUMN_NAME = 'remark');
SET @sql := IF(@c = 0, 'ALTER TABLE `BillOfMaterialItem` ADD COLUMN `remark` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.enquiryId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'enquiryId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `enquiryId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.customerId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.customerAddressId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.salesGroupNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'salesGroupNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `salesGroupNumber` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.salesOrderNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'salesOrderNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `salesOrderNumber` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.orderNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'orderNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `orderNo` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.product
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'product');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `product` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `grade` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.quantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `quantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.price
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'price');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `price` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.currency
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'currency');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `currency` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.unit
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'unit');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `unit` ENUM(''KG'', ''MT'', ''LTR'') NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.packingType
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'packingType');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `packingType` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.packingSize
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'packingSize');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `packingSize` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.deliveryDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'deliveryDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `deliveryDate` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.clientName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'clientName');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `clientName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `address` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `city` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `pincode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `state` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.countryCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'countryCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `countryCode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.dispatchDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'dispatchDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `dispatchDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `status` ENUM(''CREATED'', ''IN_PRODUCTION'', ''READY_FOR_DISPATCH'', ''PARTIALLY_DISPATCHED'', ''COMPLETED'', ''DISPATCHED'') NOT NULL DEFAULT ''CREATED''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.paymentStatus
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentStatus');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentStatus` ENUM(''PENDING'', ''PARTIAL'', ''RECEIVED'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.amountReceived
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'amountReceived');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `amountReceived` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.paymentReceivedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentReceivedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentReceivedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.paymentRemarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentRemarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentRemarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.isUrgent
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'isUrgent');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `isUrgent` BOOLEAN NOT NULL DEFAULT false', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.orderDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'orderDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.createdById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `createdById` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.requestNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'requestNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `requestNumber` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.customerId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.customerAddressId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.product
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'product');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `product` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `grade` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.quantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `quantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.unit
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'unit');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `unit` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.packingType
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'packingType');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `packingType` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.packingSize
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'packingSize');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `packingSize` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.dispatchDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'dispatchDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `dispatchDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.clientName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'clientName');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `clientName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `address` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `city` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `pincode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `state` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.countryCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'countryCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `countryCode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `status` ENUM(''REQUESTED'', ''APPROVED'', ''REJECTED'', ''ORDER_CREATED'') NOT NULL DEFAULT ''REQUESTED''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.createdById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `createdById` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.approvedById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'approvedById');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `approvedById` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.orderId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'orderId');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `orderId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.orderId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'orderId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `orderId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `status` ENUM(''PENDING'', ''IN_PROGRESS'', ''PARTIALLY_PRODUCED'', ''HOLD'', ''REWORK'', ''COMPLETED'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.statusChangeCount
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'statusChangeCount');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `statusChangeCount` INTEGER NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `state` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.assignedPersonnel
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'assignedPersonnel');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `assignedPersonnel` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.deliveryDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'deliveryDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `deliveryDate` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.productSpecs
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'productSpecs');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `productSpecs` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.capacity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'capacity');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `capacity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.particleSize
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'particleSize');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `particleSize` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.acmRpm
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'acmRpm');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `acmRpm` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.classifierRpm
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'classifierRpm');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `classifierRpm` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.blowerRpm
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'blowerRpm');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `blowerRpm` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.rawMaterials
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'rawMaterials');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `rawMaterials` LONGTEXT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.productRemark
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'productRemark');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `productRemark` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `remarks` LONGTEXT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.productionStartedDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'productionStartedDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `productionStartedDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.productionCompletionDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'productionCompletionDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `productionCompletionDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.producedQuantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'producedQuantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `producedQuantity` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Production` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.productionId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'productionId');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `productionId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.productName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'productName');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `productName` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.overallResult
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'overallResult');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `overallResult` ENUM(''PENDING'', ''PASS'', ''FAIL'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.approvedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'approvedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.approvedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'approvedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `approvedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.inProcessTestSheetId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'inProcessTestSheetId');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `inProcessTestSheetId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.analysisDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'analysisDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `analysisDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.shift
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'shift');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `shift` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.lotNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'lotNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `lotNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.reactorNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'reactorNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `reactorNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.samplingBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'samplingBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `samplingBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.samplingTime
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'samplingTime');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `samplingTime` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.freeFattyAcid
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'freeFattyAcid');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `freeFattyAcid` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.ash
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'ash');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `ash` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.moisture
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'moisture');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `moisture` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.appearance
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'appearance');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `appearance` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.meltingPoint
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'meltingPoint');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `meltingPoint` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.analysisBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'analysisBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `analysisBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.ffaInformTime
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'ffaInformTime');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `ffaInformTime` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.productionId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'productionId');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `productionId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.productName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'productName');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `productName` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.overallResult
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'overallResult');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `overallResult` ENUM(''PENDING'', ''PASS'', ''FAIL'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.approvedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'approvedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.approvedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'approvedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `approvedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.sheetId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'sheetId');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `sheetId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.srNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'srNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `srNo` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.sampleDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'sampleDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `sampleDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.shift
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'shift');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `shift` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.samplingBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'samplingBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `samplingBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.samplingTime
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'samplingTime');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `samplingTime` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.blackParticle
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'blackParticle');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `blackParticle` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.bulkDensity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'bulkDensity');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `bulkDensity` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.sieveResidue
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'sieveResidue');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `sieveResidue` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.analysisBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'analysisBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `analysisBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.approvedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'approvedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.orderId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'orderId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `orderId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.dispatchedQuantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'dispatchedQuantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `dispatchedQuantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.dispatchDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'dispatchDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `dispatchDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.packingDone
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'packingDone');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `packingDone` BOOLEAN NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.shipmentStatus
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'shipmentStatus');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `shipmentStatus` ENUM(''PACKING'', ''SHIPPED'', ''DELIVERED'') NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.orderId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'orderId');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `orderId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.packedQuantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'packedQuantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `packedQuantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.packingMaterialItemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'packingMaterialItemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `packingMaterialItemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.packingMaterialQty
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'packingMaterialQty');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `packingMaterialQty` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.packedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'packedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `packedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `PackingRecord` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.name
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'name');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `name` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.supplierCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'supplierCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `supplierCode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.contactPerson
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'contactPerson');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `contactPerson` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.phone
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'phone');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `phone` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.email
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'email');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `email` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `address` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `pincode` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.gstNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'gstNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `gstNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.panNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'panNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `panNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Supplier` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.poNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'poNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `poNumber` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.poNumberWithCategory
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'poNumberWithCategory');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `poNumberWithCategory` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `category` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.billTo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'billTo');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `billTo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.shipTo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'shipTo');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `shipTo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.supplierId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'supplierId');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `supplierId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.orderDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'orderDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.expectedDeliveryDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'expectedDeliveryDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `expectedDeliveryDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.totalDiscount
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'totalDiscount');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `totalDiscount` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.freight
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'freight');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `freight` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `status` ENUM(''DRAFT'', ''SUBMITTED'', ''APPROVED'', ''SENT_TO_SUPPLIER'', ''PARTIALLY_RECEIVED'', ''FULLY_RECEIVED'', ''CLOSED'') NOT NULL DEFAULT ''DRAFT''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.totalAmount
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'totalAmount');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `totalAmount` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.notes
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'notes');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `notes` TEXT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.department
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'department');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `department` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.createdById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `createdById` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrder` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.uniqueKey
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'uniqueKey');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `uniqueKey` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.poId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'poId');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `poId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.poNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'poNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `poNumber` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.supplier
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'supplier');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `supplier` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.itemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'itemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `itemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `category` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.uom
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'uom');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `uom` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.currency
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'currency');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT ''INR''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.unitPrice
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'unitPrice');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `unitPrice` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.taxPercent
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'taxPercent');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `taxPercent` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.expDaysDelivery
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'expDaysDelivery');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `expDaysDelivery` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.qty
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'qty');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `qty` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.receivedQty
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'receivedQty');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `receivedQty` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.outwardKey
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'outwardKey');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `outwardKey` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.remark
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'remark');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `remark` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.receivedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND COLUMN_NAME = 'receivedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `PurchaseOrderItem` ADD COLUMN `receivedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.grnNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'grnNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `grnNumber` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.poId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'poId');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `poId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.receivedDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'receivedDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `receivedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.receivedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'receivedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `receivedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.vehicleRef
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'vehicleRef');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `vehicleRef` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.warehouseLocation
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'warehouseLocation');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `warehouseLocation` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.status
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'status');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `status` ENUM(''DRAFT'', ''CONFIRMED'', ''REJECTED'') NOT NULL DEFAULT ''DRAFT''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.rejectionReason
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'rejectionReason');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `rejectionReason` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.rejectedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'rejectedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `rejectedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `remarks` TEXT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.notes
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'notes');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `notes` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.grnId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'grnId');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `grnId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.poItemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'poItemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `poItemId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.itemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'itemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `itemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `category` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.uom
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'uom');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `uom` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.currency
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'currency');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `currency` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.unitPrice
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'unitPrice');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `unitPrice` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.taxPercent
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'taxPercent');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `taxPercent` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.quantityOrdered
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'quantityOrdered');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `quantityOrdered` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.quantityReceived
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'quantityReceived');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `quantityReceived` DOUBLE NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `GrnItem` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.grnId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'grnId');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `grnId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.sheetNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'sheetNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `sheetNumber` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.overallResult
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'overallResult');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `overallResult` ENUM(''PENDING'', ''PASS'', ''FAIL'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.approvedBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'approvedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.approvedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'approvedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `approvedAt` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheet` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.qcTestSheetId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'qcTestSheetId');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `qcTestSheetId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.srNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'srNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `srNo` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.samplingDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'samplingDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `samplingDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.productName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'productName');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `productName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.mfgDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'mfgDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `mfgDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.expiryDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'expiryDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `expiryDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.supplier
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'supplier');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `supplier` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.sampleQty
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'sampleQty');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `sampleQty` DOUBLE NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.testParameter
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'testParameter');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `testParameter` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.result
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'result');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `result` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.analysisBy
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'analysisBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `analysisBy` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.analysisDate
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'analysisDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `analysisDate` DATETIME(3) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `QcTestSheetItem` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.type
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'type');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `type` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.itemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'itemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `itemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.quantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `quantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.warehouseLocation
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'warehouseLocation');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `warehouseLocation` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.reference
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'reference');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `reference` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.grnId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'grnId');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `grnId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.grnItemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'grnItemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `grnItemId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.remarks
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'remarks');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `remarks` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `category` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.uom
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'uom');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `uom` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `grade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `batchNo` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.shift
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'shift');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `shift` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.importBatch
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'importBatch');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `importBatch` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `InventoryTransaction` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.productionId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'productionId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `productionId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.section
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'section');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `section` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.originalItemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'originalItemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `originalItemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.originalBatchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'originalBatchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `originalBatchNo` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.originalVendor
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'originalVendor');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `originalVendor` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.originalGrade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'originalGrade');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `originalGrade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.quantity
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `quantity` DOUBLE NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.substituteItemId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'substituteItemId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `substituteItemId` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.substituteBatchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'substituteBatchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `substituteBatchNo` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.substituteVendor
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'substituteVendor');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `substituteVendor` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.substituteGrade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'substituteGrade');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `substituteGrade` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.reason
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'reason');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `reason` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.reversalTransactionId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'reversalTransactionId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `reversalTransactionId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.consumptionTransactionId
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'consumptionTransactionId');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `consumptionTransactionId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.createdById
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'createdById');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `createdById` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `BatchSubstitution` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `category` VARCHAR(100) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.value
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'value');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `value` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.label
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'label');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `label` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.sortOrder
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'sortOrder');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.isActive
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'isActive');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `MasterDataItem` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.modeOfEnquiry
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'modeOfEnquiry');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `modeOfEnquiry` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.companyName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'companyName');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `companyName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.product
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'product');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `product` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.assignedPerson
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'assignedPerson');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `assignedPerson` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.isActive
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'isActive');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `EnquiryMaster` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.customerName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'customerName');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `customerName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.gstn
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'gstn');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `gstn` VARCHAR(50) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.country
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'country');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `country` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.countryCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'countryCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `countryCode` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.custInitials
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'custInitials');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `custInitials` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.sNoCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'sNoCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `sNoCode` VARCHAR(50) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.customerCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'customerCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `customerCode` VARCHAR(80) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.contactPerson
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'contactPerson');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `contactPerson` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.contactPersonNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'contactPersonNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `contactPersonNumber` VARCHAR(30) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.companyEmail
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'companyEmail');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `companyEmail` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `address` VARCHAR(500) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `pincode` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `state` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `city` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.isActive
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'isActive');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerMaster` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.supplierName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'supplierName');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `supplierName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.gstn
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'gstn');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `gstn` VARCHAR(50) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.panNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'panNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `panNo` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.country
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'country');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `country` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.countryCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'countryCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `countryCode` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.supplierCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'supplierCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `supplierCode` VARCHAR(80) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.contactPerson
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'contactPerson');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `contactPerson` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.contactPersonNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'contactPersonNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `contactPersonNumber` VARCHAR(30) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.companyEmail
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'companyEmail');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `companyEmail` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.address
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'address');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `address` VARCHAR(500) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.pincode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'pincode');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `pincode` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `state` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `city` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.isActive
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'isActive');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `SupplierMaster` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.productName
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'productName');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `productName` VARCHAR(191) NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.category
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'category');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `category` VARCHAR(100) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.defaultUnit
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'defaultUnit');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `defaultUnit` VARCHAR(20) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.hsnCode
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'hsnCode');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `hsnCode` VARCHAR(30) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.description
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'description');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `description` VARCHAR(500) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.isActive
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'isActive');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.createdAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'createdAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.updatedAt
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'updatedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3) New indexes (added only if missing)
-- ------------------------------------------------------------

-- User.User_email_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND INDEX_NAME = 'User_email_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.User_createdAt_id_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND INDEX_NAME = 'User_createdAt_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `User_createdAt_id_idx` ON `User`(`createdAt`, `id`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.User_role_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND INDEX_NAME = 'User_role_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `User_role_createdAt_idx` ON `User`(`role`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.RolePermission_role_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND INDEX_NAME = 'RolePermission_role_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `RolePermission_role_idx` ON `RolePermission`(`role`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RolePermission.RolePermission_role_module_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RolePermission' AND INDEX_NAME = 'RolePermission_role_module_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `RolePermission_role_module_key` ON `RolePermission`(`role`, `module`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Customer.Customer_name_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND INDEX_NAME = 'Customer_name_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Customer_name_idx` ON `Customer`(`name`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Customer.Customer_name_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND INDEX_NAME = 'Customer_name_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `Customer_name_key` ON `Customer`(`name`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerAddress.CustomerAddress_customerId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND INDEX_NAME = 'CustomerAddress_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `CustomerAddress_customerId_idx` ON `CustomerAddress`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.AuditLog_entityType_entityId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND INDEX_NAME = 'AuditLog_entityType_entityId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `AuditLog_entityType_entityId_idx` ON `AuditLog`(`entityType`, `entityId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.AuditLog_action_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND INDEX_NAME = 'AuditLog_action_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `AuditLog_action_createdAt_idx` ON `AuditLog`(`action`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog.AuditLog_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AuditLog' AND INDEX_NAME = 'AuditLog_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.Enquiry_customerId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_customerId_idx` ON `Enquiry`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.Enquiry_status_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_status_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_status_createdAt_idx` ON `Enquiry`(`status`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.Enquiry_stage_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_stage_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_stage_idx` ON `Enquiry`(`stage`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.Enquiry_enquiryDate_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_enquiryDate_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_enquiryDate_idx` ON `Enquiry`(`enquiryDate`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.Enquiry_expectedTimeline_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_expectedTimeline_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_expectedTimeline_idx` ON `Enquiry`(`expectedTimeline`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.BillOfMaterial_product_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND INDEX_NAME = 'BillOfMaterial_product_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `BillOfMaterial_product_idx` ON `BillOfMaterial`(`product`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterial.BillOfMaterial_product_grade_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterial' AND INDEX_NAME = 'BillOfMaterial_product_grade_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `BillOfMaterial_product_grade_key` ON `BillOfMaterial`(`product`, `grade`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem.BillOfMaterialItem_bomId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BillOfMaterialItem' AND INDEX_NAME = 'BillOfMaterialItem_bomId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `BillOfMaterialItem_bomId_idx` ON `BillOfMaterialItem`(`bomId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_enquiryId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_enquiryId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `Order_enquiryId_key` ON `Order`(`enquiryId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_salesOrderNumber_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_salesOrderNumber_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `Order_salesOrderNumber_key` ON `Order`(`salesOrderNumber`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_orderNo_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_orderNo_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `Order_orderNo_key` ON `Order`(`orderNo`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_customerId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Order_customerId_idx` ON `Order`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_status_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_status_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_orderDate_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_orderDate_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Order_orderDate_idx` ON `Order`(`orderDate`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order.Order_deliveryDate_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_deliveryDate_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Order_deliveryDate_idx` ON `Order`(`deliveryDate`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.ManualOrderRequest_orderId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_orderId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `ManualOrderRequest_orderId_key` ON `ManualOrderRequest`(`orderId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.ManualOrderRequest_status_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_status_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `ManualOrderRequest_status_createdAt_idx` ON `ManualOrderRequest`(`status`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.ManualOrderRequest_requestNumber_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_requestNumber_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `ManualOrderRequest_requestNumber_idx` ON `ManualOrderRequest`(`requestNumber`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest.ManualOrderRequest_customerId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `ManualOrderRequest_customerId_idx` ON `ManualOrderRequest`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.Production_orderId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND INDEX_NAME = 'Production_orderId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Production_orderId_idx` ON `Production`(`orderId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.Production_status_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND INDEX_NAME = 'Production_status_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Production_status_createdAt_idx` ON `Production`(`status`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production.Production_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND INDEX_NAME = 'Production_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Production_createdAt_idx` ON `Production`(`createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet.InProcessTestSheet_productionId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND INDEX_NAME = 'InProcessTestSheet_productionId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `InProcessTestSheet_productionId_key` ON `InProcessTestSheet`(`productionId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem.InProcessTestSheetItem_inProcessTestSheetId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheetItem' AND INDEX_NAME = 'InProcessTestSheetItem_inProcessTestSheetId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InProcessTestSheetItem_inProcessTestSheetId_idx` ON `InProcessTestSheetItem`(`inProcessTestSheetId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet.FinishedGoodsTestSheet_productionId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheet' AND INDEX_NAME = 'FinishedGoodsTestSheet_productionId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `FinishedGoodsTestSheet_productionId_key` ON `FinishedGoodsTestSheet`(`productionId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem.FinishedGoodsTestSheetItem_sheetId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND INDEX_NAME = 'FinishedGoodsTestSheetItem_sheetId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `FinishedGoodsTestSheetItem_sheetId_idx` ON `FinishedGoodsTestSheetItem`(`sheetId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.Dispatch_orderId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND INDEX_NAME = 'Dispatch_orderId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Dispatch_orderId_idx` ON `Dispatch`(`orderId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch.Dispatch_createdAt_id_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND INDEX_NAME = 'Dispatch_createdAt_id_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Dispatch_createdAt_id_idx` ON `Dispatch`(`createdAt`, `id`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord.PackingRecord_orderId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PackingRecord' AND INDEX_NAME = 'PackingRecord_orderId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `PackingRecord_orderId_idx` ON `PackingRecord`(`orderId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.Supplier_name_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND INDEX_NAME = 'Supplier_name_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `Supplier_name_key` ON `Supplier`(`name`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supplier.Supplier_name_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Supplier' AND INDEX_NAME = 'Supplier_name_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Supplier_name_idx` ON `Supplier`(`name`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.PurchaseOrder_poNumber_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND INDEX_NAME = 'PurchaseOrder_poNumber_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `PurchaseOrder_poNumber_key` ON `PurchaseOrder`(`poNumber`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.PurchaseOrder_status_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND INDEX_NAME = 'PurchaseOrder_status_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `PurchaseOrder_status_createdAt_idx` ON `PurchaseOrder`(`status`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.PurchaseOrder_supplierId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND INDEX_NAME = 'PurchaseOrder_supplierId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `PurchaseOrder_supplierId_idx` ON `PurchaseOrder`(`supplierId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder.PurchaseOrder_orderDate_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrder' AND INDEX_NAME = 'PurchaseOrder_orderDate_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `PurchaseOrder_orderDate_idx` ON `PurchaseOrder`(`orderDate`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.PurchaseOrderItem_uniqueKey_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND INDEX_NAME = 'PurchaseOrderItem_uniqueKey_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `PurchaseOrderItem_uniqueKey_key` ON `PurchaseOrderItem`(`uniqueKey`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem.PurchaseOrderItem_poId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PurchaseOrderItem' AND INDEX_NAME = 'PurchaseOrderItem_poId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `PurchaseOrderItem_poId_idx` ON `PurchaseOrderItem`(`poId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.GoodsReceiptNote_grnNumber_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND INDEX_NAME = 'GoodsReceiptNote_grnNumber_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `GoodsReceiptNote_grnNumber_key` ON `GoodsReceiptNote`(`grnNumber`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.GoodsReceiptNote_poId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND INDEX_NAME = 'GoodsReceiptNote_poId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `GoodsReceiptNote_poId_idx` ON `GoodsReceiptNote`(`poId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote.GoodsReceiptNote_status_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND INDEX_NAME = 'GoodsReceiptNote_status_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `GoodsReceiptNote_status_idx` ON `GoodsReceiptNote`(`status`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.GrnItem_grnId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND INDEX_NAME = 'GrnItem_grnId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `GrnItem_grnId_idx` ON `GrnItem`(`grnId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem.GrnItem_poItemId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GrnItem' AND INDEX_NAME = 'GrnItem_poItemId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `GrnItem_poItemId_idx` ON `GrnItem`(`poItemId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet.QcTestSheet_grnId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheet' AND INDEX_NAME = 'QcTestSheet_grnId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `QcTestSheet_grnId_key` ON `QcTestSheet`(`grnId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem.QcTestSheetItem_qcTestSheetId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QcTestSheetItem' AND INDEX_NAME = 'QcTestSheetItem_qcTestSheetId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `QcTestSheetItem_qcTestSheetId_idx` ON `QcTestSheetItem`(`qcTestSheetId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_itemId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_itemId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_itemId_idx` ON `InventoryTransaction`(`itemId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_itemId_batchNo_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_itemId_batchNo_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_itemId_batchNo_idx` ON `InventoryTransaction`(`itemId`, `batchNo`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_grnId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_grnId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_grnId_idx` ON `InventoryTransaction`(`grnId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_reference_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_reference_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_reference_idx` ON `InventoryTransaction`(`reference`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_createdAt_idx` ON `InventoryTransaction`(`createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction.InventoryTransaction_type_createdAt_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryTransaction' AND INDEX_NAME = 'InventoryTransaction_type_createdAt_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `InventoryTransaction_type_createdAt_idx` ON `InventoryTransaction`(`type`, `createdAt`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.BatchSubstitution_reversalTransactionId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND INDEX_NAME = 'BatchSubstitution_reversalTransactionId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `BatchSubstitution_reversalTransactionId_key` ON `BatchSubstitution`(`reversalTransactionId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.BatchSubstitution_consumptionTransactionId_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND INDEX_NAME = 'BatchSubstitution_consumptionTransactionId_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `BatchSubstitution_consumptionTransactionId_key` ON `BatchSubstitution`(`consumptionTransactionId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution.BatchSubstitution_productionId_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BatchSubstitution' AND INDEX_NAME = 'BatchSubstitution_productionId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `BatchSubstitution_productionId_idx` ON `BatchSubstitution`(`productionId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.MasterDataItem_category_sortOrder_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND INDEX_NAME = 'MasterDataItem_category_sortOrder_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `MasterDataItem_category_sortOrder_idx` ON `MasterDataItem`(`category`, `sortOrder`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MasterDataItem.MasterDataItem_category_value_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MasterDataItem' AND INDEX_NAME = 'MasterDataItem_category_value_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `MasterDataItem_category_value_key` ON `MasterDataItem`(`category`, `value`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- EnquiryMaster.EnquiryMaster_unique_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EnquiryMaster' AND INDEX_NAME = 'EnquiryMaster_unique_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `EnquiryMaster_unique_key` ON `EnquiryMaster`(`modeOfEnquiry`, `companyName`, `product`, `assignedPerson`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- CustomerMaster.CustomerMaster_customerCode_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerMaster' AND INDEX_NAME = 'CustomerMaster_customerCode_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `CustomerMaster_customerCode_key` ON `CustomerMaster`(`customerCode`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- SupplierMaster.SupplierMaster_supplierCode_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SupplierMaster' AND INDEX_NAME = 'SupplierMaster_supplierCode_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `SupplierMaster_supplierCode_key` ON `SupplierMaster`(`supplierCode`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.ProductMaster_productName_key
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND INDEX_NAME = 'ProductMaster_productName_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `ProductMaster_productName_key` ON `ProductMaster`(`productName`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.ProductMaster_category_idx
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND INDEX_NAME = 'ProductMaster_category_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `ProductMaster_category_idx` ON `ProductMaster`(`category`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 4) Foreign keys (added only if missing)
-- ------------------------------------------------------------

-- CustomerAddress_customerId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'CustomerAddress_customerId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AuditLog_actorId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'AuditLog_actorId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry_customerId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Enquiry_customerId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry_createdById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Enquiry_createdById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry_approvedById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Enquiry_approvedById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BillOfMaterialItem_bomId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'BillOfMaterialItem_bomId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `BillOfMaterialItem` ADD CONSTRAINT `BillOfMaterialItem_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `BillOfMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order_customerId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Order_customerId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order_enquiryId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Order_enquiryId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Order` ADD CONSTRAINT `Order_enquiryId_fkey` FOREIGN KEY (`enquiryId`) REFERENCES `Enquiry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Order_createdById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Order_createdById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Order` ADD CONSTRAINT `Order_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest_customerId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'ManualOrderRequest_customerId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest_createdById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'ManualOrderRequest_createdById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest_approvedById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'ManualOrderRequest_approvedById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ManualOrderRequest_orderId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'ManualOrderRequest_orderId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Production_orderId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Production_orderId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Production` ADD CONSTRAINT `Production_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheet_productionId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'InProcessTestSheet_productionId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `InProcessTestSheet` ADD CONSTRAINT `InProcessTestSheet_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InProcessTestSheetItem_inProcessTestSheetId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'InProcessTestSheetItem_inProcessTestSheetId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `InProcessTestSheetItem` ADD CONSTRAINT `InProcessTestSheetItem_inProcessTestSheetId_fkey` FOREIGN KEY (`inProcessTestSheetId`) REFERENCES `InProcessTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheet_productionId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'FinishedGoodsTestSheet_productionId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `FinishedGoodsTestSheet` ADD CONSTRAINT `FinishedGoodsTestSheet_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FinishedGoodsTestSheetItem_sheetId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'FinishedGoodsTestSheetItem_sheetId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD CONSTRAINT `FinishedGoodsTestSheetItem_sheetId_fkey` FOREIGN KEY (`sheetId`) REFERENCES `FinishedGoodsTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Dispatch_orderId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'Dispatch_orderId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Dispatch` ADD CONSTRAINT `Dispatch_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PackingRecord_orderId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'PackingRecord_orderId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `PackingRecord` ADD CONSTRAINT `PackingRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder_supplierId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'PurchaseOrder_supplierId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrder_createdById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'PurchaseOrder_createdById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PurchaseOrderItem_poId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'PurchaseOrderItem_poId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GoodsReceiptNote_poId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'GoodsReceiptNote_poId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `GoodsReceiptNote` ADD CONSTRAINT `GoodsReceiptNote_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem_grnId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'GrnItem_grnId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `GrnItem` ADD CONSTRAINT `GrnItem_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- GrnItem_poItemId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'GrnItem_poItemId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `GrnItem` ADD CONSTRAINT `GrnItem_poItemId_fkey` FOREIGN KEY (`poItemId`) REFERENCES `PurchaseOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheet_grnId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'QcTestSheet_grnId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `QcTestSheet` ADD CONSTRAINT `QcTestSheet_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- QcTestSheetItem_qcTestSheetId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'QcTestSheetItem_qcTestSheetId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `QcTestSheetItem` ADD CONSTRAINT `QcTestSheetItem_qcTestSheetId_fkey` FOREIGN KEY (`qcTestSheetId`) REFERENCES `QcTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- InventoryTransaction_grnId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'InventoryTransaction_grnId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `InventoryTransaction` ADD CONSTRAINT `InventoryTransaction_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution_productionId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'BatchSubstitution_productionId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution_reversalTransactionId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'BatchSubstitution_reversalTransactionId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_reversalTransactionId_fkey` FOREIGN KEY (`reversalTransactionId`) REFERENCES `InventoryTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution_consumptionTransactionId_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'BatchSubstitution_consumptionTransactionId_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_consumptionTransactionId_fkey` FOREIGN KEY (`consumptionTransactionId`) REFERENCES `InventoryTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BatchSubstitution_createdById_fkey
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME = 'BatchSubstitution_createdById_fkey'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Restore the caller's FK-check setting.
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
