-- CreateTable
CREATE TABLE `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_name_key`(`name`),
    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `poNumber` VARCHAR(191) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDeliveryDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_poNumber_key`(`poNumber`),
    INDEX `PurchaseOrder_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uniqueKey` VARCHAR(191) NOT NULL,
    `poId` INTEGER NOT NULL,
    `poNumber` VARCHAR(191) NOT NULL,
    `supplier` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `uom` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL,
    `receivedQty` INTEGER NOT NULL DEFAULT 0,
    `outwardKey` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PurchaseOrderItem_uniqueKey_key`(`uniqueKey`),
    INDEX `PurchaseOrderItem_poId_idx`(`poId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceiptNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grnNumber` VARCHAR(191) NOT NULL,
    `poId` INTEGER NOT NULL,
    `receivedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoodsReceiptNote_grnNumber_key`(`grnNumber`),
    INDEX `GoodsReceiptNote_poId_idx`(`poId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceiptNote` ADD CONSTRAINT `GoodsReceiptNote_poId_fkey` FOREIGN KEY (`poId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
