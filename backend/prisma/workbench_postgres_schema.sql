-- FMS schema-only script for PostgreSQL
-- Connect to database fms_db before running this file

CREATE TYPE "Role" AS ENUM ('admin', 'sales', 'production', 'dispatch');
CREATE TYPE "EnquiryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'HOLD', 'REJECTED');
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED');
CREATE TYPE "ProductionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "Unit" AS ENUM ('KG', 'MT', 'LTR');
CREATE TYPE "ShipmentStatus" AS ENUM ('PACKING', 'SHIPPED', 'DELIVERED');

CREATE TABLE "User" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Enquiry" (
  "id" SERIAL PRIMARY KEY,
  "companyName" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "expectedTimeline" TEXT NOT NULL,
  "assignedPerson" TEXT NOT NULL,
  "remarks" TEXT,
  "status" "EnquiryStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER NOT NULL,
  "approvedById" INTEGER
);

CREATE TABLE "Order" (
  "id" SERIAL PRIMARY KEY,
  "enquiryId" INTEGER NOT NULL UNIQUE,
  "salesOrderNumber" TEXT NOT NULL UNIQUE,
  "orderNo" TEXT NOT NULL UNIQUE,
  "product" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit" "Unit" NOT NULL,
  "packingType" TEXT NOT NULL,
  "packingSize" TEXT NOT NULL,
  "deliveryDate" TIMESTAMP(3) NOT NULL,
  "clientName" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "pincode" TEXT,
  "state" TEXT,
  "countryCode" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER NOT NULL
);

CREATE TABLE "Production" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL UNIQUE,
  "status" "ProductionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "assignedPersonnel" TEXT NOT NULL,
  "deliveryDate" TIMESTAMP(3) NOT NULL,
  "productSpecs" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "particleSize" TEXT NOT NULL,
  "acmRpm" INTEGER NOT NULL,
  "classifierRpm" INTEGER NOT NULL,
  "blowerRpm" INTEGER NOT NULL,
  "rawMaterials" TEXT NOT NULL,
  "remarks" TEXT,
  "productionCompletionDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Dispatch" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL UNIQUE,
  "dispatchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "packingDone" BOOLEAN NOT NULL,
  "shipmentStatus" "ShipmentStatus" NOT NULL,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Enquiry"
  ADD CONSTRAINT "Enquiry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enquiry"
  ADD CONSTRAINT "Enquiry_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_enquiryId_fkey"
  FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Production"
  ADD CONSTRAINT "Production_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispatch"
  ADD CONSTRAINT "Dispatch_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Enquiry_createdById_idx" ON "Enquiry" ("createdById");
CREATE INDEX "Enquiry_approvedById_idx" ON "Enquiry" ("approvedById");
CREATE INDEX "Order_createdById_idx" ON "Order" ("createdById");

