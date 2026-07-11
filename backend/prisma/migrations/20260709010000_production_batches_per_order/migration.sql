-- Allow an Order to have multiple Production batches instead of exactly one.
-- CreateIndex (added first so the FK on orderId still has a backing index once the unique index below is dropped)
CREATE INDEX `Production_orderId_idx` ON `Production`(`orderId`);

-- DropIndex
DROP INDEX `Production_orderId_key` ON `Production`;
