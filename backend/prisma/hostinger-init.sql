-- ============================================================
-- Nimbasia ERP — full schema for a fresh Hostinger MySQL import.
-- Safe to run: idempotent. CREATE TABLE IF NOT EXISTS and guarded
-- foreign keys mean a re-run (or a resumed, partially-applied
-- import) does not error. It creates structure only — no data;
-- run the seed (npm run seed) afterwards for the admin user and
-- role permissions, or you will not be able to log in.
--
-- FK checks are disabled for the load so table order cannot bite,
-- then restored.
-- ============================================================
SET @OLD_FOREIGN_KEY_CHECKS := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_name_idx`(`name`),
    UNIQUE INDEX `Customer_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS `Dispatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `dispatchedQuantity` DOUBLE NOT NULL,
    `dispatchDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `packingDone` BOOLEAN NOT NULL,
    `shipmentStatus` ENUM('PACKING', 'SHIPPED', 'DELIVERED') NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- Compatibility for partially-created / older Hostinger databases.
-- CREATE TABLE IF NOT EXISTS does not update an existing table. If an import was
-- resumed after an older schema had already created these tables, the FK section
-- below can fail with: #1072 - Key column 'customerId' doesn't exist in table.
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `CustomerAddress` ADD COLUMN `customerId` INTEGER NOT NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerAddress' AND INDEX_NAME = 'CustomerAddress_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `CustomerAddress_customerId_idx` ON `CustomerAddress`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Enquiry_customerId_idx` ON `Enquiry`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `Order` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Order_customerId_idx` ON `Order`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerId');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerAddressId');
SET @sql := IF(@c = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerAddressId` INTEGER NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_customerId_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `ManualOrderRequest_customerId_idx` ON `ManualOrderRequest`(`customerId`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
