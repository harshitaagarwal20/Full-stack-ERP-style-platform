-- The purchase and accounts roles were seeded with no master_data access at all
-- (level NONE). But the purchase-order form — the one screen those two roles
-- exist to use — populates its item picker (finished goods, raw materials,
-- packing materials) and its unit-of-measurement dropdown from master data.
-- With NONE, GET /api/master-data returns 403 and those dropdowns come up empty.
--
-- The permission defaults are seeded with skipDuplicates, so correcting the
-- default in config/permissions.js does not repair a database that has already
-- been seeded. This does.
--
-- Scoped to rows still at NONE, so an admin who has deliberately raised the
-- level (e.g. to FULL) keeps their choice.
UPDATE `RolePermission`
SET `level` = 'VIEW'
WHERE `role` IN ('purchase', 'accounts')
  AND `module` = 'master_data'
  AND `level` = 'NONE';
