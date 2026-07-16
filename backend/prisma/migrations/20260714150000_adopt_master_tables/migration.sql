-- Brings the five master tables under Prisma's control.
--
-- They already exist on every running database: masterDataService creates them
-- with raw DDL on the first master-data request after boot. But they were absent
-- from schema.prisma, so Prisma believed they were junk — and `prisma migrate
-- dev` would have generated a migration that DROPPED all five, destroying the
-- customer master, the supplier master, the product master, and every dropdown
-- list in the app.
--
-- Declaring the models and adopting the tables here closes that hole. Every
-- statement is IF NOT EXISTS, so this migration:
--   * is a no-op on an existing database (the tables are already there), and
--   * creates them properly on a fresh one, which is what makes the schema and
--     the database agree from now on.
--
-- The DDL below is copied from the live tables, so adoption changes nothing.

CREATE TABLE IF NOT EXISTS `MasterDataItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(100) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MasterDataItem_category_value_key` (`category`, `value`),
  KEY `MasterDataItem_category_sortOrder_idx` (`category`, `sortOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EnquiryMaster` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `modeOfEnquiry` VARCHAR(191) NOT NULL,
  `companyName` VARCHAR(191) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `assignedPerson` VARCHAR(191) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `EnquiryMaster_unique_key` (`modeOfEnquiry`, `companyName`, `product`, `assignedPerson`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CustomerMaster` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerName` VARCHAR(191) NOT NULL,
  `gstn` VARCHAR(50) NULL,
  `country` VARCHAR(100) NULL,
  `countryCode` VARCHAR(20) NULL,
  `custInitials` VARCHAR(20) NULL,
  `sNoCode` VARCHAR(50) NULL,
  `customerCode` VARCHAR(80) NULL,
  `contactPerson` VARCHAR(191) NULL,
  `contactPersonNumber` VARCHAR(30) NULL,
  `companyEmail` VARCHAR(191) NULL,
  `address` VARCHAR(500) NULL,
  `pincode` VARCHAR(20) NULL,
  `state` VARCHAR(100) NULL,
  `city` VARCHAR(100) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerMaster_customerCode_key` (`customerCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupplierMaster` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `supplierName` VARCHAR(191) NOT NULL,
  `gstn` VARCHAR(50) NULL,
  `panNo` VARCHAR(20) NULL,
  `country` VARCHAR(100) NULL,
  `countryCode` VARCHAR(20) NULL,
  `supplierCode` VARCHAR(80) NULL,
  `contactPerson` VARCHAR(191) NULL,
  `contactPersonNumber` VARCHAR(30) NULL,
  `companyEmail` VARCHAR(191) NULL,
  `address` VARCHAR(500) NULL,
  `pincode` VARCHAR(20) NULL,
  `state` VARCHAR(100) NULL,
  `city` VARCHAR(100) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SupplierMaster_supplierCode_key` (`supplierCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductMaster` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `productName` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NULL,
  `defaultUnit` VARCHAR(20) NULL,
  `hsnCode` VARCHAR(30) NULL,
  `description` VARCHAR(500) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ProductMaster_productName_key` (`productName`),
  KEY `ProductMaster_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
