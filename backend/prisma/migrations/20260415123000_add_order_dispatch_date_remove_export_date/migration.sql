ALTER TABLE `Order`
  ADD COLUMN `dispatchDate` DATETIME(3) NULL,
  DROP COLUMN `exportDate`;
