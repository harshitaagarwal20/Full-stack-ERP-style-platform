-- Admin-editable module access per role. Rows are seeded from the previously
-- hard-coded route role lists on first boot (see config/permissions.js), so
-- behaviour is unchanged until an admin edits something.
CREATE TABLE IF NOT EXISTS `RolePermission` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` ENUM('admin', 'sales', 'production', 'dispatch', 'purchase', 'accounts') NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `level` ENUM('NONE', 'VIEW', 'FULL') NOT NULL DEFAULT 'NONE',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RolePermission_role_module_key` (`role`, `module`),
  KEY `RolePermission_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
