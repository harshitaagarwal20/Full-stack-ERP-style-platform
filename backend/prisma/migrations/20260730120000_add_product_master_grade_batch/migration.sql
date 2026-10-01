-- Grade and batch number on the product master.
--
-- Grade is part of a row's identity: a plant stocks one product in several
-- grades and each grade is its own master row, so the unique key moves from
-- (productName) to (productName, grade). It is NOT NULL DEFAULT '' rather than
-- nullable because MySQL counts NULLs in a unique key as distinct, which would
-- let unlimited un-graded duplicates of one product back in.
--
-- Existing rows all take grade '', so (productName, '') is exactly as unique as
-- (productName) already was — the key swap cannot fail on duplicate data. The
-- composite key goes on before the old one comes off, so the table is never
-- left without a uniqueness guard.

ALTER TABLE `ProductMaster` ADD COLUMN `grade` VARCHAR(100) NOT NULL DEFAULT '' AFTER `productName`;
ALTER TABLE `ProductMaster` ADD COLUMN `batchNo` VARCHAR(80) NULL AFTER `grade`;

ALTER TABLE `ProductMaster` ADD UNIQUE KEY `ProductMaster_productName_grade_key` (`productName`, `grade`);
ALTER TABLE `ProductMaster` DROP INDEX `ProductMaster_productName_key`;
