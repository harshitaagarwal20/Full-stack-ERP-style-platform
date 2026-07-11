-- Purchase order, GRN, and inventory quantities need to support fractional
-- amounts (e.g. 12.5 kg received against an order), not just whole units.
-- These columns were originally created as INTEGER; widen them to DOUBLE.
ALTER TABLE `PurchaseOrderItem`
  MODIFY COLUMN `qty` DOUBLE NOT NULL,
  MODIFY COLUMN `receivedQty` DOUBLE NOT NULL DEFAULT 0;

ALTER TABLE `GrnItem`
  MODIFY COLUMN `quantityOrdered` DOUBLE NOT NULL,
  MODIFY COLUMN `quantityReceived` DOUBLE NOT NULL DEFAULT 0;

ALTER TABLE `InventoryTransaction`
  MODIFY COLUMN `quantity` DOUBLE NOT NULL;
