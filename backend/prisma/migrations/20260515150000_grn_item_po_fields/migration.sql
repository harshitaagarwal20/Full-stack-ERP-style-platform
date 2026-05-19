-- Add PO item fields to GrnItem so each GRN line carries its own copy of the item details
ALTER TABLE `GrnItem`
  ADD COLUMN `category`         VARCHAR(191)  NULL AFTER `itemId`,
  ADD COLUMN `grade`            VARCHAR(191)  NULL AFTER `category`,
  ADD COLUMN `uom`              VARCHAR(191)  NULL AFTER `grade`,
  ADD COLUMN `currency`         VARCHAR(191)  NULL AFTER `uom`,
  ADD COLUMN `unitPrice`        DOUBLE        NULL AFTER `currency`,
  ADD COLUMN `taxPercent`       DOUBLE        NULL AFTER `unitPrice`,
  ADD COLUMN `batchNo`          VARCHAR(191)  NULL AFTER `taxPercent`;
