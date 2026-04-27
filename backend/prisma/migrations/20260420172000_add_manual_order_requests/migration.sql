CREATE TABLE `ManualOrderRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `requestNumber` VARCHAR(191) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `grade` VARCHAR(191) NOT NULL,
  `quantity` INT NOT NULL,
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
  `createdById` INT NOT NULL,
  `approvedById` INT NULL,
  `orderId` INT NULL,
  UNIQUE INDEX `ManualOrderRequest_requestNumber_key`(`requestNumber`),
  UNIQUE INDEX `ManualOrderRequest_orderId_key`(`orderId`),
  INDEX `ManualOrderRequest_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ManualOrderRequest`
  ADD CONSTRAINT `ManualOrderRequest_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ManualOrderRequest_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ManualOrderRequest_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `ManualOrderRequest`
SET `updatedAt` = CURRENT_TIMESTAMP(3);
