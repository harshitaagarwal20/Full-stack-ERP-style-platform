-- Invoice number on each dispatch, and a Payment ledger so accounts can book
-- full / partial receipts against a specific invoice. Order.paymentStatus and
-- amountReceived become roll-ups of these rows.

ALTER TABLE `Dispatch` ADD COLUMN `invoiceNumber` VARCHAR(191) NULL AFTER `remarks`;
CREATE INDEX `Dispatch_invoiceNumber_idx` ON `Dispatch`(`invoiceNumber`);

CREATE TABLE `Payment` (
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

ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_dispatchId_fkey` FOREIGN KEY (`dispatchId`) REFERENCES `Dispatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry existing order-level payments over so the rolled-up status and amount
-- don't reset to PENDING.
--
-- A fully paid order paid every invoice it had, so each of its dispatches gets
-- a FULL receipt for that invoice's value (quantity x price; 0 when the order
-- has no price, where a FULL receipt is what settles it). Booking it against
-- only the first dispatch would leave the others showing as unpaid.
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
WHERE o.`paymentStatus` = 'RECEIVED';

-- A part-paid order only recorded a lump sum, with no record of which invoice
-- it was for, so it stays one PARTIAL receipt on the first dispatch.
INSERT INTO `Payment` (`orderId`, `dispatchId`, `amount`, `paymentType`, `receivedAt`, `remarks`, `createdById`)
SELECT o.`id`,
       (SELECT MIN(d.`id`) FROM `Dispatch` d WHERE d.`orderId` = o.`id`),
       COALESCE(o.`amountReceived`, 0),
       'PARTIAL',
       COALESCE(o.`paymentReceivedAt`, o.`updatedAt`),
       COALESCE(o.`paymentRemarks`, 'Carried over from the order-level payment'),
       o.`createdById`
FROM `Order` o
WHERE o.`paymentStatus` = 'PARTIAL'
  AND EXISTS (SELECT 1 FROM `Dispatch` d WHERE d.`orderId` = o.`id`);
