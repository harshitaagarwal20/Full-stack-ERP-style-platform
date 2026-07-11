/*
  Warnings:

  - You are about to alter the column `actorRole` on the `auditlog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(32)` to `Enum(EnumId(1))`.
  - You are about to alter the column `oldValue` on the `auditlog` table. The data in that column could be lost. The data in that column will be cast from `LongText` to `Json`.
  - You are about to alter the column `newValue` on the `auditlog` table. The data in that column could be lost. The data in that column will be cast from `LongText` to `Json`.
  - You are about to drop the column `enquiryReceivedBy` on the `enquiry` table. All the data in the column will be lost.
  - You are about to drop the `masterdataitem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `auditlog` DROP FOREIGN KEY `AuditLog_actorId_fkey`;

-- DropIndex
DROP INDEX `AuditLog_actorId_fkey` ON `auditlog`;

-- AlterTable
ALTER TABLE `auditlog` MODIFY `actorRole` ENUM('admin', 'sales', 'production', 'dispatch') NULL,
    MODIFY `oldValue` JSON NULL,
    MODIFY `newValue` JSON NULL;

-- AlterTable
ALTER TABLE `dispatch` ALTER COLUMN `dispatchedQuantity` DROP DEFAULT;

-- AlterTable
ALTER TABLE `enquiry` DROP COLUMN `enquiryReceivedBy`,
    MODIFY `notesForProduction` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `production` MODIFY `rawMaterials` LONGTEXT NULL;

-- DropTable
DROP TABLE `masterdataitem`;

-- CreateIndex
CREATE INDEX `User_createdAt_id_idx` ON `User`(`createdAt`, `id`);

-- CreateIndex
CREATE INDEX `User_role_createdAt_idx` ON `User`(`role`, `createdAt`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
