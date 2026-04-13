SET @db = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Dispatch' AND COLUMN_NAME = 'dispatchedQuantity'
    ),
    'SELECT 1',
    'ALTER TABLE `Dispatch` ADD COLUMN `dispatchedQuantity` INTEGER NOT NULL DEFAULT 0'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `Dispatch` d
JOIN `Order` o ON o.id = d.orderId
SET d.dispatchedQuantity = CASE
  WHEN d.shipmentStatus = 'PACKING' AND d.packingDone = FALSE THEN 0
  ELSE o.quantity
END
WHERE d.dispatchedQuantity = 0;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Dispatch' AND INDEX_NAME = 'Dispatch_orderId_idx'
    ),
    'SELECT 1',
    'CREATE INDEX `Dispatch_orderId_idx` ON `Dispatch` (`orderId`)'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'Dispatch'
        AND INDEX_NAME = 'Dispatch_orderId_key'
        AND NON_UNIQUE = 0
    ),
    'ALTER TABLE `Dispatch` DROP INDEX `Dispatch_orderId_key`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
