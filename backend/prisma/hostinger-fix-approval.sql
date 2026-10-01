-- Nimbasia: live DB changes for this release —
--   * Enquiry city/state (domestic enquiries)
--   * ProductMaster grade/batch + (productName, grade) unique key
--   * Enquiry DRAFT status (Send for Approval)
--   * User.dataScope (Self / All data access)
--   * PasswordChangeOtp table (OTP on password change)
--   * Dispatch.invoiceNumber + Payment ledger (invoice-wise payments),
--     carrying existing order-level payments over once
-- Safe to re-run; adds only what is missing. The only rows it writes are the
-- payment carry-over, and only on the run that creates the Payment table.

-- Enquiry.city
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'city');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `city` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.state
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'state');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` ADD COLUMN `state` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.grade
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'grade');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `grade` VARCHAR(100) NOT NULL DEFAULT '''' AFTER `productName`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster.batchNo
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND COLUMN_NAME = 'batchNo');
SET @sql := IF(@c = 0, 'ALTER TABLE `ProductMaster` ADD COLUMN `batchNo` VARCHAR(80) NULL AFTER `grade`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ProductMaster: one row per (product, grade), not per product name.
SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND INDEX_NAME = 'ProductMaster_productName_grade_key');
SET @sql := IF(@i = 0, 'CREATE UNIQUE INDEX `ProductMaster_productName_grade_key` ON `ProductMaster`(`productName`, `grade`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductMaster' AND INDEX_NAME = 'ProductMaster_productName_key');
SET @sql := IF(@i > 0, 'ALTER TABLE `ProductMaster` DROP INDEX `ProductMaster_productName_key`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Enquiry.status gains DRAFT (saved, not yet sent for approval). Appended at
-- the end of the ENUM so MySQL extends it in place; existing rows keep their value.
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Enquiry' AND COLUMN_NAME = 'status'
             AND COLUMN_TYPE LIKE '%''DRAFT''%');
SET @sql := IF(@c = 0, 'ALTER TABLE `Enquiry` MODIFY COLUMN `status` ENUM(''PENDING'', ''ACCEPTED'', ''HOLD'', ''REJECTED'', ''DRAFT'') NOT NULL DEFAULT ''PENDING''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User.dataScope (SELF = sees only their own sales data, ALL = everyone's).
-- Existing users get ALL, so nobody loses sight of data until an admin changes it.
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'dataScope');
SET @sql := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `dataScope` ENUM(''SELF'', ''ALL'') NOT NULL DEFAULT ''ALL''', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- PasswordChangeOtp: the emailed OTP a user needs to change their own password.
-- One row per user; only an HMAC of the 6-digit code is stored.
CREATE TABLE IF NOT EXISTS `PasswordChangeOtp` (
    `userId` INTEGER NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- Payments: invoice number on each dispatch, the Payment ledger, and a
-- one-off carry-over of existing order-level payments (only on the run
-- that creates the Payment table, so re-running never duplicates them).
-- ------------------------------------------------------------
-- Dispatch.invoiceNumber
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'invoiceNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Dispatch` ADD COLUMN `invoiceNumber` VARCHAR(191) NULL', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Dispatch' AND INDEX_NAME = 'Dispatch_invoiceNumber_idx');
SET @sql := IF(@i = 0, 'CREATE INDEX `Dispatch_invoiceNumber_idx` ON `Dispatch`(`invoiceNumber`)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Payment: receipts booked against an invoice (dispatch)
SET @payment_is_new := (SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Payment');

CREATE TABLE IF NOT EXISTS `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `dispatchId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `paymentType` ENUM('FULL', 'PARTIAL') NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_orderId_idx`(`orderId`),
    INDEX `Payment_dispatchId_idx`(`dispatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'Payment_orderId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'Payment_dispatchId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Payment` ADD CONSTRAINT `Payment_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `Dispatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'Payment_createdById_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0, 'ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- One-off carry-over of order-level payments (only when the table was just created).
-- A fully paid order gets a FULL receipt on every dispatch, for that invoice's
-- value (0 when unpriced), so no invoice of a paid order shows as unpaid.
INSERT INTO `Payment` (`orderId`, `dispatchId`, `amount`, `paymentType`, `receivedAt`, `remarks`, `createdById`)
SELECT o.`id`,
       d.`id`,
       IF(o.`price` IS NULL, 0, ROUND(d.`dispatchedQuantity` * o.`price`, 2)),
       'FULL',
       COALESCE(o.`paymentReceivedAt`, o.`updatedAt`),
       COALESCE(o.`paymentRemarks`, 'Carried over from the order-level payment'),
       o.`createdById`
FROM `Order` o
JOIN `Dispatch` d ON d.`orderId` = o.`id`
WHERE @payment_is_new = 1
  AND o.`paymentStatus` = 'RECEIVED';

-- A part-paid order only has a lump sum with no invoice attached, so it stays
-- one PARTIAL receipt on the first dispatch.
INSERT INTO `Payment` (`orderId`, `dispatchId`, `amount`, `paymentType`, `receivedAt`, `remarks`, `createdById`)
SELECT o.`id`,
       (SELECT MIN(d.`id`) FROM `Dispatch` d WHERE d.`orderId` = o.`id`),
       COALESCE(o.`amountReceived`, 0),
       'PARTIAL',
       COALESCE(o.`paymentReceivedAt`, o.`updatedAt`),
       COALESCE(o.`paymentRemarks`, 'Carried over from the order-level payment'),
       o.`createdById`
FROM `Order` o
WHERE @payment_is_new = 1
  AND o.`paymentStatus` = 'PARTIAL'
  AND EXISTS (SELECT 1 FROM `Dispatch` d WHERE d.`orderId` = o.`id`);
