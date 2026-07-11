-- CreateTable
CREATE TABLE `BillOfMaterial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillOfMaterial_product_idx`(`product`),
    UNIQUE INDEX `BillOfMaterial_product_grade_key`(`product`, `grade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillOfMaterialItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bomId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `qtyPerUnit` DOUBLE NOT NULL,
    `remark` VARCHAR(191) NULL,

    INDEX `BillOfMaterialItem_bomId_idx`(`bomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BillOfMaterialItem` ADD CONSTRAINT `BillOfMaterialItem_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `BillOfMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
