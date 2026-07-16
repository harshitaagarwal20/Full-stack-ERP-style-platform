-- Brings the database in line with the client-approved Enquiry → Dispatch flow.
-- Four changes, all additive: no existing row changes meaning, and every new
-- column defaults to the behaviour the system had before.
--
--  1. REWORK on a production batch — where a batch goes when a quality check
--     rejects it (in-process or finished goods).
--  2. The in-process test sheet gains its own PASS/FAIL, making the
--     "quality check in between project" a real gate rather than a log.
--  3. Payment on the order — accounts records what has been received, and that
--     is what finally completes a dispatched order.
--  4. REJECTED on a goods receipt — a consignment whose raw material test
--     failed is turned away and can never be confirmed into inventory.

-- 1. Production batches can be sent back for rework.
ALTER TABLE `Production`
  MODIFY COLUMN `status` ENUM('PENDING', 'IN_PROGRESS', 'PARTIALLY_PRODUCED', 'HOLD', 'REWORK', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

-- 2. The in-process test sheet becomes a quality gate.
--    Existing sheets default to PENDING, which keeps them exactly what they were
--    before: a running log that gates nothing.
ALTER TABLE `InProcessTestSheet`
  ADD COLUMN `overallResult` ENUM('PENDING', 'PASS', 'FAIL') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `approvedBy` VARCHAR(191) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL;

-- 3. Payment on the order.
--    Every existing order starts at PENDING. Orders already COMPLETED stay
--    COMPLETED — the new rule only governs orders dispatched from here on.
ALTER TABLE `Order`
  ADD COLUMN `paymentStatus` ENUM('PENDING', 'PARTIAL', 'RECEIVED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `amountReceived` DOUBLE NULL,
  ADD COLUMN `paymentReceivedAt` DATETIME(3) NULL,
  ADD COLUMN `paymentRemarks` VARCHAR(191) NULL;

-- 4. A goods receipt can be rejected outright on a failed raw material test.
ALTER TABLE `GoodsReceiptNote`
  MODIFY COLUMN `status` ENUM('DRAFT', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `rejectionReason` VARCHAR(191) NULL,
  ADD COLUMN `rejectedAt` DATETIME(3) NULL;
