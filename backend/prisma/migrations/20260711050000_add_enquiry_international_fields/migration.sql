-- Add international enquiry fields to Enquiry table
ALTER TABLE `Enquiry` ADD COLUMN `customerType` VARCHAR(191) NULL;
ALTER TABLE `Enquiry` ADD COLUMN `enquiryType` VARCHAR(191) NULL;
ALTER TABLE `Enquiry` ADD COLUMN `incoTerm` VARCHAR(191) NULL;
ALTER TABLE `Enquiry` ADD COLUMN `country` VARCHAR(191) NULL;
ALTER TABLE `Enquiry` ADD COLUMN `port` VARCHAR(191) NULL;
ALTER TABLE `Enquiry` ADD COLUMN `lastTransaction` VARCHAR(191) NULL;
