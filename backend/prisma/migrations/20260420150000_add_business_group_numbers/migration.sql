ALTER TABLE `Enquiry`
  ADD COLUMN `enquiryNumber` VARCHAR(191) NULL AFTER `id`;

ALTER TABLE `Order`
  ADD COLUMN `salesGroupNumber` VARCHAR(191) NULL AFTER `enquiryId`;

UPDATE `Enquiry`
SET `enquiryNumber` = CONCAT('ENQ-', LPAD(`id`, 6, '0'))
WHERE `enquiryNumber` IS NULL;

UPDATE `Order`
SET `salesGroupNumber` = `salesOrderNumber`
WHERE `salesGroupNumber` IS NULL;
