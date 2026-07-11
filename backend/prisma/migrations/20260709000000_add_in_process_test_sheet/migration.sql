-- CreateTable
CREATE TABLE `InProcessTestSheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productionId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `batchNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InProcessTestSheet_productionId_key`(`productionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InProcessTestSheetItem` (
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

-- AddForeignKey
ALTER TABLE `InProcessTestSheet` ADD CONSTRAINT `InProcessTestSheet_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InProcessTestSheetItem` ADD CONSTRAINT `InProcessTestSheetItem_inProcessTestSheetId_fkey` FOREIGN KEY (`inProcessTestSheetId`) REFERENCES `InProcessTestSheet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
