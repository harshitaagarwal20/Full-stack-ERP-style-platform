-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'sales', 'production', 'dispatch') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `expectedTimeline` VARCHAR(191) NOT NULL,
    `assignedPerson` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'HOLD', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enquiryId` INTEGER NOT NULL,
    `salesOrderNumber` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
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
    `status` ENUM('CREATED', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED') NOT NULL DEFAULT 'CREATED',
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,

    UNIQUE INDEX `Order_enquiryId_key`(`enquiryId`),
    UNIQUE INDEX `Order_salesOrderNumber_key`(`salesOrderNumber`),
    UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Production` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
    `assignedPersonnel` VARCHAR(191) NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `productSpecs` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `particleSize` VARCHAR(191) NOT NULL,
    `acmRpm` INTEGER NOT NULL,
    `classifierRpm` INTEGER NOT NULL,
    `blowerRpm` INTEGER NOT NULL,
    `rawMaterials` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `productionCompletionDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Production_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `dispatchDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `packingDone` BOOLEAN NOT NULL,
    `shipmentStatus` ENUM('PACKING', 'SHIPPED', 'DELIVERED') NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Dispatch_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_enquiryId_fkey` FOREIGN KEY (`enquiryId`) REFERENCES `Enquiry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Production` ADD CONSTRAINT `Production_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dispatch` ADD CONSTRAINT `Dispatch_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

