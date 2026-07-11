-- CreateTable
CREATE TABLE `FinishedGoodsTestSheet` (
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
CREATE TABLE `FinishedGoodsTestSheetItem` (
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
    `remarks` VARCHAR(191) NULL,

    INDEX `FinishedGoodsTestSheetItem_sheetId_idx`(`sheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FinishedGoodsTestSheet` ADD CONSTRAINT `FinishedGoodsTestSheet_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsTestSheetItem` ADD CONSTRAINT `FinishedGoodsTestSheetItem_sheetId_fkey` FOREIGN KEY (`sheetId`) REFERENCES `FinishedGoodsTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
