CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `action` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` INT NULL,
  `actorId` INT NULL,
  `actorName` VARCHAR(191) NULL,
  `actorRole` VARCHAR(32) NULL,
  `oldValue` LONGTEXT NULL,
  `newValue` LONGTEXT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AuditLog_entityType_entityId_idx` (`entityType`, `entityId`),
  INDEX `AuditLog_action_createdAt_idx` (`action`, `createdAt`),
  INDEX `AuditLog_createdAt_idx` (`createdAt`),
  CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
