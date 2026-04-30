import prisma from "../config/prisma.js";
import { buildPagination } from "../utils/pagination.js";

const AUDIT_LOG_RETENTION_DAYS = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "30", 10);
const AUDIT_LOG_BACKUP_DAYS = Number.parseInt(process.env.AUDIT_LOG_BACKUP_DAYS || "3", 10);

const AUDIT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`AuditLog\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`action\` VARCHAR(191) NOT NULL,
    \`entityType\` VARCHAR(191) NOT NULL,
    \`entityId\` INT NULL,
    \`actorId\` INT NULL,
    \`actorName\` VARCHAR(191) NULL,
    \`actorRole\` VARCHAR(32) NULL,
    \`oldValue\` LONGTEXT NULL,
    \`newValue\` LONGTEXT NULL,
    \`note\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`AuditLog_entityType_entityId_idx\` (\`entityType\`, \`entityId\`),
    INDEX \`AuditLog_action_createdAt_idx\` (\`action\`, \`createdAt\`),
    INDEX \`AuditLog_createdAt_idx\` (\`createdAt\`),
    CONSTRAINT \`AuditLog_actorId_fkey\` FOREIGN KEY (\`actorId\`) REFERENCES \`User\` (\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const AUDIT_BACKUP_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`AuditLogBackup\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`sourceId\` INT NOT NULL,
    \`action\` VARCHAR(191) NOT NULL,
    \`entityType\` VARCHAR(191) NOT NULL,
    \`entityId\` INT NULL,
    \`actorId\` INT NULL,
    \`actorName\` VARCHAR(191) NULL,
    \`actorRole\` VARCHAR(32) NULL,
    \`oldValue\` LONGTEXT NULL,
    \`newValue\` LONGTEXT NULL,
    \`note\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL,
    \`archivedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`AuditLogBackup_sourceId_key\` (\`sourceId\`),
    INDEX \`AuditLogBackup_entityType_entityId_idx\` (\`entityType\`, \`entityId\`),
    INDEX \`AuditLogBackup_archivedAt_idx\` (\`archivedAt\`),
    INDEX \`AuditLogBackup_createdAt_idx\` (\`createdAt\`),
    CONSTRAINT \`AuditLogBackup_actorId_fkey\` FOREIGN KEY (\`actorId\`) REFERENCES \`User\` (\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

let auditTableReady;
let auditBackupTableReady;

async function ensureAuditLogTable(client = prisma, { suppressErrors = false } = {}) {
  if (!auditTableReady) {
    auditTableReady = client.$executeRawUnsafe(AUDIT_TABLE_SQL).catch((error) => {
      auditTableReady = undefined;
      throw error;
    });
  }

  try {
    await auditTableReady;
    return true;
  } catch (error) {
    if (suppressErrors) {
      console.warn("Audit log table initialization skipped:", error?.message || error);
      return false;
    }

  throw error;
  }
}

async function ensureAuditLogBackupTable(client = prisma, { suppressErrors = false } = {}) {
  if (!auditBackupTableReady) {
    auditBackupTableReady = client.$executeRawUnsafe(AUDIT_BACKUP_TABLE_SQL).catch((error) => {
      auditBackupTableReady = undefined;
      throw error;
    });
  }

  try {
    await auditBackupTableReady;
    return true;
  } catch (error) {
    if (suppressErrors) {
      console.warn("Audit backup table initialization skipped:", error?.message || error);
      return false;
    }

    throw error;
  }
}

function toJsonString(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function parseJsonString(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeAuditRow(row) {
  return {
    ...row,
    actor: row.actorId
      ? {
          id: row.actorId,
          name: row.actorName,
          role: row.actorRole
        }
      : null,
    oldValue: parseJsonString(row.oldValue),
    newValue: parseJsonString(row.newValue)
  };
}

function toRetentionDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function cleanupAuditLogRetention(client = prisma, { suppressErrors = false } = {}) {
  const tablesReady = await Promise.all([
    ensureAuditLogTable(client, { suppressErrors }),
    ensureAuditLogBackupTable(client, { suppressErrors })
  ]);

  if (tablesReady.some((ready) => !ready)) {
    return {
      archivedCount: 0,
      deletedCount: 0,
      prunedBackupCount: 0
    };
  }

  const result = {
    archivedCount: 0,
    deletedCount: 0,
    prunedBackupCount: 0
  };

  if (Number.isInteger(AUDIT_LOG_RETENTION_DAYS) && AUDIT_LOG_RETENTION_DAYS > 0) {
    const auditCutoff = toRetentionDate(AUDIT_LOG_RETENTION_DAYS);
    result.archivedCount = await client.$executeRawUnsafe(
      `INSERT IGNORE INTO \`AuditLogBackup\` (\`sourceId\`, \`action\`, \`entityType\`, \`entityId\`, \`actorId\`, \`actorName\`, \`actorRole\`, \`oldValue\`, \`newValue\`, \`note\`, \`createdAt\`)
       SELECT \`id\`, \`action\`, \`entityType\`, \`entityId\`, \`actorId\`, \`actorName\`, \`actorRole\`, \`oldValue\`, \`newValue\`, \`note\`, \`createdAt\`
       FROM \`AuditLog\`
       WHERE \`createdAt\` < ?`,
      auditCutoff
    );

    result.deletedCount = await client.$executeRawUnsafe(
      "DELETE FROM `AuditLog` WHERE `createdAt` < ?",
      auditCutoff
    );
  }

  if (Number.isInteger(AUDIT_LOG_BACKUP_DAYS) && AUDIT_LOG_BACKUP_DAYS > 0) {
    const backupCutoff = toRetentionDate(AUDIT_LOG_BACKUP_DAYS);
    result.prunedBackupCount = await client.$executeRawUnsafe(
      "DELETE FROM `AuditLogBackup` WHERE `archivedAt` < ?",
      backupCutoff
    );
  }

  return result;
}

function buildAuditWhere(filters = {}) {
  const clauses = [];
  const params = [];
  const { q, action, entityType } = filters;

  if (action) {
    clauses.push("`action` = ?");
    params.push(action);
  }

  if (entityType) {
    clauses.push("`entityType` = ?");
    params.push(entityType);
  }

  const query = String(q || "").trim();
  if (query) {
    const numericEntityId = Number.parseInt(query, 10);
    const searchParts = [
      "`action` LIKE ?",
      "`entityType` LIKE ?",
      "`actorName` LIKE ?",
      "`note` LIKE ?"
    ];
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);

    if (Number.isInteger(numericEntityId)) {
      searchParts.push("`entityId` = ?");
      params.push(numericEntityId);
    }

    clauses.push(`(${searchParts.join(" OR ")})`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

export async function recordAuditEvent({
  action,
  entityType,
  entityId = null,
  user = null,
  oldValue = null,
  newValue = null,
  note = null,
  tx = null
}) {
  const client = tx || prisma;

  try {
    await client.$executeRawUnsafe(
      `INSERT INTO \`AuditLog\` (\`action\`, \`entityType\`, \`entityId\`, \`actorId\`, \`actorName\`, \`actorRole\`, \`oldValue\`, \`newValue\`, \`note\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      action,
      entityType,
      entityId,
      user?.id ?? null,
      user?.name ?? null,
      user?.role ?? null,
      toJsonString(oldValue),
      toJsonString(newValue),
      note
    );
  } catch (error) {
    console.warn("Failed to record audit event:", error?.message || error);
  }
}

export async function listAuditLogs(filters = {}) {
  try {
    await cleanupAuditLogRetention(prisma, { suppressErrors: true });
  } catch (error) {
    console.warn("Audit retention cleanup skipped:", error?.message || error);
  }

  await ensureAuditLogTable();

  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 500 });
  const { whereSql, params } = buildAuditWhere(filters);

  const rows = take > 0
    ? await Promise.all([
        prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS total FROM \`AuditLog\` ${whereSql}`,
          ...params
        ),
        prisma.$queryRawUnsafe(
          `SELECT * FROM \`AuditLog\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
          ...params,
          take,
          skip
        )
      ]).then(([countRows, dataRows]) => ({
        total: Number(countRows?.[0]?.total || 0),
        rows: dataRows
      }))
    : {
        total: 0,
        rows: await prisma.$queryRawUnsafe(
          `SELECT * FROM \`AuditLog\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC`,
          ...params
        )
      };

  const items = rows.rows.map(normalizeAuditRow);

  if (!take) {
    return items;
  }

  return {
    items,
    pagination: {
      page,
      limit: take,
      total: rows.total,
      totalPages: Math.max(1, Math.ceil(rows.total / take))
    }
  };
}

export { ensureAuditLogTable, ensureAuditLogBackupTable };
