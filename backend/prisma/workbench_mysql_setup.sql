-- FMS setup script for MySQL 8+ (generated from prisma/schema.prisma)
-- Run in MySQL Workbench

CREATE DATABASE IF NOT EXISTS `fms_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fms_db`;

CREATE TABLE IF NOT EXISTS `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(191) NOT NULL,
  `role` ENUM('admin','sales','production','dispatch') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Enquiry` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyName` VARCHAR(191) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `quantity` INT NOT NULL,
  `expectedTimeline` VARCHAR(191) NOT NULL,
  `assignedPerson` VARCHAR(191) NOT NULL,
  `remarks` TEXT NULL,
  `status` ENUM('PENDING','ACCEPTED','HOLD','REJECTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  `approvedById` INT NULL,
  PRIMARY KEY (`id`),
  KEY `Enquiry_createdById_idx` (`createdById`),
  KEY `Enquiry_approvedById_idx` (`approvedById`),
  CONSTRAINT `Enquiry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Enquiry_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `enquiryId` INT NOT NULL,
  `salesOrderNumber` VARCHAR(191) NOT NULL,
  `orderNo` VARCHAR(191) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `grade` VARCHAR(191) NOT NULL,
  `quantity` INT NOT NULL,
  `unit` ENUM('KG','MT','LTR') NOT NULL,
  `packingType` VARCHAR(191) NOT NULL,
  `packingSize` VARCHAR(191) NOT NULL,
  `deliveryDate` DATETIME(3) NOT NULL,
  `clientName` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `pincode` VARCHAR(191) NULL,
  `state` VARCHAR(191) NULL,
  `countryCode` VARCHAR(191) NULL,
  `status` ENUM('CREATED','IN_PRODUCTION','COMPLETED','DISPATCHED') NOT NULL DEFAULT 'CREATED',
  `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Order_enquiryId_key` (`enquiryId`),
  UNIQUE KEY `Order_salesOrderNumber_key` (`salesOrderNumber`),
  UNIQUE KEY `Order_orderNo_key` (`orderNo`),
  KEY `Order_createdById_idx` (`createdById`),
  CONSTRAINT `Order_enquiryId_fkey` FOREIGN KEY (`enquiryId`) REFERENCES `Enquiry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Order_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Production` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `status` ENUM('IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  `assignedPersonnel` VARCHAR(191) NOT NULL,
  `deliveryDate` DATETIME(3) NOT NULL,
  `productSpecs` VARCHAR(191) NOT NULL,
  `capacity` INT NOT NULL,
  `particleSize` VARCHAR(191) NOT NULL,
  `acmRpm` INT NOT NULL,
  `classifierRpm` INT NOT NULL,
  `blowerRpm` INT NOT NULL,
  `rawMaterials` TEXT NOT NULL,
  `remarks` TEXT NULL,
  `productionCompletionDate` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Production_orderId_key` (`orderId`),
  CONSTRAINT `Production_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Dispatch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `dispatchDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `packingDone` BOOLEAN NOT NULL,
  `shipmentStatus` ENUM('PACKING','SHIPPED','DELIVERED') NOT NULL,
  `remarks` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Dispatch_orderId_key` (`orderId`),
  CONSTRAINT `Dispatch_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
