-- AlterTable
ALTER TABLE `InventoryTransaction`
    ADD COLUMN `batchNo` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `InventoryTransaction_itemId_batchNo_idx` ON `InventoryTransaction`(`itemId`, `batchNo`);

-- CreateTable
CREATE TABLE `BatchSubstitution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productionId` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `originalItemId` VARCHAR(191) NOT NULL,
    `originalBatchNo` VARCHAR(191) NOT NULL,
    `originalVendor` VARCHAR(191) NULL,
    `originalGrade` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `substituteItemId` VARCHAR(191) NOT NULL,
    `substituteBatchNo` VARCHAR(191) NOT NULL,
    `substituteVendor` VARCHAR(191) NULL,
    `substituteGrade` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `reversalTransactionId` INTEGER NOT NULL,
    `consumptionTransactionId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BatchSubstitution_reversalTransactionId_key`(`reversalTransactionId`),
    UNIQUE INDEX `BatchSubstitution_consumptionTransactionId_key`(`consumptionTransactionId`),
    INDEX `BatchSubstitution_productionId_idx`(`productionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_productionId_fkey` FOREIGN KEY (`productionId`) REFERENCES `Production`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_reversalTransactionId_fkey` FOREIGN KEY (`reversalTransactionId`) REFERENCES `InventoryTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_consumptionTransactionId_fkey` FOREIGN KEY (`consumptionTransactionId`) REFERENCES `InventoryTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSubstitution` ADD CONSTRAINT `BatchSubstitution_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
