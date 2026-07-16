import prisma from "../config/prisma.js";
import {
  DEFAULT_MATRIX,
  EDITABLE_ROLES,
  MODULE_KEYS,
  MODULES,
  PERMISSION_LEVELS
} from "../config/permissions.js";

// The matrix is read on every request, so it is cached in memory and only
// reloaded when an admin changes it.
let matrixCache = null;

export function invalidatePermissionCache() {
  matrixCache = null;
}

function emptyMatrix() {
  const matrix = {};
  for (const role of EDITABLE_ROLES) {
    matrix[role] = {};
    for (const key of MODULE_KEYS) matrix[role][key] = "NONE";
  }
  return matrix;
}

function defaultsAsRows() {
  const rows = [];
  for (const role of EDITABLE_ROLES) {
    for (const key of MODULE_KEYS) {
      rows.push({ role, module: key, level: DEFAULT_MATRIX[role]?.[key] || "NONE" });
    }
  }
  return rows;
}

// Seeds any role/module pair that has never been stored. Using createMany with
// skipDuplicates means an admin's existing choices are never overwritten — a
// newly added module simply appears at its default level.
export async function ensurePermissionDefaults() {
  await prisma.rolePermission.createMany({
    data: defaultsAsRows(),
    skipDuplicates: true
  });
  invalidatePermissionCache();
}

export async function getPermissionMatrix() {
  if (matrixCache) return matrixCache;

  const rows = await prisma.rolePermission.findMany({
    select: { role: true, module: true, level: true }
  });

  const matrix = emptyMatrix();
  for (const row of rows) {
    if (!matrix[row.role]) continue; // ignore admin/unknown roles stored by hand
    if (!MODULE_KEYS.includes(row.module)) continue; // ignore retired modules
    matrix[row.role][row.module] = row.level;
  }

  matrixCache = matrix;
  return matrix;
}

// Admin is not in the matrix and always has full access.
export async function getLevelFor(role, moduleKey) {
  if (role === "admin") return "FULL";
  const matrix = await getPermissionMatrix();
  return matrix[role]?.[moduleKey] || "NONE";
}

export async function getPermissionsForRole(role) {
  if (role === "admin") {
    return Object.fromEntries(MODULE_KEYS.map((key) => [key, "FULL"]));
  }
  const matrix = await getPermissionMatrix();
  return matrix[role] || Object.fromEntries(MODULE_KEYS.map((key) => [key, "NONE"]));
}

export async function getPermissionSettings() {
  return {
    modules: MODULES,
    levels: PERMISSION_LEVELS,
    roles: EDITABLE_ROLES,
    matrix: await getPermissionMatrix()
  };
}

export async function updatePermissionMatrix(updates, actorUser) {
  const rows = [];

  for (const [role, modules] of Object.entries(updates || {})) {
    if (!EDITABLE_ROLES.includes(role)) {
      const error = new Error(`Role "${role}" cannot be edited here.`);
      error.statusCode = 400;
      throw error;
    }

    for (const [moduleKey, level] of Object.entries(modules || {})) {
      if (!MODULE_KEYS.includes(moduleKey)) {
        const error = new Error(`Unknown module "${moduleKey}".`);
        error.statusCode = 400;
        throw error;
      }
      if (!PERMISSION_LEVELS.includes(level)) {
        const error = new Error(`Invalid level "${level}" for ${role}/${moduleKey}.`);
        error.statusCode = 400;
        throw error;
      }
      rows.push({ role, module: moduleKey, level });
    }
  }

  if (rows.length === 0) {
    const error = new Error("No permission changes supplied.");
    error.statusCode = 400;
    throw error;
  }

  const before = await getPermissionMatrix();

  // Callback form, not the array form: this codebase routes Prisma through a
  // proxy (utils/prismaClientProxy.js), so pre-built call arrays aren't
  // recognised as Prisma promises by $transaction.
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.rolePermission.upsert({
        where: { role_module: { role: row.role, module: row.module } },
        update: { level: row.level },
        create: row
      });
    }
  });

  invalidatePermissionCache();

  return getPermissionSettings();
}
