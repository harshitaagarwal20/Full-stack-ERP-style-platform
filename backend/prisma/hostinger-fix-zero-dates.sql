-- ============================================================
-- Nimbasia ERP — repair invalid (zero) dates in a LIVE database.
--
-- MySQL zero dates (0000-00-00 00:00:00) crash the Prisma mariadb
-- driver adapter (RangeError: Invalid time value in mapRow), which
-- surfaces as HTTP 500 on any endpoint that reads the bad row.
-- They typically come from restoring an old backup or from
-- ADD COLUMN ... NOT NULL filling existing rows with zeros.
--
-- For every datetime/timestamp/date column in the schema:
--   * nullable column    -> zero date becomes NULL (value was never real)
--   * NOT NULL updatedAt -> takes createdAt when valid, else NOW()
--   * other NOT NULL     -> becomes NOW()
-- Idempotent and safe to re-run: only rows with invalid dates change.
-- BACK UP FIRST anyway: mysqldump -u USER -p DBNAME > backup.sql
-- ============================================================

-- AuditLog
UPDATE `AuditLog` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');

-- BatchSubstitution
UPDATE `BatchSubstitution` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');

-- BillOfMaterial
UPDATE `BillOfMaterial` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `BillOfMaterial` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- Customer
UPDATE `Customer` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Customer` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- CustomerAddress
UPDATE `CustomerAddress` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `CustomerAddress` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- CustomerMaster
UPDATE `CustomerMaster` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `CustomerMaster` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- Dispatch
UPDATE `Dispatch` SET `dispatchDate` = NOW() WHERE (CAST(`dispatchDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Dispatch` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');

-- Enquiry
UPDATE `Enquiry` SET `enquiryDate` = NULL WHERE (CAST(`enquiryDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`enquiryDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`enquiryDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`enquiryDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Enquiry` SET `expectedTimeline` = NULL WHERE (CAST(`expectedTimeline` AS CHAR(23)) LIKE '0000-%' OR CAST(`expectedTimeline` AS CHAR(23)) LIKE '%-00-%' OR CAST(`expectedTimeline` AS CHAR(23)) LIKE '%-00 %' OR CAST(`expectedTimeline` AS CHAR(23)) LIKE '%-00');
UPDATE `Enquiry` SET `sampledAt` = NULL WHERE (CAST(`sampledAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`sampledAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`sampledAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`sampledAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Enquiry` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Enquiry` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- EnquiryMaster
UPDATE `EnquiryMaster` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `EnquiryMaster` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- FinishedGoodsTestSheet
UPDATE `FinishedGoodsTestSheet` SET `approvedAt` = NULL WHERE (CAST(`approvedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00');
UPDATE `FinishedGoodsTestSheet` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `FinishedGoodsTestSheet` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- FinishedGoodsTestSheetItem
UPDATE `FinishedGoodsTestSheetItem` SET `sampleDate` = NULL WHERE (CAST(`sampleDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`sampleDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`sampleDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`sampleDate` AS CHAR(23)) LIKE '%-00');

-- GoodsReceiptNote
UPDATE `GoodsReceiptNote` SET `receivedDate` = NOW() WHERE (CAST(`receivedDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`receivedDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`receivedDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`receivedDate` AS CHAR(23)) LIKE '%-00');
UPDATE `GoodsReceiptNote` SET `rejectedAt` = NULL WHERE (CAST(`rejectedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`rejectedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`rejectedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`rejectedAt` AS CHAR(23)) LIKE '%-00');
UPDATE `GoodsReceiptNote` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `GoodsReceiptNote` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- InProcessTestSheet
UPDATE `InProcessTestSheet` SET `approvedAt` = NULL WHERE (CAST(`approvedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00');
UPDATE `InProcessTestSheet` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `InProcessTestSheet` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- InProcessTestSheetItem
UPDATE `InProcessTestSheetItem` SET `analysisDate` = NULL WHERE (CAST(`analysisDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00');

-- InventoryTransaction
UPDATE `InventoryTransaction` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');

-- ManualOrderRequest
UPDATE `ManualOrderRequest` SET `dispatchDate` = NULL WHERE (CAST(`dispatchDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00');
UPDATE `ManualOrderRequest` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `ManualOrderRequest` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- MasterDataItem
UPDATE `MasterDataItem` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `MasterDataItem` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- Order
UPDATE `Order` SET `deliveryDate` = NOW() WHERE (CAST(`deliveryDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Order` SET `dispatchDate` = NULL WHERE (CAST(`dispatchDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`dispatchDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Order` SET `paymentReceivedAt` = NULL WHERE (CAST(`paymentReceivedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`paymentReceivedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`paymentReceivedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`paymentReceivedAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Order` SET `orderDate` = NOW() WHERE (CAST(`orderDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Order` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Order` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- PackingRecord
UPDATE `PackingRecord` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');

-- Production
UPDATE `Production` SET `deliveryDate` = NOW() WHERE (CAST(`deliveryDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`deliveryDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Production` SET `productionStartedDate` = NULL WHERE (CAST(`productionStartedDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`productionStartedDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`productionStartedDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`productionStartedDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Production` SET `productionCompletionDate` = NULL WHERE (CAST(`productionCompletionDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`productionCompletionDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`productionCompletionDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`productionCompletionDate` AS CHAR(23)) LIKE '%-00');
UPDATE `Production` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Production` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- ProductMaster
UPDATE `ProductMaster` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `ProductMaster` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- PurchaseOrder
UPDATE `PurchaseOrder` SET `orderDate` = NOW() WHERE (CAST(`orderDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`orderDate` AS CHAR(23)) LIKE '%-00');
UPDATE `PurchaseOrder` SET `expectedDeliveryDate` = NULL WHERE (CAST(`expectedDeliveryDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`expectedDeliveryDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`expectedDeliveryDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`expectedDeliveryDate` AS CHAR(23)) LIKE '%-00');
UPDATE `PurchaseOrder` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `PurchaseOrder` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- PurchaseOrderItem
UPDATE `PurchaseOrderItem` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `PurchaseOrderItem` SET `receivedAt` = NULL WHERE (CAST(`receivedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`receivedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`receivedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`receivedAt` AS CHAR(23)) LIKE '%-00');

-- QcTestSheet
UPDATE `QcTestSheet` SET `approvedAt` = NULL WHERE (CAST(`approvedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`approvedAt` AS CHAR(23)) LIKE '%-00');
UPDATE `QcTestSheet` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `QcTestSheet` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- QcTestSheetItem
UPDATE `QcTestSheetItem` SET `samplingDate` = NULL WHERE (CAST(`samplingDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`samplingDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`samplingDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`samplingDate` AS CHAR(23)) LIKE '%-00');
UPDATE `QcTestSheetItem` SET `mfgDate` = NULL WHERE (CAST(`mfgDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`mfgDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`mfgDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`mfgDate` AS CHAR(23)) LIKE '%-00');
UPDATE `QcTestSheetItem` SET `expiryDate` = NULL WHERE (CAST(`expiryDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`expiryDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`expiryDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`expiryDate` AS CHAR(23)) LIKE '%-00');
UPDATE `QcTestSheetItem` SET `analysisDate` = NULL WHERE (CAST(`analysisDate` AS CHAR(23)) LIKE '0000-%' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00-%' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00 %' OR CAST(`analysisDate` AS CHAR(23)) LIKE '%-00');

-- RolePermission
UPDATE `RolePermission` SET `updatedAt` = NOW() WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- Supplier
UPDATE `Supplier` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `Supplier` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- SupplierMaster
UPDATE `SupplierMaster` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `SupplierMaster` SET `updatedAt` = IF((CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00'), NOW(), `createdAt`) WHERE (CAST(`updatedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`updatedAt` AS CHAR(23)) LIKE '%-00');

-- User
UPDATE `User` SET `createdAt` = NOW() WHERE (CAST(`createdAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`createdAt` AS CHAR(23)) LIKE '%-00');
UPDATE `User` SET `passwordChangedAt` = NULL WHERE (CAST(`passwordChangedAt` AS CHAR(23)) LIKE '0000-%' OR CAST(`passwordChangedAt` AS CHAR(23)) LIKE '%-00-%' OR CAST(`passwordChangedAt` AS CHAR(23)) LIKE '%-00 %' OR CAST(`passwordChangedAt` AS CHAR(23)) LIKE '%-00');
