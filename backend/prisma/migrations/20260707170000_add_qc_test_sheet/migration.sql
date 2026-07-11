-- CreateTable
CREATE TABLE `QcTestSheet` (
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
CREATE TABLE `QcTestSheetItem` (
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

-- AddForeignKey
ALTER TABLE `QcTestSheet` ADD CONSTRAINT `QcTestSheet_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiptNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QcTestSheetItem` ADD CONSTRAINT `QcTestSheetItem_qcTestSheetId_fkey` FOREIGN KEY (`qcTestSheetId`) REFERENCES `QcTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
