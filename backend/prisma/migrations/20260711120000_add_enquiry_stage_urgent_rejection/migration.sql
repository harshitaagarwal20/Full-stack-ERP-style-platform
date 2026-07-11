-- Enquiries gain a sales "stage" (General → Sampled → Quoted) that tracks how
-- far a lead has progressed. This is deliberately separate from `status`, which
-- still drives the approval workflow (Pending/Accepted/Hold/Rejected), so the
-- existing approval chain keeps working unchanged.
ALTER TABLE `Enquiry`
  ADD COLUMN `stage` ENUM('GENERAL', 'SAMPLED', 'QUOTED') NOT NULL DEFAULT 'GENERAL';

-- Stamped the first time an enquiry enters SAMPLED. The 12-day follow-up
-- reminder is measured from this, not from createdAt, so re-sampling an old
-- enquiry doesn't fire a stale reminder.
ALTER TABLE `Enquiry`
  ADD COLUMN `sampledAt` DATETIME(3) NULL;

-- Urgent enquiries jump the production queue and can auto-create the
-- downstream order + production job on creation.
ALTER TABLE `Enquiry`
  ADD COLUMN `isUrgent` BOOLEAN NOT NULL DEFAULT false;

-- Reason captured when an enquiry is rejected at approval.
ALTER TABLE `Enquiry`
  ADD COLUMN `rejectionReason` VARCHAR(191) NULL;

-- Urgency is copied onto the Order because production sorts by order, and
-- manual orders have no source enquiry to read urgency from.
ALTER TABLE `Order`
  ADD COLUMN `isUrgent` BOOLEAN NOT NULL DEFAULT false;
