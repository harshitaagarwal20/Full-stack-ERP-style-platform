-- Adds the `purchase` (raises PO items, no pricing) and `accounts` (owns
-- pricing, releases the PO to the supplier) roles.
ALTER TABLE `User`
  MODIFY `role` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NOT NULL;

-- AuditLog.actorRole mirrors Role, so it has to accept the new values too or
-- audit writes by a purchase/accounts user will fail.
ALTER TABLE `AuditLog`
  MODIFY `actorRole` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NULL;
