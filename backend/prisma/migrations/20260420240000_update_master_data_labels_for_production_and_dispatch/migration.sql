CREATE TABLE IF NOT EXISTS `MasterDataItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(100) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MasterDataItem_category_value_key` (`category`, `value`),
  KEY `MasterDataItem_category_sortOrder_idx` (`category`, `sortOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `MasterDataItem` (`category`, `value`, `label`, `sortOrder`, `isActive`)
VALUES
  ('productionStatuses', 'PENDING', 'Not Started', 1, 1),
  ('productionStatuses', 'IN_PROGRESS', 'Started', 2, 1),
  ('productionStatuses', 'HOLD', 'Hold', 3, 1),
  ('productionStatuses', 'COMPLETED', 'Completed', 4, 1),
  ('shipmentStatuses', 'PACKING', 'Packed', 1, 1),
  ('shipmentStatuses', 'SHIPPED', 'Dispatched', 2, 1),
  ('shipmentStatuses', 'DELIVERED', 'Delivered', 3, 1)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `sortOrder` = VALUES(`sortOrder`),
  `isActive` = 1;
