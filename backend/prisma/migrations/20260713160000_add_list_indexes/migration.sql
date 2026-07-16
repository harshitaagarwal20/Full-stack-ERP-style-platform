-- Indexes for the columns the list screens actually filter and sort by.
--
-- Before this, `SELECT ... FROM `Order` WHERE status=? ORDER BY status, createdAt`
-- reported type=ALL, key=NULL, "Using where; Using filesort" — a full table scan
-- plus an in-memory sort on every page load. Harmless at 30 rows, crippling at
-- 10,000, and worst of all on a phone.
--
-- Composite (status, createdAt) serves both the status filter and the sort in one
-- index; the single-column date indexes serve the day/month filters.

CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);
CREATE INDEX `Order_orderDate_idx` ON `Order`(`orderDate`);
CREATE INDEX `Order_deliveryDate_idx` ON `Order`(`deliveryDate`);

CREATE INDEX `Enquiry_status_createdAt_idx` ON `Enquiry`(`status`, `createdAt`);
CREATE INDEX `Enquiry_stage_idx` ON `Enquiry`(`stage`);
CREATE INDEX `Enquiry_enquiryDate_idx` ON `Enquiry`(`enquiryDate`);
CREATE INDEX `Enquiry_expectedTimeline_idx` ON `Enquiry`(`expectedTimeline`);

CREATE INDEX `Production_status_createdAt_idx` ON `Production`(`status`, `createdAt`);
CREATE INDEX `Production_createdAt_idx` ON `Production`(`createdAt`);

-- The ledger is the fastest-growing table in the system. Production consumption
-- reversal and finished-goods sync both look rows up by `reference`, and the
-- stock register scans by date.
CREATE INDEX `InventoryTransaction_reference_idx` ON `InventoryTransaction`(`reference`);
CREATE INDEX `InventoryTransaction_createdAt_idx` ON `InventoryTransaction`(`createdAt`);
CREATE INDEX `InventoryTransaction_type_createdAt_idx` ON `InventoryTransaction`(`type`, `createdAt`);

CREATE INDEX `PurchaseOrder_orderDate_idx` ON `PurchaseOrder`(`orderDate`);
