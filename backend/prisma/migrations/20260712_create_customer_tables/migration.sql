-- Table names here must match the model names in schema.prisma exactly
-- (`Customer`, `CustomerAddress`, `Order`, `Enquiry`, `ManualOrderRequest`) —
-- none of those models declare an @@map, so Prisma queries them PascalCase.
-- Lowercase/snake_case names only appear to work on Windows or macOS, where
-- MySQL runs with lower_case_table_names=1 and folds identifiers; on a Linux
-- server (lower_case_table_names=0) the names are compared literally and every
-- query against them fails.

-- CreateTable Customer
CREATE TABLE `Customer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Customer_name_key`(`name`),
    INDEX `Customer_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CustomerAddress
CREATE TABLE `CustomerAddress` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `customerId` INT NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `CustomerAddress_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CustomerAddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable Order
ALTER TABLE `Order` ADD COLUMN `customerId` INT NULL;
ALTER TABLE `Order` ADD COLUMN `customerAddressId` INT NULL;
ALTER TABLE `Order` ADD INDEX `Order_customerId_idx`(`customerId`);
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL;

-- AlterTable Enquiry
ALTER TABLE `Enquiry` ADD COLUMN `customerId` INT NULL;
ALTER TABLE `Enquiry` ADD COLUMN `customerAddressId` INT NULL;
ALTER TABLE `Enquiry` ADD INDEX `Enquiry_customerId_idx`(`customerId`);
ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL;

-- AlterTable ManualOrderRequest
-- schema.prisma declares customerId/customerAddressId on ManualOrderRequest, so
-- these columns have to exist too: approving a request runs a bare
-- manualOrderRequest.update() (no select), which makes Prisma read every scalar
-- column and fail with P2022 if they are missing.
ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerId` INT NULL;
ALTER TABLE `ManualOrderRequest` ADD COLUMN `customerAddressId` INT NULL;
ALTER TABLE `ManualOrderRequest` ADD INDEX `ManualOrderRequest_customerId_idx`(`customerId`);
ALTER TABLE `ManualOrderRequest` ADD CONSTRAINT `ManualOrderRequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL;
