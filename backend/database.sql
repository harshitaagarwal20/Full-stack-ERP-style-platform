-- Complete Nimbasia customer-tables schema change.
-- Safe to import more than once: every step checks INFORMATION_SCHEMA first.
--
-- Three things this file has to get right, all of which bite on a real server:
--
--  1. Table names match the model names in schema.prisma exactly (`Customer`,
--     `CustomerAddress`, `Order`, `Enquiry`, `ManualOrderRequest`). None of
--     those models declare an @@map, so Prisma queries them PascalCase.
--     snake_case names like `customer_address` never match, and lowercase ones
--     only appear to work on Windows/macOS, where MySQL runs with
--     lower_case_table_names=1 and folds identifiers. On a Linux server they
--     are compared literally and every query fails.
--
--  2. No `ADD COLUMN IF NOT EXISTS`. That is MariaDB syntax; on MySQL 8 it is a
--     syntax error that aborts the whole import. Idempotency is done the
--     portable way instead: check INFORMATION_SCHEMA, build the statement, and
--     PREPARE it (`DO 0` is the no-op when the object already exists).
--
--  3. No stored procedure / DELIMITER. Those are client-side constructs that
--     not every import path honours. Plain statements only.
--
--  4. Safe update mode. The backfill UPDATEs below match on clientName /
--     companyName / customerId — none of which is a key — so a client running
--     with sql_safe_updates on (phpMyAdmin and MySQL Workbench both do by
--     default) aborts them with error 1175, "You are using safe update mode".
--     The setting is turned off for this session only and restored at the end,
--     so the import behaves the same however it is run.

-- Remember the caller's setting so it can be put back exactly as it was.
SET @OLD_SQL_SAFE_UPDATES := @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

-- CreateTable Customer
CREATE TABLE IF NOT EXISTS `Customer` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Customer_name_key` (`name`),
  KEY `Customer_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CreateTable CustomerAddress
CREATE TABLE IF NOT EXISTS `CustomerAddress` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerId` INT NOT NULL,
  `address` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` VARCHAR(191) COLLATE utf8mb4_unicode_ci,
  `pincode` VARCHAR(191) COLLATE utf8mb4_unicode_ci,
  `state` VARCHAR(191) COLLATE utf8mb4_unicode_ci,
  `countryCode` VARCHAR(191) COLLATE utf8mb4_unicode_ci,
  `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `CustomerAddress_customerId_idx` (`customerId`),
  CONSTRAINT `CustomerAddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- Order refs
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerId');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `customerId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'customerAddressId');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `customerAddressId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND INDEX_NAME = 'Order_customerId_idx');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD INDEX `Order_customerId_idx` (`customerId`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND CONSTRAINT_NAME = 'Order_customerId_fkey');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- -------------------------------------------------------------- Enquiry refs
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerId');
SET @s := IF(@x = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'customerAddressId');
SET @s := IF(@x = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `customerAddressId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND INDEX_NAME = 'Enquiry_customerId_idx');
SET @s := IF(@x = 0, 'ALTER TABLE `Enquiry` ADD INDEX `Enquiry_customerId_idx` (`customerId`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND CONSTRAINT_NAME = 'Enquiry_customerId_fkey');
SET @s := IF(@x = 0, 'ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- --------------------------------------------- ManualOrderRequest refs
-- The table is `ManualOrderRequest`, not `manual_order_request` — the old
-- version of this file targeted a table that has never existed.
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerId');
SET @s := IF(@x = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND COLUMN_NAME = 'customerAddressId');
SET @s := IF(@x = 0, 'ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerAddressId` INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND INDEX_NAME = 'ManualOrderRequest_customerId_idx');
SET @s := IF(@x = 0, 'ALTER TABLE `ManualOrderRequest` ADD INDEX `ManualOrderRequest_customerId_idx` (`customerId`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManualOrderRequest' AND CONSTRAINT_NAME = 'ManualOrderRequest_customerId_fkey');
SET @s := IF(@x = 0, 'ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ------------------------------------------------------------------ backfill

-- Customers, from the client names already on orders
INSERT INTO `Customer` (`name`, `createdAt`, `updatedAt`)
SELECT DISTINCT o.`clientName`, NOW(), NOW()
FROM `Order` o
WHERE o.`clientName` IS NOT NULL AND o.`clientName` != ''
  AND NOT EXISTS (SELECT 1 FROM `Customer` c WHERE c.`name` = o.`clientName`)
ON DUPLICATE KEY UPDATE `updatedAt` = NOW();

-- Addresses, from the addresses already on orders
INSERT INTO `CustomerAddress` (`customerId`, `address`, `city`, `pincode`, `state`, `countryCode`, `isDefault`, `createdAt`, `updatedAt`)
SELECT c.`id`, o.`address`, o.`city`, o.`pincode`, o.`state`, o.`countryCode`, 1, NOW(), NOW()
FROM `Order` o
JOIN `Customer` c ON c.`name` = o.`clientName`
WHERE o.`address` IS NOT NULL AND o.`address` != ''
  AND NOT EXISTS (
    SELECT 1 FROM `CustomerAddress` ca
    WHERE ca.`customerId` = c.`id` AND ca.`address` = o.`address`
  );

-- Point existing rows at the customers just created
UPDATE `Order` o
SET o.`customerId` = (SELECT c.`id` FROM `Customer` c WHERE c.`name` = o.`clientName`)
WHERE o.`id` > 0 AND o.`clientName` IS NOT NULL AND o.`customerId` IS NULL;

UPDATE `Order` o
SET o.`customerAddressId` = (
  SELECT ca.`id` FROM `CustomerAddress` ca
  WHERE ca.`customerId` = o.`customerId` AND ca.`address` = o.`address`
  LIMIT 1
)
WHERE o.`id` > 0 AND o.`customerId` IS NOT NULL AND o.`address` IS NOT NULL AND o.`customerAddressId` IS NULL;

UPDATE `Enquiry` e
SET e.`customerId` = (SELECT c.`id` FROM `Customer` c WHERE c.`name` = e.`companyName`)
WHERE e.`id` > 0 AND e.`companyName` IS NOT NULL AND e.`customerId` IS NULL;

UPDATE `ManualOrderRequest` mor
SET mor.`customerId` = (SELECT c.`id` FROM `Customer` c WHERE c.`name` = mor.`clientName`)
WHERE mor.`id` > 0 AND mor.`clientName` IS NOT NULL AND mor.`customerId` IS NULL;

-- ============================================================================
-- Client-approved Enquiry → Dispatch flow: rework, the in-process quality gate,
-- payments, and rejected consignments.
--
-- Mirrors prisma/migrations/20260714120000_flow_rework_payments_grn_rejection.
-- Additive and re-runnable: every new column defaults to the behaviour the
-- system already had, so importing this changes no existing row's meaning.
--
-- The ENUM columns are MODIFYed unconditionally rather than guarded. Widening an
-- ENUM with the existing members still listed is a no-op on a database that has
-- already been widened, and MySQL will not drop a value that is still in use —
-- so re-running is safe, and there is no INFORMATION_SCHEMA check that reads
-- cleanly for "does this ENUM already contain REWORK".
-- ============================================================================

-- ------------------------------------------------- Production: rework batches
ALTER TABLE `Production`
  MODIFY COLUMN `status` ENUM('PENDING', 'IN_PROGRESS', 'PARTIALLY_PRODUCED', 'HOLD', 'REWORK', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

-- ------------------------------- In-process test sheet: the mid-project gate
-- Existing sheets land on PENDING, which leaves them exactly what they were:
-- a running log that gates nothing until someone records a Pass or a Fail.
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'overallResult');
SET @s := IF(@x = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `overallResult` ENUM(''PENDING'', ''PASS'', ''FAIL'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'approvedBy');
SET @s := IF(@x = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InProcessTestSheet' AND COLUMN_NAME = 'approvedAt');
SET @s := IF(@x = 0, 'ALTER TABLE `InProcessTestSheet` ADD COLUMN `approvedAt` DATETIME(3) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ------------------------------------------------------- Order: payment stage
-- Accounts records what has been received; payment in full is what completes a
-- dispatched order. Existing orders start at PENDING, and any order already
-- COMPLETED stays COMPLETED — the rule governs orders dispatched from here on.
SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentStatus');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentStatus` ENUM(''PENDING'', ''PARTIAL'', ''RECEIVED'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'amountReceived');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `amountReceived` DOUBLE NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentReceivedAt');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentReceivedAt` DATETIME(3) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'paymentRemarks');
SET @s := IF(@x = 0, 'ALTER TABLE `Order` ADD COLUMN `paymentRemarks` VARCHAR(191) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- --------------------------------------- Goods receipt: rejected consignments
-- A consignment whose raw material test sheet failed is turned away. A REJECTED
-- GRN can never be confirmed, so none of its material reaches inventory.
ALTER TABLE `GoodsReceiptNote`
  MODIFY COLUMN `status` ENUM('DRAFT', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'DRAFT';

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'rejectionReason');
SET @s := IF(@x = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `rejectionReason` VARCHAR(191) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoodsReceiptNote' AND COLUMN_NAME = 'rejectedAt');
SET @s := IF(@x = 0, 'ALTER TABLE `GoodsReceiptNote` ADD COLUMN `rejectedAt` DATETIME(3) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------- Product master (no DDL)
-- ProductMaster and the `productCategories` master list are created and seeded
-- by masterDataService.ensureMasterDataInitialized() on the first master-data
-- request after a restart, in the same way CustomerMaster and SupplierMaster
-- are. Nothing to import here — the table appears on its own, backfilled from
-- the existing product list.

-- ============================================================================
-- Finished goods test sheet: per-row "Approved by".
--
-- Mirrors prisma/migrations/20260713170000_add_finished_goods_item_approved_by.
-- The controlled paper form (QCD/021/F/001-00) signs off each sampled row
-- individually, so the approver belongs on the item, not only on the sheet.
-- ============================================================================

SET @x := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FinishedGoodsTestSheetItem' AND COLUMN_NAME = 'approvedBy');
SET @s := IF(@x = 0, 'ALTER TABLE `FinishedGoodsTestSheetItem` ADD COLUMN `approvedBy` VARCHAR(191) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ============================================================================
-- Quantities are weights, not counts.
--
-- Mirrors prisma/migrations/20260714090000_quantities_allow_decimal.
-- Enquiry.quantity was already a DOUBLE, so an accepted enquiry for 10.5 MT
-- silently truncated to 10 on its way into the order. Widening the order alone
-- is not enough — production and dispatch would truncate it again downstream —
-- so the whole chain moves to DOUBLE together.
--
-- MODIFY is naturally re-runnable: widening a column that is already DOUBLE is a
-- no-op, and INT -> DOUBLE preserves every existing whole-number value.
-- RPMs, batch counts and IDs stay INT on purpose: those are counts.
-- ============================================================================

ALTER TABLE `Order`              MODIFY COLUMN `quantity` DOUBLE NOT NULL;
ALTER TABLE `ManualOrderRequest` MODIFY COLUMN `quantity` DOUBLE NOT NULL;
ALTER TABLE `Production`         MODIFY COLUMN `capacity` DOUBLE NOT NULL;
ALTER TABLE `Production`         MODIFY COLUMN `producedQuantity` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `Dispatch`           MODIFY COLUMN `dispatchedQuantity` DOUBLE NOT NULL;
ALTER TABLE `BatchSubstitution`  MODIFY COLUMN `quantity` DOUBLE NOT NULL;

-- Put safe update mode back exactly as the caller had it.
SET SESSION sql_safe_updates = @OLD_SQL_SAFE_UPDATES;
