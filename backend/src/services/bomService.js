import prisma from "../config/prisma.js";
import { invalidateCacheByPrefix } from "../utils/responseCache.js";
import { BOM_LIST_SELECT, BOM_DETAIL_SELECT } from "../utils/selects.js";

function invalidateBomCaches() {
  invalidateCacheByPrefix("bom:");
}

function toItemsData(items) {
  return items.map((item) => ({
    category:   item.category,
    name:       item.name.trim(),
    vendor:     item.vendor || null,
    grade:      item.grade || null,
    qtyPerUnit: Number(item.qty_per_unit),
    remark:     item.remark || null
  }));
}

export async function listBOMs(query = {}) {
  const where = {};
  if (query.q) {
    where.OR = [
      { product: { contains: query.q } },
      { grade: { contains: query.q } }
    ];
  }

  const items = await prisma.billOfMaterial.findMany({
    where,
    select: BOM_LIST_SELECT,
    orderBy: [{ product: "asc" }, { grade: "asc" }]
  });

  return { items };
}

export async function getBOM(id) {
  const bom = await prisma.billOfMaterial.findUnique({
    where: { id },
    select: BOM_DETAIL_SELECT
  });

  if (!bom) {
    const error = new Error("Bill of material not found.");
    error.statusCode = 404;
    throw error;
  }

  return bom;
}

export async function lookupBOM(product, grade) {
  if (!product || !grade) return null;

  return prisma.billOfMaterial.findUnique({
    where: { product_grade: { product, grade } },
    select: BOM_DETAIL_SELECT
  });
}

export async function saveBOM(payload, user) {
  const itemsData = toItemsData(payload.items);

  const bom = await prisma.$transaction(async (tx) => {
    return tx.billOfMaterial.upsert({
      where:  { product_grade: { product: payload.product, grade: payload.grade } },
      create: {
        product: payload.product,
        grade:   payload.grade,
        items: { create: itemsData }
      },
      update: {
        items: { deleteMany: {}, create: itemsData }
      },
      select: { id: true }
    });
  });

  invalidateBomCaches();
  return getBOM(bom.id);
}

export async function deleteBOM(id, user) {
  const bom = await prisma.billOfMaterial.findUnique({ where: { id }, select: { id: true, product: true, grade: true } });
  if (!bom) {
    const error = new Error("Bill of material not found.");
    error.statusCode = 404;
    throw error;
  }

  await prisma.billOfMaterial.delete({ where: { id } });

  invalidateBomCaches();
  return { success: true };
}

export async function importBOMRows(rows, user) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.product}::${row.grade}`;
    if (!grouped.has(key)) {
      grouped.set(key, { product: row.product, grade: row.grade, items: [] });
    }
    grouped.get(key).items.push({
      category:     row.category,
      name:         row.name,
      vendor:       row.vendor,
      grade:        row.material_grade,
      qty_per_unit: row.qty_per_unit,
      remark:       row.remark
    });
  }

  const result = { total: grouped.size, imported: 0, failed: 0, errors: [] };

  for (const entry of grouped.values()) {
    try {
      await saveBOM(entry, user);
      result.imported += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push({ row: `${entry.product} / ${entry.grade}`, message: err.message || "Failed to save" });
    }
  }

  invalidateBomCaches();
  return result;
}
