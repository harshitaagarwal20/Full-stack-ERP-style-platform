-- Per-product remark on a production batch (each batch is a single product).
ALTER TABLE `Production` ADD COLUMN `productRemark` VARCHAR(191) NULL;
