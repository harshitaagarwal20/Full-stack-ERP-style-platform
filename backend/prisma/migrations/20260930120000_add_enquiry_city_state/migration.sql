-- City and state on the enquiry, captured for domestic enquiries (the
-- international form uses country and port instead).

ALTER TABLE `Enquiry` ADD COLUMN `city` VARCHAR(191) NULL AFTER `port`;
ALTER TABLE `Enquiry` ADD COLUMN `state` VARCHAR(191) NULL AFTER `city`;
