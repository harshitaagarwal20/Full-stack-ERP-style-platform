-- Allow multiple manual request rows to share the same request number.
ALTER TABLE `ManualOrderRequest` DROP INDEX `ManualOrderRequest_requestNumber_key`;
CREATE INDEX `ManualOrderRequest_requestNumber_idx` ON `ManualOrderRequest`(`requestNumber`);
