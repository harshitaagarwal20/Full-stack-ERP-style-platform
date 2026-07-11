-- Packing was previously just a free "packing_done" checkbox on Dispatch
-- with no real inventory link. This table records actual packing events —
-- how much finished product was packed, and how much packing material
-- (bags/cartons) was consumed from inventory doing it — so dispatch can be
-- gated on packing having genuinely happened.
CREATE TABLE `PackingRecord` (
    `id`                    INTEGER      NOT NULL AUTO_INCREMENT,
    `orderId`               INTEGER      NOT NULL,
    `packedQuantity`        DOUBLE       NOT NULL,
    `packingMaterialItemId` VARCHAR(191) NOT NULL,
    `packingMaterialQty`    DOUBLE       NOT NULL,
    `packedBy`              VARCHAR(191) NULL,
    `remarks`               VARCHAR(191) NULL,
    `createdAt`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `PackingRecord_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PackingRecord`
  ADD CONSTRAINT `PackingRecord_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
