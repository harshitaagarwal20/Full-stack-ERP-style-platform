-- Quantities are weights (10.5 T is a legitimate order), not counts. Enquiry
-- quantity was already a Float, so an accepted enquiry silently truncated its
-- decimal on the way into the order. Widen the rest of the chain to match.
ALTER TABLE `Order`             MODIFY `quantity` DOUBLE NOT NULL;
ALTER TABLE `ManualOrderRequest` MODIFY `quantity` DOUBLE NOT NULL;
ALTER TABLE `Production`        MODIFY `capacity` DOUBLE NOT NULL;
ALTER TABLE `Production`        MODIFY `producedQuantity` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `Dispatch`          MODIFY `dispatchedQuantity` DOUBLE NOT NULL;
ALTER TABLE `BatchSubstitution` MODIFY `quantity` DOUBLE NOT NULL;
